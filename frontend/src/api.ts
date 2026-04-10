export interface ApiResponseMeta<T> {
  ok: boolean;
  status: number;
  data: T;
  traceId: string | null;
}

async function parseJsonResponse<T>(response: Response): Promise<ApiResponseMeta<T>> {
  const contentType = response.headers.get("content-type");
  if (!contentType || !contentType.includes("application/json")) {
    throw new Error("Server returned non-JSON response");
  }

  const data = (await response.json()) as T;
  return {
    ok: response.ok,
    status: response.status,
    data,
    traceId: response.headers.get("x-trace-id")
  };
}

export async function apiGet<T = unknown>(path: string): Promise<T> {
  const response = await fetch(path, { credentials: "include" });
  const parsed = await parseJsonResponse<T>(response);
  return parsed.data;
}

export async function apiGetWithMeta<T = unknown>(path: string): Promise<ApiResponseMeta<T>> {
  const response = await fetch(path, { credentials: "include" });
  return parseJsonResponse<T>(response);
}

export async function apiPost<T = unknown>(path: string, data?: unknown): Promise<T> {
  const response = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(data ?? {})
  });

  const parsed = await parseJsonResponse<T>(response);
  return parsed.data;
}

export async function apiPostWithMeta<T = unknown>(path: string, data?: unknown): Promise<ApiResponseMeta<T>> {
  const response = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(data ?? {})
  });
  return parseJsonResponse<T>(response);
}
