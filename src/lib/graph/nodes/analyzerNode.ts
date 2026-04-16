import "server-only";

import { AIMessage } from "@langchain/core/messages";
import { analyzeImageRequest } from "@/lib/gemini";
import type { AgentState } from "@/lib/graph/state";

export async function analyzerNode(state: AgentState) {
  try {
    const analysis = await analyzeImageRequest({
      prompt: state.originalPrompt,
      requestedMode: state.requestedMode,
      hasSourceImage: Boolean(state.sourceImage),
      sessionContext: state.sessionContext,
    });

    return {
      intent: analysis.intent,
      mode: analysis.mode,
      shouldOptimizePrompt: analysis.shouldOptimizePrompt,
      messages: [
        new AIMessage(
          `Intent=${analysis.intent}; mode=${analysis.mode}; optimize=${analysis.shouldOptimizePrompt}`,
        ),
      ],
    };
  } catch (error) {
    const fallbackMode = state.sourceImage ? "image-to-image" : state.requestedMode;
    const fallbackIntent = state.sourceImage ? "edit_existing" : "create_new";
    const message =
      error instanceof Error ? error.message : "Failed to analyze generation intent.";

    return {
      intent: fallbackIntent,
      mode: fallbackMode,
      shouldOptimizePrompt: true,
      errors: [`analyzerNode: ${message}`],
      errorCount: state.errorCount + 1,
    };
  }
}
