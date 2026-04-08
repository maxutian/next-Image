既然决定采用 **Next.js (App Router) + TypeScript + Tailwind CSS + shadcn/ui** 的同构架构，这已经是一个生产级别的技术栈了。为了让 Agent（或你自己）能够高效执行，我们将任务拆解为五个阶段。

这份计划表通过 **Server Actions** 处理 Gemini API 的多模态输入，并利用 **shadcn/ui** 提供高质量的交互组件。

---

## 🛠️ Gemini AI 图像平台执行计划表

### 第一阶段：环境初始化与基础框架 (Day 1)
**目标：** 搭建 Next.js 同构基础环境，配置样式与 UI 组件库。

1.  **项目初始化：**
    * 运行 `npx create-next-app@latest my-gemini-ai --typescript --tailwind --eslint`。
    * 选择 **App Router: Yes**, **Src Directory: Yes**。
2.  **安装 shadcn/ui：**
    * 初始化：`npx shadcn-ui@latest init`。
    * 添加必要组件：`npx shadcn-ui@latest add button input card slider toast tabs skeleton`。
3.  **配置 SDK 与 环境变量：**
    * 安装 Gemini SDK：`npm install @google/genai`。
    * 在 `.env.local` 中配置 `GEMINI_API_KEY`。
4.  **建立同构 API 客户端：**
    * 创建 `src/lib/gemini.ts` 用于初始化 `GoogleGenAI` 实例。

---

### 第二阶段：同构后端逻辑 - Server Actions (Day 1-2)
**目标：** 实现文生图、图生图的核心调用逻辑，确保服务端处理图片数据的安全性。

1.  **定义数据转换 Utility：**
    * 编写一个函数将 `File` 对象转换为 Gemini 所需的 `inlineData` (Base64) 格式。
2.  **编写核心 Action (`src/app/actions.ts`)：**
    * 实现 `generateImageAction`：接收 `FormData`。
    * **文生图逻辑：** 仅传递 `text` Part。
    * **图生图逻辑：** 同时传递 `inlineData` (原图) 与 `text` (修改指令)。
    * 设置 `responseModalities: ["IMAGE"]` 以获取图片输出。

---

### 第三阶段：前端交互界面开发 (Day 2-3)
**目标：** 使用 shadcn/ui 构建响应式画板，支持多模态输入。

1.  **上传区域 (`ImageUploader.tsx`)：**
    * 利用 `input[type="file"]` 结合 shadcn 的 `Card` 样式，实现图片拖拽上传与即时预览。
2.  **输入控制区：**
    * 使用 `Textarea` 编写 Prompt 输入框。
    * 使用 `Tabs` 切换“文生图”和“图生图”模式。
3.  **状态管理：**
    * 使用 React 的 `useTransition` 或 `useActionState` 处理 Server Action 的挂起状态，并展示 shadcn 的 `Skeleton` 加载占位符。

---

### 第四阶段：图片编辑与高级功能 (Day 3-4)
**目标：** 根据 Gemini API 文档，实现图像编辑（Editing）能力。

1.  **历史记录维护：**
    * 在客户端维护一个 `history` 状态，将生成的图片作为下一次编辑的输入，实现多轮编辑（Multi-turn Editing）。
2.  **结果处理与下载：**
    * 将生成的 Base64 数据转换为 Blob，支持用户下载生成的图片。
3.  **错误捕获与提示：**
    * 使用 shadcn 的 `toast` 组件处理 API 限制、内容安全拦截（Safety Filters）等异常反馈。

---

### 第五阶段：部署与优化 (Day 4)
**目标：** 确保应用在生产环境稳定运行。

1.  **Vercel 部署配置：**
    * 配置 `next.config.js` 允许显示来自 `data:` 协议的图片。
    * 配置 `maxDuration: 60` (如果使用 Pro 账号)，应对 AI 生成图片的延迟。
2.  **性能优化：**
    * 图片预览使用 `next/image` 进行基础优化。
    * 实现简单的客户端防抖，避免用户频繁点击生成。

---

## 📂 推荐的文件目录结构 (供 Agent 扫描)

```bash
src/
├── app/
│   ├── layout.tsx       # 全局布局 (Provider 配置)
│   ├── page.tsx         # 主控制面板 (Client Component)
│   ├── actions.ts       # 【核心】Server Actions 处理函数
│   └── globals.css      # Tailwind 样式
├── components/
│   ├── ui/              # shadcn 自动生成的组件
│   ├── image-editor/
│   │   ├── uploader.tsx # 图片上传组件
│   │   ├── controls.tsx # Prompt 与 参数调节
│   │   └── display.tsx  # 生成结果展示
├── lib/
│   ├── gemini.ts        # Gemini SDK 初始化
│   └── utils.ts         # 包含 Base64 转换等工具函数
└── types/
    └── index.ts         # 严格的 TS 类型定义
```

## 🚀 启动指令 (Agent 第一步)
如果你现在就想让 Agent 开始工作，可以先让它执行以下命令集：

```bash
npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir --import-alias "@/*"
npx shadcn-ui@latest init -d
npm install @google/genai lucide-react
```

你需要我针对其中某个具体的 Server Action 代码逻辑进行深入拆解吗？
