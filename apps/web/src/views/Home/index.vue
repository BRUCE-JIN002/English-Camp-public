<template>
  <div ref="homePage" class="page-container home-page">
    <section class="camp-hero">
      <div class="hero-copy">
        <p class="camp-note"><span class="note-dot"></span> 今天，也向世界多说一句。</p>
        <h1>英语学习，<br>快乐一点！</h1>
        <p class="hero-english">Small steps. Big smiles.</p>
        <p class="hero-description">把单词变成对话，把练习变成日常。<br>和 AI 语伴一起，从第一句 Hello 开始。</p>
        <div class="hero-actions">
          <button class="camp-button primary" @click="goChat">开始 AI 对话 <span aria-hidden="true"><ArrowUpRight /></span></button>
          <button class="camp-button" @click="goCourses">探索课程</button>
        </div>
        <div class="hero-footnote"><span aria-hidden="true">✦</span> 不怕说错，每一次开口都是进步</div>
      </div>
      <div class="hero-art" aria-label="彩色英语对话插画">
        <span class="art-spark spark-one" aria-hidden="true">✳</span>
        <div class="speech speech-hello">Hello, world! <span>✦</span></div>
        <div class="mascot mascot-green"><div class="mascot-eyes"><i></i><i></i></div><div class="mascot-smile"></div><span class="mascot-cheek"></span></div>
        <div class="mascot mascot-purple"><div class="mascot-eyes"><i></i><i></i></div><div class="mascot-smile"></div></div>
        <div class="speech speech-reply">Let's talk!</div>
        <div class="word-sticker"><span>今日心情</span><strong>curious</strong><small>/ˈkjʊəriəs/ 好奇的</small></div>
        <span class="art-spark spark-two" aria-hidden="true">✧</span>
        <div class="art-caption">A little practice, a lot of possibility.</div>
      </div>
    </section>
    <section class="learning-paths" aria-labelledby="paths-title">
      <div class="section-heading"><div><p>找到你的学习节奏</p><h2 id="paths-title">今天，想练点什么？</h2></div><span class="hand-note">Ready when you are ✳</span></div>
      <div class="path-grid">
        <button class="path-card path-chat" @click="goChat"><span class="path-icon" aria-hidden="true">“</span><span class="path-text"><strong>大胆开口，聊起来</strong><span>和 AI 语伴聊日常，在对话中练习表达。</span></span><span class="path-link">AI 对话 <span aria-hidden="true"><ArrowUpRight /></span></span></button>
        <button class="path-card path-words" @click="router.push('/word-book/index')"><span class="path-icon word-icon" aria-hidden="true">Aa</span><span class="path-text"><strong>每个新词，都是发现</strong><span>查释义、听发音，积累自己的表达素材。</span></span><span class="path-link">探索词库 <span aria-hidden="true"><ArrowUpRight /></span></span></button>
        <button class="path-card path-course" @click="goCourses"><span class="path-icon" aria-hidden="true">✳</span><span class="path-text"><strong>一点一点，学有所获</strong><span>选择适合你的课程，让每次练习有方向。</span></span><span class="path-link">精选课程 <span aria-hidden="true"><ArrowUpRight /></span></span></button>
      </div>
    </section>
    <section class="practice-banner"><div><span class="banner-star" aria-hidden="true">✸</span><div><h2>不用完美，开始就很棒。</h2><p>回到你的课程，把今天的小进步收进口袋。</p></div></div><button class="camp-button" @click="goMyCourses">继续学习 <span aria-hidden="true"><ArrowUpRight /></span></button></section>
    <footer class="camp-footer"><strong>English Camp<span>✳</span></strong><span>让英语成为生活里快乐的一部分。</span><span>See you tomorrow!</span></footer>
  </div>
</template>
<script setup lang="ts">
  import ArrowUpRight from "@/components/Icons/ArrowUpRight.vue";
import { onMounted, onBeforeUnmount, ref } from 'vue';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useRouter } from 'vue-router';
import { useLogin } from '@/hooks/useLogin';

gsap.registerPlugin(ScrollTrigger);
const homePage = ref<HTMLElement>();
let animations: ReturnType<typeof gsap.matchMedia> | undefined;

onMounted(() => {
  animations = gsap.matchMedia();
  animations.add({ motion: '(prefers-reduced-motion: no-preference)', mobile: '(max-width: 600px)' }, (context) => {
    if (!context.conditions?.motion) return;
    const root = homePage.value;
    if (!root) return;
    const scroller = context.conditions?.mobile ? root : undefined;

    gsap.fromTo(root.querySelectorAll('.hero-copy > *'),
      { opacity: 0, y: 40 },
      {
        opacity: 1, y: 0, duration: 0.6, stagger: 0.08,
        ease: 'power2.out', clearProps: 'opacity,transform',
      },
    );

    root.querySelectorAll('.section-heading p, .section-heading h2, .practice-banner h2, .practice-banner p').forEach((text) => {
      gsap.fromTo(text,
        { opacity: 0, y: 60 },
        {
          opacity: 1, y: 0, duration: 0.6, ease: 'power2.out',
          scrollTrigger: { scroller, trigger: text, start: 'top 90%', once: true },
          clearProps: 'opacity,transform',
        },
      );
    });

    root.querySelectorAll('.path-card').forEach((card, index) => {
      gsap.fromTo(card,
        { opacity: 0, y: 40, scale: 0.98 },
        {
          opacity: 1, y: 0, scale: 1, duration: 0.5, delay: index * 0.08,
          ease: 'power2.out',
          scrollTrigger: { scroller, trigger: card, start: 'top 90%', once: true },
          clearProps: 'opacity,transform',
        },
      );
    });
  }, homePage.value);
});

onBeforeUnmount(() => animations?.revert());

const router = useRouter();
const { login } = useLogin();
const goCourses = () => router.push('/courses/index');
const goChat = async () => { try { await login(); await router.push('/chat/index'); } catch {} };
const goMyCourses = async () => { try { await login(); await router.push('/courses/index?tab=my'); } catch {} };
</script>
