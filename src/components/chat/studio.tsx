"use client";

import {
  useEffect,
  useRef,
  useState,
  useTransition,
  type FormEvent,
} from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ImagePlus, MessageSquareText, Plus, RefreshCw } from "lucide-react";
import {
  apiClient,
  getRequestErrorDetails,
  getRequestErrorMessage,
} from "@/lib/api/client";
import type { ChatMessage, ChatSession, ChatTurnState } from "@/types/chat";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import Image from "next/image";
import { cn } from "@/lib/utils";

const ROLE_LABELS: Record<ChatMessage["role"], string> = {
  user: "你",
  assistant: "IImage",
  system: "系统",
};

const messageTimeFormatter = new Intl.DateTimeFormat("zh-CN", {
  hour: "2-digit",
  minute: "2-digit",
});

const sessionTimeFormatter = new Intl.DateTimeFormat("zh-CN", {
  month: "numeric",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

function formatMessageTime(createdAt: string) {
  return messageTimeFormatter.format(new Date(createdAt));
}

function formatSessionTime(updatedAt: string) {
  return sessionTimeFormatter.format(new Date(updatedAt));
}

function getUserMessageStateLabel(status: ChatMessage["status"]) {
  switch (status) {
    case "pending":
      return "处理中";
    case "error":
      return "发送失败";
    default:
      return "已发送";
  }
}

function MessageContent({
  message,
  tone,
}: {
  message: ChatMessage;
  tone: "user" | "assistant" | "system";
}) {
  const mediaClassName =
    tone === "user"
      ? "overflow-hidden rounded-[1rem] border border-white/15 bg-white/10"
      : "overflow-hidden rounded-[1rem] border border-border/70 bg-muted/70";

  return (
    <div className="min-w-0 space-y-3">
      {message.text ? (
        <p className="whitespace-pre-wrap leading-7 break-words">{message.text}</p>
      ) : null}
      {message.images?.length ? (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {message.images.map((img) => (
            <div key={img.id} className={mediaClassName}>
              <Image
                src={img.imageUrl}
                alt={img.prompt}
                width={600}
                height={600}
                className="aspect-square w-full object-cover"
                unoptimized
              />
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user";
  const isSystem = message.role === "system";

  if (isSystem) {
    return (
      <div className="flex justify-center">
        <div className="max-w-[36rem] rounded-full border border-border/70 bg-secondary/70 px-4 py-2 text-center text-xs text-muted-foreground shadow-sm">
          <MessageContent message={message} tone="system" />
        </div>
      </div>
    );
  }

  return (
    <article
      className={cn(
        "flex w-full",
        isUser ? "justify-end pl-8 sm:pl-14" : "justify-start pr-8 sm:pr-14",
      )}
    >
      <div
        className={cn(
          "flex max-w-[42rem] min-w-0 flex-col gap-2",
          isUser ? "items-end" : "items-start",
        )}
      >
        <p
          className={cn(
            "px-1 text-[11px] font-semibold tracking-[0.18em] uppercase",
            isUser ? "text-primary/70" : "text-muted-foreground",
          )}
        >
          {ROLE_LABELS[message.role]}
        </p>
        <div
          className={cn(
            "min-w-0 rounded-[1.6rem] border px-4 py-3 shadow-[0_18px_45px_-30px_rgba(15,23,42,0.32)]",
            isUser
              ? "border-primary/15 bg-primary text-primary-foreground"
              : "border-border/70 bg-background/95 text-foreground",
          )}
        >
          <MessageContent
            message={message}
            tone={isUser ? "user" : "assistant"}
          />
        </div>
        <div
          className={cn(
            "flex items-center gap-2 px-1 text-[11px]",
            isUser ? "text-primary/70" : "text-muted-foreground",
          )}
        >
          <time dateTime={message.createdAt}>{formatMessageTime(message.createdAt)}</time>
          {isUser ? (
            <span
              className={cn(
                "rounded-full border px-2 py-0.5",
                message.status === "error"
                  ? "border-destructive/30 bg-destructive/10 text-destructive"
                  : "border-border/60 bg-background/80",
              )}
            >
              {getUserMessageStateLabel(message.status)}
            </span>
          ) : null}
        </div>
      </div>
    </article>
  );
}

function ChatMessageList({ messages }: { messages: ChatMessage[] }) {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (ref.current) {
      ref.current.scrollTop = ref.current.scrollHeight;
    }
  }, [messages]);

  return (
    <div ref={ref} className="min-h-0 flex-1 overflow-y-auto [scrollbar-gutter:stable]">
      <div className="flex min-h-full flex-col justify-end gap-4 rounded-[1.75rem] border border-white/80 bg-gradient-to-b from-white/72 via-white/64 to-secondary/55 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.75)] sm:p-4">
        {messages.length ? (
          messages.map((message) => (
            <MessageBubble key={message.id} message={message} />
          ))
        ) : (
          <div className="mx-auto flex max-w-sm flex-col items-center rounded-[1.5rem] border border-dashed border-border/80 bg-background/78 px-5 py-4 text-center text-sm text-muted-foreground">
            先发一条消息，开始当前会话。
          </div>
        )}
      </div>
    </div>
  );
}

function Composer({
  sessionId,
  pending,
  onSubmit,
}: {
  sessionId: string;
  pending: boolean;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <form onSubmit={onSubmit} className="space-y-3 border-t border-border/70 pt-4">
      <input type="hidden" name="sessionId" value={sessionId} />
      <div className="rounded-[1.5rem] border border-border/70 bg-background/80 p-3 shadow-sm">
        <Textarea
          name="message"
          placeholder="描述你想生成或修改的效果，支持多轮追问"
          className="min-h-[88px] resize-none border-0 bg-transparent p-0 shadow-none focus-visible:ring-0"
          disabled={pending}
        />
        <div className="mt-4 flex flex-col gap-3 border-t border-border/60 pt-3">
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            <ImagePlus className="size-4" />
            <span>可选上传 1 张参考图，未上传时会优先复用当前会话最近一张结果图。</span>
          </label>
          <input
            name="attachments"
            type="file"
            accept="image/*"
            disabled={pending}
            className="block w-full cursor-pointer rounded-[0.9rem] border border-dashed border-border/70 bg-white/70 px-3 py-2 text-xs text-muted-foreground file:mr-3 file:cursor-pointer file:rounded-full file:border-0 file:bg-secondary file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-foreground"
          />
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-muted-foreground">
              同一会话会自动读取最近上下文，适合连续追问、补充风格和局部修改。
            </p>
            <Button type="submit" className="rounded-[1rem] px-4" disabled={pending}>
              {pending ? (
                <span className="inline-flex items-center gap-2">
                  <RefreshCw className="size-4 animate-spin" /> 生成中
                </span>
              ) : (
                <span className="inline-flex items-center gap-2">发送并生成</span>
              )}
            </Button>
          </div>
        </div>
      </div>
    </form>
  );
}

function SessionList({
  sessions,
  activeSessionId,
  pending,
  switchingSessionId,
  creatingSession,
  onSelect,
  onCreate,
}: {
  sessions: ChatSession[];
  activeSessionId: string;
  pending: boolean;
  switchingSessionId: string | null;
  creatingSession: boolean;
  onSelect: (sessionId: string) => void;
  onCreate: () => void;
}) {
  return (
    <Card className="flex max-h-[22rem] min-h-0 flex-col border-white/80 bg-white/82 lg:h-[min(56rem,calc(100vh-3rem))] lg:max-h-none">
      <CardHeader className="space-y-3 pb-4">
        <div className="space-y-1">
          <CardTitle>会话</CardTitle>
          <CardDescription>新建独立上下文，或切回历史会话继续追问。</CardDescription>
        </div>
        <Button
          type="button"
          variant="outline"
          className="w-full rounded-[1rem]"
          disabled={pending}
          onClick={onCreate}
        >
          {creatingSession ? (
            <>
              <RefreshCw className="size-4 animate-spin" />
              创建中
            </>
          ) : (
            <>
              <Plus className="size-4" />
              新建会话
            </>
          )}
        </Button>
      </CardHeader>
      <CardContent className="min-h-0 flex-1 overflow-hidden pb-6">
        <div className="flex max-h-full flex-col gap-2 overflow-y-auto pr-1">
          {sessions.length ? (
            sessions.map((session) => {
              const isActive = session.id === activeSessionId;
              const isSwitching = session.id === switchingSessionId;

              return (
                <button
                  key={session.id}
                  type="button"
                  disabled={pending}
                  onClick={() => onSelect(session.id)}
                  className={cn(
                    "w-full rounded-[1.25rem] border px-3 py-3 text-left transition",
                    isActive
                      ? "border-primary/20 bg-primary text-primary-foreground shadow-[0_18px_45px_-30px_rgba(59,130,246,0.7)]"
                      : "border-border/70 bg-background/80 hover:bg-secondary/70",
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 space-y-1">
                      <p className="truncate text-sm font-medium">
                        {session.title || "未命名会话"}
                      </p>
                      <p
                        className={cn(
                          "text-xs",
                          isActive ? "text-primary-foreground/80" : "text-muted-foreground",
                        )}
                      >
                        {session.lastImageId ? "已包含生成结果" : "尚未生成图片"}
                      </p>
                    </div>
                    {isSwitching ? (
                      <RefreshCw className="mt-0.5 size-4 animate-spin" />
                    ) : (
                      <MessageSquareText className="mt-0.5 size-4 opacity-70" />
                    )}
                  </div>
                  <p
                    className={cn(
                      "mt-3 text-xs",
                      isActive ? "text-primary-foreground/80" : "text-muted-foreground",
                    )}
                  >
                    更新于 {formatSessionTime(session.updatedAt)}
                  </p>
                </button>
              );
            })
          ) : (
            <div className="rounded-[1.25rem] border border-dashed border-border/80 bg-background/70 px-4 py-5 text-sm text-muted-foreground">
              还没有历史会话，先创建一个。
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export function ChatStudio({ initialState }: { initialState: ChatTurnState }) {
  const [state, setState] = useState(initialState);
  const [pending, startTransition] = useTransition();
  const [switchingSessionId, setSwitchingSessionId] = useState<string | null>(null);
  const [creatingSession, setCreatingSession] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();

  function syncSessionQuery(sessionId: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("session", sessionId);
    const query = params.toString();

    router.replace(query ? `/?${query}` : "/", { scroll: false });
  }

  function applyRequestError(error: unknown) {
    const details = getRequestErrorDetails<ChatTurnState>(error);
    if (details) {
      setState(details);
      return;
    }

    setState((previous) => ({
      ...previous,
      status: "error",
      error: getRequestErrorMessage(error),
    }));
  }

  function handleSelectSession(nextSessionId: string) {
    if (nextSessionId === state.sessionId || pending) {
      return;
    }

    setSwitchingSessionId(nextSessionId);

    startTransition(async () => {
      try {
        const nextState = await apiClient.request<ChatTurnState>(
          `/api/chat/sessions?sessionId=${encodeURIComponent(nextSessionId)}`,
          {
            method: "GET",
            dedupe: false,
          },
        );

        setState(nextState);
        syncSessionQuery(nextState.sessionId);
      } catch (error) {
        applyRequestError(error);
      } finally {
        setSwitchingSessionId(null);
      }
    });
  }

  function handleCreateSession() {
    if (pending) {
      return;
    }

    setCreatingSession(true);

    startTransition(async () => {
      try {
        const nextState = await apiClient.post<ChatTurnState>("/api/chat/sessions", {
          dedupe: false,
        });

        setState(nextState);
        syncSessionQuery(nextState.sessionId);
      } catch (error) {
        applyRequestError(error);
      } finally {
        setCreatingSession(false);
      }
    });
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const form = event.currentTarget;
    const formData = new FormData(form);

    startTransition(async () => {
      setState((previous) => ({
        ...previous,
        status: "pending",
        error: undefined,
      }));

      try {
        const nextState = await apiClient.postForm<ChatTurnState>(
          "/api/chat/turn",
          formData,
        );

        setState(nextState);
        syncSessionQuery(nextState.sessionId);

        if (nextState.status === "success") {
          form.reset();
        }
      } catch (error) {
        const details = getRequestErrorDetails<ChatTurnState>(error);
        const message = getRequestErrorMessage(error);

        if (details) {
          setState(details);
          return;
        }

        setState((previous) => ({
          ...previous,
          status: "error",
          error: message,
        }));
      }
    });
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-7xl items-start justify-center px-4 py-4 sm:px-6 sm:py-6 lg:px-8">
      <section className="grid w-full gap-4 lg:grid-cols-[18rem_minmax(0,1fr)]">
        <SessionList
          sessions={state.sessions}
          activeSessionId={state.sessionId}
          pending={pending}
          switchingSessionId={switchingSessionId}
          creatingSession={creatingSession}
          onSelect={handleSelectSession}
          onCreate={handleCreateSession}
        />

        <Card className="flex h-[min(52rem,calc(100vh-2rem))] w-full min-h-0 flex-col border-white/80 bg-white/82 sm:h-[min(56rem,calc(100vh-3rem))]">
          <CardHeader className="space-y-2">
            <div className="space-y-1">
              <CardTitle>{state.currentSession?.title || "当前会话"}</CardTitle>
              <CardDescription>
                同一会话会自动继承最近对话和上一张结果图；切换会话后上下文完全隔离。
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden">
            <ChatMessageList messages={state.messages} />
            {state.error ? (
              <p className="text-sm text-destructive">{state.error}</p>
            ) : null}
            <Composer
              key={state.sessionId}
              sessionId={state.sessionId}
              pending={pending}
              onSubmit={handleSubmit}
            />
          </CardContent>
        </Card>
      </section>
    </main>
  );
}
