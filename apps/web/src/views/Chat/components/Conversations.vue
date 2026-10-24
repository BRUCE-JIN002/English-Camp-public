<template>
  <div class="conversation-sidebar">
    <div class="agent-sidebar-intro">
    <div class="agent-sidebar-heading"><h2>一起聊英语</h2><button class="agent-add" aria-label="新增 Agent" @click="openEditor()"><el-icon><Plus /></el-icon></button></div>
    <p class="sidebar-caption">每个话题，都是新开始</p>
    </div>
    <p v-if="!modes.length" class="agent-empty-hint">创建一个专属语伴，开始聊天。</p>
    <div v-for="(mode, index) in modes" :key="mode.id" class="conversation-mode agent-row" :data-active="activeId === mode.id" :style="{ '--mode-delay': `${100 + Math.min(index, 7) * 35}ms` }">
      <button class="agent-select" :title="mode.name" :aria-pressed="activeId === mode.id" @click="emit('onGetRole', mode.role)"><span aria-hidden="true">{{ mode.icon }}</span><span class="agent-name">{{ mode.name }}</span></button>
      <button class="agent-edit" :aria-label="`编辑 ${mode.name}`" @click="openEditor(mode)"><el-icon><MoreFilled /></el-icon></button>
    </div>
    <el-dialog v-model="editorOpen" :title="editing ? '编辑 Agent' : '新建 Agent'" width="480px" align-center append-to-body class="agent-editor" modal-class="agent-editor-overlay" :close-on-click-modal="!saving" :close-on-press-escape="!saving" :show-close="!saving">
      <el-form label-position="top" @submit.prevent="save">
        <el-form-item label="名称" required><el-input v-model="draft.name" maxlength="30" show-word-limit placeholder="例如：口语陪练" :disabled="saving" /></el-form-item>
        <el-form-item label="图标" required>
          <el-popover v-model:visible="iconPickerOpen" trigger="click" placement="bottom-start" :width="248" :disabled="saving" popper-class="agent-icon-popover">
            <template #reference>
              <button type="button" class="agent-icon-trigger" :disabled="saving" aria-label="选择 Agent 图标" :aria-expanded="iconPickerOpen">
                <span>{{ draft.icon }}</span><el-icon><ArrowDown /></el-icon>
              </button>
            </template>
            <div class="agent-icon-options" role="group" aria-label="可选图标"><button v-for="icon in icons" :key="icon" type="button" :aria-label="`使用 ${icon}`" :aria-pressed="draft.icon === icon" @click="selectIcon(icon)">{{ icon }}</button></div>
          </el-popover>
        </el-form-item>
        <el-form-item label="强调色">
          <el-popover v-model:visible="colorPickerOpen" trigger="click" placement="bottom-start" :width="248" :disabled="saving" popper-class="agent-icon-popover">
            <template #reference>
              <button type="button" class="agent-icon-trigger" :disabled="saving" aria-label="选择 Agent 强调色" :aria-expanded="colorPickerOpen">
                <span class="agent-color-label"><i class="agent-color-dot" :style="{ backgroundColor: draft.accentColor }" /></span><el-icon><ArrowDown /></el-icon>
              </button>
            </template>
            <div class="agent-color-options" role="group" aria-label="可选强调色">
              <button v-for="color in agentAccentColors" :key="color.value" type="button" :aria-label="color.name" :aria-pressed="draft.accentColor === color.value" :style="{ backgroundColor: color.value }" @click="selectColor(color.value)"><el-icon v-if="draft.accentColor === color.value"><Check /></el-icon></button>
            </div>
          </el-popover>
        </el-form-item>
        <el-form-item label="人物设定" required><el-input v-model="draft.prompt" type="textarea" :rows="6" maxlength="6000" show-word-limit placeholder="描述角色的身份、说话风格、使用语言，以及你希望它如何帮助你。" :disabled="saving" /></el-form-item>
        <p class="agent-editor-note">设定将在下一次回复时生效，已有聊天记录会保留。</p>
      </el-form>
      <template #footer><div class="agent-editor-actions"><el-button v-if="editing" type="danger" plain :disabled="saving" @click="remove">删除 Agent</el-button><span class="agent-action-spacer" /><el-button :disabled="saving" @click="editorOpen = false">取消</el-button><el-button type="primary" :loading="saving" @click="save">保存</el-button></div></template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { reactive, ref, watch } from 'vue';
