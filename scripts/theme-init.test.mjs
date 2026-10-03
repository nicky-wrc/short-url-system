import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const source = readFileSync(new URL('../frontend/public/theme-init.js', import.meta.url), 'utf8');
function boot(saved, blocked = false) {
  const events = {};
  const values = new Map(saved === undefined ? [] : [['linkstudio.theme', saved]]);
  const root = { dataset: {} };
  const meta = {};
  const window = { addEventListener: (name, callback) => { events[name] = callback; } };
  vm.runInNewContext(source, {
    window,
    document: { documentElement: root, querySelector: () => ({ setAttribute: (key, value) => { meta[key] = value; } }), addEventListener: (name, callback) => { events[name] = callback; } },
    localStorage: { getItem: key => { if (blocked) throw Error('blocked'); return values.get(key); }, setItem: (key, value) => { if (blocked) throw Error('blocked'); values.set(key, value); } },
    getComputedStyle: () => ({ getPropertyValue: () => root.dataset.theme === 'light' ? '#f5f7f1' : '#141619' }),
  });
  return { store: window.linkStudioTheme, root, meta, events, values };
}
test('default/invalid theme preserves dark; saved light applies before React', () => {
  assert.equal(boot().root.dataset.theme, 'dark');
  assert.equal(boot('invalid').store.get(), 'dark');
  const light = boot('light');
  assert.equal(light.root.dataset.theme, 'light');
  assert.equal(light.meta.content, '#f5f7f1');
});
test('toggle persists and notifies once; unsubscribe and invalid inputs are safe', () => {
  const app = boot(); let changes = 0;
  const unsubscribe = app.store.subscribe(() => changes++);
  app.store.set('light'); app.store.set('light'); app.store.set('invalid');
  assert.equal(changes, 1);
  assert.equal(app.values.get('linkstudio.theme'), 'light');
  assert.equal(app.meta.content, '#f5f7f1');
  unsubscribe(); app.store.set('dark'); assert.equal(changes, 1);
});
test('blocked storage still allows switching in memory', () => {
  const app = boot('light', true); app.store.set('light');
  assert.equal(app.root.dataset.theme, 'light');
});
test('cross-tab changes synchronize; removal restores dark; unrelated keys ignored', () => {
  const app = boot();
  app.events.storage({ key: 'other', newValue: 'light' }); assert.equal(app.store.get(), 'dark');
  app.events.storage({ key: 'linkstudio.theme', newValue: 'light' }); assert.equal(app.store.get(), 'light');
  app.events.storage({ key: null, newValue: null }); assert.equal(app.store.get(), 'dark');
});

test('both palettes keep readable text, status colors and keyboard focus', () => {
  const css = readFileSync(new URL('../frontend/src/theme.css', import.meta.url), 'utf8');
  const lightStart = css.indexOf(':root[data-theme="light"]');
  const colors = text => Object.fromEntries([...text.matchAll(/--([\w-]+):\s*(#[\da-f]{6})/gi)].map(match => [match[1], match[2]]));
  const dark = colors(css.slice(0, lightStart));
  dark['accent-text'] = dark.accent; dark.focus = dark.accent;
  const light = { ...dark, ...colors(css.slice(lightStart)) };
  const luminance = hex => {
    const channels = hex.slice(1).match(/../g).map(value => parseInt(value, 16) / 255)
      .map(value => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
    return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
  };
  const contrast = (a, b) => (Math.max(luminance(a), luminance(b)) + 0.05) / (Math.min(luminance(a), luminance(b)) + 0.05);
  for (const [name, palette] of [['dark', dark], ['light', light]]) {
    for (const background of ['canvas', 'sidebar', 'surface', 'hover']) {
      for (const text of ['text', 'muted', 'accent-text', 'danger', 'warning', 'success']) {
        assert.ok(contrast(palette[text], palette[background]) >= 4.5, `${name}: ${text} on ${background} must meet AA`);
      }
      assert.ok(contrast(palette.focus, palette[background]) >= 3, `${name}: focus on ${background}`);
    }
    assert.ok(contrast(palette['accent-ink'], palette.accent) >= 4.5, `${name}: primary button`);
  }
});
