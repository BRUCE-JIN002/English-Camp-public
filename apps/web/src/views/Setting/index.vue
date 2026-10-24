<template>
  <div class="page-container settings-page route-motion px-0 py-6">
    <div class="page-heading settings-heading module-row justify-between">
      <div>
        <div class="text-xl font-extrabold text-slate-900">我的学习空间</div>
        <div class="mt-1 text-sm text-slate-500">
          {{ userStore.getUser ? "在这里管理偏好与个人信息" : "设置外观，登录后查看学习记录" }}
        </div>
      </div>

      <div v-if="userStore.getUser" class="settings-save-actions">
        <span class="settings-save-state" :class="{ 'is-dirty': isDirty }" role="status">{{ saving ? '正在保存…' : isDirty ? '有未保存的修改' : '所有修改已保存' }}</span>
        <div class="module-row">
        <el-button :disabled="!isDirty || saving" @click="init">重置</el-button>
        <el-button :disabled="!isDirty" :loading="saving" @click="onSave" type="primary"
          >保存</el-button
        >
        </div>
      </div>
    </div>
    <div class="settings-scroll" tabindex="0" aria-label="设置内容">
    <section class="settings-personal-group" aria-label="个人信息">
    <h2 class="settings-mobile-group-title">个人信息<span v-if="userStore.getUser" class="settings-edit-hint">点击内容可编辑</span></h2>
    <section class="settings-overview" aria-label="学习记录">
      <div class="settings-learning-stats">
        <div><el-icon><Sunny /></el-icon><span>打卡天数</span><strong>{{ userStore.getUser ? userStore.getUser.dayNumber ?? 0 : '—' }}<small v-if="userStore.getUser">天</small></strong></div>
        <button type="button" class="learned-stat-link" aria-label="查看已学单词，开始复习" @click="openLearned"><el-icon><Star /></el-icon><span>已学单词</span><strong>{{ userStore.getUser ? userStore.getUser.wordNumber ?? 0 : '—' }}<small v-if="userStore.getUser">个</small></strong><span class="learned-stat-action">查看单词 · 开始复习 <span aria-hidden="true"><ArrowUpRight /></span></span></button>
      </div>
    </section>
    <el-row :gutter="16" class="mt-4 setting-row">
      <el-col :span="8">
        <el-card v-if="userStore.getUser" shadow="never">
          <template #header>
            <div class="font-bold">头像</div>
          </template>

          <div class="module-row">
            <el-image
              v-if="previewUrl"
              class="settings-avatar-image h-25 w-25 rounded-full border-2 border-gray-200 object-cover"
              :src="previewUrl"
              @error="previewUrl = ''"
              :zoom-rate="1.2"
              :max-scale="1.5"
              :min-scale="0.5"
              :scale="0.2"
              :preview-src-list="[previewUrl]"
              show-progress
              hide-on-click-modal
              fit="cover"
            />

            <span v-else class="guest-avatar settings-avatar-placeholder" role="img" aria-label="默认用户图标"><el-icon><User /></el-icon></span>

            <div class="flex flex-col gap-2">
              <el-upload
                :show-file-list="false"
                :auto-upload="false"
                accept="image/*"
                :on-change="onAvatarSelect"
              >
                <el-button type="primary">更换头像</el-button>
              </el-upload>

              <div class="text-xs text-slate-500">
                支持 png/jpg/webp，建议小于 2MB
              </div>
            </div>
          </div>
        </el-card>

        <el-card shadow="never" class="mt-4">
          <template #header>
            <div class="font-bold">账号</div>
          </template>

          <div class="text-sm text-slate-600">
            <div class="flex items-center justify-between">
              <span>登录状态</span>
              <el-tag :type="userStore.getUser ? 'success' : 'info'">{{ userStore.getUser ? '已登录' : '未登录' }}</el-tag>
            </div>
          </div>
          <div v-if="!userStore.getUser" class="settings-login-prompt"><p>登录后查看学习记录、管理个人资料。</p><el-button type="primary" @click="loginForSettings">登录</el-button></div>
        </el-card>

      </el-col>

      <el-col v-if="userStore.getUser" :span="16">
        <el-card shadow="never">
          <template #header>
            <div class="settings-info-title"><strong>个人信息</strong><span class="settings-edit-hint">修改后点击保存</span></div>
          </template>

          <el-form
            class="setting-form"
            label-width="140px"
            :model="form"
            :rules="rules"
            ref="formRef"
            :disabled="saving"
            status-icon
          >
            <el-form-item label="用户名" prop="name">
              <el-input
                class="w-full"
                v-model="form.name"
                placeholder="请输入用户名"
                clearable
              />
            </el-form-item>

            <el-form-item label="手机号">
              <el-input
                class="w-full"
                :model-value="userStore.getUser?.phone ?? ''"
                readonly
                aria-label="注册手机号，不可修改"
              />
            </el-form-item>

            <el-form-item label="邮箱" prop="email">
              <el-input
                class="w-full"
                v-model="form.email"
                placeholder="请输入邮箱"
                clearable
              />
            </el-form-item>

            <el-form-item class="setting-switch-row settings-timing-desktop" label="定时任务" prop="isTimingTask">
              <el-switch v-model="form.isTimingTask" :before-change="beforeTimingChange" />
            </el-form-item>
            <el-form-item class="settings-timing-desktop" label="定时任务时间" prop="timingTaskTime">
              <div class="w-full">
                <el-time-picker
                  style="width: 100%"
                  format="HH:mm:ss"
                  value-format="HH:mm:ss"
                  v-model="form.timingTaskTime"
                  placeholder="请选择定时任务时间"
                />
                <div class="setting-tip mt-3 text-xs text-slate-500">
                  填写邮箱并开启提醒，每天给自己一点学习动力。
                </div>
              </div>
            </el-form-item>

            <el-form-item label="地址" prop="address">
              <el-input
                class="w-full"
                v-model="form.address"
                placeholder="请输入地址"
                clearable
              />
            </el-form-item>

            <el-form-item label="签名" prop="bio">
              <el-input
                class="w-full"
                v-model="form.bio"
                placeholder="写点什么介绍一下自己"
                type="textarea"
                :rows="4"
                maxlength="120"
                show-word-limit
              />
            </el-form-item>
          </el-form>
        </el-card>


      </el-col>
    </el-row>
    </section>
    <el-card v-if="userStore.getUser" shadow="never" class="settings-timing-mobile">
      <template #header><h2 class="font-bold">定时任务</h2></template>
      <el-form class="setting-form" :model="form" :disabled="saving">
        <el-form-item class="setting-switch-row" label="开启定时任务">
          <el-switch v-model="form.isTimingTask" :before-change="beforeTimingChange" />
        </el-form-item>
        <el-form-item label="提醒时间">
          <div class="w-full">
            <el-time-picker v-model="form.timingTaskTime" style="width: 100%" format="HH:mm:ss" value-format="HH:mm:ss" placeholder="请选择提醒时间" />
            <p class="setting-tip mt-3 text-xs text-slate-500">先填写个人信息中的邮箱并选择时间，再开启提醒。</p>
          </div>
        </el-form-item>
      </el-form>
    </el-card>
    <el-card shadow="never" class="settings-operations-group" :class="{ 'settings-guest-operations': !userStore.getUser }">
      <template #header><h2 class="font-bold"><span class="settings-desktop-title">危险操作</span><span class="settings-mobile-title">偏好与账号操作</span></h2></template>
      <section class="settings-theme-panel" aria-label="主题外观">
        <h3 class="font-bold">主题外观</h3>
        <div class="settings-theme-options" role="group" aria-label="主题模式">
          <label v-for="option in themeOptions" :key="option.value">
            <input type="radio" name="mobile-theme" :value="option.value" :checked="themeMode === option.value" @change="changeTheme(option.value, $event)" />
            <span>{{ option.label }}</span>
          </label>
        </div>
      </section>
      <section v-if="userStore.getUser" class="settings-danger-section" aria-label="危险操作">
          <div class="flex items-center justify-between">
            <div>
              <div class="font-bold text-slate-900">退出登录</div>
              <div class="text-sm text-slate-500">清除本地登录状态</div>
            </div>
            <el-button @click="logoutHandle" type="danger" plain>
              退出
            </el-button>
          </div>
          <div class="settings-delete-row flex items-center justify-between gap-4 mt-6 pt-6 border-t border-[var(--el-border-color-light)]">
            <div>
              <div class="settings-delete-title"><span>注销账户</span></div>
              <div class="text-sm text-slate-500">永久删除个人资料、学习记录、课程购买记录和聊天数据，无法恢复</div>
            </div>
            <el-button @click="deleteAccountHandle" type="danger" :loading="deletingAccount" :disabled="saving">
              注销账户
            </el-button>
          </div>
      </section>
    </el-card>
    </div>
  </div>
