"use server";

import { generateContentWithGeminiGateway } from "@/lib/gemini";
import { fileToInlineData, inlineDataToDataUrl } from "@/lib/utils";
import type { EditorMode, GenerateImageState } from "@/types";

const DEFAULT_IMAGE_MODEL =
  process.env.GEMINI_IMAGE_MODEL || "gemini-2.5-flash-image";

function extractGeneratedImage(response: unknown) {
  const candidates = (response as { candidates?: Array<{ content?: { parts?: Array<Record<string, unknown>> } }> })
    .candidates;

  for (const candidate of candidates || []) {
    for (const part of candidate.content?.parts || []) {
      const inlineData = part.inlineData as
        | { data?: string; mimeType?: string; mime_type?: string }
        | undefined;

      if (inlineData?.data) {
        return inlineData;
      }
    }
  }

  return null;
}

function extractTextMessage(response: unknown) {
  const candidates = (response as { candidates?: Array<{ content?: { parts?: Array<Record<string, unknown>> } }> })
    .candidates;

  for (const candidate of candidates || []) {
    for (const part of candidate.content?.parts || []) {
      if (typeof part.text === "string" && part.text.trim()) {
        return part.text.trim();
      }
    }
  }

  return "";
}

function formatGeminiError(error: unknown) {
  if (!(error instanceof Error)) {
    return "生成失败，请检查服务端日志。";
  }

  const cause = error.cause as
    | { code?: string; message?: string; errno?: string | number }
    | undefined;
  const details = [error.message, cause?.code, cause?.message]
    .filter(Boolean)
    .join(" | ");

  if (error.message === "fetch failed") {
    return [
      "请求 Gemini 接口失败。",
      "如果你当前走的是第三方中转站，请检查网关地址、API Key 和网络连通性。",
      details ? `底层信息: ${details}` : null,
    ]
      .filter(Boolean)
      .join(" ");
  }

  return details || "生成失败，请检查服务端日志。";
}

export async function generateImageAction(
  previousState: GenerateImageState,
  formData: FormData,
): Promise<GenerateImageState> {
  const mode = (formData.get("mode") as EditorMode) || "text-to-image";
  const prompt = String(formData.get("prompt") || "").trim();
  const sourceImage = formData.get("sourceImage");
  const imageFile =
    sourceImage instanceof File && sourceImage.size > 0 ? sourceImage : null;

  if (!prompt) {
    return {
      status: "error",
      mode,
      message: "请输入提示词。",
      image: null,
      history: previousState.history,
    };
  }

  if (mode === "image-to-image" && !imageFile) {
    return {
      status: "error",
      mode,
      message: "图生图模式需要先上传一张参考图。",
      image: null,
      history: previousState.history,
    };
  }

  try {
    const parts: Array<Record<string, unknown>> = [{ text: prompt }];

    if (imageFile) {
      const inlineData = await fileToInlineData(imageFile);
      parts.unshift({
        inlineData: {
          data: inlineData.data,
          mimeType: inlineData.mimeType,
        },
      });
    }

    const response = await generateContentWithGeminiGateway(DEFAULT_IMAGE_MODEL, {
      contents: [{ role: "user", parts }],
      config: {
        responseModalities: ["IMAGE", "TEXT"],
      },
    });

    const generatedImage = extractGeneratedImage(response);
    const fallbackMessage = extractTextMessage(response);

    if (!generatedImage?.data) {
      return {
        status: "error",
        mode,
        message: fallbackMessage || "模型没有返回图片结果，请调整提示词后重试。",
        image: null,
        history: previousState.history,
      };
    }

    const image = {
      id: crypto.randomUUID(),
      prompt,
      mode,
      imageUrl: inlineDataToDataUrl({
        data: generatedImage.data,
        mimeType: generatedImage.mimeType,
        mime_type: generatedImage.mime_type,
      }),
      createdAt: new Date().toISOString(),
      note: fallbackMessage || undefined,
    };

    return {
      status: "success",
      mode,
      message: fallbackMessage || "生成完成。",
      image,
      history: [image, ...previousState.history].slice(0, 6),
    };
  } catch (error) {
    console.error("generateImageAction failed:", error);
    const message = formatGeminiError(error);

    return {
      status: "error",
      mode,
      message,
      image: null,
      history: previousState.history,
    };
  }
}
