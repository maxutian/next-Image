## Getting Started

1. 在 Supabase SQL Editor 执行 [supabase/migrations/20260408_stage3_stage4_images.sql](/home/mxt/IImage/supabase/migrations/20260408_stage3_stage4_images.sql)。
2. 在 `.env.local` 中配置：

```bash
GEMINI_API_KEY=your_google_ai_api_key
GEMINI_IMAGE_MODEL=gemini-3.1-flash-image
GEMINI_EMBEDDING_MODEL=text-embedding-004
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
NEXT_PUBLIC_SITE_URL=http://localhost:3000
SUPABASE_IMAGES_BUCKET=images
```

3. 启动开发服务器：

```bash
pnpm dev
```

4. 打开 `http://localhost:3000`，先登录，再测试文生图或图生图。

## Current Flow

- Supabase Auth 负责登录、登出和会话恢复。
- `generateImageAction` 先校验用户身份，再调用 Gemini 生成图片。
- 生成结果上传到 Supabase Storage 的 `images` bucket。
- Prompt 会额外生成 768 维 embedding，并写入 `public.images`。
- 首页历史记录直接从数据库读取最近 6 条结果。

## Notes

- 这里的 embedding 使用的是 `text-embedding-004`，不是 `gemini-1.5-flash`。后者是文本/多模态生成模型，不是向量模型。
- 当前存储链路使用 public bucket 来换取稳定的永久 URL；上传、更新、删除仍然受 Storage policy 限制在本人目录下。
