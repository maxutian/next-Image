## 项目概览

`IImage` 是一个基于 `Next.js App Router + Supabase + OpenRouter` 的多会话 AI 图片工作台。

当前支持的核心能力：

- 邮箱密码登录与退出
- 新建会话、切换历史会话
- 文生图
- 图生图
- 同一会话内的上下文延续
- 将生成结果、消息记录、会话关系和 prompt embedding 持久化到 Supabase

## 技术栈

- 前端：`Next.js 16`、`React 19`、`Tailwind CSS`
- 鉴权与数据库：`Supabase Auth`、`Postgres`、`Storage`
- 模型接入：`OpenRouter`
- 工作流编排：`LangGraph`

## 环境变量

在 `.env.local` 中配置：

```bash
OPENROUTER_API_KEY=your_openrouter_api_key
OPENROUTER_BASE_URL=https://openrouter.ai/api/v1
OPENROUTER_TEXT_MODEL=moonshotai/kimi-k2
OPENROUTER_IMAGE_MODEL=black-forest-labs/flux.2-klein-4b
OPENROUTER_EMBEDDING_MODEL=qwen/qwen3-embedding-4b
OPENROUTER_EMBEDDING_DIMENSIONS=768
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
NEXT_PUBLIC_SITE_URL=http://localhost:3000
SUPABASE_IMAGES_BUCKET=images
```

当前默认模型职责：

- 文本分析与 prompt 优化：`moonshotai/kimi-k2`
- 图片生成与编辑：`black-forest-labs/flux.2-klein-4b`
- 向量 embedding：`qwen/qwen3-embedding-4b`

说明：

- embedding 显式固定为 `768` 维，用来匹配数据库中的 `vector(768)` 列。
- OpenRouter 文本模型和图片模型是分开的，不是一个模型同时承担所有任务。

## 本地启动

1. 在 Supabase SQL Editor 执行迁移：
   [supabase/migrations/20260408_stage3_stage4_images.sql](/home/mxt/IImage/supabase/migrations/20260408_stage3_stage4_images.sql)

2. 如果使用聊天会话能力，再执行：
   [supabase/migrations/20260409_chat_sessions.sql](/home/mxt/IImage/supabase/migrations/20260409_chat_sessions.sql)

3. 启动开发服务器：

```bash
pnpm dev
```

4. 打开 `http://localhost:3000`

## 完整业务流程

### 1. 请求进入应用

所有页面请求会先经过 [src/proxy.ts](/home/mxt/IImage/src/proxy.ts:1)。

- 这里会创建一个 Supabase Server Client
- 通过 `supabase.auth.getUser()` 触发 Supabase cookie 刷新
- 这样服务端组件和 API Route 才能持续拿到最新登录态

### 2. 用户登录 / 退出

登录和注册入口：

- 前端表单：`src/components/auth/auth-form.tsx`
- API：[`src/app/api/auth/route.ts`](/home/mxt/IImage/src/app/api/auth/route.ts:1)
- 服务端封装：[`src/lib/auth/session.ts`](/home/mxt/IImage/src/lib/auth/session.ts:1)

流程如下：

1. 前端提交邮箱和密码到 `/api/auth`
2. `authenticateUser()` 根据 `mode` 决定是 `signUp` 还是 `signInWithPassword`
3. 登录成功后前端 `router.replace("/")`
4. 退出登录时调用 `/api/auth/sign-out`
5. `signOutCurrentUser()` 清理 Supabase 会话并回到首页

### 3. 首页加载

首页入口在 [src/app/page.tsx](/home/mxt/IImage/src/app/page.tsx:32)。

流程如下：

1. 先检查 Supabase 环境变量是否完整
2. 读取 URL 中的 `session` 查询参数
3. 调用 `loadSessionWithMessages(sessionId)`
4. 如果未登录，直接渲染 `AuthForm`
5. 如果已登录，渲染 `ChatStudio`

### 4. 会话初始化与会话列表

