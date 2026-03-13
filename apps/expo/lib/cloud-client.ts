import { z } from "zod";

import { secureApiFetch } from "./integrity";
import { getApiBaseUrl } from "./api-config";

const API_BASE_URL = getApiBaseUrl();

async function getErrorMessage(
  response: Response,
  fallbackMessage: string,
): Promise<string> {
  try {
    const payload = await response.json();
    if (typeof payload?.error === "string") {
      return payload.error;
    }
    if (typeof payload?.message === "string") {
      return payload.message;
    }
  } catch {
    return fallbackMessage;
  }

  return fallbackMessage;
}

async function parseResponse<T>(
  response: Response,
  schema: z.ZodType<T>,
  fallbackMessage: string,
): Promise<T> {
  if (!response.ok) {
    throw new Error(await getErrorMessage(response, fallbackMessage));
  }

  return schema.parse(await response.json());
}

async function ensureSuccess(
  response: Response,
  fallbackMessage: string,
): Promise<void> {
  if (!response.ok) {
    throw new Error(await getErrorMessage(response, fallbackMessage));
  }
}

export function createCloudClient(token?: string) {
  const getAuthHeaders = (headers: Record<string, string> = {}) => {
    if (!token) {
      throw new Error("Not authenticated");
    }

    return {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...headers,
    };
  };

  const request = (path: string, options: RequestInit = {}) =>
    secureApiFetch(`${API_BASE_URL}${path}`, {
      ...options,
      headers: getAuthHeaders((options.headers as Record<string, string>) ?? {}),
    });

  const jsonRequest = (
    method: "POST" | "PUT",
    path: string,
    body?: unknown,
  ) =>
    request(path, {
      method,
      body: body === undefined ? undefined : JSON.stringify(body),
    });

  return {
    get: async <T>(
      path: string,
      schema: z.ZodType<T>,
      fallbackMessage: string,
    ): Promise<T> =>
      parseResponse(await request(path), schema, fallbackMessage),
    post: async <T>(
      path: string,
      body: unknown,
      schema: z.ZodType<T>,
      fallbackMessage: string,
    ): Promise<T> =>
      parseResponse(
        await jsonRequest("POST", path, body),
        schema,
        fallbackMessage,
      ),
    put: async <T>(
      path: string,
      body: unknown,
      schema: z.ZodType<T>,
      fallbackMessage: string,
    ): Promise<T> =>
      parseResponse(
        await jsonRequest("PUT", path, body),
        schema,
        fallbackMessage,
      ),
    delete: async (path: string, fallbackMessage: string) => {
      await ensureSuccess(
        await request(path, { method: "DELETE" }),
        fallbackMessage,
      );
      return { success: true as const };
    },
  };
}