</template>

<script setup lang="ts">
  import ArrowUpRight from "@/components/Icons/ArrowUpRight.vue";
  import { ref, watch, useTemplateRef, computed } from "vue";
  import type { UserUpdate } from "@en/common/user";
  import type { FormRules } from "element-plus";
  import { useUserStore } from "@/stores/user";
  import { uploadAvatar, deleteOwnAccount } from "@/apis/user"; //上传头像接口
  import type { UploadFile, FormInstance } from "element-plus"; //上传文件类型
  import { updateUser } from "@/apis/user"; //更新用户信息接口
  import { ElMessage, ElMessageBox } from "element-plus"; //提示信息
  import { useAvatar } from "@/hooks/useAvatar";
  import { useLogin } from "@/hooks/useLogin";
  import { useRouter } from "vue-router";
  import { useTheme, type ThemeMode } from "@/hooks/useTheme";
  import { Sunny, Star, User } from "@element-plus/icons-vue";

  const router = useRouter();
  const openLearned = async () => { try { await login(); await router.push("/learned"); } catch {} };
  const { customAvatar } = useAvatar();
  const { logout, login } = useLogin();
  const { themeMode, setTheme } = useTheme();
  const themeOptions = [
    { value: 'light', label: '亮色' },
    { value: 'dark', label: '暗色' },
    { value: 'system', label: '跟随系统' },
  ] as const;
  const changeTheme = (mode: ThemeMode, event: Event) => {
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    void setTheme(mode, { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 });
  };
  const loginForSettings = async () => { try { await login(); init(); } catch {} };
  const formRef = useTemplateRef<FormInstance>("formRef"); //表单ref
  const userStore = useUserStore();
  const previewUrl = ref<string>("");
  const form = ref<UserUpdate>({
    name: "", //用户名
    email: "", //邮箱
    isTimingTask: false, //是否开启定时任务
    timingTaskTime: "", //定时任务时间
    address: "", //地址
    bio: "", //签名
    avatar: "", //头像
  });

  const srcList = [previewUrl];
  const initial = ref<UserUpdate | null>(null);
  const saving = ref(false);
  const isDirty = computed(() => {
    if (!initial.value) return false;
    return JSON.stringify(form.value) !== JSON.stringify(initial.value);
  });

  //上传头像
  const onAvatarSelect = async (file: UploadFile) => {
    const formData = new FormData();
    formData.append("file", file.raw as File);
    const res = await uploadAvatar(formData);
    if (res.success && res.data) {
      form.value.avatar = res.data.databaseUrl;
      // Use the same public media URL as saved avatars, not MinIO's internal host.
      previewUrl.value = customAvatar(res.data.databaseUrl);
    } else {
      ElMessage.error(res.message);
    }
  };

  const timingReady = () => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.value.email || '')
    && /^([01]\d|2[0-3]):[0-5]\d:[0-5]\d$/.test(form.value.timingTaskTime || '');
  const beforeTimingChange = () => {
    if (form.value.isTimingTask || timingReady()) return true;
    ElMessage.warning('请先填写有效邮箱并选择提醒时间');
    return false;
  };
  watch(() => [form.value.email, form.value.timingTaskTime], () => {
    if (form.value.isTimingTask && !timingReady()) {
      form.value.isTimingTask = false;
      ElMessage.warning('邮箱或提醒时间不完整，定时任务已关闭，请保存修改');
    }
  });

  //表单验证规则
  const rules: FormRules = {
    name: [{ required: true, message: "请输入用户名", trigger: "blur" }],
    email: [
      { required: false, message: "请输入邮箱", trigger: "blur" },
      {
        validator: (rule, value, callback) => {
          if (
            value &&
            !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
          ) {
            callback(new Error("请输入正确的邮箱"));
          } else {
            callback();
          }
        },
        trigger: "blur",
      },
    ],
    isTimingTask: [
      {
        required: true,
        message: "请选择是否开启定时任务",
        trigger: "blur",
        type: "boolean",
      },
    ],
    timingTaskTime: [
      { validator: (_rule, _value, callback) => callback(form.value.isTimingTask && !timingReady() ? new Error("请填写有效邮箱并选择提醒时间") : undefined), trigger: "change" },
    ],
  };

  //提交保存接口的
  const onSave = async () => {
    if (!isDirty.value || saving.value) return;
    if (form.value.isTimingTask && !timingReady()) {
      ElMessage.warning('请先填写有效邮箱并选择提醒时间');
      return;
    }
    const valid = await formRef.value?.validate().catch(() => false);
    if (!valid) return;
    saving.value = true;
    try {
      const res = await updateUser({ ...form.value });
      if (!res.success || !res.data) throw new Error(res.message || '保存失败');
      userStore.updateUser(res.data);
      initial.value = { ...form.value };
      ElMessage.success("修改已保存");
    } catch {
      ElMessage.error('保存失败，修改内容已保留，请重试');
    } finally { saving.value = false; }
  };

  const deletingAccount = ref(false);
  const deleteAccountHandle = async () => {
    if (deletingAccount.value) return;
    deletingAccount.value = true;
    try {
      await ElMessageBox.confirm(
        "注销后，个人资料、学习与签到记录、课程购买权益、支付记录及 AI 聊天数据将永久删除，无法恢复。确定继续吗？",
        "注销账户", { confirmButtonText: "继续注销", cancelButtonText: "取消", type: "warning", closeOnClickModal: false },
      );
      const confirmation = await ElMessageBox.prompt(
        "这是不可恢复的操作。请输入“注销账户”完成二次确认。",
        "确认永久注销", {
          confirmButtonText: "永久注销", cancelButtonText: "取消", type: "warning",
          inputPattern: /^注销账户$/, inputErrorMessage: "请输入完整的“注销账户”",
          closeOnClickModal: false,
        },
      );
      if (typeof confirmation === "string") return;
      const result = await deleteOwnAccount(confirmation.value);
      if (result.code !== 200) throw new Error(result.message || "注销失败，请重试");
      logout();
      ElMessage.success("账户及相关数据已删除，已退出登录");
    } catch (error: any) {
      if (error !== "cancel" && error !== "close") {
        ElMessage.error(error?.response?.data?.message || error?.message || "注销失败，请稍后重试");
      }
    } finally { deletingAccount.value = false; }
  };

  //退出登录
  const logoutHandle = () => {
    ElMessageBox.confirm("确定退出登录吗？", "提示", {
      customClass: "logout-confirm",
      confirmButtonText: "确定",
      cancelButtonText: "取消",
      type: "warning",
    }).then((data) => {
      logout();
    });
  };

  const init = () => {
    //如果用户登录了，则获取用户信息
    if (userStore.getUser) {
      form.value = { ...userStore.getUpdateUserInfo };
      previewUrl.value = customAvatar(form.value.avatar!);
      initial.value = { ...form.value };
    }
  };

  watch(() => userStore.getUser?.id, () => { init(); }, { immediate: true });
  watch(() => userStore.user && { ...userStore.getUpdateUserInfo }, () => {
    if (!isDirty.value && !saving.value) init();
  });
</script>
