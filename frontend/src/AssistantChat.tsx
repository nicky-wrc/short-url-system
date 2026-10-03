import { useEffect, useRef, useState } from 'react';
import { MessageCircle, X, RotateCcw, Link2, BarChart3, UserRound, Plus, Sparkles, Copy, Check, Info } from 'lucide-react';
import { api } from './api';
import MorphLoading from './components/ui/morph-loading';
import { PromptInput } from './components/ui/ai-chat-input';

interface Message { role: 'user' | 'assistant'; content: string }
interface Status { available: boolean; provider: string }
const shortcuts = [
  { hash: 'create', text: 'สร้างลิงก์', icon: Plus }, { hash: 'links', text: 'My links / CSV', icon: Link2 },
  { hash: 'analytics', text: 'สถิติ', icon: BarChart3 }, { hash: 'profile', text: 'โปรไฟล์', icon: UserRound },
];
const suggestions = [
  { label: 'ใช้ QR', question: 'สร้าง QR แล้วดาวน์โหลดอย่างไร?' },
  { label: 'ตั้งชื่อลิงก์', question: 'ช่วยตั้งชื่อลิงก์สำหรับพอร์ตสมัครฝึกงาน' },
  { label: 'การนับคลิก', question: 'จำนวนเปิดนับอย่างไร?' },
];

