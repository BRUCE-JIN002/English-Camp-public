<template>
  <div class="page-container chat-page">
    <div class="chat-workspace" :class="{ 'sidebar-collapsed': sidebarCollapsed }" @touchstart.passive="onSwipeStart" @touchmove="onSwipeMove" @touchend="onSwipeEnd" @touchcancel="cancelSwipe" @keydown.esc="closeMobileSidebar">
      <div id="agent-sidebar" class="chat-sidebar-slot" :inert="sidebarCollapsed">
      <Conversations
        :modes="chatModeList"
        :activeId="activeId"
        @onGetRole="selectRole"
        @saved="onAgentSaved"
        @deleted="onAgentDeleted"
      />
      </div>
      <button v-if="isMobile && !sidebarCollapsed" class="agent-sidebar-backdrop" aria-label="关闭 Agent 列表" tabindex="-1" @click="closeMobileSidebar" />
      <section class="chat-main" :inert="isMobile && !sidebarCollapsed">
        <div class="chat-main-toolbar">
          <button class="chat-sidebar-toggle" :aria-label="sidebarCollapsed ? '展开 Agent 列表' : '收起 Agent 列表'" :title="sidebarCollapsed ? '展开 Agent 列表' : '收起 Agent 列表'" :aria-expanded="!sidebarCollapsed" aria-controls="agent-sidebar" @click="sidebarCollapsed = !sidebarCollapsed"><el-icon><Expand v-if="sidebarCollapsed" /><Fold v-else /></el-icon></button>
          <span class="chat-current-agent" :title="currentAgent?.name" :style="{ backgroundColor: currentAgent?.accentColor || '#50d8f5' }">
            <span v-if="currentAgent" class="chat-current-agent-icon" aria-hidden="true">{{ currentAgent.icon }}</span>
            <span class="agent-name">{{ currentAgent?.name ?? 'AI 对话' }}</span>
          </span>
        </div>
      <div v-if="modesLoading || modesError || !activeId" class="agent-chat-empty">
        <h2>{{ modesLoading ? '正在加载语伴…' : modesError ? '语伴加载失败' : '创建你的第一个 Agent' }}</h2>
        <p>{{ modesError ? '请检查网络或重新登录后重试。' : '点击左侧加号，设置名称、图标和人物设定。' }}</p>
        <el-button v-if="modesError" @click="initModes">重新加载</el-button>
      </div>
      <Bubble v-else
        class="min-w-0 flex-1"
        :list="chatList"
        :role="role"
        :aiIcon="aiIcon"
        :streaming="streaming"
        :loadingHistory="loadingHistory"
        :animationStart="animationStart"
        :conversationVersion="conversationVersion"
        :disableVoice="isMobile"
        @onEditMessage="onEditMessage"
        @onRegenerate="onRegenerate"
        @onSendMessage="sendMessage"
      />
      </section>
    </div>
  </div>
