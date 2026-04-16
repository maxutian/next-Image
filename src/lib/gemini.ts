import "server-only";

import type { GenerationIntent } from "@/lib/graph/state";
import type { EditorMode } from "@/types";

// 这里保留 gemini.ts 这个文件名，是为了避免影响上层调用方；
// 当前实际 provider 已经统一切换为 OpenRouter。
const DEFAULT_OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";
const DEFAULT_TEXT_MODEL =
  process.env.OPENROUTER_TEXT_MODEL ||
  process.env.GEMINI_TEXT_MODEL ||
  "moonshotai/kimi-k2";
const DEFAULT_IMAGE_MODEL =
  process.env.OPENROUTER_IMAGE_MODEL ||
  process.env.GEMINI_IMAGE_MODEL ||
  "black-forest-labs/flux.2-klein-4b";
const DEFAULT_EMBEDDING_MODEL =
  process.env.OPENROUTER_EMBEDDING_MODEL ||
  process.env.GEMINI_EMBEDDING_MODEL ||
  "qwen/qwen3-embedding-4b";
const DEFAULT_EMBEDDING_DIMENSION = Number.parseInt(
  process.env.OPENROUTER_EMBEDDING_DIMENSIONS ||
    process.env.GEMINI_EMBEDDING_DIMENSIONS ||
    "768",
  10,
);

type InlineData = {
  data: string;
  mimeType?: string;
};

type OpenRouterChatMessage = {
  role: "user" | "assistant" | "system";
  content?:
    | string
    | Array<
        | {
            type: "text";
            text: string;
          }
        | {
            type: "image_url";
            image_url: {
              url: string;
            };
          }
      >
    | null;
  images?: Array<{
    type?: string;
    image_url?: {
      url?: string;
    };
  }>;
  refusal?: string | null;
  reasoning?: string | null;
};

type OpenRouterChatCompletionResponse = {
  choices?: Array<{
    message?: OpenRouterChatMessage;
  }>;
  error?: {
    message?: string;
  };
};

type OpenRouterEmbeddingsResponse = {
  data?: Array<{
    embedding?: number[];
  }>;
  error?: {
    message?: string;
  };
};

function getOptionalEnv(name: string) {
  const value = process.env[name]?.trim();
  return value ? value : undefined;
}

function getOpenRouterBaseUrl() {
  return getOptionalEnv("OPENROUTER_BASE_URL") || DEFAULT_OPENROUTER_BASE_URL;
}

function getRequiredApiKey() {
  const apiKey =
    process.env.OPENROUTER_API_KEY ||
    process.env.GEMINI_API_KEY ||
    process.env.GOOGLE_API_KEY;

  if (!apiKey) {
    throw new Error("Missing OPENROUTER_API_KEY. Add it to .env.local before generating images.");
  }

  return apiKey;
}

function getRequestHeaders() {
  const headers = new Headers({
    Authorization: `Bearer ${getRequiredApiKey()}`,
    "Content-Type": "application/json",
  });

  const siteUrl = getOptionalEnv("NEXT_PUBLIC_SITE_URL");
  const appName = getOptionalEnv("OPENROUTER_APP_NAME") || "IImage";

  if (siteUrl) {
    headers.set("HTTP-Referer", siteUrl);
  }

  headers.set("X-Title", appName);

  return headers;
}

async function openRouterRequest<T>(path: string, payload: Record<string, unknown>) {
  // 文本分析、图片生成、embedding 都复用这一个请求封装，保证 header、报错格式和鉴权一致。
  const response = await fetch(`${getOpenRouterBaseUrl()}${path}`, {
    method: "POST",
    headers: getRequestHeaders(),
    body: JSON.stringify(payload),
  });

  const rawText = await response.text();
  let parsed: T | null = null;

  if (rawText) {
    try {
      parsed = JSON.parse(rawText) as T;
    } catch {
      parsed = null;
    }
  }

  if (!response.ok) {
    const message =
      (parsed as { error?: { message?: string } } | null)?.error?.message ||
      rawText ||
      `OpenRouter request failed with status ${response.status}`;

    throw new Error(message);
  }

  if (!parsed) {
    throw new Error("OpenRouter returned an empty response.");
  }

  return parsed;
}

function stripCodeFence(text: string) {
  return text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
}

function extractChatText(message: OpenRouterChatMessage | undefined) {
  if (!message?.content) {
    return "";
  }

  if (typeof message.content === "string") {
    return message.content.trim();
  }

  return message.content
    .map((part) => ("text" in part ? part.text : ""))
    .join("\n")
    .trim();
}

function extractImageFromMessage(message: OpenRouterChatMessage | undefined) {
  // OpenRouter 图片模型返回的是 data URL，这里统一拆成业务层需要的 { mimeType, data } 结构。
  const dataUrl = message?.images?.[0]?.image_url?.url;

  if (!dataUrl?.startsWith("data:")) {
    return null;
  }

  const match = /^data:(.+?);base64,(.+)$/i.exec(dataUrl);
  if (!match) {
    return null;
  }

  return {
    mimeType: match[1] || "image/png",
    data: match[2],
  };
}

function extractJsonText(text: string) {
  const normalized = stripCodeFence(text);

  try {
    JSON.parse(normalized);
    return normalized;
  } catch {
    const firstBrace = normalized.indexOf("{");
    const lastBrace = normalized.lastIndexOf("}");

    if (firstBrace >= 0 && lastBrace > firstBrace) {
      return normalized.slice(firstBrace, lastBrace + 1);
    }

    return normalized;
  }
}

