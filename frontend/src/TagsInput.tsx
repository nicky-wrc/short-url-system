import { useRef, useState } from 'react';
import { Plus, X } from 'lucide-react';

const suggestedTags = ['โซเชียล', 'สมัครงาน', 'แคมเปญ', 'งาน', 'ส่วนตัว'];

export function parseTags(value: string): string[] {
  if (!value.trim()) return [];
  const tags = value.split(',').map(tag => tag.normalize('NFC').trim().toLowerCase());
  if (tags.length > 8 || tags.some(tag => !tag || tag.length > 32 || /[\p{Cc}\p{Cf}]/u.test(tag))) throw new Error('Use up to 8 tags, 1–32 characters each, separated by commas.');
  return [...new Set(tags)].sort();
}

export function TagsInput({ id, value, onChange, disabled = false, suggestions = [] }: {
  id: string; value: string; onChange: (value: string) => void; disabled?: boolean; suggestions?: readonly string[];
}) {
  const [choiceError, setChoiceError] = useState('');
  const [draft, setDraft] = useState('');
  const input = useRef<HTMLInputElement>(null);
  let selected: string[] = [];
  let draftValid = true;
  try { selected = parseTags(value); } catch { draftValid = false; }
  const ownTags = [...new Set(suggestions)].sort();
  const recommended = suggestedTags.filter(tag => !ownTags.includes(tag));
  function addTags(text: string, clearDraft = false) {
    try {
      const current = parseTags(value);
      const next = [...new Set([...current, ...parseTags(text)])];
      if (next.length > 8) throw new Error('เลือกได้สูงสุด 8 Tags กรุณาลบ Tag เดิมก่อน');
      onChange(next.sort().join(', ')); setChoiceError('');
      if (clearDraft) { setDraft(''); input.current?.setCustomValidity(''); input.current?.focus(); }
    } catch { setChoiceError('เพิ่มไม่ได้: ใช้ได้สูงสุด 8 Tags, Tag ละ 32 ตัวอักษร และคั่นด้วย comma'); }
  }
  return <div className="tags-field"><label htmlFor={id}>Tags <span className="edit-optional">Optional · private</span></label>
    <div className="tags-controls">
      <div className="tag-entry"><input ref={input} id={id} value={draft} maxLength={512} disabled={disabled} placeholder="พิมพ์ Tag ใหม่…" onChange={event => { setDraft(event.target.value); setChoiceError(''); event.target.setCustomValidity(event.target.value.trim() ? 'กด Enter หรือปุ่มเพิ่ม Tag ก่อนบันทึก' : ''); }} onKeyDown={event => { if (event.key === 'Enter' && !event.nativeEvent.isComposing && event.keyCode !== 229) { event.preventDefault(); if (draft.trim()) addTags(draft, true); } }} aria-describedby={`${id}-hint`} /><button type="button" className="button tag-add" aria-label="เพิ่ม Tag ที่พิมพ์" disabled={disabled || !draft.trim()} onClick={() => addTags(draft, true)}><Plus size={18} aria-hidden="true" /></button></div>
      <select aria-label="เลือก Tag" aria-describedby={`${id}-hint`} value="" disabled={disabled || (draftValid && selected.length >= 8)} onChange={event => addTags(event.target.value)}>
        <option value="" disabled>เลือก Tag…</option>
        {!!ownTags.length && <optgroup label="Tags ที่คุณเคยใช้">{ownTags.map(tag => <option key={tag} value={tag} disabled={selected.includes(tag)}>{tag}</option>)}</optgroup>}
        {!!recommended.length && <optgroup label="คำแนะนำ">{recommended.map(tag => <option key={tag} value={tag} disabled={selected.includes(tag)}>{tag}</option>)}</optgroup>}
      </select>
    </div>
    {!!selected.length && <div className="tags-selection" aria-label="Tags ที่เลือก">{selected.map(tag => <button key={tag} className="tag-remove" type="button" disabled={disabled} aria-label={`ลบ Tag ${tag}`} onClick={() => { onChange(selected.filter(item => item !== tag).join(', ')); setChoiceError(''); }}><span>{tag}</span><X size={14} aria-hidden="true" /></button>)}</div>}
    <p className="field-hint" id={`${id}-hint`}>พิมพ์แล้วกด Enter หรือ + เพื่อเพิ่ม · สูงสุด 8 Tags · เห็นเฉพาะคุณ</p>
    {choiceError && <p className="form-error" role="alert">{choiceError}</p>}
  </div>;
}
