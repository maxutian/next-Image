import "server-only";

import { HumanMessage } from "@langchain/core/messages";
import { imageGenerationGraph } from "@/lib/graph/workflow";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { fileToInlineData } from "@/lib/utils";
import type { ChatMessage, ChatSession, ChatTurnState } from "@/types/chat";
import type { HistoryItem } from "@/types";

const DEFAULT_SESSION_TITLE = "新会话";
const SESSION_CONTEXT_MESSAGE_LIMIT = 6;
const FOLLOW_UP_EDIT_PATTERN =
  /上一张|上个|刚才|继续|修改|调整|改成|换成|保留|在此基础上|基于|这张|这幅|这个图|同一|再来|优化|细化|局部|背景|颜色|make it|change|adjust|update|keep/i;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type DbSessionRow = {
  id: string;
  title: string | null;
  last_image_id: string | null;
  created_at: string;
  updated_at: string;
};

type DbImage = {
  id: string;
  prompt: string;
  source_prompt?: string;
  image_url: string;
  mode: string;
  session_id?: string | null;
  message_id?: string | null;
  created_at: string;
};

type DbMessageRow = {
  id: string;
  session_id: string;
  role: "user" | "assistant" | "system";
  text: string;
  status: "pending" | "success" | "error";
  intent?: string | null;
  created_at: string;
};

function isUuid(value: string | null | undefined) {
  return Boolean(value && UUID_PATTERN.test(value));
}

function mapDbSession(row: DbSessionRow): ChatSession {
  return {
    id: row.id,
    title: row.title,
    lastImageId: row.last_image_id || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapDbImage(row: DbImage): HistoryItem {
  return {
    id: row.id,
    prompt: row.prompt,
    sourcePrompt: row.source_prompt,
    mode: row.mode as HistoryItem["mode"],
    imageUrl: row.image_url,
    sessionId: row.session_id || undefined,
    messageId: row.message_id || undefined,
    createdAt: row.created_at,
  };
}

function mapDbMessage(
  row: DbMessageRow,
  imagesByMessageId: Map<string, HistoryItem[]>,
): ChatMessage {
  return {
    id: row.id,
    sessionId: row.session_id,
    role: row.role,
    text: row.text,
    status: row.status,
    intent: row.intent,
    createdAt: row.created_at,
    images: imagesByMessageId.get(row.id) || [],
  };
}

async function createSession(userId: string) {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("chat_sessions")
    .insert({ user_id: userId, title: DEFAULT_SESSION_TITLE })
    .select("id, title, last_image_id, created_at, updated_at")
    .single<DbSessionRow>();

  if (error || !data) {
    throw new Error("创建会话失败");
  }

  return mapDbSession(data);
}

async function ensureSession(userId: string, sessionId?: string | null) {
  const supabase = await createSupabaseServerClient();

  // 优先使用显式传入的 sessionId；如果它无效或不属于当前用户，再回退到最近会话。
  if (isUuid(sessionId)) {
    const { data } = await supabase
      .from("chat_sessions")
      .select("id, title, last_image_id, created_at, updated_at")
      .eq("id", sessionId)
      .eq("user_id", userId)
      .single<DbSessionRow>();

    if (data) {
      return mapDbSession(data);
    }
  }

  const { data: latestSession } = await supabase
    .from("chat_sessions")
    .select("id, title, last_image_id, created_at, updated_at")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle<DbSessionRow>();

  if (latestSession) {
    return mapDbSession(latestSession);
  }

  return createSession(userId);
}

async function listUserSessions(userId: string): Promise<ChatSession[]> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("chat_sessions")
    .select("id, title, last_image_id, created_at, updated_at")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });

  return (data || []).map((row) => mapDbSession(row as DbSessionRow));
}

async function updateSessionMetadata(
  sessionId: string,
  patch: {
    title?: string;
    lastImageId?: string | null;
    updatedAt?: string;
  },
) {
  const supabase = await createSupabaseServerClient();
  const payload: Record<string, string | null> = {
    updated_at: patch.updatedAt || new Date().toISOString(),
  };

  if (patch.title !== undefined) {
    payload.title = patch.title;
  }

  if (patch.lastImageId !== undefined) {
    payload.last_image_id = patch.lastImageId;
  }

  await supabase.from("chat_sessions").update(payload).eq("id", sessionId).throwOnError();
}

async function insertMessage({
  sessionId,
  userId,
  role,
  text,
  status = "success",
  intent,
}: {
  sessionId: string;
  userId?: string;
  role: "user" | "assistant" | "system";
  text: string;
  status?: "pending" | "success" | "error";
  intent?: string | null;
}) {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("chat_messages")
    .insert({
      session_id: sessionId,
      user_id: userId,
      role,
      text,
      status,
      intent,
    })
    .select("id, session_id, role, text, status, intent, created_at")
    .single();

  if (error || !data) {
    throw new Error("保存消息失败");
  }

  return {
    id: data.id,
    sessionId: data.session_id,
    role: data.role,
    text: data.text,
    status: data.status,
    intent: data.intent,
    createdAt: data.created_at,
    images: [],
  };
}

