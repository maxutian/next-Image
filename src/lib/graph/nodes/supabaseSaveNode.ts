import "server-only";

import { generatePromptEmbedding } from "@/lib/gemini";
import { getImageFileExtension, toPgVector } from "@/lib/images";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { AgentState } from "@/lib/graph/state";
import type { EditorMode } from "@/types";

const IMAGES_BUCKET = process.env.SUPABASE_IMAGES_BUCKET || "images";

type InsertedImageRow = {
  id: string;
  prompt: string;
  source_prompt: string;
  image_url: string;
  mode: EditorMode;
  session_id: string | null;
  message_id: string | null;
  created_at: string;
};

function createStoragePath(userId: string, imageId: string, mimeType: string) {
  const extension = getImageFileExtension(mimeType);
  const date = new Date().toISOString().slice(0, 10);
  return `${userId}/${date}/${imageId}.${extension}`;
}

export async function supabaseSaveNode(state: AgentState) {
  if (!state.userId) {
    throw new Error("缺少用户上下文，无法保存图片。");
  }

  if (!state.generatedImage?.data || !state.generatedImage.mimeType) {
    throw new Error("缺少生成图片数据，无法保存图片。");
  }

  const supabase = await createSupabaseServerClient();
  const imageId = crypto.randomUUID();
  const storagePath = createStoragePath(
    state.userId,
    imageId,
    state.generatedImage.mimeType,
  );
  const imageBuffer = Buffer.from(state.generatedImage.data, "base64");
  const { error: uploadError } = await supabase.storage
    .from(IMAGES_BUCKET)
    .upload(storagePath, imageBuffer, {
      cacheControl: "31536000",
      contentType: state.generatedImage.mimeType,
      upsert: false,
    });

  if (uploadError) {
    throw new Error(`上传图片到 Supabase Storage 失败: ${uploadError.message}`);
  }

  const { data: publicUrlData } = supabase.storage
    .from(IMAGES_BUCKET)
    .getPublicUrl(storagePath);
  const publicUrl = publicUrlData.publicUrl;

  if (!publicUrl) {
    throw new Error("未能从 Supabase Storage 获取图片地址。");
  }

  let embeddingVector: string | null = null;

  try {
    // embedding 是增强检索能力的附加信息，不应该因为它失败而阻塞整张图保存。
    const embedding = await generatePromptEmbedding(
      state.optimizedPrompt || state.originalPrompt,
    );
    embeddingVector = toPgVector(embedding);
  } catch (error) {
    console.warn("generatePromptEmbedding failed:", error);
  }

  const persistedPrompt = state.optimizedPrompt || state.originalPrompt;
  // 这里先保存“图片主记录”；会话消息和 message_images 关系由 chat 层在工作流返回后补齐。
  const { data: insertedRow, error: insertError } = await supabase
    .from("images")
    .insert({
      id: imageId,
      user_id: state.userId,
      source_prompt: state.originalPrompt,
      prompt: persistedPrompt,
      image_url: publicUrl,
      mode: state.mode,
      session_id: state.sessionId || null,
      message_id: null,
      embedding: embeddingVector,
    })
    .select("id, prompt, source_prompt, image_url, mode, session_id, message_id, created_at")
    .single<InsertedImageRow>();

  if (insertError || !insertedRow) {
    throw new Error(insertError?.message || "保存图片记录失败。");
  }

  return {
    currentImageUrl: publicUrl,
    imageRecord: {
      id: insertedRow.id,
      prompt: insertedRow.prompt,
      sourcePrompt: insertedRow.source_prompt,
      mode: insertedRow.mode,
      imageUrl: insertedRow.image_url,
      sessionId: insertedRow.session_id || undefined,
      messageId: insertedRow.message_id || undefined,
      createdAt: insertedRow.created_at,
      note: state.generatedText || undefined,
    },
  };
}