会话核心逻辑都在 [src/lib/chat/turn.ts](/home/mxt/IImage/src/lib/chat/turn.ts:89)。

页面初始化时：

1. `ensureSession()` 会优先尝试读取 URL 指定的会话
2. 如果指定会话不存在或不属于当前用户，则回退到“最近更新的会话”
3. 如果用户还没有任何会话，则自动创建一个默认会话
4. `fetchSessionMessages()` 读取该会话下的消息与图片
5. `listUserSessions()` 读取左侧会话列表
6. `buildChatState()` 组装成前端消费的统一状态

### 5. 新建会话 / 切换会话

会话 API：

- [src/app/api/chat/sessions/route.ts](/home/mxt/IImage/src/app/api/chat/sessions/route.ts:1)

前端交互：

- [src/components/chat/studio.tsx](/home/mxt/IImage/src/components/chat/studio.tsx:360)

新建会话：

1. 前端点击“新建会话”
2. 调用 `POST /api/chat/sessions`
3. 服务端执行 `createChatSession()`
4. 返回空消息的新会话状态
5. 前端把 `sessionId` 写回 URL

切换会话：

1. 前端点击左侧某个历史会话
2. 调用 `GET /api/chat/sessions?sessionId=...`
3. 服务端重新加载该会话的消息、图片和会话列表
4. 前端更新右侧聊天区内容，并同步 URL

### 6. 用户发送一条消息

提交入口：

- 前端：[`src/components/chat/studio.tsx`](/home/mxt/IImage/src/components/chat/studio.tsx:440)
- API：[`src/app/api/chat/turn/route.ts`](/home/mxt/IImage/src/app/api/chat/turn/route.ts:1)
- 服务端主逻辑：[`src/lib/chat/turn.ts`](/home/mxt/IImage/src/lib/chat/turn.ts:436)

流程如下：

1. 前端把 `sessionId`、文本消息和可选图片一起提交到 `/api/chat/turn`
2. 服务端确认当前用户身份
3. 根据 `sessionId` 找到当前会话
4. 校验本次请求至少包含“文本”或“附件”之一
5. 先把用户消息写入 `chat_messages`

### 7. 同会话上下文记忆

为了支持“继续改上一张图”这类多轮编辑，`processChatTurn()` 会在正式生成前做两层上下文拼装：

1. 文本上下文
   - 从当前会话最近几条消息中提取文本和相关图片 prompt
   - 组合成 `sessionContext`
   - 交给分析节点和 prompt 优化节点

2. 图片上下文
   - 如果用户本轮没有上传图片
   - 但文本里出现“上一张、继续、修改、保留、基于这张图”等 follow-up 语义
   - 系统会自动复用当前会话最近一张结果图作为 `sourceImage`

这保证了：

- 不同会话之间上下文隔离
- 同一会话内部能连续追问和二次编辑

### 8. LangGraph 生成工作流

工作流定义在 [src/lib/graph/workflow.ts](/home/mxt/IImage/src/lib/graph/workflow.ts:1)。

执行链路：

1. `analyzer`
   - 判断当前请求属于文生图还是图生图
   - 判断是否需要优化 prompt

2. `optimizer`
   - 将用户输入重写为更适合模型的生产级英文 prompt
   - 会参考同会话最近上下文

3. `generate`
   - 调用 OpenRouter 图片模型生成图片

4. `review`
   - 对生成结果做最基础的通过/失败判定

5. `save`
   - 上传图片到 Supabase Storage
   - 生成 prompt embedding
   - 写入 `public.images`

路由逻辑：

- `analyzer -> optimizer -> generate`
- 如果 `analyzer` 判定不需要优化，则直接 `analyzer -> generate`
- `review` 失败时会在阈值内回退到 `optimizer`
- `review` 通过后进入 `save`

### 9. OpenRouter 调用方式

模型封装在 [src/lib/gemini.ts](/home/mxt/IImage/src/lib/gemini.ts:1)。

