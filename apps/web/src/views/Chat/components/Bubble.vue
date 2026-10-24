<template>
  <div
    class="chat-bubble relative flex h-full min-w-0 flex-1 flex-col overflow-hidden p-5 rounded-tr-xl rounded-br-xl rounded-l-none"
  >
    <div
      class="chat-scroll w-full flex-1 overflow-y-auto mx-auto max-w-[920px] pt-4 pb-8"
      ref="scrollRef"
      @scroll="handleScroll"
    >
      <el-skeleton v-if="loadingHistory" :rows="5" animated class="p-4" />
      <div v-else :key="conversationVersion" class="conversation-content">
      <div v-if="!list?.length" class="chat-welcome"><span aria-hidden="true">“</span><h1>Hi，今天想聊点什么？</h1><p>选一个对话模式，用一句简单的英语开始。<br>不用担心说错，练习就是进步。</p><button class="camp-button" @click="message = 'Hi! Can we practice a simple everyday conversation?'">试试日常英语</button></div>
      <div v-for="(item, index) in list" :key="messageKey(item)" :class="{ 'message-arrival': animationStart != null && index >= animationStart }">
        <!-- 人类消息 -->
        <template v-if="item.role === 'human'">
          <div
            class="mt-5 mr-1 flex items-start justify-end gap-3 sm:mr-5 sm:gap-4"
          >
            <template v-if="editingIndex === index">
              <div class="flex-1 max-w-[80%]">
                <div
                  class="rounded-xl border border-blue-500/50 bg-blue-50/40 px-3 py-2"
                >
                  <textarea
                    v-model="editingContent"
                    rows="3"
                    class="w-full bg-transparent outline-none resize-none text-sm text-slate-800 placeholder:text-slate-400"
                  />
                  <div class="mt-2 flex justify-end gap-2">
                    <button
                      class="px-3 py-1.5 rounded-full text-xs font-semibold border border-gray-300 text-slate-700 bg-white hover:border-gray-400 transition cursor-pointer"
                      type="button"
                      @click="cancelEdit"
                    >
                      Cancel
                    </button>
                    <button
                      class="px-3 py-1.5 rounded-full text-xs font-semibold bg-blue-600 text-white hover:bg-blue-700 transition disabled:opacity-50 cursor-pointer"
                      type="button"
                      :disabled="!editingContent"
                      @click="submitEdit(index)"
                    >
                      Send
                    </button>
                  </div>
                </div>
              </div>
            </template>
            <template v-else>
              <div
                class="human-message max-w-[85%] rounded-lg bg-blue-500 p-2 text-sm text-white shadow-md sm:max-w-[80%]"
              >
                {{ item.content }}
              </div>
            </template>
            <div>
              <el-avatar v-if="avatar" :size="35"
                ><img :src="avatar" @error="onAvatarError"
              /></el-avatar>
              <span v-else class="guest-avatar" role="img" aria-label="默认用户图标"><el-icon><User /></el-icon></span>
            </div>
          </div>
          <div class="mt-1 mr-1 flex justify-end sm:mr-5">
            <div class="flex max-w-[85%] items-center gap-3 sm:max-w-[80%]">
              <button
                class="text-slate-500 hover:text-slate-700 transition flex items-center cursor-pointer"
                type="button"
                title="复制"
                @click="copyText(item.content)"
              >
                <el-icon :size="16"><CopyDocument /></el-icon>
              </button>
              <button
                class="text-slate-500 hover:text-slate-700 transition flex items-center cursor-pointer"
                type="button"
                title="编辑"
                @click="startEdit(index, item.content)"
              >
                <el-icon :size="16"><EditPen /></el-icon>
              </button>
            </div>
          </div>
        </template>
        <!-- AI 消息 -->
        <template v-else>
          <div class="mt-5 mb-1 flex items-start justify-start gap-2 sm:gap-4">
            <el-avatar :size="30" class="shrink-0 sm:size-[35px]">{{
              aiIconText
            }}</el-avatar>
            <div class="min-w-0 flex-1">
              <div v-if="streaming && index === (list?.length ?? 0) - 1 && !item.content && !item.reasoning" class="reply-waiting" role="status" aria-label="正在等待 AI 回复">
                <span aria-hidden="true"></span><span aria-hidden="true"></span><span aria-hidden="true"></span>
                <span class="sr-only">正在等待 AI 回复</span>
              </div>
              <div
                v-if="item.role === 'ai' && item.reasoning"
                class="max-w-[85%] p-2 text-[12px] text-gray-500 sm:max-w-[80%]"
              >
                {{ item.reasoning }}
              </div>
              <div
                v-if="item.role === 'ai' && item.content !== ''"
                class="deepseek-markdown mt-2 w-full max-w-[85%] rounded-lg bg-white text-sm text-gray-700 sm:max-w-[80%]"
                v-html="parseMarkdown(item.content)"
              />
            </div>
          </div>

          <div
            v-if="item.content !== ''"
            class="ml-[34px] flex items-center gap-3 sm:ml-[54px]"
          >
            <button
              class="text-slate-500 hover:text-slate-700 transition flex items-center cursor-pointer"
              type="button"
              title="复制"
              @click="copyText(item.content)"
            >
              <el-icon :size="16"><CopyDocument /></el-icon>
            </button>
            <button
              class="text-slate-500 hover:text-slate-700 transition flex items-center cursor-pointer"
              type="button"
              title="重新生成"
              @click="regenerate(index)"
            >
              <el-icon :size="16"><RefreshRight /></el-icon>
            </button>
          </div>
        </template>
      </div>
      </div>
      <div ref="chatRef"></div>
    </div>
    <div class="box-border border-t border-transparent">
      <div
        class="chat-composer relative mx-auto w-full max-w-[920px] rounded-2xl border border-gray-200 bg-white/90 px-4 py-3 shadow-sm"
      >
        <div class="flex items-start">
          <textarea
            v-model="message"
            rows="2"
            aria-label="输入聊天消息"
            class="flex-1 bg-transparent outline-none resize-none text-sm text-slate-800 placeholder:text-slate-400"
            placeholder="聊聊今天，或试着用英语说一句 Hello…"
            @keydown.enter.exact.prevent="sendMessage"
          />
        </div>
        <div class="chat-composer-actions absolute bottom-3 right-3 flex items-center gap-3">
          <button
            v-if="!disableVoice && !isRecording && isVoiceSupported"
            class="chat-voice text-slate-500 hover:text-blue-500 transition flex items-center cursor-pointer"
            type="button"
            title="开启语音"
            @click="startRecording"
          >
            <el-icon :size="18"><Mute /></el-icon>
          </button>
          <button
            v-else-if="!disableVoice && isRecording"
            class="chat-voice text-blue-500 transition flex items-center cursor-pointer"
            type="button"
            title="关闭语音"
            @click="stopRecording"
          >
            <el-icon :size="18"><Microphone /></el-icon>
          </button>
          <button
            class="chat-send size-9 rounded-full ml-2 bg-blue-600 text-white flex items-center justify-center hover:bg-blue-700 transition disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
            type="button"
            :disabled="!message.trim() || streaming || loadingHistory"
            @click="sendMessage"
            :title="streaming ? '正在回复…' : '发送'"
            :aria-label="streaming ? '正在回复' : '发送消息'"
          >
            <el-icon><Position /></el-icon>
          </button>
        </div>
        <div class="mt-3 flex items-center justify-between">
          <div class="module-row">
            <button
              type="button"
              class="chat-think-chip" :aria-pressed="deepThink"
              :class="[chipBase, deepThink ? chipActive : chipInactive]"
              @click="deepThink = !deepThink"
            >
              <span>🧠</span>
              DeepThink
            </button>
            <button
              type="button"
              class="chat-search-chip" :aria-pressed="webSearch"
              :class="[chipBase, webSearch ? chipActive : chipInactive]"
              @click="webSearch = !webSearch"
            >
              <span>🌐</span>
              Search
            </button>
          </div>
        </div>
      </div>
    </div>
    <Transition name="jump-bottom">
    <button
      v-if="showJumpBottom"
      class="absolute right-10 bottom-60 z-10 flex size-9 cursor-pointer items-center justify-center rounded-full bg-transparent text-blue-400 shadow-md transition hover:bg-gray-100 sm:right-10 sm:bottom-40"
      type="button"
      title="回到底部"
      @click="scrollToBottom"
    >
      <el-icon><Bottom /></el-icon>
    </button>
    </Transition>
  </div>
