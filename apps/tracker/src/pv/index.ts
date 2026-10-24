import type { PvDto, TrackerConfig } from "@en/common/tracker";
import { report, resolveVisitor, type VisitorSource } from "@/report";

// 上报pv
export const reportView = (visitorId: VisitorSource, config: TrackerConfig) => {
  const url = config.baseUrl + config.pv.api;
  const isHash = window.location.href.includes("#");
  const body: PvDto = {
    visitorId: resolveVisitor(visitorId),
    url: window.location.protocol + "//" + window.location.host,
    referrer: document.referrer,
    path: isHash ? "/" + window.location.hash : window.location.pathname,
  };
  report(url, body);
};

export const reportPv = (visitorId: VisitorSource, config: TrackerConfig) => {
  reportView(visitorId, config);
  //路由两种模式hash history
  window.addEventListener("hashchange", () => {
    reportView(visitorId, config);
  });
  //监听history模式 前进和后退
  window.addEventListener("popstate", () => {
    reportView(visitorId, config);
  });
  //pushState和replaceState
  const originalPushState = history.pushState;
  history.pushState = function () {
    originalPushState.apply(this, arguments);
    reportView(visitorId, config);
  };
  const originalReplaceState = history.replaceState;
  history.replaceState = function () {
    originalReplaceState.apply(this, arguments);
    reportView(visitorId, config);
  };
};
