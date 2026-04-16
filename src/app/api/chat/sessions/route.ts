import { apiError, apiSuccess } from "@/lib/api/server";
import { createChatSession, loadSessionWithMessages } from "@/lib/chat/turn";

function toResponseStatus(error: unknown) {
  return error instanceof Error && error.message === "未登录" ? 401 : 500;
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const sessionId = url.searchParams.get("sessionId");
    const state = await loadSessionWithMessages(sessionId);

    return apiSuccess(state);
  } catch (error) {
    console.error("GET /api/chat/sessions failed", error);

    return apiError(error instanceof Error ? error.message : "请求失败", {
      status: toResponseStatus(error),
    });
  }
}

export async function POST() {
  try {
    const state = await createChatSession();

    return apiSuccess(state, { status: 201 });
  } catch (error) {
    console.error("POST /api/chat/sessions failed", error);

    return apiError(error instanceof Error ? error.message : "请求失败", {
      status: toResponseStatus(error),
    });
  }
}