async function linkMessageImages(
  messageId: string,
  images: HistoryItem[],
  kind: "input_reference" | "generated_result" | "selected_context",
) {
  if (!images.length) return;

  const supabase = await createSupabaseServerClient();
  const payload = images.map((img) => ({
    message_id: messageId,
    image_id: img.id,
    kind,
  }));

  await supabase.from("message_images").insert(payload).throwOnError();
}

async function fetchSessionMessages(sessionId: string): Promise<ChatMessage[]> {
  const supabase = await createSupabaseServerClient();
  const { data: messagesRows } = await supabase
    .from("chat_messages")
    .select("id, session_id, role, text, status, intent, created_at")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: true });

  const messageIds = (messagesRows || []).map((row) => row.id);
  const imagesByMessageId = new Map<string, HistoryItem[]>();

  if (messageIds.length) {
    const { data: imageRows } = await supabase
      .from("images")
      .select("id, prompt, source_prompt, image_url, mode, session_id, message_id, created_at")
      .in("message_id", messageIds)
      .order("created_at", { ascending: true });

    for (const row of imageRows || []) {
      if (!row.message_id) continue;
      const mapped = mapDbImage(row as DbImage);
      const bucket = imagesByMessageId.get(row.message_id) || [];
      bucket.push(mapped);
      imagesByMessageId.set(row.message_id, bucket);
    }
  }

  return (messagesRows || []).map((row: DbMessageRow) =>
    mapDbMessage(row, imagesByMessageId),
  );
}

function getLatestSessionImage(messages: ChatMessage[]) {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const candidate = messages[index]?.images?.at(-1);
    if (candidate) {
      return candidate;
    }
  }

  return null;
}

function normalizeContextSnippet(value: string, maxLength = 220) {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (!normalized) {
    return "";
  }

  return normalized.length > maxLength
    ? `${normalized.slice(0, maxLength - 1).trimEnd()}…`
    : normalized;
}

function buildSessionContext(messages: ChatMessage[]) {
  const recentMessages = messages.slice(-SESSION_CONTEXT_MESSAGE_LIMIT);
  const lines: string[] = [];

  // 这里只抽取最近几轮的文本和图片 prompt，用于保持同会话连续性，避免把完整历史都塞给模型。
  for (const message of recentMessages) {
    const roleLabel =
      message.role === "assistant"
        ? "assistant"
        : message.role === "system"
          ? "system"
          : "user";
    const text = normalizeContextSnippet(message.text);

    if (text) {
      lines.push(`${roleLabel}: ${text}`);
    }

    if (message.images?.length) {
      const prompts = message.images
        .map((image) => normalizeContextSnippet(image.prompt, 160))
        .filter(Boolean)
        .join(" | ");

      if (prompts) {
        lines.push(`${roleLabel}_images: ${prompts}`);
      }
    }
  }

  if (!lines.length) {
    return "";
  }

  return [
    "Recent same-session context. Use it only when it helps keep continuity with the ongoing request.",
    ...lines,
  ].join("\n");
}

function shouldReuseLatestSessionImage(
  message: string,
  latestSessionImage: HistoryItem | null,
) {
  return Boolean(
    latestSessionImage &&
      message &&
      FOLLOW_UP_EDIT_PATTERN.test(message),
  );
}

async function fetchImageAsInlineData(imageUrl: string) {
  const response = await fetch(imageUrl);

  if (!response.ok) {
    throw new Error(`读取会话参考图失败: ${response.status}`);
  }

  const arrayBuffer = await response.arrayBuffer();

  return {
    data: Buffer.from(arrayBuffer).toString("base64"),
    mimeType: response.headers.get("content-type") || "image/png",
  };
}

function deriveSessionTitle(message: string) {
  const normalized = normalizeContextSnippet(message, 28);
  return normalized || DEFAULT_SESSION_TITLE;
}

function buildChatState({
  sessionId,
  status,
  sessions,
  messages,
  error,
}: {
  sessionId: string;
  status: ChatTurnState["status"];
  sessions: ChatSession[];
  messages: ChatMessage[];
  error?: string;
}): ChatTurnState {
  const activeImages = messages.flatMap((message) => message.images || []);
  const activeImage = activeImages.at(-1) || null;
  const currentSession =
    sessions.find((session) => session.id === sessionId) || null;

  return {
    status,
    sessionId,
    currentSession,
    sessions,
    messages,
    activeImage,
    activeImages,
    error,
  };
}

