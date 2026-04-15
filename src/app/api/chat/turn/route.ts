import { apiError, apiSuccess } from "@/lib/api/server";
import { processChatTurn } from "@/lib/chat/turn";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const state = await processChatTurn(formData);

    if (state.status === "error") {
      const status = state.error === "请先登录后再对话。" ? 401 : 422;

      return apiError(state.error || "请求失败", {
        status,
        details: state,
      });
    }

    return apiSuccess(state);
  } catch (error) {
    console.error("POST /api/chat/turn failed", error);

    return apiError(error instanceof Error ? error.message : "请求失败");
  }
}
