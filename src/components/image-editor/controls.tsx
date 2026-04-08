"use client";

import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import type { EditorMode } from "@/types";
import { ImageUploader } from "./uploader";

type ControlsProps = {
  mode: EditorMode;
  previewUrl: string | null;
  pending: boolean;
  onModeChange: (mode: EditorMode) => void;
  onFileChange: (file: File | null) => void;
};

export function Controls({
  mode,
  previewUrl,
  pending,
  onModeChange,
  onFileChange,
}: ControlsProps) {
  return (
    <Card className="border-white/80">
      <CardHeader className="space-y-3">
        <div className="inline-flex w-fit items-center gap-2 rounded-full bg-secondary px-3 py-1 text-xs font-medium text-secondary-foreground">
          <Sparkles className="size-3.5" />
          Gemini Studio Init
        </div>
        <CardTitle>多模态画板</CardTitle>
        <CardDescription>
          已完成项目初始化。现在可以直接填写提示词，或上传一张参考图走图生图链路。
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <input name="mode" type="hidden" value={mode} />
        <Tabs value={mode} onValueChange={(value) => onModeChange(value as EditorMode)}>
          <TabsList>
            <TabsTrigger value="text-to-image">文生图</TabsTrigger>
            <TabsTrigger value="image-to-image">图生图</TabsTrigger>
          </TabsList>
          <TabsContent value="text-to-image" className="space-y-4">
            <Textarea
              defaultValue="A cinematic editorial photo of a brutalist gallery hall filled with floating translucent screens, warm daylight, refined detail"
              name="prompt"
              placeholder="描述你想生成的场景、风格、镜头和光线。"
            />
          </TabsContent>
          <TabsContent value="image-to-image" className="space-y-4">
            <Textarea
              defaultValue="Keep the subject composition, transform the scene into a premium poster aesthetic with warm highlights and crisp detail"
              name="prompt"
              placeholder="描述要如何修改这张图，例如风格、光照、材质或构图微调。"
            />
            <ImageUploader
              previewUrl={previewUrl}
              onFileChange={onFileChange}
              disabled={pending}
            />
          </TabsContent>
        </Tabs>
        <div className="space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium">创意强度</span>
            <span className="text-muted-foreground">初始化占位参数</span>
          </div>
          <Slider defaultValue={[65]} max={100} name="creativity" step={1} />
        </div>
        <Button className="w-full" disabled={pending} type="submit">
          {pending ? "生成中..." : "生成图片"}
        </Button>
      </CardContent>
    </Card>
  );
}