export function AssistantChat() {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<Status | null>(null);
  const [checking, setChecking] = useState(false);
  const [statusError, setStatusError] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState('');
  const [question, setQuestion] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [includeStats, setIncludeStats] = useState(false);
  const [copied, setCopied] = useState<number | null>(null);
  const [infoOpen, setInfoOpen] = useState(false);
  const panel = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  const conversation = useRef<HTMLDivElement>(null);
  const request = useRef<AbortController | null>(null);
  const lock = useRef(false);
  const sequence = useRef(0);
  const statusRequest = useRef<AbortController | null>(null);

  async function checkStatus() {
    statusRequest.current?.abort();
    const controller = new AbortController(); statusRequest.current = controller;
    setChecking(true); setStatusError('');
    try { const result = await api<Status>('/assistant/status', {signal:controller.signal}); if (!controller.signal.aborted) setStatus(result); }
    catch (reason) { if (!controller.signal.aborted) { setStatus(null); setStatusError((reason as Error).message); } }
    finally { if (!controller.signal.aborted) setChecking(false); }
  }
  function stop(showFeedback = true) {
    sequence.current++; request.current?.abort(); request.current = null; lock.current = false;
    setBusy(false); setDraft(previous => question || previous); setQuestion('');
    if (showFeedback) setError('หยุดรอคำตอบแล้ว คุณส่งคำถามอีกครั้งได้');
  }
  function close() { if (busy) stop(false); setInfoOpen(false); setOpen(false); }
  const closeRef = useRef(close);
  closeRef.current = close;
  useEffect(() => () => { sequence.current++; request.current?.abort(); statusRequest.current?.abort(); }, []);
  useEffect(() => { if (open) void checkStatus(); else statusRequest.current?.abort(); }, [open]);
  useEffect(() => {
    if (!open) return;
    const oldOverflow = document.body.style.overflow;
    const background = [...document.querySelectorAll<HTMLElement>('.sidebar,.main-wrapper')];
    const previousInert = background.map(element => element.inert);
    background.forEach(element => { element.inert = true; });
    document.body.style.overflow = 'hidden';
    panel.current?.focus();
    const keyboard = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); closeRef.current(); return; }
      if (event.key !== 'Tab') return;
      const elements = [...(panel.current?.querySelectorAll<HTMLElement>('button:not(:disabled),a[href],textarea:not(:disabled),input:not(:disabled)') ?? [])].filter(element => element.getClientRects().length);
      if (!elements?.length) return;
      const first = elements[0], last = elements[elements.length - 1];
      if (event.shiftKey && (document.activeElement === first || document.activeElement === panel.current)) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    document.addEventListener('keydown', keyboard);
    return () => { background.forEach((element,index) => { element.inert = previousInert[index]; }); document.body.style.overflow = oldOverflow; document.removeEventListener('keydown', keyboard); trigger.current?.focus(); };
  }, [open]);
  useEffect(() => { if (open && status?.available && !busy) input.current?.focus(); }, [open, status?.available, busy]);
  useEffect(() => { conversation.current?.scrollTo({top:conversation.current.scrollHeight,behavior:'instant'}); }, [messages, question, error]);

  async function send() {
    const content = draft.trim(); if (lock.current || !content || content.length > 1000 || !status?.available) return;
    lock.current = true; setBusy(true); setError(''); setQuestion(content); setDraft('');
    // Only successful recent pairs go into the next request; never replay a failed user turn.
    let history: Message[] = [...messages.slice(-6).map(message => ({...message,content:message.content.slice(0,1000)})), {role:'user',content}];
    while (history.reduce((sum, message) => sum + message.content.length, 0) > 4000 && history.length > 1) history = history.slice(2);
    const controller = new AbortController(); request.current = controller;
    const current = ++sequence.current;
    const timer = setTimeout(() => controller.abort(), 35_000);
    try {
      const result = await api<{reply:string}>('/assistant/chat', {method:'POST', body:JSON.stringify({messages:history,includeStats}), signal:controller.signal});
      if (current !== sequence.current) return;
      if (typeof result.reply !== 'string' || !result.reply.trim()) throw new Error('AI ไม่ได้ส่งคำตอบ กรุณาลองใหม่');
      setMessages(previous => [...previous, {role:'user' as const,content}, {role:'assistant' as const,content:result.reply}].slice(-20));
      setQuestion('');
    } catch (reason) {
      if (current !== sequence.current) return;
      setDraft(content); setQuestion('');
      setError((reason as Error).name === 'AbortError' ? 'รอนานเกินไป กรุณาส่งอีกครั้ง' : (reason as Error).message);
    } finally { clearTimeout(timer); if (current === sequence.current) { lock.current = false; request.current = null; setBusy(false); } }
  }
  async function copyAnswer(content: string, index: number) {
    try { await navigator.clipboard.writeText(content); setCopied(index); }
    catch { setError('คัดลอกไม่ได้ กรุณาเลือกข้อความแล้วคัดลอกเอง'); }
  }

  return <>
    <button ref={trigger} type="button" className="ai-launcher" aria-label="เปิดผู้ช่วย AI" aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen(true)}><MessageCircle size={21} /><span>ผู้ช่วย AI</span></button>
    {open && <div className="ai-backdrop" onClick={event => {if(event.target === event.currentTarget) close();}}>
      <div ref={panel} className="ai-panel" data-empty={!messages.length && !question} role="dialog" aria-modal="true" aria-labelledby="ai-title" tabIndex={-1}>
        <header className="ai-header"><div><Sparkles className="ai-mark" size={19} /><h2 id="ai-title">Link Studio AI</h2></div><div className="ai-header-actions">
          <button type="button" className="icon-button" title="เริ่มแชตใหม่" aria-label="เริ่มแชตใหม่" disabled={busy || (!messages.length && !draft && !error)} onClick={() => {setMessages([]);setDraft('');setError('');setCopied(null);setIncludeStats(false);input.current?.focus();}}><RotateCcw size={17} /></button>
          <button type="button" className="icon-button" title="เกี่ยวกับผู้ช่วย" aria-label="เกี่ยวกับผู้ช่วย" aria-expanded={infoOpen} aria-controls="ai-info" onClick={() => setInfoOpen(previous => !previous)}><Info size={18} /></button>
          <button type="button" className="icon-button" aria-label="ปิดแชต" onClick={close}><X size={20} /></button>
        </div></header>
        {infoOpen && <section id="ai-info" className="ai-info" aria-label="เกี่ยวกับผู้ช่วย">
          <p>ถามวิธีใช้ QR, Preview, วันหมดอายุ, CSV และการนับคลิก หรือให้ช่วยคิดชื่อลิงก์และข้อความแคมเปญ</p>
          <p>ข้อความส่งไป OpenAI · อย่าส่งข้อมูลลับ ผู้ช่วยไม่สร้างหรือแก้ข้อมูลแทนคุณ และอาจตอบผิด</p>
          <p>ส่งสถิติ: ส่งเฉพาะยอดรวมลิงก์และจำนวนเปิดของคุณ การเปลี่ยนตัวเลือกจะเริ่มแชตใหม่</p>
          <nav className="ai-shortcuts" aria-label="ปุ่มลัด workspace">{shortcuts.map(({hash,text,icon:Icon}) => <a key={hash} href={`#${hash}`} onClick={close}><Icon size={16} />{text}</a>)}</nav>
        </section>}
        <div ref={conversation} className="ai-conversation" role="log" aria-label="บทสนทนากับผู้ช่วย" aria-live="polite" aria-relevant="additions text">
          {messages.map((message,index) => <article key={index} aria-label={message.role === 'user' ? 'คำถามของคุณ' : 'คำตอบ AI'} className={`ai-message ai-message--${message.role}`}><p>{message.content}</p>{message.role === 'assistant' && <button className="icon-button" type="button" title={copied === index ? 'คัดลอกแล้ว' : 'คัดลอกคำตอบ'} aria-label={copied === index ? `คัดลอกคำตอบ ${index + 1} แล้ว` : `คัดลอกคำตอบ ${index + 1}`} onClick={() => void copyAnswer(message.content,index)}>{copied === index ? <Check size={16} /> : <Copy size={16} />}</button>}</article>)}
          {question && <article className="ai-message ai-message--user" aria-label="คำถามของคุณ"><p>{question}</p></article>}
          {busy && <p className="ai-pending" role="status"><MorphLoading size="sm" />AI กำลังตอบ…</p>}
        </div>
        <div className="ai-controls">
          {!messages.length && !question && <h3 className="ai-welcome-title">ให้ช่วยอะไรดี?</h3>}
          {checking && <p role="status" className="ai-service-status"><MorphLoading size="sm" />กำลังตรวจบริการ AI…</p>}
          {!checking && (statusError || !status?.available) && <div className="ai-service-status" role="status"><p>{statusError || 'ยังไม่เปิดบริการ AI'}</p><button className="text-button" type="button" onClick={() => void checkStatus()}>ตรวจอีกครั้ง</button></div>}
          {error && <p className="ai-error" role="alert">{error}</p>}
          <PromptInput ref={input} value={draft} onChange={setDraft} onSubmit={() => void send()} onStop={() => stop()} busy={busy} disabled={checking || !status?.available} />
          {!messages.length && !question && <div className="ai-suggestions" aria-label="คำถามแนะนำ">{suggestions.map(({label,question:prompt}) => <button key={label} type="button" title={prompt} aria-label={prompt} disabled={busy} onClick={() => {setDraft(prompt);setError('');input.current?.focus();}}>{label}</button>)}</div>}
          <div className="ai-footer"><label className="ai-consent" title="ส่งเฉพาะยอดรวมให้ OpenAI; เปลี่ยนตัวเลือกจะเริ่มแชตใหม่"><input type="checkbox" checked={includeStats} disabled={busy} aria-describedby="ai-consent-hint" onChange={event => {setIncludeStats(event.target.checked);setMessages([]);setError('');setCopied(null);}} />ส่งสถิติให้ OpenAI</label><span>AI อาจตอบผิด</span></div>
          <p id="ai-consent-hint" className="sr-only">ส่งยอดรวมลิงก์และจำนวนเปิดของคุณให้ OpenAI การเปลี่ยนตัวเลือกจะเริ่มแชตใหม่ ไม่ส่ง URL หรือข้อมูลบัญชี</p>
        </div>
      </div>
    </div>}
  </>;
}
