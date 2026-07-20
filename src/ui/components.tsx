import { useState } from 'react';

export function NumField({
  value, onCommit, min, max, decimals = 0, prefix = '', suffix = '', wide = false,
}: {
  value: number; onCommit: (v: number) => void;
  min: number; max: number; decimals?: number;
  prefix?: string; suffix?: string; wide?: boolean;
}) {
  const [draft, setDraft] = useState(String(value));
  const [editing, setEditing] = useState(false);
  if (!editing && draft !== String(value)) setDraft(String(value));
  const commit = () => {
    setEditing(false);
    const parsed = parseFloat(draft);
    if (Number.isNaN(parsed)) { setDraft(String(value)); return; }
    const n = +Math.min(max, Math.max(min, parsed)).toFixed(decimals);
    onCommit(n);
    setDraft(String(n));
  };
  return (
    <span className="inline-flex items-baseline gap-0.5 text-sm font-semibold text-slate-800 tabular-nums">
      {prefix && <span>{prefix}</span>}
      <input
        type="number" inputMode="decimal" value={draft}
        onFocus={(e) => { setEditing(true); e.target.select(); }}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
        className={`${wide ? 'w-20' : 'w-14'} text-right bg-slate-50 border border-slate-200 rounded-md px-1.5 py-0.5 focus:outline-none focus:border-emerald-500 focus:bg-white`}
      />
      {suffix && <span>{suffix}</span>}
    </span>
  );
}

export function Slider({
  label, value, min, max, step, onChange, hint, edit,
}: {
  label: string; value: number; min: number; max: number; step: number;
  onChange: (v: number) => void; hint?: string;
  edit: { min: number; max: number; decimals?: number; prefix?: string; suffix?: string; wide?: boolean };
}) {
  return (
    <div className="mb-4">
      <div className="flex justify-between items-center mb-1 gap-2">
        <span className="text-sm text-slate-500">{label}</span>
        <span className="flex items-baseline gap-1.5">
          {hint && <span className="text-xs text-slate-400">{hint}</span>}
          <NumField value={value} onCommit={onChange} {...edit} />
        </span>
      </div>
      <input
        type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-emerald-600"
      />
    </div>
  );
}

const TONES = {
  info: 'bg-slate-50 border-slate-200 text-slate-700',
  warn: 'bg-amber-50 border-amber-200 text-amber-900',
  good: 'bg-emerald-50 border-emerald-200 text-emerald-900',
  alert: 'bg-rose-50 border-rose-200 text-rose-900',
} as const;

export function InsightCard({
  tone = 'info', title, children,
}: {
  tone?: keyof typeof TONES; title: string; children: React.ReactNode;
}) {
  return (
    <div className={`border rounded-xl p-4 mb-3 ${TONES[tone]}`}>
      <p className="font-semibold text-sm mb-1">{title}</p>
      <p className="text-sm leading-relaxed">{children}</p>
    </div>
  );
}

export function Expander({
  title, subtitle, open, onToggle, children,
}: {
  title: string; subtitle: string; open: boolean; onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <section className="border-t border-slate-100">
      <button onClick={onToggle}
        className="w-full px-5 py-4 flex justify-between items-center text-left">
        <span>
          <span className="text-sm font-semibold text-slate-700">{title}</span>
          <span className="block text-xs text-slate-400 mt-0.5">{subtitle}</span>
        </span>
        <span className="text-slate-400 text-lg leading-none">{open ? '▴' : '▾'}</span>
      </button>
      {open && <div className="px-5 pb-5">{children}</div>}
    </section>
  );
}
