import { onBeforeUnmount, ref } from "vue";

export interface Options {
  lang?: string;
  continuous?: boolean;
  interimResults?: boolean;
  maxAlternatives?: number;
}

export const useVoiceToText = (options: Options) => {
  const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  const isSupported = !!Recognition;
  const isRecording = ref(false);
  const error = ref("");
  let recognition: SpeechRecognition | null = null;

  // Voice input is optional. Never initialize it during chat component setup.
  const start = (callback?: (result: string) => void) => {
    error.value = "";
    if (!Recognition) {
      error.value = "当前浏览器不支持语音输入，请使用文字聊天";
      return;
    }
    if (isRecording.value) return;
    try {
      if (!recognition) {
        recognition = new Recognition();
        recognition.lang = options.lang ?? "zh-CN";
        recognition.continuous = options.continuous ?? false;
        recognition.interimResults = options.interimResults ?? false;
        recognition.maxAlternatives = options.maxAlternatives ?? 1;
        recognition.onend = () => { isRecording.value = false; };
        recognition.onerror = (event) => {
          isRecording.value = false;
          if (event.error !== "aborted") {
            error.value = event.error === "not-allowed" || event.error === "service-not-allowed"
              ? "无法使用麦克风，请检查浏览器权限或使用文字聊天"
              : "语音识别暂不可用，请重试或使用文字聊天";
          }
        };
      }
      recognition.onresult = (event) => {
        let text = "";
        for (let i = 0; i < event.results.length; i++) {
          text += event.results[i]?.[0]?.transcript || "";
        }
        callback?.(text);
      };
      recognition.start();
      isRecording.value = true;
    } catch {
      isRecording.value = false;
      error.value = "语音输入启动失败，请使用文字聊天";
    }
  };

  const stop = () => {
    isRecording.value = false;
    try { recognition?.stop(); } catch { /* Already stopped by the browser. */ }
  };

  onBeforeUnmount(() => {
    if (!recognition) return;
    recognition.onend = null;
    recognition.onerror = null;
    recognition.onresult = null;
    try { recognition.abort(); } catch { /* Browser may already have released it. */ }
    recognition = null;
  });

  return { isSupported, isRecording, error, start, stop };
};
