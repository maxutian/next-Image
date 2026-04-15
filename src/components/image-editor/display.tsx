"use client";

import Image from "next/image";
import { Download, History, Wand2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { GenerateImageState, HistoryItem } from "@/types";

type DisplayProps = {
  pending: boolean;
  state: GenerateImageState;
  history: HistoryItem[];
};

export function Display({ pending, state, history }: DisplayProps) {
  const activeImage = state.image || history[0] || null;

  return (
    <div className="space-y-5">
      <Card className="overflow-hidden">
        <CardHeader>
          <CardTitle>生成结果</CardTitle>
          <CardDescription>{state.message}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {pending ? (
            <div className="space-y-3">
              <Skeleton className="h-[420px] w-full rounded-[1.5rem]" />
              <Skeleton className="h-4 w-2/3" />
            </div>
          ) : activeImage ? (
            <>
              <div className="overflow-hidden rounded-[1.5rem] border border-border bg-muted">
                <Image
                  alt={activeImage.prompt}
                  className="aspect-square w-full object-cover"
                  height={1200}
                  src={activeImage.imageUrl}
                  unoptimized
                  width={1200}
                />
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="space-y-1">
                  <p className="text-sm font-medium">{activeImage.prompt}</p>
                  <p className="text-xs text-muted-foreground">
                    {activeImage.mode === "text-to-image" ? "文生图" : "图生图"} ·{" "}
                    {new Date(activeImage.createdAt).toLocaleString("zh-CN")}
                  </p>
                </div>
                <a
                  className="inline-flex items-center gap-2 rounded-full border border-border px-4 py-2 text-sm font-medium"
                  download={`iimage-${activeImage.id}.png`}
                  href={activeImage.imageUrl}
                >
                  <Download className="size-4" />
                  下载
                </a>
              </div>
            </>
          ) : (
            <div className="flex min-h-[420px] flex-col items-center justify-center gap-3 rounded-[1.5rem] bg-muted px-6 text-center">
              <div className="flex size-14 items-center justify-center rounded-full bg-white text-primary shadow-sm">
                <Wand2 className="size-6" />
              </div>
              <p className="text-sm font-medium">等待第一次生成</p>
              <p className="max-w-sm text-sm text-muted-foreground">
                Route Handler、Gemini SDK、图片上传与结果区域都已经连通，补充密钥后即可开始试跑。
              </p>
            </div>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <History className="size-4" />
            历史记录
          </CardTitle>
          <CardDescription>后续多轮编辑会以这里的结果作为下一次输入。</CardDescription>
        </CardHeader>
        <CardContent>
          {history.length ? (
            <div className="grid gap-3 sm:grid-cols-2">
              {history.map((item) => (
                <div
                  key={item.id}
                  className="overflow-hidden rounded-[1.25rem] border border-border bg-white/70"
                >
                  <Image
                    alt={item.prompt}
                    className="aspect-square w-full object-cover"
                    height={600}
                    src={item.imageUrl}
                    unoptimized
                    width={600}
                  />
                  <div className="space-y-1 p-3">
                    <p className="line-clamp-2 text-sm font-medium">{item.prompt}</p>
                    <p className="text-xs text-muted-foreground">
                      {item.mode === "text-to-image" ? "文生图" : "图生图"}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">暂时还没有生成历史。</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
