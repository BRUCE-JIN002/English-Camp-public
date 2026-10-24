import type { ErrorDto, TrackerConfig } from "@en/common/tracker";
import { report, resolveVisitor, type VisitorSource } from "@/report";

export const reportError = async (visitorId: VisitorSource, config: TrackerConfig) => {
  const url = config.baseUrl + config.error.api;

  window.addEventListener("error", (e: ErrorEvent) => {
    const body: ErrorDto = {
      visitorId: resolveVisitor(visitorId),
      error: "js",
      message: e.message,
      stack: e.error.stack,
      url: e.filename,
      column: e.colno,
      line: e.lineno,
    };
    report(url, body);
  });

  window.addEventListener("unhandledrejection", (e: PromiseRejectionEvent) => {
    console.log("promiseEvent2:", e);
    const isError = e.reason instanceof Error;
    const body: ErrorDto = {
      visitorId: resolveVisitor(visitorId),
      error: "promise",
      message: isError ? e.reason.message : JSON.stringify(e.reason),
      stack: isError ? e.reason.stack : "Promise Rejection",
      url: window.location.href,
      column: e.reason.column,
      line: e.reason.line,
    };
    report(url, body);
  });
};
