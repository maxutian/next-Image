import "server-only";

import { GoogleGenAI, type Part } from "@google/genai";
import type { GenerationIntent } from "@/lib/graph/state";
import type { EditorMode } from "@/types";

const DEFAULT_IMAGE_MODEL =
  process.env.GEMINI_IMAGE_MODEL || "gemini-2.5-flash-image";
const DEFAULT_TEXT_MODEL =
  process.env.GEMINI_TEXT_MODEL || "gemini-1.5-flash";
const DEFAULT_EMBEDDING_MODEL =
  process.env.GEMINI_EMBEDDING_MODEL || "text-embedding-004";
const DEFAULT_EMBEDDING_DIMENSION = 768;

type InlineData = {
  data: string;
  mimeType?: string;
};

function getOptionalEnv(name: string) {
  const value = process.env[name]?.trim();
  return value ? value : undefined;
}

function getRequiredApiKey() {
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;

  if (!apiKey) {
    throw new Error("Missing GEMINI_API_KEY. Add it to .env.local before generating images.");
  }

  return apiKey;
}

let geminiClient: GoogleGenAI | undefined;

function getGeminiClient() {
  if (!geminiClient) {
    const apiVersion = getOptionalEnv("GEMINI_API_VERSION");
    const baseUrl = getOptionalEnv("GEMINI_BASE_URL");

    geminiClient = new GoogleGenAI({
      apiKey: getRequiredApiKey(),
      ...(apiVersion ? { apiVersion } : {}),
      ...(baseUrl
        ? {
            httpOptions: {
              baseUrl,
            },
          }
        : {}),
    });
  }

  return geminiClient;
}

function extractInlineData(parts: Part[] | undefined) {
  for (const part of parts || []) {
    if (part.inlineData?.data) {
      return {
        data: part.inlineData.data,
        mimeType: part.inlineData.mimeType || "image/png",
      };
    }
  }

  return null;
}

function extractText(parts: Part[] | undefined) {
  for (const part of parts || []) {
    if (typeof part.text === "string" && part.text.trim()) {
      return part.text.trim();
    }
  }

  return "";
}

function stripCodeFence(text: string) {
  return text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
}

export async function analyzeImageRequest({
  prompt,
  requestedMode,
  hasSourceImage,
}: {
  prompt: string;
  requestedMode: EditorMode;
  hasSourceImage: boolean;
}) {
  const ai = getGeminiClient();
  const response = await ai.models.generateContent({
    model: DEFAULT_TEXT_MODEL,
    contents: [
      {
        role: "user",
        parts: [
          {
            text: [
              "Classify the user's image generation request.",
              "Return strict JSON with keys: intent, mode, shouldOptimizePrompt.",
              "intent must be one of: create_new, edit_existing, enhance_prompt.",
              "mode must be one of: text-to-image, image-to-image.",
              `requestedMode: ${requestedMode}`,
              `hasSourceImage: ${hasSourceImage}`,
              `prompt: ${prompt}`,
            ].join("\n"),
          },
        ],
      },
    ],
    config: {
      temperature: 0,
      responseMimeType: "application/json",
      responseSchema: {
        type: "OBJECT",
        required: ["intent", "mode", "shouldOptimizePrompt"],
        properties: {
          intent: {
            type: "STRING",
            enum: ["create_new", "edit_existing", "enhance_prompt"],
          },
          mode: {
            type: "STRING",
            enum: ["text-to-image", "image-to-image"],
          },
          shouldOptimizePrompt: {
            type: "BOOLEAN",
          },
        },
      },
    },
  });

  const fallbackMode = hasSourceImage ? "image-to-image" : requestedMode;
  const fallbackIntent = hasSourceImage ? "edit_existing" : "create_new";
  const rawText = response.text ? stripCodeFence(response.text) : "";

  if (!rawText) {
    return {
      intent: fallbackIntent,
      mode: fallbackMode,
      shouldOptimizePrompt: true,
    };
  }

  try {
    const parsed = JSON.parse(rawText) as {
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
}: {
  prompt: string;
  intent: GenerationIntent;
  mode: EditorMode;
  hasSourceImage: boolean;
}) {
  const ai = getGeminiClient();
  const response = await ai.models.generateContent({
    model: DEFAULT_TEXT_MODEL,
    contents: [
      {
        role: "user",
        parts: [
          {
            text: [
              "Rewrite the user's request into a production-quality English image prompt.",
              "Keep the visual intent, subject, style, camera, lighting, composition, material, and background details explicit.",
              "If the request is image editing, preserve the existing subject identity and only apply the requested edits.",
              "Do not add safety disclaimers or markdown.",
              `intent: ${intent}`,
              `mode: ${mode}`,
              `hasSourceImage: ${hasSourceImage}`,
              `userPrompt: ${prompt}`,
            ].join("\n"),
          },
        ],
      },
    ],
    config: {
      temperature: 0.4,
      maxOutputTokens: 300,
    },
  });

  return (response.text || prompt).trim();
}

export async function generateImageWithGemini({
  prompt,
  sourceImage,
}: {
  prompt: string;
  sourceImage?: InlineData | null;
}) {
  const ai = getGeminiClient();
  const parts: Part[] = [{ text: prompt }];

  if (sourceImage) {
    parts.unshift({
      inlineData: {
        data: sourceImage.data,
        mimeType: sourceImage.mimeType || "image/png",
      },
    });
  }

  const response = await ai.models.generateContent({
    model: DEFAULT_IMAGE_MODEL,
    contents: [{ role: "user", parts }],
    config: {
      responseModalities: ["TEXT", "IMAGE"],
    },
  });

  const partsFromResponse = response.candidates?.flatMap(
    (candidate) => candidate.content?.parts || [],
  );
  const image = extractInlineData(partsFromResponse);
  const text = extractText(partsFromResponse);

  return {
    image,
    text,
  };
}

export async function generatePromptEmbedding(prompt: string) {
  const ai = getGeminiClient();
  const response = await ai.models.embedContent({
    model: DEFAULT_EMBEDDING_MODEL,
    contents: [prompt],
    config: {
      outputDimensionality: DEFAULT_EMBEDDING_DIMENSION,
    },
  });

  return response.embeddings?.[0]?.values || null;
}
