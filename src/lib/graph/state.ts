import "server-only";

import type { BaseMessage } from "@langchain/core/messages";
import { Annotation, messagesStateReducer } from "@langchain/langgraph";
import type { EditorMode, HistoryItem } from "@/types";

export type InlineData = {
  data: string;
  mimeType?: string;
};

export type GeneratedInlineImage = {
  data: string;
  mimeType: string;
};

export type GenerationIntent = "create_new" | "edit_existing" | "enhance_prompt";
export type ReviewStatus = "pending" | "passed" | "failed";

const replaceValue = <T>(_: T, value: T) => value;

export const agentState = Annotation.Root({
  sessionId: Annotation<string>({
    reducer: replaceValue,
    default: () => "",
  }),
  messages: Annotation<BaseMessage[]>({
    reducer: messagesStateReducer,
    default: () => [],
  }),
  userId: Annotation<string>({
    reducer: replaceValue,
    default: () => "",
  }),
  requestedMode: Annotation<EditorMode>({
    reducer: replaceValue,
    default: () => "text-to-image",
  }),
  mode: Annotation<EditorMode>({
    reducer: replaceValue,
    default: () => "text-to-image",
  }),
  intent: Annotation<GenerationIntent>({
    reducer: replaceValue,
    default: () => "create_new",
  }),
  shouldOptimizePrompt: Annotation<boolean>({
    reducer: replaceValue,
    default: () => true,
  }),
  originalPrompt: Annotation<string>({
    reducer: replaceValue,
    default: () => "",
  }),
  optimizedPrompt: Annotation<string>({
    reducer: replaceValue,
    default: () => "",
  }),
  sourceImage: Annotation<InlineData | null>({
    reducer: replaceValue,
    default: () => null,
  }),
  generatedImage: Annotation<GeneratedInlineImage | null>({
    reducer: replaceValue,
    default: () => null,
  }),
  generatedText: Annotation<string>({
    reducer: replaceValue,
    default: () => "",
  }),
  reviewStatus: Annotation<ReviewStatus>({
    reducer: replaceValue,
    default: () => "pending",
  }),
  currentImageUrl: Annotation<string>({
    reducer: replaceValue,
    default: () => "",
  }),
  imageRecord: Annotation<HistoryItem | null>({
    reducer: replaceValue,
    default: () => null,
  }),
  errors: Annotation<string[]>({
    reducer: (left, right) => left.concat(right),
    default: () => [],
  }),
  errorCount: Annotation<number>({
    reducer: replaceValue,
    default: () => 0,
  }),
});

export type AgentState = typeof agentState.State;
