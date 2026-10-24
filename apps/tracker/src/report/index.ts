export type VisitorSource = string | (() => string | null);
export const resolveVisitor = (source: VisitorSource): string =>
  (typeof source === "function" ? source() : source) || "";

export const report = (url: string, body: any) => {
  if (!body.visitorId) return; // Pause during identity transitions.
  const blob = new Blob([JSON.stringify(body)], { type: "application/json" });
  navigator.sendBeacon(url, blob);
};

export const reportFetch = async (url: string, body: any, signal?: AbortSignal) => {
  const response = await fetch(url, {
    method: "POST",
    body: JSON.stringify(body),
    keepalive: true,
    signal,
    headers: {
      "Content-Type": "application/json",
    },
  });
  if (!response.ok) throw new Error("Tracker request failed");
  const result = await response.json();
  if (result.code !== 200) throw new Error("Tracker request rejected");
  return result;
};
