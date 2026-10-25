import type { ErrorDto, TrackerConfig } from "@en/common/tracker";
import { report, resolveVisitor, type VisitorSource } from "@/report";

const errorMessage = (reason: unknown): string => {
  if (typeof reason === "string") return reason;
  if (reason && typeof (reason as Error).message === "string") return (reason as Error).message;
  try {
    return JSON.stringify(reason) ?? String(reason);
  } catch {
    // Promise rejection values may be circular objects or contain BigInt.
    try { return String(reason); } catch { return "Unknown error"; }
  }
};

export const reportError = async (visitorId: VisitorSource, config: TrackerConfig) => {
  const url = config.baseUrl + config.error.api;

  window.addEventListener("error", (e: ErrorEvent) => {
    const body: ErrorDto = {
      visitorId: resolveVisitor(visitorId),
      error: "js",
      message: e.message || errorMessage(e.error),
      stack: typeof e.error?.stack === "string" ? e.error.stack : "Stack unavailable",
      url: e.filename || window.location.href,
      column: e.colno ?? 0,
      line: e.lineno ?? 0,
    };
    report(url, body);
  });

  window.addEventListener("unhandledrejection", (e: PromiseRejectionEvent) => {
    const body: ErrorDto = {
      visitorId: resolveVisitor(visitorId),
      error: "promise",
      message: errorMessage(e.reason),
      stack: typeof e.reason?.stack === "string" ? e.reason.stack : "Promise Rejection",
      url: window.location.href,
      column: typeof e.reason?.column === "number" ? e.reason.column : 0,
      line: typeof e.reason?.line === "number" ? e.reason.line : 0,
    };
    report(url, body);
  });
};