</template>

<script setup lang="ts">
  import { ref, useTemplateRef, watch, nextTick, computed } from "vue";
  import {
    User,
    Position,
    Microphone,
    Mute,
    CopyDocument,
    EditPen,
    RefreshRight,
    Bottom,
  } from "@element-plus/icons-vue";
  import { ElMessage } from "element-plus";
  import type { ChatMessageList, ChatRoleType } from "@en/common/chat";
  import { marked } from "marked";
  import { useAvatar } from "@/hooks/useAvatar";
  import "@/assets/css/deep-seek.css";
  import { useVoiceToText } from "@/hooks/useVocieToText";

  const emit = defineEmits(["onSendMessage", "onEditMessage", "onRegenerate"]);
  const props = defineProps<{
    list?: ChatMessageList;
    role?: ChatRoleType;
    aiIcon?: string;
    streaming?: boolean;
    loadingHistory?: boolean;
    animationStart?: number | null;
    conversationVersion?: number;
    disableVoice?: boolean;
  }>();
  const messageIds = new WeakMap<object, number>();
  let nextMessageId = 0;
  const messageKey = (item: object) => {
    if (!messageIds.has(item)) messageIds.set(item, ++nextMessageId);
    return messageIds.get(item)!;
  };
  const message = ref<string>("");
  const deepThink = ref<boolean>(false);
  const webSearch = ref<boolean>(false);
  const autoStickBottom = ref(true);
  const showJumpBottom = ref(false);
  const editingIndex = ref<number | null>(null);
  const editingContent = ref<string>("");
  const chatRef = useTemplateRef<HTMLDivElement>("chatRef");
  const scrollRef = useTemplateRef<HTMLDivElement>("scrollRef");

  const { avatar, onAvatarError } = useAvatar();
  const { isSupported: isVoiceSupported, isRecording, error: voiceError, start, stop } = useVoiceToText({
    lang: "zh-CN",
    continuous: true,
  });
  watch(voiceError, (error) => { if (error) ElMessage.warning(error); });
  watch(() => props.disableVoice, (disabled) => {
    if (disabled) stop();
  });
  const aiIconText = computed(() => props.aiIcon ?? "AI");
  const chipBase = "px-3 py-1.5 rounded-full text-xs font-semibold transition";
  const chipActive =
    "border border-blue-500 text-blue-700 bg-blue-50 hover:bg-blue-100 cursor-pointer";
  const chipInactive =
    "border border-gray-300 text-slate-700 bg-white hover:border-blue-400 cursor-pointer";

  const handleScroll = () => {
    const el = scrollRef.value;
    if (!el) return;
    const distanceToBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    autoStickBottom.value = distanceToBottom < 24;
    showJumpBottom.value = distanceToBottom > 120;
  };

  // 开始录音
  const startRecording = () => {
    if (props.disableVoice) return;
    start((result) => {
      if (props.disableVoice) return;
      message.value = result;
    });
  };
  // 停止录音
  const stopRecording = () => {
    stop();
  };

  // 滚动到底部
  const scrollToBottom = () => {
    const el = scrollRef.value;
    if (el) el.scrollTo({
      top: el.scrollHeight,
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
    });
  };

  // 复制文本
  const copyText = (text: string) => {
    try {
      navigator.clipboard.writeText(text);
      ElMessage.success("复制成功");
    } catch {}
  };

  // 开始编辑
  const startEdit = (index: number, content: string) => {
    editingIndex.value = index;
    editingContent.value = content;
  };

  // 取消编辑
  const cancelEdit = () => {
    editingIndex.value = null;
    editingContent.value = "";
  };

  // 提交编辑
  const submitEdit = (index: number) => {
    if (!editingContent.value) return;
    emit("onEditMessage", {
      index,
      content: editingContent.value,
      deepThink: deepThink.value,
      webSearch: webSearch.value,
    });
    cancelEdit();
  };

  // 重新生成
  const regenerate = (index: number) => {
    emit("onRegenerate", {
      index,
      deepThink: deepThink.value,
      webSearch: webSearch.value,
    });
  };

  watch(
    () => props.list,
    (newVal) => {
      if (!newVal) return;
      const shouldFollow = autoStickBottom.value;
      nextTick(() => {
        const el = scrollRef.value;
        if (!el) return;
        if (shouldFollow && autoStickBottom.value) el.scrollTop = el.scrollHeight;
        showJumpBottom.value = el.scrollHeight - el.scrollTop - el.clientHeight > 120;
      });
    },
    {
      immediate: true,
      deep: true,
    },
  );

  watch(() => props.conversationVersion, async () => {
    autoStickBottom.value = true;
    editingIndex.value = null;
    await nextTick();
    const el = scrollRef.value;
    if (el) el.scrollTop = el.scrollHeight;
    handleScroll();
  });

  // 发送消息
  const sendMessage = () => {
    if (!message.value.trim() || props.streaming || props.loadingHistory) {
      return;
    }
    autoStickBottom.value = true;
    emit("onSendMessage", message.value.trim(), deepThink.value, webSearch.value);
    message.value = "";
  };

  // 解析Markdown
  const parseMarkdown = (markdown: string) => {
    if (!markdown) {
      return "";
    }
    return marked.parse(markdown);
  };
