import { getChatAccessToken } from "@/apis/chat/auth";
import { fetchEventSource } from "@microsoft/fetch-event-source";
import type { Method } from "axios";

export const CHAT_URL = "/ai/v1/chat";

export const sse = <T, V = any>(
  url: string,
  method: Method = "POST",
  data: V,
  callback?: (data: T) => void,
  errorCallback?: (error: Error) => void,
  controller?: AbortController,
  completeCallback?: () => void,
): AbortController => {
  const abortController = controller ?? new AbortController();
  getChatAccessToken().then((token) => {
    if (abortController.signal.aborted) return;
    return fetchEventSource(url, {
    signal: abortController.signal,
    method: method.toUpperCase(),
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    async onopen(response) {
      if (!response.ok || !response.headers.get("content-type")?.includes("text/event-stream")) {
        throw new Error("对话连接失败，请重新登录或重试");
      }
    },
    body: JSON.stringify(data),
    onmessage: (event) => {
      try {
        const parsed = JSON.parse(event.data) as T;
        callback?.(parsed);
      } catch (e) {
        // 非致命解析错误不抛出，交由上层决定
      }
    },
    onclose: () => completeCallback?.(),
    onerror: (error) => {
      // 若已手动中止，不再回调错误
      if (abortController.signal.aborted) return;
      throw error;
    },
    });
  }).catch((error: Error) => {
    if (!abortController.signal.aborted) errorCallback?.(error);
  });
  return abortController;
};
