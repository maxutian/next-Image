import "server-only";

import type { BaseMessage } from "@langchain/core/messages";
import { Annotation, messagesStateReducer } from "@langchain/langgraph";
import type { EditorMode, HistoryItem } from "@/types";

// 上传参考图或从历史记录回填时，统一使用这份内联图片结构。
export type InlineData = {
  data: string;
  mimeType?: string;
};

// 图片模型返回的原始结果，后续还会经过 review 和持久化。
export type GeneratedInlineImage = {
  data: string;
  mimeType: string;
};

// analyzer 节点产出的业务意图，用来决定后续 prompt 优化和生成路径。
export type GenerationIntent = "create_new" | "edit_existing" | "enhance_prompt";
export type ReviewStatus = "pending" | "passed" | "failed";

// 大多数字段只需要“最后一次写入”的值，所以默认直接覆盖旧值。
const replaceValue = <T>(_: T, value: T) => value;

// 这份 state 是整条 LangGraph 工作流共享的单一状态源。
// 各节点读取它、返回局部更新，再由 reducer 合并回去。
export const agentState = Annotation.Root({
  // 会话与用户上下文：用于把生成结果重新挂回正确的聊天会话。
  sessionId: Annotation<string>({
    reducer: replaceValue,
    default: () => "",
  }),
  // LangGraph 的消息轨迹会在多个节点间持续追加，因此使用专门的消息 reducer。
  messages: Annotation<BaseMessage[]>({
    reducer: messagesStateReducer,
    default: () => [],
  }),
  userId: Annotation<string>({
    reducer: replaceValue,
    default: () => "",
  }),
  // requestedMode 是入口推断的初始模式；mode 是 analyzer 最终确认后的执行模式。
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
  // originalPrompt 保留用户原话，sessionContext 注入最近同会话上下文，
  // optimizedPrompt 则是给图片模型使用的最终 prompt。
  originalPrompt: Annotation<string>({
    reducer: replaceValue,
    default: () => "",
  }),
  sessionContext: Annotation<string>({
    reducer: replaceValue,
    default: () => "",
  }),
  optimizedPrompt: Annotation<string>({
    reducer: replaceValue,
    default: () => "",
  }),
  // sourceImage 是图生图输入；generatedImage 是模型生成出的原始图片结果。
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
  // review/save 阶段会继续填充最终审核状态、可访问 URL 和数据库记录。
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
  // 错误需要在多个节点间累计，方便最终定位是哪一步失败。
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
