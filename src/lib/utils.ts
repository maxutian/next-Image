import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export async function fileToInlineData(file: File) {
  const buffer = await file.arrayBuffer();

  return {
    data: Buffer.from(buffer).toString("base64"),
    mimeType: file.type || "image/png",
  };
}

export function inlineDataToDataUrl(inlineData: {
  data: string;
  mimeType?: string;
  mime_type?: string;
}) {
  const mimeType = inlineData.mimeType || inlineData.mime_type || "image/png";
  return `data:${mimeType};base64,${inlineData.data}`;
}
