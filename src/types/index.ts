export type EditorMode = "text-to-image" | "image-to-image";

export type HistoryItem = {
  id: string;
  prompt: string;
  sourcePrompt?: string;
  mode: EditorMode;
  imageUrl: string;
  sessionId?: string;
  messageId?: string;
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

export type AuthMode = "sign-in" | "sign-up";

export type AuthFormState = {
  status: "idle" | "success" | "error";
  mode: AuthMode;
  message: string;
};

export type AuthResult = AuthFormState & {
  redirectTo?: string;
};

export type SignOutResult = {
  message: string;
  redirectTo: string;
};

export const initialAuthFormState: AuthFormState = {
  status: "idle",
  mode: "sign-in",
  message: "请输入邮箱和密码。",
};
