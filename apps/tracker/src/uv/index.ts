import type { TrackerConfig, UvDto } from "@en/common/tracker";
import FingerprintJS from "@fingerprintjs/fingerprintjs";
import { UAParser } from "ua-parser-js";
import { reportFetch } from "@/report";

export const getBrowserInfo = () => {
  const ua = new UAParser();

  return {
    browser: ua.getBrowser().name,
    os: ua.getOS().name,
    device: ua.getDevice().type || "desktop",
  };
};

export const getFingerprint = async (config: TrackerConfig, signal?: AbortSignal) => {
  if (!config.userId) return null;
  const browser = getBrowserInfo();
  const fp = await FingerprintJS.load();
  const result = await fp.get();
  const body: UvDto = {
    anonymousId: `${result.visitorId}:${config.userId}`,
    userId: config.userId,
    browser: browser.browser,
    os: browser.os,
    device: browser.device,
  };
  // 上报uv到后端
  const url = config.baseUrl + config.uv.api;
  const res = await reportFetch(url, body, signal);
  return res.data;
};
