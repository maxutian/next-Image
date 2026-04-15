import { apiError, apiSuccess } from "@/lib/api/server";
import { signOutCurrentUser } from "@/lib/auth/session";

export async function POST() {
  try {
    return apiSuccess(await signOutCurrentUser());
  } catch (error) {
    console.error("POST /api/auth/sign-out failed", error);

    return apiError(error instanceof Error ? error.message : "请求失败");
  }
}

