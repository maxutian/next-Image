import "server-only";

import { AIMessage } from "@langchain/core/messages";
import { optimizeImagePrompt } from "@/lib/gemini";
import type { AgentState } from "@/lib/graph/state";

export async function optimizerNode(state: AgentState) {
  if (!state.shouldOptimizePrompt) {
    return {
      optimizedPrompt: state.originalPrompt,
    };
  }

  try {
    const optimizedPrompt = await optimizeImagePrompt({
      prompt: state.originalPrompt,
      intent: state.intent,
      mode: state.mode,
      hasSourceImage: Boolean(state.sourceImage),
      sessionContext: state.sessionContext,
    });

    return {
      optimizedPrompt,
      messages: [new AIMessage(`Optimized prompt: ${optimizedPrompt}`)],
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to optimize prompt.";

    return {
      optimizedPrompt: state.originalPrompt,
      errors: [`optimizerNode: ${message}`],
      errorCount: state.errorCount + 1,
    };
  }
}
