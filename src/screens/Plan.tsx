import { useMemo, useState } from 'react'
import type { Category, Exercise, LoadType } from '../lib/types.ts'
import { formatLoad, seriesFor, trendNote } from '../lib/progression.ts'
import type { Point } from '../lib/progression.ts'
import {
  addExercise, exerciseById, removeExercise, renameRoutine,
  saveExercise, setRoutineItems, useDB,
} from '../lib/store.ts'
import { shortKo } from '../lib/date.ts'
import { Panel } from '../ui.tsx'

/**
 * 루틴 화면(먼저 루틴을 고른다) + 종목 상세 화면(큰 버튼으로 고친다).
 * 헬스장에서 한 손으로 쓰는 것이 기준이라 입력칸보다 버튼을 크게 잡았다.
 */
export default function Plan({ onClose }: { onClose: () => void }) {
  const db = useDB()
  const [routineId, setRoutineId] = useState(db.routines[0]?.id ?? '')
  const [editId, setEditId] = useState<string | null>(null)

  const ex = editId ? exerciseById(db, editId) : undefined
  if (editId && ex) return <ExerciseDetail ex={ex} onBack={() => setEditId(null)} />

  return (
    <RoutineBoard
      routineId={routineId}
      setRoutineId={setRoutineId}
      onEdit={setEditId}
      onClose={onClose}
    />
  )
}

// ── 루틴 화면 ────────────────────────────────────────────────
function RoutineBoard({
  routineId, setRoutineId, onEdit, onClose,
}: {
  routineId: string
  setRoutineId: (id: string) => void
  onEdit: (id: string) => void
  onClose: () => void
}) {
  const db = useDB()
  const routine = db.routines.find((r) => r.id === routineId) ?? db.routines[0]
  const [newName, setNewName] = useState('')

  if (!routine) return null

  const items = routine.items
  const inRoutine = new Set(items.map((i) => i.exerciseId))
  const rest = db.exercises.filter((e) => !inRoutine.has(e.id))

  const move = (i: number, delta: number) => {
    const next = [...items]
    const j = i + delta
    if (j < 0 || j >= next.length) return
    ;[next[i], next[j]] = [next[j], next[i]]
    setRoutineItems(routine.id, next)
  }
  const drop = (id: string) => setRoutineItems(routine.id, items.filter((i) => i.exerciseId !== id))
  const put = (id: string) => setRoutineItems(routine.id, [...items, { exerciseId: id }])
  const bumpSets = (i: number, delta: number, fallback: number) => {
    const next = [...items]
    next[i] = { ...next[i], sets: Math.max(1, (next[i].sets ?? fallback) + delta) }
    setRoutineItems(routine.id, next)
  }

  return (
    <>
      <div className="topbar">
        <h1>루틴</h1>
        <button type="button" className="btn sm" onClick={onClose}>닫기</button>
      </div>

      <div className="seg scroll-x">
        {db.routines.map((r) => (
          <button
            key={r.id}
            type="button"
            className={r.id === routine.id ? 'on' : ''}
            onClick={() => setRoutineId(r.id)}
          >
            {r.name.split(' · ')[0]}
          </button>
        ))}
      </div>

      <label className="field" style={{ marginTop: 10 }}>
        <span className="k">루틴 이름</span>
        <input
          type="text"
          value={routine.name}
          onChange={(e) => renameRoutine(routine.id, e.target.value)}
        />
      </label>

      {routine.kind !== 'weight' ? (
        <div className="note" style={{ marginTop: 10 }}>
          {routine.kind === 'rest'
            ? '휴식일에는 종목이 없습니다.'
            : '러닝·클라이밍·불가리안백은 숫자만 기록하는 세션이라 종목 목록이 없습니다.'}
        </div>
      ) : (
        <>
          <div className="sec"><span>이 루틴의 순서</span><span>{items.length}종목</span></div>

          {items.length === 0 && <div className="empty">아직 종목이 없습니다. 아래에서 넣으세요.</div>}

          <div className="stack">
            {items.map((it, i) => {
              const ex = exerciseById(db, it.exerciseId)
              if (!ex) return null
              const sets = it.sets ?? ex.sets
              return (
                <div className="slot" key={it.exerciseId}>
                  <div className="ord">
                    <button type="button" onClick={() => move(i, -1)} disabled={i === 0} aria-label="위로">▲</button>
                    <button type="button" onClick={() => move(i, 1)} disabled={i === items.length - 1} aria-label="아래로">▼</button>
                  </div>
                  <button type="button" className="slotname" onClick={() => onEdit(ex.id)}>
                    <span className="nm">{ex.name}</span>
                    <span className="sub2">{ex.repMin}–{ex.repMax}회 · 휴식 {ex.restSec}초 ›</span>
                  </button>
                  <div className="setbox">
                    <button type="button" onClick={() => bumpSets(i, -1, ex.sets)} aria-label="세트 줄이기">−</button>
                    <b className="num">{sets}</b>
                    <button type="button" onClick={() => bumpSets(i, 1, ex.sets)} aria-label="세트 늘리기">＋</button>
                  </div>
                  <button type="button" className="x" onClick={() => drop(ex.id)} aria-label="루틴에서 빼기">×</button>
                </div>
              )
            })}
          </div>

          <Panel title="이 루틴에 넣기">
            <div className="pick">
              {rest.map((e) => (
                <button key={e.id} type="button" onClick={() => put(e.id)}>{e.name}</button>
              ))}
              {rest.length === 0 && <span className="note">모든 종목이 이미 들어 있습니다.</span>}
            </div>
          </Panel>
        </>
      )}

      <div className="sec"><span>새 종목 만들기</span></div>
      <div className="tile wide">
        <label className="field">
          <span className="k">종목 이름</span>
          <input
            type="text"
            value={newName}
            placeholder="예: 체스트 프레스"
            onChange={(e) => setNewName(e.target.value)}
          />
        </label>
        <button
          type="button"
          className="btn"
          style={{ marginTop: 8 }}
          disabled={!newName.trim()}
          onClick={() => {
            const id = addExercise(newName.trim())
            setNewName('')
            onEdit(id)
          }}
        >
          만들고 설정하러 가기
        </button>
      </div>
    </>
  )
}

