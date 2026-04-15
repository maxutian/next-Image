import "server-only";

import { generateImageWithGemini } from "@/lib/gemini";
import type { AgentState } from "@/lib/graph/state";

export async function generateImageNode(state: AgentState) {
  const prompt = state.optimizedPrompt || state.originalPrompt;
  const { image, text } = await generateImageWithGemini({
    prompt,
    sourceImage: state.sourceImage,
  });

  if (!image?.data || !image.mimeType) {
    throw new Error(text || "模型没有返回图片结果，请调整提示词后重试。");
  }

  return {
    generatedImage: {
      data: image.data,
      mimeType: image.mimeType,
    },
    generatedText: text || "",
  };
}
