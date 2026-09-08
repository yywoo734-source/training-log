import { useEffect, useMemo, useState } from 'react'
import type { DB, Entry, Exercise, Phase } from '../lib/types.ts'
import { ACTION_LABEL, advise, formatLoad, formatReps, historyFor, repsOf, reviewEntry } from '../lib/progression.ts'
import {
  ensureSession, exerciseById, plannedRoutineId, recoveryFor, routineById,
  sessionFor, setEntry, setMetric, setSessionDone, setSessionNote, useDB,
} from '../lib/store.ts'
import { DateNav, Panel } from '../ui.tsx'

export default function Workout({ date, setDate }: { date: string; setDate: (d: string) => void }) {
  const db = useDB()
  const routineId = plannedRoutineId(db, date)
  const routine = routineById(db, routineId)!
  const session = sessionFor(db, date)
  const { score } = recoveryFor(db, date)

  const [openId, setOpenId] = useState<string | null>(null)

  // 아직 목표 세트를 못 채운 첫 종목을 기본으로 편다
  const firstOpen = useMemo(() => {
    for (const it of routine.items) {
      const ex = exerciseById(db, it.exerciseId)
      if (!ex) continue
      const done = session?.entries.find((e) => e.exerciseId === ex.id)?.sets.length ?? 0
      if (done < (it.sets ?? ex.sets)) return ex.id
    }
    return routine.items[0]?.exerciseId ?? null
  }, [db, routine, session])

  const active = openId ?? firstOpen

  return (
    <>
      <div className="topbar">
        <DateNav date={date} setDate={setDate} />
        <select
          value={routineId}
          onChange={(e) => ensureSession(date, e.target.value)}
          style={{ width: 'auto', fontSize: 13, padding: '6px 8px' }}
          aria-label="이 날의 세션 바꾸기"
        >
          {db.routines.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
        </select>
      </div>

      <div className="topbar" style={{ paddingTop: 0 }}>
        <h1>{routine.name}</h1>
        <span className="sub">{score !== null ? `회복 ${score}` : '회복 미기록'}</span>
      </div>

      {routine.kind === 'rest' ? (
        <Panel title="완전 휴식">
          <div className="empty">오늘은 아무것도 하지 않는 날입니다.</div>
        </Panel>
      ) : routine.kind !== 'weight' ? (
        <SimpleSession db={db} date={date} routineId={routineId} kind={routine.kind} />
      ) : (
        <>
          {routine.items.map((it) => {
            const ex = exerciseById(db, it.exerciseId)
            if (!ex) return null
            const planned = it.sets ?? ex.sets
            return active === ex.id ? (
              <ExerciseCard
                key={ex.id}
                db={db}
                date={date}
                routineId={routineId}
                ex={ex}
                planned={planned}
                score={score}
                phase={db.settings.phase}
                onNext={() => setOpenId(null)}
              />
            ) : (
              <CollapsedRow key={ex.id} db={db} date={date} ex={ex} planned={planned} onOpen={() => setOpenId(ex.id)} />
            )
          })}

          <button
            type="button"
            className={session?.done ? 'btn' : 'btn pri'}
            style={{ marginTop: 8 }}
            onClick={() => { ensureSession(date, routineId); setSessionDone(date, !session?.done) }}
          >
            {session?.done ? '완료 취소' : '오늘 운동 마치기'}
          </button>

          {session?.done && <SessionReview db={db} date={date} />}
        </>
      )}
    </>
  )
}

function CollapsedRow({
  db, date, ex, planned, onOpen,
}: { db: DB; date: string; ex: Exercise; planned: number; onOpen: () => void }) {
  const entry = sessionFor(db, date)?.entries.find((e) => e.exerciseId === ex.id)
  const doneSets = entry?.sets.length ?? 0
  const full = doneSets >= planned
  return (
    <button type="button" className={`tile wide ${full ? 'lead-grn' : ''}`} onClick={onOpen}>
      <span className="k">{ex.name}</span>
      <div className="row" style={{ borderBottom: 'none', padding: '2px 0' }}>
        <span className="n" style={{ color: 'var(--mut)', fontSize: 12.5 }}>
          {planned}세트 × {ex.repMin}–{ex.repMax}회
        </span>
        <span className="s">
          {doneSets ? `${formatReps(entry!)} · ${formatLoad(ex, entry!.load)}` : '기록 전'}
        </span>
      </div>
    </button>
  )
}

function ExerciseCard({
  db, date, routineId, ex, planned, score, phase, onNext,
}: {
  db: DB; date: string; routineId: string; ex: Exercise; planned: number
  score: number | null; phase: Phase; onNext: () => void
}) {
  const hist = useMemo(() => historyFor(db.sessions, ex.id, date), [db.sessions, ex.id, date])
  const a = useMemo(() => advise(ex, hist, planned, score, phase), [ex, hist, planned, score, phase])
  const entry = sessionFor(db, date)?.entries.find((e) => e.exerciseId === ex.id)
  const sets = entry?.sets ?? []
  const i = sets.length
  const target = a.targetReps[i] ?? ex.repMax

  const [repsRaw, setRepsRaw] = useState<number | null>(null)
  const [rir, setRir] = useState<number | null>(null)
  const [loadRaw, setLoadRaw] = useState<number | null>(null)
  // ponytail: setTimeout 카운트다운이라 화면을 오래 내려두면 조금 느려진다. 휴식 안내용이라 그 정도면 충분.
  const [restLeft, setRestLeft] = useState(0)

  const reps = repsRaw ?? target
  const load = loadRaw ?? entry?.load ?? a.load

  useEffect(() => {
    if (restLeft <= 0) return
    const t = setTimeout(() => setRestLeft(restLeft - 1), 1000)
    return () => clearTimeout(t)
  }, [restLeft])

  const save = (nextSets: Entry['sets'], formBroke = entry?.formBroke) => {
    setEntry(date, routineId, { exerciseId: ex.id, load, sets: nextSets, formBroke })
  }

  const completeSet = () => {
    save([...sets, { reps, rir }])
    setRepsRaw(null)
    setRir(null)
    setRestLeft(ex.restSec)
    if (i + 1 >= planned) onNext()
  }

  const tone = a.action === 'up' ? 'grn' : a.action === 'down' || a.action === 'deload' ? 'amb' : 'blu'

  return (
    <div className="tile wide lead">
      <div className="row" style={{ borderBottom: 'none', padding: '0 0 4px' }}>
        <span className="n" style={{ fontSize: 16, fontWeight: 600 }}>
          {ex.name}
          <small>{ex.en} · {planned}세트 × {ex.repMin}–{ex.repMax}회 · RIR 1–2</small>
        </span>
        <span className={`pill ${tone}`}>{ACTION_LABEL[a.action]}</span>
      </div>

      <div className="note" style={{ paddingBottom: 6 }}>{a.message}</div>
      {hist.length > 1 && (
        <div className="note" style={{ paddingBottom: 6 }}>
          최근 3회 <b>{hist.slice(0, 3).map((h) => formatReps(h)).join('  ·  ')}</b>
        </div>
      )}

      {ex.loadType !== 'body' && (
        <div className="row" style={{ borderBottom: 'none', padding: '2px 0 8px' }}>
          <span className="k">{ex.loadType === 'assist' ? '보조중량' : '중량'}</span>
          <span style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <button type="button" className="btn sm" onClick={() => setLoadRaw(Math.max(0, load - ex.step))}>−{ex.step}</button>
            <b className="num" style={{ fontSize: 22, minWidth: 52, textAlign: 'center' }}>{load}</b>
            <button type="button" className="btn sm" onClick={() => setLoadRaw(load + ex.step)}>+{ex.step}</button>
          </span>
        </div>
      )}

      {sets.length > 0 && (
        <table className="setgrid" style={{ marginBottom: 8 }}>
          <thead>
            <tr><th>세트</th><th>회</th><th>RIR</th><th>목표</th></tr>
          </thead>
          <tbody>
            {sets.map((s, n) => (
              <tr key={n}>
                <td>{n + 1}</td>
                <td>{s.reps}</td>
                <td>{s.rir ?? '—'}</td>
                <td style={{ color: 'var(--mut)', fontSize: 13 }}>{a.targetReps[n] ?? ex.repMax}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {i < planned ? (
        <>
          <div className="k" style={{ paddingBottom: 4 }}>
            {i + 1}세트 · 목표 {target}회{restLeft > 0 && ` · 휴식 ${Math.floor(restLeft / 60)}:${String(restLeft % 60).padStart(2, '0')}`}
          </div>
          <div className="bigrow">
            <button type="button" onClick={() => setRepsRaw(Math.max(0, reps - 1))} aria-label="한 개 줄이기">−</button>
            <div className="val"><b>{reps}</b><span>회</span></div>
            <button type="button" onClick={() => setRepsRaw(reps + 1)} aria-label="한 개 늘리기">+</button>
          </div>
          <div className="k" style={{ padding: '8px 0 4px' }}>RIR — 몇 개 더 할 수 있었나</div>
          <div className="seg">
            {[0, 1, 2, 3].map((n) => (
              <button key={n} type="button" className={rir === n ? 'on' : ''} onClick={() => setRir(n)}>
                {n === 3 ? '3+' : n}
              </button>
            ))}
          </div>
          <button type="button" className="btn pri" style={{ marginTop: 8 }} onClick={completeSet}>
            {i + 1}세트 완료
          </button>
          {sets.length > 0 && (
            <button type="button" className="btn sm" style={{ marginTop: 6 }} onClick={() => save(sets.slice(0, -1))}>
              마지막 세트 지우기
            </button>
          )}
        </>
      ) : (
        <>
          <div className="note"><b>{reviewEntry(ex, entry!, planned)}</b></div>
          <div className="row" style={{ borderBottom: 'none', paddingTop: 6 }}>
            <label className="note" style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <input
                type="checkbox"
                style={{ width: 18, height: 18 }}
                checked={!!entry?.formBroke}
                onChange={(e) => save(sets, e.target.checked)}
              />
              자세가 무너졌다 (증량 보류)
            </label>
            <button type="button" className="btn sm" onClick={() => save(sets.slice(0, -1))}>되돌리기</button>
          </div>
          <button type="button" className="btn" style={{ marginTop: 8 }} onClick={onNext}>다음 종목</button>
        </>
      )}
    </div>
  )
}

function SessionReview({ db, date }: { db: DB; date: string }) {
  const session = sessionFor(db, date)!
  return (
    <Panel title="오늘 요약">
      {session.entries.map((e) => {
        const ex = exerciseById(db, e.exerciseId)
        if (!ex) return null
        return (
          <div className="row" key={e.exerciseId}>
            <span className="n">{ex.name}<small>{reviewEntry(ex, e, ex.sets)}</small></span>
            <span className="s">{formatLoad(ex, e.load)}</span>
          </div>
        )
      })}
      <div className="row">
        <span className="n">총 세트</span>
        <span className="s">{session.entries.reduce((a, e) => a + repsOf(e).length, 0)}세트</span>
      </div>
    </Panel>
  )
}

const METRICS: Record<string, { key: string; label: string; unit: string }[]> = {
  run: [
    { key: 'minutes', label: '시간', unit: '분' },
    { key: 'km', label: '거리', unit: 'km' },
    { key: 'hr', label: '평균 심박', unit: 'bpm' },
    { key: 'rpe', label: 'RPE', unit: '/10' },
  ],
  climb: [
    { key: 'minutes', label: '시간', unit: '분' },
    { key: 'sends', label: '완등', unit: '개' },
    { key: 'flashes', label: 'Flash', unit: '개' },
    { key: 'topGrade', label: '최고 난이도', unit: '' },
  ],
  bag: [
    { key: 'level', label: '레벨', unit: '1–3' },
    { key: 'rounds', label: '라운드', unit: '회' },
    { key: 'minutes', label: '시간', unit: '분' },
    { key: 'rpe', label: 'RPE', unit: '/10' },
  ],
}

function SimpleSession({
  db, date, routineId, kind,
}: { db: DB; date: string; routineId: string; kind: string }) {
  const session = sessionFor(db, date)
  const fields = METRICS[kind] ?? []
  return (
    <Panel title="기록">
      <div className="g2" style={{ marginTop: 6 }}>
        {fields.map((f) => (
          <label className="field" key={f.key}>
            <span className="k">{f.label} {f.unit && `(${f.unit})`}</span>
            <input
              type="number"
              inputMode="decimal"
              value={session?.metrics?.[f.key] ?? ''}
              onChange={(e) => {
                ensureSession(date, routineId)
                setMetric(date, f.key, Number(e.target.value))
              }}
            />
          </label>
        ))}
      </div>
      <label className="field" style={{ marginTop: 8 }}>
        <span className="k">메모</span>
        <textarea
          rows={2}
          value={session?.note ?? ''}
          onChange={(e) => { ensureSession(date, routineId); setSessionNote(date, e.target.value) }}
        />
      </label>
      <button
        type="button"
        className={session?.done ? 'btn' : 'btn pri'}
        style={{ marginTop: 8 }}
        onClick={() => { ensureSession(date, routineId); setSessionDone(date, !session?.done) }}
      >
        {session?.done ? '완료 취소' : '완료로 표시'}
      </button>
    </Panel>
  )
}
