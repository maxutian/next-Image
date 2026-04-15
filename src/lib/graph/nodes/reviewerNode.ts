import "server-only";

import type { AgentState } from "@/lib/graph/state";

export async function reviewerNode(state: AgentState) {
  if (!state.generatedImage?.data) {
    return {
      reviewStatus: "failed" as const,
      errors: ["reviewerNode: No generated image available for review."],
      errorCount: state.errorCount + 1,
    };
  }

  return {
    reviewStatus: "passed" as const,
  };
}
