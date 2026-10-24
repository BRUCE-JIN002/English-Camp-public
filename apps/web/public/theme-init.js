// Apply the saved theme before the app renders to avoid a light-theme flash.
(() => {
  let mode = 'system';
  try {
    const saved = localStorage.getItem('english-camp-theme');
    if (['light', 'dark', 'system'].includes(saved)) mode = saved;
  } catch {}
  const dark = mode === 'dark' || (mode === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.dataset.themeMode = mode;
  document.documentElement.classList.toggle('dark', dark);
  document.documentElement.style.colorScheme = dark ? 'dark' : 'light';
})();
