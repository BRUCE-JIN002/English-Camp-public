<template>
  <div
    :class="compact ? 'relative h-full w-full' : 'relative hidden h-full bg-linear-to-br from-gray-800 to-gray-900 lg:block lg:w-[58%]'"
  >
    <canvas class="w-full h-full" ref="canvasRef" />
    <div v-if="!compact" class="absolute top-6 left-6">
      <div class="flex items-center gap-2">
        <div
          class="w-10 h-10 bg-linear-to-br from-indigo-500 to-purple-600 rounded-[10px] flex items-center justify-center"
        >
          <span class="text-white font-bold text-xl">E</span>
        </div>
        <span class="text-white text-xl font-bold">English Camp</span>
      </div>
    </div>
    <!-- 登录/注册切换按钮 -->
    <div v-if="!compact" class="absolute top-6 right-6">
      <div
        class="flex items-center gap-2 bg-white/10 backdrop-blur-sm rounded-lg p-1"
      >
        <button @click="loadModel('login')" :class="loginClass">登录</button>
        <button @click="loadModel('register')" :class="registerClass">
          注册
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
  import {
    ref,
    computed,
    onMounted,
    onBeforeUnmount,
    useTemplateRef,
  } from "vue";
  import * as THREE from "three";
  import type { LoginType } from "./type";
  import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js"; //gltf模型加载器
  import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js"; //轨道控制器
  const props = defineProps<{ compact?: boolean }>();
  const canvasRef = useTemplateRef<HTMLCanvasElement>("canvasRef"); //获取canvas元素引用 渲染容器
  const type = ref<LoginType>("login"); // 登录/注册类型
  const loginClass = computed(() => {
    return type.value === "login"
      ? "bg-indigo-500 text-white shadow-lg px-4 py-2 rounded-md text-sm font-medium transition-all"
      : "text-white/70 hover:text-white hover:bg-white/10 px-4 py-2 rounded-md text-sm font-medium transition-all";
  });
  const registerClass = computed(() => {
    return type.value === "register"
      ? "bg-indigo-500 text-white shadow-lg px-4 py-2 rounded-md text-sm font-medium transition-all"
      : "text-white/70 hover:text-white hover:bg-white/10 px-4 py-2 rounded-md text-sm font-medium transition-all";
  });
  const emits = defineEmits(["changeType"]);
  const scene = new THREE.Scene(); //创建场景
  const clock = new THREE.Clock(); //创建时钟
  let currentModel: THREE.Group | null = null; //记录当前的模型
  let mixer: THREE.AnimationMixer | null = null; //记录当前的动画混合器
  let dispose: (() => void) | null = null;
  let frameModel = () => {};

  let modelRequest = 0;
  let modelReveal: Animation | undefined;
  const loadModel = (url: LoginType) => {
    const request = ++modelRequest;
    type.value = url;
    const loader = new GLTFLoader();
    loader.load(`${import.meta.env.BASE_URL}models/${url}/scene.gltf`, (gltf) => {
      if (request !== modelRequest) return;
      mixer?.stopAllAction();
      mixer = null;
      if (currentModel) scene.remove(currentModel);
      currentModel = gltf.scene;
      scene.add(currentModel);
      scene.position.y = -0.8;
      currentModel.scale.set(0.8, 0.8, 0.8);
      frameModel();
      if (url === 'register' && gltf.animations.length) {
        mixer = new THREE.AnimationMixer(currentModel);
        gltf.animations.forEach((animation) => mixer!.clipAction(animation).play());
      }
      modelReveal?.cancel();
      if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        modelReveal = canvasRef.value?.animate(
          [{ opacity: 0, transform: 'translateY(6px)' }, { opacity: 1, transform: 'translateY(0)' }],
          { duration: 300, easing: 'ease-out' },
        );
      }
    });
    emits('changeType', url);
  };
  defineExpose({
    loadModel,
  });

  const initThree = () => {
    if (!canvasRef.value) {
      return;
    }
    const width = canvasRef.value.clientWidth || 640; //获取canvas宽度
    const height = canvasRef.value.clientHeight || 480; //获取canvas高度
    const camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 1000); //创建相机
    camera.position.set(1, 0.5, 1); //设置相机位置
    const renderer = new THREE.WebGLRenderer({
      canvas: canvasRef.value, //渲染容器
      antialias: true, //抗锯齿
      alpha: true, //透明背景
      precision: "highp", //高精度
      powerPreference: "high-performance", //高性能
    });
    loadModel(type.value);
    renderer.setSize(width, height); //设置渲染器大小
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.render(scene, camera); //渲染场景
    const handleResize = () => {
      if (!canvasRef.value) {
        return;
      }
      const resizeWidth = canvasRef.value.clientWidth || 640;
      const resizeHeight = canvasRef.value.clientHeight || 480;
      camera.aspect = resizeWidth / resizeHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(resizeWidth, resizeHeight, false);
    };
    window.addEventListener("resize", handleResize);
    const controls = new OrbitControls(camera, renderer.domElement); //创建轨道控制器
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    controls.autoRotateSpeed = 0.9;
    if (props.compact) {
      controls.enablePan = false;
      controls.enableZoom = false;
      frameModel = () => {
        if (!currentModel) return;
        scene.position.set(0, 0, 0);
        scene.rotation.set(0, 0, 0);
        const bounds = new THREE.Box3().setFromObject(currentModel);
        const center = bounds.getCenter(new THREE.Vector3());
        const size = bounds.getSize(new THREE.Vector3());
        const distance = Math.max(size.y, size.x / camera.aspect) / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2))) * 1.25 + size.z / 2;
        camera.position.set(center.x, center.y, center.z + distance);
        camera.zoom = type.value === 'login' ? 1.6 : 0.8;
        camera.updateProjectionMatrix();
        controls.target.copy(center);
        controls.update();
      };
    }
    let animationFrame = 0;
    const animate = () => {
      animationFrame = requestAnimationFrame(animate);
      const delta = Math.min(clock.getDelta(), 0.05);
      if (mixer) {
        mixer.update(delta);
      }
      controls.autoRotate = !reducedMotion.matches;
      controls.update(delta); //围绕模型中心缓慢旋转，拖动时暂停自动旋转
      renderer.render(scene, camera); //渲染场景
    };
    animate();
    dispose = () => {
      cancelAnimationFrame(animationFrame);
      window.removeEventListener("resize", handleResize);
      controls.dispose();
      renderer.dispose();
    };
  };

  onMounted(() => {
    initThree();
  });
  onBeforeUnmount(() => {
    ++modelRequest;
    modelReveal?.cancel();
    dispose?.();
  });
</script>