</script>

<style scoped>
  .conversation-content { animation: conversation-enter 200ms ease-out; }
  .message-arrival { animation: message-enter 220ms ease-out; }
  .chat-send { transition: background-color 180ms ease, opacity 180ms ease, transform 150ms ease; }
  .chat-send:enabled:active { transform: scale(.9); }
  .reply-waiting { display: flex; gap: 6px; align-items: center; min-height: 36px; padding: 8px 12px; color: #7042d9; }
  :global(.dark .reply-waiting) { color: #c6a6ff; }
  .reply-waiting > span:not(.sr-only) { width: 6px; height: 6px; border-radius: 50%; background: currentColor; animation: waiting-dot 900ms ease-in-out infinite; }
  .reply-waiting > span:nth-child(2) { animation-delay: 150ms; }
  .reply-waiting > span:nth-child(3) { animation-delay: 300ms; }
  .jump-bottom-enter-active, .jump-bottom-leave-active { transition: opacity 180ms ease, transform 180ms ease; }
  .jump-bottom-enter-from, .jump-bottom-leave-to { opacity: 0; transform: translateY(8px) scale(.95); }
  @keyframes conversation-enter { from { opacity: 0; } to { opacity: 1; } }
  @keyframes message-enter { from { opacity: 0; translate: 0 10px; } to { opacity: 1; translate: 0 0; } }
  @keyframes waiting-dot { 0%, 60%, 100% { transform: translateY(0); opacity: .45; } 30% { transform: translateY(-4px); opacity: 1; } }
  @media (prefers-reduced-motion: reduce) {
    .conversation-content, .message-arrival, .reply-waiting > span:not(.sr-only) { animation: none; }
    .chat-send, .jump-bottom-enter-active, .jump-bottom-leave-active { transition: none; }
    .chat-send:enabled:active { transform: none; }
  }
  .chat-scroll {
    -ms-overflow-style: none;
    scrollbar-width: none;
  }
  .chat-scroll::-webkit-scrollbar {
    display: none;
  }
</style>
