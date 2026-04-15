"use client";

import { useEffect, useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  apiClient,
  getRequestErrorDetails,
  getRequestErrorMessage,
} from "@/lib/api/client";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { initialAuthFormState, type AuthMode, type AuthResult } from "@/types";

export function AuthForm() {
  const [state, setState] = useState(initialAuthFormState);
  const [pending, startTransition] = useTransition();
  const [submittedMode, setSubmittedMode] = useState<AuthMode>("sign-in");
  const { toast } = useToast();
  const router = useRouter();

  useEffect(() => {
    if (state.status === "success") {
      toast({
        title: "操作成功",
        description: state.message,
      });
    }

    if (state.status === "error") {
      toast({
        title: state.mode === "sign-up" ? "注册失败" : "登录失败",
        description: state.message,
        variant: "destructive",
      });
    }
  }, [state, toast]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const form = event.currentTarget;
    const formData = new FormData(form);
    const mode = (formData.get("mode") as AuthMode) || "sign-in";

    setSubmittedMode(mode);

    startTransition(async () => {
      try {
        const nextState = await apiClient.post<AuthResult>("/api/auth", {
          json: {
            mode,
            email: String(formData.get("email") || ""),
            password: String(formData.get("password") || ""),
          },
        });

        setState(nextState);

        if (nextState.status === "success" && nextState.redirectTo) {
          router.replace(nextState.redirectTo);
          router.refresh();
        }
      } catch (error) {
        const details = getRequestErrorDetails<AuthResult>(error);

        setState(
          details || {
            status: "error",
            mode,
            message: getRequestErrorMessage(error),
          },
        );
      }
    });
  }

  return (
    <div className="grid min-h-screen gap-8 px-4 py-8 sm:px-6 lg:grid-cols-[1.1fr_0.9fr] lg:px-8">
      <section className="flex flex-col justify-between rounded-[2rem] border border-white/60 bg-white/65 p-8 shadow-[0_30px_90px_-50px_rgba(15,23,42,0.45)] backdrop-blur sm:p-10">
        <div className="space-y-6">
          <div className="inline-flex w-fit rounded-full border border-border/70 bg-background/80 px-4 py-2 text-sm text-muted-foreground">
            Supabase Auth
          </div>
          <div className="space-y-4">
            <h1 className="max-w-2xl text-4xl font-semibold tracking-tight text-balance sm:text-6xl">
              登录后再进入你的 AI 图片工作台。
            </h1>
            <p className="max-w-xl text-base leading-7 text-muted-foreground sm:text-lg">
              现在首页会先校验 Supabase 会话，登录成功后才允许调用图片生成能力，避免匿名访问直接打到服务端动作。
            </p>
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-[1.5rem] border border-white/70 bg-background/75 p-4">
            <p className="text-sm font-medium">邮箱密码登录</p>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              使用 Supabase 原生 Auth，无需自建用户表。
            </p>
          </div>
          <div className="rounded-[1.5rem] border border-white/70 bg-background/75 p-4">
            <p className="text-sm font-medium">服务端鉴权</p>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              首页与生成动作都会校验当前用户会话。
            </p>
          </div>
          <div className="rounded-[1.5rem] border border-white/70 bg-background/75 p-4">
            <p className="text-sm font-medium">自动续期</p>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              通过 Next.js proxy 同步刷新 Supabase Cookie。
            </p>
          </div>
        </div>
      </section>

      <section className="flex items-center justify-center">
        <Card className="w-full max-w-md border-white/80 bg-white/78">
          <CardHeader className="space-y-2">
            <CardTitle>账号入口</CardTitle>
            <CardDescription>
              登录已有账号，或先注册一个测试账号。
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="sign-in">
              <TabsList>
                <TabsTrigger value="sign-in">登录</TabsTrigger>
                <TabsTrigger value="sign-up">注册</TabsTrigger>
              </TabsList>

              <TabsContent value="sign-in">
                <form onSubmit={handleSubmit} className="space-y-4">
                  <input name="mode" type="hidden" value="sign-in" />
                  <div className="space-y-2">
                    <label className="text-sm font-medium" htmlFor="sign-in-email">
                      邮箱
                    </label>
                    <Input
                      autoComplete="email"
                      id="sign-in-email"
                      name="email"
                      placeholder="you@example.com"
                      required
                      type="email"
                      disabled={pending}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium" htmlFor="sign-in-password">
                      密码
                    </label>
                    <Input
                      autoComplete="current-password"
                      id="sign-in-password"
                      minLength={6}
                      name="password"
                      placeholder="至少 6 位密码"
                      required
                      type="password"
                      disabled={pending}
                    />
                  </div>
                  <Button className="h-11 w-full rounded-2xl" disabled={pending} type="submit">
                    {pending && submittedMode === "sign-in" ? "登录中..." : "登录并进入工作台"}
                  </Button>
                </form>
              </TabsContent>

              <TabsContent value="sign-up">
                <form onSubmit={handleSubmit} className="space-y-4">
                  <input name="mode" type="hidden" value="sign-up" />
                  <div className="space-y-2">
                    <label className="text-sm font-medium" htmlFor="sign-up-email">
                      邮箱
                    </label>
                    <Input
                      autoComplete="email"
                      id="sign-up-email"
                      name="email"
                      placeholder="you@example.com"
                      required
                      type="email"
                      disabled={pending}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium" htmlFor="sign-up-password">
                      密码
                    </label>
                    <Input
                      autoComplete="new-password"
                      id="sign-up-password"
                      minLength={6}
                      name="password"
                      placeholder="至少 6 位密码"
                      required
                      type="password"
                      disabled={pending}
                    />
                  </div>
                  <Button className="h-11 w-full rounded-2xl" disabled={pending} type="submit">
                    {pending && submittedMode === "sign-up" ? "注册中..." : "创建账号"}
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