// ── 종목 상세 화면 ───────────────────────────────────────────
const CATS: [Category, string][] = [
  ['pull', '당기기'], ['push', '밀기'], ['legs', '하체'], ['shoulders', '어깨'], ['core', '코어'],
]
const LOADS: [LoadType, string][] = [
  ['weight', '무게가 높을수록 강함'],
  ['assist', '보조가 낮을수록 강함'],
  ['body', '맨몸'],
]

function ExerciseDetail({ ex, onBack }: { ex: Exercise; onBack: () => void }) {
  const db = useDB()
  const pts = useMemo(() => seriesFor(db.sessions, ex.id), [db.sessions, ex.id])
  const set = (patch: Partial<Exercise>) => saveExercise({ ...ex, ...patch })

  return (
    <>
      <div className="topbar">
        <button type="button" className="btn sm" onClick={onBack}>‹ 루틴</button>
        <span className="sub">자동 저장</span>
      </div>

      <div className="topbar" style={{ paddingTop: 0 }}>
        <h1>{ex.name}</h1>
      </div>

      <Growth ex={ex} pts={pts} />

      <div className="sec"><span>설정</span></div>

      <label className="field">
        <span className="k">이름</span>
        <input type="text" value={ex.name} onChange={(e) => set({ name: e.target.value })} />
      </label>

      <Stepper
        label="기본 세트 수"
        value={ex.sets}
        unit="세트"
        step={1}
        min={1}
        onChange={(sets) => set({ sets })}
      />
      <Stepper
        label="세트 사이 휴식"
        value={ex.restSec}
        unit="초"
        step={10}
        min={10}
        onChange={(restSec) => set({ restSec })}
      />

      <div className="bigfield">
        <span className="k">목표 횟수</span>
        <div className="g2" style={{ marginTop: 7 }}>
          <label className="field">
            <span className="k">최소</span>
            <input
              type="number"
              inputMode="numeric"
              value={ex.repMin}
              onChange={(e) => set({ repMin: Number(e.target.value) })}
            />
          </label>
          <label className="field">
            <span className="k">최대</span>
            <input
              type="number"
              inputMode="numeric"
              value={ex.repMax}
              onChange={(e) => set({ repMax: Number(e.target.value) })}
            />
          </label>
        </div>
        <div className="note" style={{ marginTop: 7 }}>
          모든 세트가 최대를 채우면 다음에 무게를 올리라고 알려줍니다.
        </div>
      </div>

      {ex.loadType !== 'body' && (
        <Stepper
          label="한 번에 올리는 무게"
          value={ex.step}
          unit="kg"
          step={0.5}
          min={0.5}
          onChange={(step) => set({ step })}
        />
      )}

      <div className="bigfield">
        <span className="k">무게를 읽는 방향</span>
        <div className="stack" style={{ marginTop: 7, gap: 4 }}>
          {LOADS.map(([id, label]) => (
            <button
              key={id}
              type="button"
              className={`opt ${ex.loadType === id ? 'on' : ''}`}
              onClick={() => set({ loadType: id })}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="note" style={{ marginTop: 7 }}>
          어시스트 풀업처럼 보조가 낮을수록 잘한 종목은 가운데를 고르세요. 추천 방향이 뒤집힙니다.
        </div>
      </div>

      <div className="bigfield">
        <span className="k">부위</span>
        <div className="seg scroll-x" style={{ marginTop: 7 }}>
          {CATS.map(([id, label]) => (
            <button
              key={id}
              type="button"
              className={ex.category === id ? 'on' : ''}
              onClick={() => set({ category: id })}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <button
        type="button"
        className={`opt ${ex.formSensitive ? 'on' : ''}`}
        style={{ marginTop: 6 }}
        onClick={() => set({ formSensitive: !ex.formSensitive })}
      >
        자세가 잘 무너지는 종목 {ex.formSensitive ? '✓' : ''}
      </button>
      <div className="note">켜두면 증량을 권할 때 반동을 확인하라는 문구가 함께 뜹니다.</div>

      <button
        type="button"
        className="btn danger"
        style={{ marginTop: 12 }}
        onClick={() => {
          if (confirm(`${ex.name}을(를) 종목 목록과 모든 루틴에서 지웁니다. 지난 기록은 남습니다.`)) {
            removeExercise(ex.id)
            onBack()
          }
        }}
      >
        이 종목 지우기
      </button>
    </>
  )
}

/** 운동 화면의 큰 ＋／− 입력(.bigrow)을 그대로 쓴다. 장갑 낀 손 기준은 이미 거기서 맞춰뒀다. */
function Stepper({
  label, value, unit, step, min, onChange,
}: {
  label: string
  value: number
  unit: string
  step: number
  min: number
  onChange: (v: number) => void
}) {
  const round = (v: number) => Math.round(v * 10) / 10
  return (
    <div className="bigfield">
      <span className="k" style={{ paddingBottom: 6 }}>{label}</span>
      <div className="bigrow">
        <button type="button" onClick={() => onChange(Math.max(min, round(value - step)))} aria-label={`${label} 줄이기`}>−</button>
        <div className="val"><b>{value}</b><span>{unit}</span></div>
        <button type="button" onClick={() => onChange(round(value + step))} aria-label={`${label} 늘리기`}>+</button>
      </div>
    </div>
  )
}

// ── 성장 그래프 ──────────────────────────────────────────────
const W = 320
const H = 132
// 왼쪽 여백은 값 라벨 전용 자리다. 점과 라벨이 겹치지 않게 그림 영역을 그만큼 밀어둔다.
const PAD = { l: 42, r: 12, t: 16, b: 28 }

function Growth({ ex, pts }: { ex: Exercise; pts: Point[] }) {
  const db = useDB()
  const [sel, setSel] = useState<number | null>(null)

  if (pts.length === 0) {
    return (
      <Panel title="성장 그래프">
        <div className="empty">아직 이 종목의 완료된 기록이 없습니다.</div>
        <div className="note">운동을 마치고 “오늘 운동 마치기”를 누르면 여기에 쌓입니다.</div>
      </Panel>
    )
  }

  const body = ex.loadType === 'body'
  const valueOf = (p: Point) => (body ? p.reps.reduce((a, b) => a + b, 0) : p.load)
  const unit = body ? '회' : 'kg'
  // 어시스트는 보조중량이 낮을수록 강하므로 세로축을 뒤집어 "올라가면 성장"을 지킨다
  const flip = ex.loadType === 'assist'

  const vals = pts.map(valueOf)
  const lo = Math.min(...vals)
  const hi = Math.max(...vals)
  const span = hi - lo || 1

  const ts = pts.map((p) => Date.parse(p.date))
  const t0 = ts[0]
  const tspan = ts[ts.length - 1] - t0 || 1

  const x = (i: number) => (pts.length === 1 ? W / 2 : PAD.l + ((ts[i] - t0) / tspan) * (W - PAD.l - PAD.r))
  const y = (v: number) => {
    const norm = (v - lo) / span
    const up = flip ? 1 - norm : norm
    return H - PAD.b - up * (H - PAD.t - PAD.b)
  }

  const at = sel ?? pts.length - 1
  const cur = pts[at]
  const line = pts.map((p, i) => `${x(i).toFixed(1)},${y(valueOf(p)).toFixed(1)}`).join(' ')

  return (
    <Panel title="성장 그래프" right={`${pts.length}회 기록`}>
      <svg viewBox={`0 0 ${W} ${H}`} className="chart" role="img"
        aria-label={`${ex.name} 기록 ${pts.length}회, ${lo}${unit}에서 ${hi}${unit} 사이`}>
        {/* 최고·최저 자리를 나타내는 옅은 선. 눈금은 두 개면 충분하다 */}
        <line x1={PAD.l} x2={W - PAD.r} y1={y(hi)} y2={y(hi)} className="grid" />
        <line x1={PAD.l} x2={W - PAD.r} y1={y(lo)} y2={y(lo)} className="grid" />
        <text x={4} y={y(hi)} className="axis mid">{hi}{unit}</text>
        {hi !== lo && <text x={4} y={y(lo)} className="axis mid">{lo}{unit}</text>}

        {pts.length > 1 && <polyline points={line} className="line" fill="none" />}

        {pts.map((p, i) => (
          <circle
            key={p.date + i}
            cx={x(i)}
            cy={y(valueOf(p))}
            r={i === at ? 5.5 : 4}
            className={i === at ? 'dot on' : 'dot'}
            onClick={() => setSel(i)}
          />
        ))}

        <text x={PAD.l} y={H - 6} className="axis">{shortKo(pts[0].date)}</text>
        {pts.length > 1 && (
          <text x={W - PAD.r} y={H - 6} className="axis end">{shortKo(pts[pts.length - 1].date)}</text>
        )}
      </svg>

      <div className="row" style={{ borderBottom: 'none' }}>
        <span className="n">{shortKo(cur.date)}</span>
        <span className="s">
          {body ? `${cur.reps.reduce((a, b) => a + b, 0)}회` : formatLoad(ex, cur.load)}
          {' · '}{cur.reps.join('/')}회
        </span>
      </div>
      <div className="note">{trendNote(ex, pts, db.settings.phase)}</div>
    </Panel>
  )
}
