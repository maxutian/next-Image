"use client";

import Image from "next/image";
import { ImagePlus } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type ImageUploaderProps = {
  previewUrl: string | null;
  onFileChange: (file: File | null) => void;
  disabled?: boolean;
};

export function ImageUploader({
  previewUrl,
  onFileChange,
  disabled,
}: ImageUploaderProps) {
  return (
    <Card className="overflow-hidden border-dashed">
      <CardContent className="p-4">
        <label
          className={cn(
            "flex cursor-pointer flex-col items-center justify-center gap-4 rounded-[1.4rem] border border-border/80 bg-white/60 p-6 text-center transition hover:bg-white",
            disabled && "cursor-not-allowed opacity-60",
          )}
        >
          <div className="flex size-14 items-center justify-center rounded-full bg-secondary text-primary">
            <ImagePlus className="size-6" />
          </div>
          <div className="space-y-1">
            <p className="text-sm font-medium">上传参考图</p>
            <p className="text-sm text-muted-foreground">
              支持 PNG、JPG、WEBP，上传后会即时预览。
            </p>
          </div>
          <Input
            accept="image/*"
            className="hidden"
            disabled={disabled}
            name="sourceImage"
            type="file"
            onChange={(event) => onFileChange(event.target.files?.[0] ?? null)}
          />
          {previewUrl ? (
            <div className="w-full overflow-hidden rounded-[1.25rem] border border-border bg-muted">
              <Image
                alt="Uploaded preview"
                className="h-56 w-full object-cover"
                height={448}
                src={previewUrl}
                unoptimized
                width={768}
              />
            </div>
          ) : (
            <div className="flex h-40 w-full items-center justify-center rounded-[1.25rem] bg-muted text-sm text-muted-foreground">
              预览会显示在这里
            </div>
          )}
        </label>
      </CardContent>
    </Card>
  );
}