</template>
<script setup lang="ts">
  import { Fold, Expand } from "@element-plus/icons-vue";
  import Conversations from "./components/Conversations.vue";
  import Bubble from "./components/Bubble.vue";
  import { useUserStore } from "@/stores/user";
  import { getSelectedChatRole, rememberChatRole, forgetChatRole } from "@/stores/chatSelection";
  import { getChatHistory, getChatMode } from "@/apis/chat";
  import { ref, reactive, markRaw, computed, onMounted, onBeforeUnmount, nextTick } from "vue";
  import { ElMessage } from "element-plus";
  import { sse, CHAT_URL } from "@/apis/sse";
  import type {
    ChatDto,
    ChatMode,
    ChatModeList,
    ChatMessageList,
    ChatRoleType,
  } from "@en/common/chat";

  type StreamDelta = {
    type: "chat" | "reasoning";
    content: string;
  };

  const modesLoading = ref(true);
  const modesError = ref(false);

  const defaultIcon = "💬";

  const role = ref<ChatRoleType>("normal");
  const chatModeList = ref<ChatModeList>([]);
  const activeId = ref<string | null>(null);
  const mobileLayout = window.matchMedia('(max-width: 600px)');
  const isMobile = ref(mobileLayout.matches);
  const sidebarCollapsed = ref(isMobile.value);
  const syncMobileLayout = () => {
    isMobile.value = mobileLayout.matches;
    sidebarCollapsed.value = isMobile.value;
    cancelSwipe();
  };
  const closeMobileSidebar = () => {
    if (!isMobile.value) return;
    sidebarCollapsed.value = true;
    nextTick(() => document.querySelector<HTMLButtonElement>('.chat-sidebar-toggle')?.focus({ preventScroll: true }));
  };
  const selectRole = (newRole: ChatRoleType) => {
    closeMobileSidebar();
    if (newRole !== role.value || !activeId.value || !getConversation(newRole).loaded) return getRole(newRole);
  };
  let swipe: { x: number; y: number; dx: number; horizontal: boolean } | null = null;
  function cancelSwipe() { swipe = null; }
  function onSwipeStart(event: TouchEvent) {
    cancelSwipe();
    if (!isMobile.value || event.touches.length !== 1) return;
    const target = event.target as HTMLElement;
    // Let text editing, code scrolling and teleported dialogs keep their gestures.
    if (target.closest('input, textarea, pre, code, [contenteditable="true"], .el-overlay, .el-popper')) return;
    const touch = event.touches[0]!;
    swipe = { x: touch.clientX, y: touch.clientY, dx: 0, horizontal: false };
  }
  function onSwipeMove(event: TouchEvent) {
    if (!swipe || event.touches.length !== 1) return cancelSwipe();
    const touch = event.touches[0]!;
    const dx = touch.clientX - swipe.x;
    const dy = touch.clientY - swipe.y;
    if (!swipe.horizontal) {
      if (Math.abs(dy) > 12 && Math.abs(dy) >= Math.abs(dx)) return cancelSwipe();
      if (Math.abs(dx) < 12 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
      if ((sidebarCollapsed.value && dx < 0) || (!sidebarCollapsed.value && dx > 0)) return cancelSwipe();
      swipe.horizontal = true;
    }
    swipe.dx = dx;
    if (event.cancelable) event.preventDefault();
  }
  function onSwipeEnd() {
    if (swipe?.horizontal && Math.abs(swipe.dx) >= 56) {
      if (swipe.dx > 0) sidebarCollapsed.value = false;
      else closeMobileSidebar();
    }
    cancelSwipe();
  }

  const currentAgent = computed(() => chatModeList.value.find(agent => agent.id === activeId.value));
  const aiIcon = ref<string>(defaultIcon);
  const userStore = useUserStore();
  const userId = userStore.user?.id;
  type Conversation = {
    messages: ChatMessageList;
    controller: AbortController | null;
    loading: boolean;
    loaded: boolean;
    animationStart: number | null;
  };
  const conversations = new Map<string, Conversation>();
  const getConversation = (key: string) => {
    let state = conversations.get(key);
    if (!state) {
      state = reactive<Conversation>({ messages: [], controller: null, loading: false, loaded: false, animationStart: null });
      conversations.set(key, state);
    }
    return state;
  };
  const conversation = computed(() => getConversation(role.value));
  const chatList = computed({ get: () => conversation.value.messages, set: value => { conversation.value.messages = value; } });
  const streaming = computed(() => !!conversation.value.controller);
  const loadingHistory = computed(() => conversation.value.loading);
  const animationStart = computed({ get: () => conversation.value.animationStart, set: value => { conversation.value.animationStart = value; } });
  const conversationVersion = ref(0);
  let disposed = false;
  const stopStream = (state = conversation.value) => {
    state.controller?.abort();
    state.controller = null;
  };
  onBeforeUnmount(() => {
    disposed = true;
    conversations.forEach(state => stopStream(state));
    mobileLayout.removeEventListener("change", syncMobileLayout);
  });

  const initModes = async () => {
    modesLoading.value = true;
    modesError.value = false;
    try {
      const res = await getChatMode();
      if (res.code !== 200) throw new Error(res.message);
      chatModeList.value = res.data ?? [];
      if (disposed) return;
      const remembered = userId ? getSelectedChatRole(userId) : undefined;
      const selected = chatModeList.value.find(agent => agent.role === remembered) ?? chatModeList.value[0];
      if (selected) await getRole(selected.role);
    } catch { modesError.value = true; }
    finally { modesLoading.value = false; }
  };

  const onAgentSaved = async (agent: ChatMode, created: boolean) => {
    const index = chatModeList.value.findIndex(item => item.role === agent.role);
    if (index >= 0) chatModeList.value[index] = agent;
    else chatModeList.value.push(agent);
    if (created || !activeId.value) await getRole(agent.role);
    else if (role.value === agent.role) {
      aiIcon.value = agent.icon;
    }
  };

  const onAgentDeleted = async (deletedRole: string) => {
    if (userId) forgetChatRole(userId, deletedRole);
    chatModeList.value = chatModeList.value.filter(item => item.role !== deletedRole);
    const deleted = conversations.get(deletedRole);
    if (deleted) stopStream(deleted);
    conversations.delete(deletedRole);
    if (role.value !== deletedRole) return;
    activeId.value = null;
    role.value = '';
    const first = chatModeList.value[0];
    if (first) await getRole(first.role);
  };

  const getRole = async (newRole: ChatRoleType) => {
    role.value = newRole;
    const state = getConversation(newRole);
    state.animationStart = null;
    conversationVersion.value++;
    const current = chatModeList.value.find((m) => m.role === newRole);
    activeId.value = current?.id ?? null;
    if (current && userId) rememberChatRole(userId, current.role);
    aiIcon.value = current?.icon ?? defaultIcon;
    // A background reply owns its message array; never replace it with a history snapshot.
    if (state.loaded || state.loading || state.controller || !userId) return;
    state.loading = true;
    const isCurrent = () => !disposed && conversations.get(newRole) === state;
    try {
      const res = await getChatHistory(userId, newRole);
      if (!res.success) throw new Error(res.message);
      if (isCurrent()) {
        state.messages = res.data ?? [];
        state.loaded = true;
      }
    } catch {
      if (isCurrent() && role.value === newRole) ElMessage.error('历史对话加载失败，请重新选择对话模式重试');
    } finally {
      if (isCurrent()) {
        state.loading = false;
        if (role.value === newRole) conversationVersion.value++;
      }
    }
  };

  const requestReply = (content: string, deepThink: boolean, webSearch: boolean) => {
    stopStream();
    const state = conversation.value;
    const target = state.messages[state.messages.length - 1]!;
    const controller = new AbortController();
    state.controller = markRaw(controller);
    const finish = () => {
      if (state.controller === controller) state.controller = null;
    };
    sse<StreamDelta, ChatDto>(CHAT_URL, 'POST', {
      role: role.value, content, userId: userId!, deepThink, webSearch,
    }, (data) => {
      if (controller.signal.aborted) return;
      if (data.type === 'reasoning') target.reasoning = (target.reasoning || '') + data.content;
      else if (data.type === 'chat') target.content += data.content;
    }, () => {
      if (!target.content) target.content = '回复暂时未能完成，请点击重新生成再试一次。';
      finish();
    }, controller, () => {
      if (!target.content && !target.reasoning) target.content = '未收到回复，请点击重新生成再试一次。';
      finish();
    });
  };

  const sendMessage = (message: string, deepThink: boolean, webSearch: boolean) => {
    if (!activeId.value || streaming.value || loadingHistory.value || !message.trim()) return;
    animationStart.value = chatList.value.length;
    chatList.value.push({ role: 'human', content: message, type: 'chat' });
    chatList.value.push({ role: 'ai', content: '', reasoning: '', type: 'chat' });
    requestReply(message, deepThink, webSearch);
  };

  const onRegenerate = (payload: { index: number; deepThink: boolean; webSearch: boolean }) => {
    if (loadingHistory.value) return;
    const human = chatList.value[payload.index - 1];
    if (!human || human.role !== 'human') return;
    stopStream();
    animationStart.value = payload.index;
    chatList.value = chatList.value.slice(0, payload.index);
    chatList.value.push({ role: 'ai', content: '', type: 'chat' });
    requestReply(human.content, payload.deepThink, payload.webSearch);
  };

  const onEditMessage = (payload: { index: number; content: string; deepThink: boolean; webSearch: boolean }) => {
    if (loadingHistory.value) return;
    stopStream();
    animationStart.value = payload.index + 1;
    chatList.value = chatList.value.slice(0, payload.index + 1);
    chatList.value[payload.index] = { role: 'human', content: payload.content, type: 'chat' };
    chatList.value.push({ role: 'ai', content: '', type: 'chat' });
    requestReply(payload.content, payload.deepThink, payload.webSearch);
  };

  onMounted(() => {
    mobileLayout.addEventListener("change", syncMobileLayout);
    initModes();
  });
</script>
