import type { ReactNode } from 'react'
import { addDays, labelKo, ymd } from './lib/date.ts'

type Tone = 'grn' | 'red' | 'amb' | 'mut' | 'blu'

export function Stat({
  k, v, d, tone, lead, onClick, wide,
}: {
  k: string
  v: ReactNode
  d?: ReactNode
  tone?: Tone
  lead?: 'amb' | 'grn' | 'red'
  onClick?: () => void
  wide?: boolean
}) {
  const cls = [
    'tile',
    lead === 'amb' ? 'lead' : lead === 'grn' ? 'lead-grn' : lead === 'red' ? 'lead-red' : '',
    wide ? 'wide' : '',
  ].filter(Boolean).join(' ')
  const body = (
    <>
      <span className="k">{k}</span>
      <span className="v">{v}</span>
      {d !== undefined && <span className={`d ${tone ?? 'mut'}`}>{d}</span>}
    </>
  )
  return onClick ? (
    <button type="button" className={cls} onClick={onClick}>{body}</button>
  ) : (
    <div className={cls}>{body}</div>
  )
}

export function Panel({
  title, right, children, wide = true,
}: { title: string; right?: ReactNode; children: ReactNode; wide?: boolean }) {
  return (
    <div className={`tile ${wide ? 'wide' : ''}`}>
      <span className="k" style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
        <span>{title}</span>
        {right && <span style={{ color: 'var(--mut)' }}>{right}</span>}
      </span>
      {children}
    </div>
  )
}

/** 1~5 척도. invert=true면 5가 나쁜 쪽(피로·통증) */
export function Scale({
  value, onChange, lowLabel, highLabel,
}: { value: number | undefined; onChange: (v: number) => void; lowLabel: string; highLabel: string }) {
  return (
    <div className="stack" style={{ gap: 3 }}>
      <div className="seg">
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} type="button" className={value === n ? 'on' : ''} onClick={() => onChange(n)}>
            {n}
          </button>
        ))}
      </div>
      <div className="row" style={{ padding: 0, borderBottom: 'none' }}>
        <span className="note">{lowLabel}</span>
        <span className="note">{highLabel}</span>
      </div>
    </div>
  )
}

export function DateNav({ date, setDate }: { date: string; setDate: (d: string) => void }) {
  const isToday = date === ymd()
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
      <button type="button" className="btn sm" onClick={() => setDate(addDays(date, -1))} aria-label="하루 전">‹</button>
      <button
        type="button"
        className="btn sm"
        onClick={() => setDate(ymd())}
        style={{ minWidth: 108, whiteSpace: 'nowrap' }}
      >
        {isToday ? '오늘' : labelKo(date)}
      </button>
      <button
        type="button"
        className="btn sm"
        onClick={() => setDate(addDays(date, 1))}
        disabled={isToday}
        aria-label="하루 뒤"
      >›</button>
    </div>
  )
}

export function pct(a: number, b: number) {
  return b > 0 ? Math.min(100, Math.round((a / b) * 100)) : 0
}

export function Bar({ value, target, tone }: { value: number; target: number; tone?: 'grn' | 'amb' | 'red' }) {
  return (
    <div className="bar">
      <i className={tone ?? ''} style={{ width: `${pct(value, target)}%` }} />
    </div>
  )
}

export function Dots({ done, total }: { done: number; total: number }) {
  return (
    <span className="dots">
      {Array.from({ length: total }, (_, i) => (
        <i key={i} className={i < done ? 'on' : ''} />
      ))}
    </span>
  )
}

export const round1 = (n: number) => Math.round(n * 10) / 10
