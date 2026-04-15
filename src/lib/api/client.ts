"use client";

import type { ApiFailure, ApiSuccess } from "@/lib/api/schema";

type ApiRequestOptions = Omit<RequestInit, "body"> & {
  body?: BodyInit | null;
  json?: unknown;
  dedupe?: boolean;
  dedupeKey?: string;
};

const inflightRequests = new Map<string, Promise<unknown>>();

export class ApiClientError extends Error {
  status: number;
  code?: string;
  details?: unknown;

  constructor(
    message: string,
    init?: {
      status?: number;
      code?: string;
      details?: unknown;
    },
  ) {
    super(message);
    this.name = "ApiClientError";
    this.status = init?.status || 500;
    this.code = init?.code;
    this.details = init?.details;
  }
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function toStableValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(toStableValue);
  }

  if (isPlainObject(value)) {
    return Object.keys(value)
      .sort()
      .reduce<Record<string, unknown>>((acc, key) => {
        acc[key] = toStableValue(value[key]);
        return acc;
      }, {});
  }

  return value;
}

function serializeBody(body: BodyInit | null | undefined) {
  if (!body) {
    return null;
  }

  if (typeof body === "string") {
    return body;
  }

  if (body instanceof FormData) {
    return Array.from(body.entries()).map(([key, value]) => [
      key,
      typeof value === "string"
        ? value
        : {
            name: value.name,
            size: value.size,
            type: value.type,
            lastModified: value.lastModified,
          },
    ]);
  }

  if (body instanceof URLSearchParams) {
    return body.toString();
  }

  if (body instanceof Blob) {
    return {
      type: body.type,
      size: body.size,
    };
  }

  return String(body);
}

function buildRequestKey(
  url: string,
  method: string,
  body: BodyInit | null | undefined,
  json: unknown,
) {
  return JSON.stringify(
    toStableValue({
      url,
      method,
      json,
      body: serializeBody(body),
    }),
  );
}

function isApiSuccess<T>(value: unknown): value is ApiSuccess<T> {
  return isPlainObject(value) && value.ok === true && "data" in value;
}

function isApiFailure(value: unknown): value is ApiFailure {
  return isPlainObject(value) && value.ok === false && "error" in value;
}

async function parseResponseBody(response: Response) {
  if (response.status === 204) {
    return null;
  }

  const contentType = response.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    return response.json();
  }

  const text = await response.text();
  return text || null;
}

function toApiClientError(response: Response, payload: unknown) {
  if (isApiFailure(payload)) {
    return new ApiClientError(payload.error.message, {
      status: response.status,
      code: payload.error.code,
      details: payload.error.details,
    });
  }

  if (typeof payload === "string" && payload.trim()) {
    return new ApiClientError(payload, {
      status: response.status,
    });
  }

  if (isPlainObject(payload) && typeof payload.message === "string") {
    return new ApiClientError(payload.message, {
      status: response.status,
    });
  }

  return new ApiClientError("请求失败", {
    status: response.status,
  });
}

async function executeRequest<T>(url: string, options: ApiRequestOptions = {}) {
  const headers = new Headers(options.headers);
  headers.set("Accept", "application/json");

  let body = options.body;
  if (options.json !== undefined) {
    body = JSON.stringify(options.json);
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(url, {
    ...options,
    method: options.method || (body ? "POST" : "GET"),
    body,
    headers,
    credentials: options.credentials || "same-origin",
  });

  const payload = await parseResponseBody(response);

  if (!response.ok) {
    throw toApiClientError(response, payload);
  }

  if (isApiSuccess<T>(payload)) {
    return payload.data;
  }

  if (isApiFailure(payload)) {
    throw new ApiClientError(payload.error.message, {
      status: response.status,
      code: payload.error.code,
      details: payload.error.details,
    });
  }

  return payload as T;
}

export function getRequestErrorMessage(error: unknown) {
  if (error instanceof ApiClientError) {
    return error.message;
  }

  if (error instanceof Error && error.message) {
    return error.message;
  }

  return "请求失败";
}

export function getRequestErrorDetails<T>(error: unknown) {
  if (error instanceof ApiClientError) {
    return error.details as T | undefined;
  }

  return undefined;
}

export async function apiRequest<T>(url: string, options: ApiRequestOptions = {}) {
  const hasRequestBody = options.body != null || options.json !== undefined;
  const method = options.method || (hasRequestBody ? "POST" : "GET");
  const shouldDedupe = options.dedupe !== false;
  const key =
    options.dedupeKey || buildRequestKey(url, method, options.body, options.json);

  if (!shouldDedupe) {
    return executeRequest<T>(url, options);
  }

  const existing = inflightRequests.get(key);
  if (existing) {
    return existing as Promise<T>;
  }

  const request = executeRequest<T>(url, options).finally(() => {
    inflightRequests.delete(key);
  });

  inflightRequests.set(key, request);

  return request;
}

export const apiClient = {
  request: apiRequest,
  post<T>(url: string, options: Omit<ApiRequestOptions, "method"> = {}) {
    return apiRequest<T>(url, {
      ...options,
      method: "POST",
    });
  },
  postForm<T>(
    url: string,
    formData: FormData,
    options: Omit<ApiRequestOptions, "method" | "body" | "json"> = {},
  ) {
    return apiRequest<T>(url, {
      ...options,
      method: "POST",
      body: formData,
    });
  },
};
