export type EditorMode = "text-to-image" | "image-to-image";

export type HistoryItem = {
  id: string;
  prompt: string;
  mode: EditorMode;
  imageUrl: string;
  createdAt: string;
  note?: string;
};

export type GenerateImageState = {
  status: "idle" | "success" | "error";
  mode: EditorMode;
  message: string;
  image: HistoryItem | null;
  history: HistoryItem[];
};

export const initialGenerateImageState: GenerateImageState = {
  status: "idle",
  mode: "text-to-image",
  message: "输入提示词后即可开始生成。",
  image: null,
  history: [],
};
