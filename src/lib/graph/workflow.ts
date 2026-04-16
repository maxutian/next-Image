import "server-only";

import { END, START, StateGraph } from "@langchain/langgraph";
import { analyzerNode } from "@/lib/graph/nodes/analyzerNode";
import { generateImageNode } from "@/lib/graph/nodes/generateImageNode";
import { optimizerNode } from "@/lib/graph/nodes/optimizerNode";
import { reviewerNode } from "@/lib/graph/nodes/reviewerNode";
import { supabaseSaveNode } from "@/lib/graph/nodes/supabaseSaveNode";
import { agentState } from "@/lib/graph/state";

function routeAfterAnalyze(state: typeof agentState.State) {
  return state.shouldOptimizePrompt ? "optimizer" : "generate";
}

function routeAfterReview(state: typeof agentState.State) {
  // review 通过才落库；失败时允许在限定次数内回到 optimizer 重新组织 prompt。
  if (state.reviewStatus === "passed") {
    return "save";
  }

  return state.errorCount < 2 ? "optimizer" : END;
}

const workflow = new StateGraph(agentState)
  .addNode("analyzer", analyzerNode)
  .addNode("optimizer", optimizerNode)
  .addNode("generate", generateImageNode)
  .addNode("review", reviewerNode)
  .addNode("save", supabaseSaveNode)
  .addEdge(START, "analyzer")
  .addConditionalEdges("analyzer", routeAfterAnalyze, ["optimizer", "generate"])
  .addEdge("optimizer", "generate")
  .addEdge("generate", "review")
  .addConditionalEdges("review", routeAfterReview, ["optimizer", "save", END])
  .addEdge("save", END);

export const imageGenerationGraph = workflow.compile();
