import { NextResponse } from "next/server";
import type { ApiFailure, ApiSuccess } from "@/lib/api/schema";

export function apiSuccess<T>(data: T, init?: ResponseInit) {
  return NextResponse.json<ApiSuccess<T>>(
    {
      ok: true,
      data,
    },
    init,
  );
}

export function apiError(
  message: string,
  init?: {
    status?: number;
    code?: string;
    details?: unknown;
    headers?: HeadersInit;
  },
) {
  return NextResponse.json<ApiFailure>(
    {
      ok: false,
      error: {
        message,
        code: init?.code,
        details: init?.details,
      },
    },
    {
      status: init?.status || 500,
      headers: init?.headers,
    },
  );
}

