import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const compile = path => ts.transpileModule(readFileSync(new URL(path, import.meta.url),'utf8'), { compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022} }).outputText;
const catalog = {}; vm.runInNewContext(compile('../frontend/src/locales/messages.ts'),{exports:catalog});
function boot(saved, blocked=false) {
  const values=new Map(saved===undefined?[]:[['linkstudio.language',saved]]), events={}, root={}, exports={};
  vm.runInNewContext(compile('../frontend/src/i18n.ts'),{exports,require:()=>catalog,document:{documentElement:root},window:{addEventListener:(name,callback)=>{events[name]=callback;}},localStorage:{getItem:key=>{if(blocked)throw Error('blocked');return values.get(key);},setItem:(key,value)=>{if(blocked)throw Error('blocked');values.set(key,value);}}});
  return {store:exports,values,events,root};
}
test('default and invalid saved language use English; Thai restores before render',()=>{
  assert.equal(boot().root.lang,'en');assert.equal(boot('invalid').root.lang,'en');assert.equal(boot('th').root.lang,'th');
});
test('switch persists, notifies only on change, and unsubscribe works',()=>{
  const app=boot();let changes=0;const off=app.store.subscribeLanguage(()=>changes++);
  app.store.setLanguage('th');app.store.setLanguage('th');assert.equal(changes,1);assert.equal(app.values.get('linkstudio.language'),'th');assert.equal(app.root.lang,'th');off();app.store.setLanguage('en');assert.equal(changes,1);
});
test('storage blocked still allows switching; another tab and clear synchronize',()=>{
  const app=boot(undefined,true);app.store.setLanguage('th');assert.equal(app.store.getLanguage(),'th');
  app.events.storage({key:'linkstudio.language',newValue:'en'});assert.equal(app.root.lang,'en');app.events.storage({key:'linkstudio.language',newValue:'th'});app.events.storage({key:null,newValue:null});assert.equal(app.root.lang,'en');
});
test('UI copy and interpolation translate while arbitrary text and URLs survive',()=>{
  const app=boot('th');assert.equal(app.store.t('Profile'),'โปรไฟล์');assert.equal(app.store.t('Copy link {0}',['abc']),'คัดลอกลิงก์ abc');
  for(const text of ['ชื่อที่ผู้ใช้ตั้งเอง','https://example.com/a?q=ไทย','constructor','__proto__'])assert.equal(app.store.t(text),text);
  app.store.setLanguage('en');assert.equal(app.store.t('โปรไฟล์'),'Profile');assert.equal(app.store.t('รหัสผ่านปัจจุบันไม่ถูกต้อง'),'Current password is incorrect.');
});
test('Thai dates keep Gregorian years and all catalog translations are nonempty',()=>{
  const app=boot('th');const date=new Date('2026-10-04T00:00:00Z');assert.equal(new Intl.DateTimeFormat(app.store.getLocale(),{year:'numeric',timeZone:'UTC'}).format(date),'2026');
  for(const [key,value]of Object.entries(catalog.messages)){assert.ok(key.trim());for(const text of typeof value==='string'?[value]:value)assert.ok(text.trim());}
});
