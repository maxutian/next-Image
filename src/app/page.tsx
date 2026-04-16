import { ChatStudio } from "@/components/chat/studio";
import { AuthForm } from "@/components/auth/auth-form";
import { isSupabaseConfigured, getSupabaseMissingEnvMessage } from "@/lib/supabase/env";
import { loadSessionWithMessages } from "@/lib/chat/turn";

type HomePageProps = {
  searchParams?: Promise<{
    session?: string | string[];
  }>;
};

function SupabaseSetupNotice() {
  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-8">
      <section className="w-full max-w-2xl rounded-[2rem] border border-white/70 bg-white/75 p-8 shadow-[0_24px_80px_-40px_rgba(15,23,42,0.35)] backdrop-blur sm:p-10">
        <p className="text-sm font-medium text-muted-foreground">Supabase 未完成配置</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
          需要先把 Supabase 的公开环境变量注入当前运行环境。
        </h1>
        <p className="mt-4 text-base leading-7 text-muted-foreground">
          {getSupabaseMissingEnvMessage()}
        </p>
        <div className="mt-6 rounded-[1.5rem] bg-secondary/70 p-4 text-sm text-muted-foreground">
          当前项目已经接入了登录逻辑，但本地还没有读到 Supabase 环境变量。你可以从
          Vercel 拉取环境变量到本地，或手动写入 <code>.env.local</code>。
        </div>
      </section>
    </main>
  );
}

export default async function Home({ searchParams }: HomePageProps) {
  if (!isSupabaseConfigured()) {
    return <SupabaseSetupNotice />;
  }

  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const requestedSessionId = Array.isArray(resolvedSearchParams?.session)
    ? resolvedSearchParams?.session[0]
    : resolvedSearchParams?.session;

  let initialState;
  try {
    initialState = await loadSessionWithMessages(requestedSessionId);
  } catch (error) {
    if (error instanceof Error && error.message === "未登录") {
      return <AuthForm />;
    }

    throw error;
  }

  return <ChatStudio initialState={initialState} />;
}