async function hydrateChatState(
  userId: string,
  sessionId: string,
  status: ChatTurnState["status"],
  error?: string,
) {
  const [messages, sessions] = await Promise.all([
    fetchSessionMessages(sessionId),
    listUserSessions(userId),
  ]);

  return buildChatState({
    sessionId,
    status,
    sessions,
    messages,
    error,
  });
}

export async function loadSessionWithMessages(
  sessionId?: string | null,
): Promise<ChatTurnState> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("未登录");
  }

  const session = await ensureSession(user.id, sessionId);
  return hydrateChatState(user.id, session.id, "idle");
}

export async function createChatSession(): Promise<ChatTurnState> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("未登录");
  }

  const session = await createSession(user.id);
  return hydrateChatState(user.id, session.id, "idle");
}

export async function processChatTurn(formData: FormData): Promise<ChatTurnState> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      status: "error",
      sessionId: "",
      currentSession: null,
      sessions: [],
      messages: [],
      activeImage: null,
      activeImages: [],
      error: "请先登录后再对话。",
    };
  }

  const sessionId = (formData.get("sessionId") as string) || undefined;
  const message = String(formData.get("message") || "").trim();
  const files = formData
    .getAll("attachments")
    .filter(
      (item): item is File =>
        item instanceof File && item.size > 0 && item.name.trim().length > 0,
    );

  const session = await ensureSession(user.id, sessionId);

  if (!message && files.length === 0) {
    return hydrateChatState(user.id, session.id, "error", "请输入内容或上传图片。");
  }

  // 先读取历史消息，后面会同时用于“文本上下文记忆”和“自动复用上一张结果图”。
  const priorMessages = await fetchSessionMessages(session.id);
  const latestSessionImage = getLatestSessionImage(priorMessages);
  const firstFile = files[0];
  const uploadedInlineImage = firstFile ? await fileToInlineData(firstFile) : null;
  const shouldReuseImage = shouldReuseLatestSessionImage(message, latestSessionImage);
  let sourceImage = uploadedInlineImage;

  // 用户没传参考图，但语义上像是在“继续改上一张图”时，自动把最近结果图当作 source image。
  if (!sourceImage && shouldReuseImage && latestSessionImage) {
    try {
      sourceImage = await fetchImageAsInlineData(latestSessionImage.imageUrl);
    } catch (error) {
      console.warn("Failed to load latest session image context", error);
    }
  }

  const userMessage = await insertMessage({
    sessionId: session.id,
    userId: user.id,
    role: "user",
    text: message,
    status: "success",
  });

  if (shouldReuseImage && latestSessionImage) {
    await linkMessageImages(userMessage.id, [latestSessionImage], "selected_context");
  }

  await updateSessionMetadata(session.id, {
    title:
      priorMessages.length === 0 || !session.title || session.title === DEFAULT_SESSION_TITLE
        ? deriveSessionTitle(message)
        : undefined,
  });

  try {
    const result = await imageGenerationGraph.invoke({
      sessionId: session.id,
      userId: user.id,
      messages: [new HumanMessage(message)],
      requestedMode: sourceImage ? "image-to-image" : "text-to-image",
      mode: sourceImage ? "image-to-image" : "text-to-image",
      originalPrompt: message,
      sessionContext: buildSessionContext(priorMessages),
      sourceImage,
      shouldOptimizePrompt: true,
    });

    if (!result.imageRecord) {
      return hydrateChatState(
        user.id,
        session.id,
        "error",
        result.errors.at(-1) || "未生成图片，请重试。",
      );
    }

    await supabase
      .from("images")
      .update({ session_id: session.id })
      .eq("id", result.imageRecord.id);

    // 工作流节点只负责把图片存进 images；聊天层在这里补齐 assistant 消息和消息-图片关系。
    const assistantMsg = await insertMessage({
      sessionId: session.id,
      userId: user.id,
      role: "assistant",
      text: result.generatedText || "生成完成",
      status: "success",
    });

    await linkMessageImages(assistantMsg.id, [result.imageRecord], "generated_result");

    await supabase
      .from("images")
      .update({ message_id: assistantMsg.id })
      .eq("id", result.imageRecord.id);

    await updateSessionMetadata(session.id, {
      lastImageId: result.imageRecord.id,
    });

    return hydrateChatState(user.id, session.id, "success");
  } catch (error) {
    console.error("processChatTurn failed", error);
    const errMsg = error instanceof Error ? error.message : "生成失败";

    await insertMessage({
      sessionId: session.id,
      userId: user.id,
      role: "assistant",
      text: errMsg,
      status: "error",
    });

    await updateSessionMetadata(session.id, {});

    return hydrateChatState(user.id, session.id, "error", errMsg);
  }
}