虽然文件名还叫 `gemini.ts`，但当前已经不是 Google SDK 直连，而是统一走 OpenRouter：

- 文本分析：`/chat/completions`
- prompt 重写：`/chat/completions`
- 图片生成：`/chat/completions`
- embedding：`/embeddings`

这样做的好处：

- 不需要改动整个上层业务接口
- 业务侧仍然调用 `analyzeImageRequest / optimizeImagePrompt / generateImageWithGemini / generatePromptEmbedding`
- 实际 provider 和模型由环境变量控制

### 10. 图片与消息落库

持久化发生在两个阶段。

第一阶段：工作流保存图片

- 位置：[`src/lib/graph/nodes/supabaseSaveNode.ts`](/home/mxt/IImage/src/lib/graph/nodes/supabaseSaveNode.ts:22)
- 将 base64 图片上传到 Supabase Storage
- 获取公共 URL
- 生成 768 维 embedding
- 把图片记录写入 `public.images`

第二阶段：聊天层回写会话关系

- 位置：[`src/lib/chat/turn.ts`](/home/mxt/IImage/src/lib/chat/turn.ts:526)
- 将 `images.session_id` 更新为当前会话
- 新增一条 assistant 消息到 `chat_messages`
- 通过 `message_images` 关联“消息”和“图片”
- 回写 `chat_sessions.last_image_id`

### 11. 前端状态回流

生成完成后，服务端不会只返回“这张新图”，而是会重新组装整份会话状态：

- 当前会话 `sessionId`
- 当前会话元信息 `currentSession`
- 左侧会话列表 `sessions`
- 当前会话消息 `messages`
- 当前活跃图片 `activeImage`

这样前端始终用一个统一结构来刷新 UI，不需要自己拼增量补丁。

### 12. 错误处理

主要错误出口有三层：

1. API Route 层
   - 把服务端异常转成统一 JSON 结构

2. 业务层
   - `processChatTurn()` 会把生成失败写成 assistant 的错误消息
   - 然后重新返回当前会话状态

3. 前端层
   - `ChatStudio` 统一解析 API 错误
   - 优先使用服务端返回的 `details`
   - 否则展示通用错误信息

## 数据模型

本项目的核心表：

- `public.images`
  - 存最终图片记录、prompt、embedding
- `public.chat_sessions`
  - 存会话头信息和最近一张结果图
- `public.chat_messages`
  - 存聊天消息
- `public.message_images`
  - 存消息与图片的关联关系

其中：

- `images.embedding` 是 `vector(768)`
- `images.session_id` / `images.message_id` 负责把图片挂回聊天上下文

## 关键文件地图

- 首页入口：[src/app/page.tsx](/home/mxt/IImage/src/app/page.tsx:32)
- 登录逻辑：[src/lib/auth/session.ts](/home/mxt/IImage/src/lib/auth/session.ts:22)
- 聊天 UI：[src/components/chat/studio.tsx](/home/mxt/IImage/src/components/chat/studio.tsx:360)
- 会话与聊天主逻辑：[src/lib/chat/turn.ts](/home/mxt/IImage/src/lib/chat/turn.ts:406)
- 工作流编排：[src/lib/graph/workflow.ts](/home/mxt/IImage/src/lib/graph/workflow.ts:1)
- 模型调用：[src/lib/gemini.ts](/home/mxt/IImage/src/lib/gemini.ts:1)
- 图片保存节点：[src/lib/graph/nodes/supabaseSaveNode.ts](/home/mxt/IImage/src/lib/graph/nodes/supabaseSaveNode.ts:22)
- 登录态续期代理：[src/proxy.ts](/home/mxt/IImage/src/proxy.ts:1)

## 备注

- 会话隔离是通过 `sessionId` 在服务端完成的，不依赖前端本地缓存来模拟。
- 同会话上下文记忆是“文本上下文 + 最近结果图复用”两套机制同时生效。
- embedding 失败不会阻塞整张图保存，但会在服务端打印 warning。
