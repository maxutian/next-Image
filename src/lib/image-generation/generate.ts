import "server-only";

import { HumanMessage } from "@langchain/core/messages";
import { imageGenerationGraph } from "@/lib/graph/workflow";
import { mapImageRowToHistoryItem } from "@/lib/images";
import {
  getSupabaseMissingEnvMessage,
  isSupabaseConfigured,
} from "@/lib/supabase/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { fileToInlineData } from "@/lib/utils";
import type { EditorMode, GenerateImageState } from "@/types";

type ImageHistoryRow = {
  id: string;
  prompt: string;
  source_prompt: string;
  image_url: string;
  mode: EditorMode;
  session_id?: string | null;
  message_id?: string | null;
  created_at: string;
};

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

async function loadRecentHistory(userId: string) {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("images")
    .select("id, prompt, source_prompt, image_url, mode, session_id, message_id, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(6);

  return ((data || []) as ImageHistoryRow[]).map(mapImageRowToHistoryItem);
}

export async function generateImageFromFormData(
  formData: FormData,
): Promise<GenerateImageState> {
  if (!isSupabaseConfigured()) {
    return {
      status: "error",
      mode: "text-to-image",
      message: getSupabaseMissingEnvMessage(),
      image: null,
      history: [],
    };
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      status: "error",
      mode: "text-to-image",
      message: "请先登录后再生成图片。",
      image: null,
      history: [],
    };
  }

  const history = await loadRecentHistory(user.id);
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
      history,
    };
  }

  if (mode === "image-to-image" && !imageFile) {
    return {
      status: "error",
      mode,
      message: "图生图模式需要先上传一张参考图。",
      image: null,
      history,
    };
  }

  try {
    const inputImage = imageFile ? await fileToInlineData(imageFile) : null;
    const result = await imageGenerationGraph.invoke({
      messages: [new HumanMessage(prompt)],
      userId: user.id,
      requestedMode: mode,
      mode,
      originalPrompt: prompt,
      sourceImage: inputImage,
    });

    if (!result.imageRecord) {
      return {
        status: "error",
        mode,
        message:
          result.errors.at(-1) || "工作流未返回图片结果，请调整提示词后重试。",
        image: null,
        history,
      };
    }

    return {
      status: "success",
      mode: result.mode,
      message: result.generatedText || "生成完成。",
      image: result.imageRecord,
      history: await loadRecentHistory(user.id),
    };
  } catch (error) {
    console.error("generateImageFromFormData failed:", error);

    return {
      status: "error",
      mode,
      message: formatGeminiError(error),
      image: null,
      history,
    };
  }
}

