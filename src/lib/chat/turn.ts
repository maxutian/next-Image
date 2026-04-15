import "server-only";

import { HumanMessage } from "@langchain/core/messages";
import { imageGenerationGraph } from "@/lib/graph/workflow";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { fileToInlineData } from "@/lib/utils";
import type { ChatMessage, ChatTurnState } from "@/types/chat";
import type { HistoryItem } from "@/types";

async function ensureSession(userId: string, sessionId?: string | null) {
  const supabase = await createSupabaseServerClient();
  if (sessionId) {
    const { data } = await supabase
      .from("chat_sessions")
      .select("id, title, last_image_id, created_at, updated_at")
      .eq("id", sessionId)
      .single();
    if (data) {
      return {
        id: data.id,
        title: data.title,
        lastImageId: data.last_image_id || null,
        createdAt: data.created_at,
        updatedAt: data.updated_at,
      };
    }
  }

  const { data, error } = await supabase
    .from("chat_sessions")
    .insert({ user_id: userId, title: "新会话" })
    .select("id, title, last_image_id, created_at, updated_at")
    .single();

  if (error || !data) {
    throw new Error("创建会话失败");
  }

  return {
    id: data.id,
    title: data.title,
    lastImageId: data.last_image_id || null,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };
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

function buildChatState(
  sessionId: string,
  status: ChatTurnState["status"],
  messages: ChatMessage[],
  error?: string,
): ChatTurnState {
  const activeImages = messages.flatMap((message) => message.images || []);
  const activeImage = activeImages.at(-1) || null;

  return {
    status,
    sessionId,
    messages,
    activeImage,
    activeImages,
    error,
  };
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
  const messages = await fetchSessionMessages(session.id);
  return buildChatState(session.id, "idle", messages);
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
      messages: [],
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

  if (!message && files.length === 0) {
    return {
      status: "error",
      sessionId: sessionId || "",
      messages: [],
      error: "请输入内容或上传图片。",
    };
  }

  const session = await ensureSession(user.id, sessionId);
  await insertMessage({
    sessionId: session.id,
    userId: user.id,
    role: "user",
    text: message,
    status: "success",
  });

  const firstFile = files[0];
  const inlineImage = firstFile ? await fileToInlineData(firstFile) : null;

  try {
    const result = await imageGenerationGraph.invoke({
      sessionId: session.id,
      userId: user.id,
      messages: [new HumanMessage(message)],
      requestedMode: inlineImage ? "image-to-image" : "text-to-image",
      mode: inlineImage ? "image-to-image" : "text-to-image",
      originalPrompt: message,
      sourceImage: inlineImage,
      shouldOptimizePrompt: true,
    });

    if (!result.imageRecord) {
      const messages = await fetchSessionMessages(session.id);
      return {
        ...buildChatState(
          session.id,
          "error",
          messages,
          result.errors.at(-1) || "未生成图片，请重试。",
        ),
      };
    }

    await supabase
      .from("images")
      .update({ session_id: session.id })
      .eq("id", result.imageRecord.id);

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

    await supabase
      .from("chat_sessions")
      .update({
        last_image_id: result.imageRecord.id,
        updated_at: new Date().toISOString(),
      })
      .eq("id", session.id);

    const messages = await fetchSessionMessages(session.id);
    return buildChatState(session.id, "success", messages);
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

    const messages = await fetchSessionMessages(session.id);
    return buildChatState(session.id, "error", messages, errMsg);
  }
}
