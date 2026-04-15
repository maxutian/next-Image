import { apiError, apiSuccess } from "@/lib/api/server";
import { generateImageFromFormData } from "@/lib/image-generation/generate";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const result = await generateImageFromFormData(formData);

    if (result.status === "error") {
      const status = result.message === "请先登录后再生成图片。" ? 401 : 422;

      return apiError(result.message, {
        status,
        details: result,
      });
    }

    return apiSuccess(result);
  } catch (error) {
    console.error("POST /api/images/generate failed", error);

    return apiError(error instanceof Error ? error.message : "请求失败");
  }
}
