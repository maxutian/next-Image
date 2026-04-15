export type ApiErrorShape = {
  message: string;
  code?: string;
  details?: unknown;
};

export type ApiSuccess<T> = {
  ok: true;
  data: T;
};

export type ApiFailure = {
  ok: false;
  error: ApiErrorShape;
};

export type ApiResponse<T> = ApiSuccess<T> | ApiFailure;

