import "server-only";

import type { HistoryItem } from "@/types";

type ImageRow = {
  id: string;
  prompt: string;
  source_prompt?: string;
  image_url: string;
  mode: "text-to-image" | "image-to-image";
  session_id?: string | null;
  message_id?: string | null;
  created_at: string;
};

export function mapImageRowToHistoryItem(row: ImageRow): HistoryItem {
  return {
    id: row.id,
    prompt: row.prompt,
    sourcePrompt: row.source_prompt,
    imageUrl: row.image_url,
    mode: row.mode,
    sessionId: row.session_id || undefined,
    messageId: row.message_id || undefined,
    createdAt: row.created_at,
  };
}

export function toPgVector(values: number[] | null) {
  if (!values?.length) {
    return null;
  }

  return `[${values.join(",")}]`;
}

export function getImageFileExtension(mimeType: string) {
  switch (mimeType) {
    case "image/jpeg":
      return "jpg";
    case "image/webp":
      return "webp";
    default:
      return "png";
  }
}