import { Plus, MoreFilled, ArrowDown, Check } from '@element-plus/icons-vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import type { ChatMode, ChatModeList } from '@en/common/chat';
import { agentAccentColors, defaultAgentAccentColor } from '@en/common/chat/colors.js';
import { createChatAgent, updateChatAgent, deleteChatAgent } from '@/apis/chat';
defineProps<{ modes: ChatModeList; activeId: string | null }>();
const emit = defineEmits<{
  onGetRole: [role: string];
  saved: [agent: ChatMode, created: boolean];
  deleted: [role: string];
}>();
const editorOpen = ref(false);
const saving = ref(false);
const editing = ref<ChatMode | null>(null);
const draft = reactive({ name: '', icon: '💬', prompt: '', accentColor: defaultAgentAccentColor as string });
const colorPickerOpen = ref(false);
function selectColor(color: string) { draft.accentColor = color; colorPickerOpen.value = false; }
const iconPickerOpen = ref(false);
const icons = ['💬', '🎓', '🌍', '💼', '🎨', '🤖', '🧠', '🐱',
  '📚', '✍️', '🎤', '🎧', '🎵', '🎬', '🎮', '💻',
  '🔬', '🧪', '🔭', '🚀', '✈️', '🧭', '🏕️', '☕',
  '🍳', '🌱', '🌻', '⭐', '💡', '🔥', '🦊', '🐼',
  '🐶', '🐧', '🐉', '🦄', '🧙', '🦸', '👩', '🕶️'];
watch(editorOpen, () => { iconPickerOpen.value = false; colorPickerOpen.value = false; });
function selectIcon(icon: string) {
  draft.icon = icon;
  iconPickerOpen.value = false;
}
function openEditor(agent?: ChatMode) {
  editing.value = agent ?? null;
  Object.assign(draft, agent ? { name: agent.name, icon: agent.icon, prompt: agent.prompt, accentColor: agent.accentColor ?? defaultAgentAccentColor } : { name: '', icon: '💬', prompt: '', accentColor: defaultAgentAccentColor });
  editorOpen.value = true;
}
function errorMessage(error: any) { return error?.response?.data?.message || '操作失败，请稍后重试'; }
async function save() {
  if (saving.value) return;
  const input = { name: draft.name.trim(), icon: draft.icon.trim(), prompt: draft.prompt.trim(), accentColor: draft.accentColor };
  if (!input.name || !input.icon || !input.prompt) return void ElMessage.warning('请填写名称、图标和人物设定');
  saving.value = true;
  try {
    const created = !editing.value;
    const res = editing.value ? await updateChatAgent(editing.value.role, input) : await createChatAgent(input);
    if (res.code !== 200) throw new Error(res.message);
    emit('saved', res.data, created);
    editorOpen.value = false;
    ElMessage.success('Agent 已保存');
  } catch (error) { ElMessage.error(errorMessage(error)); }
  finally { saving.value = false; }
}
async function remove() {
  const agent = editing.value;
  if (!agent || saving.value) return;
  try { await ElMessageBox.confirm(`删除「${agent.name}」后将从你的列表移除。聊天记录不会清除。`, '删除 Agent', { type: 'warning', confirmButtonText: '删除', cancelButtonText: '取消', customClass: 'logout-confirm' }); }
  catch { return; }
  saving.value = true;
  try {
    await deleteChatAgent(agent.role);
    emit('deleted', agent.role);
    editorOpen.value = false;
    ElMessage.success('Agent 已删除');
  } catch (error) { ElMessage.error(errorMessage(error)); }
  finally { saving.value = false; }
}
</script>
