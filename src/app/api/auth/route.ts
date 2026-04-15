import { apiError, apiSuccess } from "@/lib/api/server";
import { authenticateUser } from "@/lib/auth/session";
import type { AuthMode } from "@/types";

type AuthRequestBody = {
  mode?: AuthMode;
  email?: string;
  password?: string;
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as AuthRequestBody;
    const result = await authenticateUser(body);

    if (result.status === "error") {
      return apiError(result.message, {
        status: 400,
        details: result,
      });
    }

    return apiSuccess(result);
  } catch (error) {
    console.error("POST /api/auth failed", error);

    return apiError(error instanceof Error ? error.message : "请求失败");
  }
}
