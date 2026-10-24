<template>
  <div class="mb-8">
    <h1 class="text-3xl font-bold text-gray-800 mb-2">欢迎回来</h1>
    <p class="text-gray-500 text-sm">请登录您的账户以继续</p>
  </div>

  <el-form ref="formRef" :model="form" :rules="rules" label-position="top" class="login-fields">
    <el-form-item prop="phone" label="手机号">
      <el-input
        :maxlength="11"
        v-model="form.phone"
        placeholder="请输入手机号"
        size="large"
        class="h-12"
        :prefix-icon="User"
      />
    </el-form-item>

    <el-form-item prop="password" label="密码">
      <el-input
        v-model="form.password"
        type="password"
        placeholder="请输入密码"
        size="large"
        class="h-12"
        :prefix-icon="Lock"
        show-password
      />
    </el-form-item>

    <el-form-item class="pt-4">
      <el-button
        type="primary"
        size="large"
        class="w-full h-12 text-base font-semibold bg-linear-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 border-0"
        @click="handleLogin"
      >
        登录
      </el-button>
    </el-form-item>
  </el-form>
</template>

<script setup lang="ts">
  import { ref, toRaw, useTemplateRef } from "vue";
  import {
    ElForm,
    ElFormItem,
    ElInput,
    ElButton,
    type FormInstance,
    ElMessage,
  } from "element-plus";
  import { User, Lock } from "@element-plus/icons-vue";
  import { useLogin } from "@/hooks/useLogin";
  import { useUserStore } from "@/stores/user";
  import type { UserLogin } from "@en/common/user";
  import { login } from "@/apis/user"; //注册接口
  import md5 from "md5";
  const { hide } = useLogin();
  const formRef = useTemplateRef<FormInstance>("formRef");
  const userStore = useUserStore();
  const form = ref<UserLogin>({
    phone: "",
    password: "",
  });

  const rules = {
    phone: [
      { required: true, message: "请输入手机号", trigger: "blur" },
      {
        pattern: /^1[3-9]\d{9}$/,
        message: "请输入正确的手机号",
        trigger: "blur",
      },
    ],
    password: [{ required: true, message: "请输入密码", trigger: "blur" }],
  };

  const handleLogin = async () => {
    await formRef.value?.validate(); //触发校验的
    const res = await login({
      ...toRaw(form.value),
      password: toRaw(md5(form.value.password)),
    });
    if (res.code === 200) {
      userStore.setUser(res.data);
      ElMessage.success("登录成功");
      hide();
    } else {
      ElMessage.error(res.message);
    }
  };
</script>
