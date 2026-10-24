import type { PerformanceDto, TrackerConfig } from "@en/common/tracker";
import { report, resolveVisitor, type VisitorSource } from "@/report";
import { onINP, onCLS } from "web-vitals";

export const reportPerformance = async (
  visitorId: VisitorSource,
  config: TrackerConfig,
) => {
  const url = config.baseUrl + config.performance.api;
  //FP 首次绘制时间 绘制任意一个像素点，或者任意一点内容就算一次FP
  //FCP 首次内容绘制时间 绘制任意内容渲染出来就算一次FCP
  let fp = 0;
  let fcp = 0;
  let inp = 0;
  let cls = 0;
  let lcp = 0;
  let performanceEntries = performance.getEntriesByType("paint");

  const fpEntry = performanceEntries.find(
    (entry) => entry.name === "first-paint",
  );

  const fcpEntry = performanceEntries.find(
    (entry) => entry.name === "first-contentful-paint",
  );

  if (fpEntry) {
    fp = fpEntry.startTime;
  }

  if (fcpEntry) {
    fcp = fcpEntry.startTime;
  }
  //LCP 最大内容绘制时间 最大内容绘制时间就是LCP
  let lcpPromise = new Promise<{
    lcpTime: number;
    lcpOverser: PerformanceObserver;
  }>((resolve) => {
    let lcpOverser = new PerformanceObserver((entryList) => {
      for (const entry of entryList.getEntries()) {
        lcp = entry.startTime;
        resolve({
          lcpTime: lcp,
          lcpOverser,
        });
      }
    });
    lcpOverser.observe({ type: "largest-contentful-paint", buffered: true });
  });

  const { lcpTime, lcpOverser } = await lcpPromise;
  lcpOverser.disconnect();
  lcp = lcpTime;

  //INP 交互性能指标 交互性能指标就是INP
  onINP(
    (metric) => {
      inp = metric.value;
    },
    { reportAllChanges: true },
  );

  onCLS(
    (metric) => {
      cls = metric.value;
    },
    { reportAllChanges: true },
  );

  window.addEventListener(
    "visibilitychange",
    () => {
      if (document.visibilityState === "hidden") {
        const body: PerformanceDto = {
          visitorId: resolveVisitor(visitorId),
          fp,
          fcp,
          lcp,
          inp,
          cls,
        };
        report(url, body);
      }
    },
    { once: true },
  );
};
