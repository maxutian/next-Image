import type { HistoryItem } from "@/types";

export type ChatSession = {
  id: string;
  title?: string | null;
  lastImageId?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ChatMessage = {
  id: string;
  sessionId: string;
  role: "user" | "assistant" | "system";
  text: string;
  status: "pending" | "success" | "error";
  intent?: string | null;
  createdAt: string;
  images?: HistoryItem[];
};

export type ChatTurnState = {
  status: "idle" | "pending" | "success" | "error";
  sessionId: string;
  messages: ChatMessage[];
  activeImage?: HistoryItem | null;
  activeImages?: HistoryItem[];
  error?: string;
};