function buildTextMessages(prompt: string) {
  return [
    {
      role: "user" as const,
      content: prompt,
    },
  ];
}

export async function analyzeImageRequest({
  prompt,
  requestedMode,
  hasSourceImage,
  sessionContext,
}: {
  prompt: string;
  requestedMode: EditorMode;
  hasSourceImage: boolean;
  sessionContext?: string;
}) {
  const response = await openRouterRequest<OpenRouterChatCompletionResponse>(
    "/chat/completions",
    {
      model: DEFAULT_TEXT_MODEL,
      messages: buildTextMessages(
        [
          "Classify the user's image generation request.",
          "Return strict JSON with keys: intent, mode, shouldOptimizePrompt.",
          "intent must be one of: create_new, edit_existing, enhance_prompt.",
          "mode must be one of: text-to-image, image-to-image.",
          `requestedMode: ${requestedMode}`,
          `hasSourceImage: ${hasSourceImage}`,
          sessionContext
            ? `recentSessionContext:\n${sessionContext}`
            : "recentSessionContext: none",
          `prompt: ${prompt}`,
        ].join("\n"),
      ),
      temperature: 0,
      max_tokens: 200,
    },
  );

  const fallbackMode = hasSourceImage ? "image-to-image" : requestedMode;
  const fallbackIntent = hasSourceImage ? "edit_existing" : "create_new";
  const rawText = extractChatText(response.choices?.[0]?.message);

  if (!rawText) {
    return {
      intent: fallbackIntent,
      mode: fallbackMode,
      shouldOptimizePrompt: true,
    };
  }

  try {
    const parsed = JSON.parse(extractJsonText(rawText)) as {
      intent?: GenerationIntent;
      mode?: EditorMode;
      shouldOptimizePrompt?: boolean;
    };

    return {
      intent: parsed.intent || fallbackIntent,
      mode: hasSourceImage ? "image-to-image" : parsed.mode || fallbackMode,
      shouldOptimizePrompt: parsed.shouldOptimizePrompt ?? true,
    };
  } catch {
    return {
      intent: fallbackIntent,
      mode: fallbackMode,
      shouldOptimizePrompt: true,
    };
  }
}

export async function optimizeImagePrompt({
  prompt,
  intent,
  mode,
  hasSourceImage,
  sessionContext,
}: {
  prompt: string;
  intent: GenerationIntent;
  mode: EditorMode;
  hasSourceImage: boolean;
  sessionContext?: string;
}) {
  const response = await openRouterRequest<OpenRouterChatCompletionResponse>(
    "/chat/completions",
    {
      model: DEFAULT_TEXT_MODEL,
      messages: buildTextMessages(
        [
          "Rewrite the user's request into a production-quality English image prompt.",
          "Keep the visual intent, subject, style, camera, lighting, composition, material, and background details explicit.",
          "If the request is image editing, preserve the existing subject identity and only apply the requested edits.",
          "When recent session context is relevant, preserve continuity with the existing scene, subject identity, and visual attributes.",
          "Do not add safety disclaimers or markdown.",
          `intent: ${intent}`,
          `mode: ${mode}`,
          `hasSourceImage: ${hasSourceImage}`,
          sessionContext
            ? `recentSessionContext:\n${sessionContext}`
            : "recentSessionContext: none",
          `userPrompt: ${prompt}`,
        ].join("\n"),
      ),
      temperature: 0.4,
      max_tokens: 300,
    },
  );

  return extractChatText(response.choices?.[0]?.message) || prompt;
}

export async function generateImageWithGemini({
  prompt,
  sourceImage,
}: {
  prompt: string;
  sourceImage?: InlineData | null;
}) {
  const content = sourceImage
    ? [
        {
          type: "text" as const,
          text: prompt,
        },
        {
          type: "image_url" as const,
          image_url: {
            url: `data:${sourceImage.mimeType || "image/png"};base64,${sourceImage.data}`,
          },
        },
      ]
    : prompt;

  const response = await openRouterRequest<OpenRouterChatCompletionResponse>(
    "/chat/completions",
    {
      model: DEFAULT_IMAGE_MODEL,
      modalities: ["image"],
      messages: [
        {
          role: "user",
          content,
        },
      ],
      max_tokens: 200,
    },
  );

  const message = response.choices?.[0]?.message;
  const image = extractImageFromMessage(message);
  const text = extractChatText(message);

  return {
    image,
    text,
  };
}

export async function generatePromptEmbedding(prompt: string) {
  const response = await openRouterRequest<OpenRouterEmbeddingsResponse>(
    "/embeddings",
    {
      model: DEFAULT_EMBEDDING_MODEL,
      input: prompt,
      dimensions: DEFAULT_EMBEDDING_DIMENSION,
    },
  );

  const embedding = response.data?.[0]?.embedding || null;

  // 数据库列固定是 vector(768)，这里提前兜底，避免把错误维度写入 Postgres。
  if (embedding && embedding.length !== DEFAULT_EMBEDDING_DIMENSION) {
    throw new Error(
      `Embedding dimension mismatch: expected ${DEFAULT_EMBEDDING_DIMENSION}, got ${embedding.length}.`,
    );
  }

  return embedding;
}
