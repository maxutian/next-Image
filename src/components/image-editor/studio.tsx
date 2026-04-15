"use client";

import { useEffect, useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import {
  apiClient,
  getRequestErrorDetails,
  getRequestErrorMessage,
} from "@/lib/api/client";
import { Controls } from "@/components/image-editor/controls";
import { Display } from "@/components/image-editor/display";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import {
  initialGenerateImageState,
  type EditorMode,
  type GenerateImageState,
  type HistoryItem,
  type SignOutResult,
} from "@/types";

type ImageStudioProps = {
  initialHistory: HistoryItem[];
  userEmail?: string;
};

export function ImageStudio({ initialHistory, userEmail }: ImageStudioProps) {
  const [state, setState] = useState<GenerateImageState>({
    ...initialGenerateImageState,
    history: initialHistory,
  });
  const [pending, startTransition] = useTransition();
  const [signingOut, startSignOutTransition] = useTransition();
  const [mode, setMode] = useState<EditorMode>("text-to-image");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const { toast } = useToast();
  const router = useRouter();

  useEffect(() => {
    if (state.status === "success" && state.image) {
      toast({
        title: "生成完成",
        description: state.message,
      });
    }

    if (state.status === "error") {
      toast({
        title: "生成失败",
        description: state.message,
        variant: "destructive",
      });
    }
  }, [state, toast]);

  function handleModeChange(nextMode: EditorMode) {
    setMode(nextMode);
    if (nextMode === "text-to-image") {
      setPreviewUrl(null);
    }
  }

  function handleFileChange(file: File | null) {
    if (!file) {
      setPreviewUrl(null);
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        setPreviewUrl(reader.result);
      }
    };
    reader.readAsDataURL(file);
  }

  function handleGenerate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const formData = new FormData(event.currentTarget);

    startTransition(async () => {
      try {
        const nextState = await apiClient.postForm<GenerateImageState>(
          "/api/images/generate",
          formData,
        );
        setState(nextState);
      } catch (error) {
        const details = getRequestErrorDetails<GenerateImageState>(error);

        if (details) {
          setState(details);
          return;
        }

        setState((previous) => ({
          ...previous,
          status: "error",
          mode,
          message: getRequestErrorMessage(error),
        }));
      }
    });
  }

  function handleSignOut() {
    startSignOutTransition(async () => {
      try {
        const result = await apiClient.post<SignOutResult>("/api/auth/sign-out");
        router.replace(result.redirectTo);
        router.refresh();
      } catch (error) {
        toast({
          title: "退出失败",
          description: getRequestErrorMessage(error),
          variant: "destructive",
        });
      }
    });
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-7xl flex-col px-4 py-8 sm:px-6 lg:px-8">
      <header className="mb-6 flex flex-col gap-4 rounded-[1.75rem] border border-white/70 bg-white/70 p-4 shadow-[0_24px_80px_-40px_rgba(15,23,42,0.35)] backdrop-blur sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <p className="text-sm text-muted-foreground">当前已登录</p>
          <p className="text-base font-medium">{userEmail || "Supabase 用户"}</p>
        </div>
        <Button
          className="h-10 rounded-full px-4"
          type="button"
          variant="outline"
          disabled={signingOut}
          onClick={handleSignOut}
        >
          <LogOut className="size-4" />
          {signingOut ? "退出中..." : "退出登录"}
        </Button>
      </header>
      <section className="grid flex-1 gap-6 lg:grid-cols-[1.02fr_0.98fr]">
        <form onSubmit={handleGenerate} className="space-y-6">
          <div className="space-y-3 px-2">
            <h1 className="max-w-3xl text-4xl font-semibold tracking-tight sm:text-5xl">
              图片生成测试
            </h1>
            <p className="max-w-2xl text-base leading-7 text-muted-foreground">
              测试项目
            </p>
          </div>
          <Controls
            mode={mode}
            previewUrl={previewUrl}
            pending={pending}
            onModeChange={handleModeChange}
            onFileChange={handleFileChange}
          />
        </form>
        <Display pending={pending} state={state} history={state.history} />
      </section>
    </main>
  );
}
