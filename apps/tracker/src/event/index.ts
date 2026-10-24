import type { EventDto, TrackerConfig } from "@en/common/tracker";
import { report, resolveVisitor, type VisitorSource } from "@/report";

export const reportEvent = (visitorId: VisitorSource, config: TrackerConfig) => {
  const url = config.baseUrl + config.event.api;
  const nodeName = "BUTTON";
  const spanName = "SPAN";
  document.addEventListener("click", (e: MouseEvent) => {
    const target = e.target as HTMLElement;
    const sendEvent = () => {
      const react = target.getBoundingClientRect();
      const body: EventDto = {
        visitorId: resolveVisitor(visitorId),
        event: e.type,
        payload: {
          x: react.left.toFixed(2) || 0,
          y: react.top.toFixed(2) || 0,
          width: react.width.toFixed(2) || 0,
          height: react.height.toFixed(2) || 0,
          text: target.textContent,
        },
        url: window.location.href,
      };
      report(url, body);
    };

    if (target.nodeName === nodeName) {
      sendEvent();
    }
    if (
      target.nodeName === spanName &&
      target.parentElement?.nodeName === nodeName
    ) {
      sendEvent();
    }
  });
};
