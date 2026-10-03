// Runs before React/CSS rendering; self-hosted to satisfy the existing CSP.
(() => {
  const key = 'linkstudio.theme';
  const valid = value => value === 'dark' || value === 'light';
  let theme = 'dark';
  try { const saved = localStorage.getItem(key); if (valid(saved)) theme = saved; } catch { /* Private/restricted storage: use memory. */ }
  const listeners = new Set();
  const apply = () => {
    document.documentElement.dataset.theme = theme;
    const meta = document.querySelector('meta[name="theme-color"]');
    const canvas = getComputedStyle(document.documentElement).getPropertyValue('--canvas').trim();
    if (meta && canvas) meta.setAttribute('content', canvas);
  };
  const update = value => {
    const next = valid(value) ? value : 'dark';
    if (next === theme) return;
    theme = next; apply(); listeners.forEach(listener => listener());
  };
  window.linkStudioTheme = {
    get: () => theme,
    set: value => {
      if (!valid(value)) return;
      update(value);
      try { localStorage.setItem(key, value); } catch { /* Theme still works until refresh. */ }
    },
    subscribe: listener => { listeners.add(listener); return () => listeners.delete(listener); },
  };
  window.addEventListener('storage', event => { if (event.key === key || event.key === null) update(event.newValue); });
  document.addEventListener('DOMContentLoaded', apply, { once: true });
  apply();
})();
