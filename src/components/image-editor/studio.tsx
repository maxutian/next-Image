"use client";

import { useActionState, useEffect, useState } from "react";
import { generateImageAction } from "@/app/actions";
import { Controls } from "@/components/image-editor/controls";
import { Display } from "@/components/image-editor/display";
import { useToast } from "@/hooks/use-toast";
import { initialGenerateImageState, type EditorMode } from "@/types";

export function ImageStudio() {
  const [state, formAction, pending] = useActionState(
    generateImageAction,
    initialGenerateImageState,
  );
  const [mode, setMode] = useState<EditorMode>("text-to-image");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const { toast } = useToast();

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

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-7xl flex-col px-4 py-8 sm:px-6 lg:px-8">
      <section className="grid flex-1 gap-6 lg:grid-cols-[1.02fr_0.98fr]">
        <form action={formAction} className="space-y-6">
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
