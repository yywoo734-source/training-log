import type { Entry, Exercise, Phase, Session } from './types.ts'

export type Action = 'start' | 'up' | 'hold' | 'reps' | 'down' | 'deload'

export type Advice = {
  action: Action
  /** 오늘 권장 로드 */
  load: number
  /** 오늘 권장 세트 수 */
  sets: number
  /** 세트별 목표 반복수 */
  targetReps: number[]
  /** 사용자에게 보여줄 한 줄 */
  message: string
}

export const ACTION_LABEL: Record<Action, string> = {
  start: '첫 기록',
  up: '증량',
  hold: '유지',
  reps: '반복수 +1',
  down: '감량',
  deload: '강도 낮춤',
}

/** 완료된 세션에서 이 종목의 기록만 최신순으로 */
export function historyFor(sessions: Session[], exerciseId: string, beforeDate?: string): Entry[] {
  return sessions
    .filter((s) => s.done && (!beforeDate || s.date < beforeDate))
    .sort((a, b) => (a.date < b.date ? 1 : -1))
    .flatMap((s) => s.entries.filter((e) => e.exerciseId === exerciseId && e.sets.some((x) => x.reps > 0)))
}

/** 그래프용 — 이 종목의 세션별 기록을 오래된 순으로, 날짜를 붙여서 */
export function seriesFor(sessions: Session[], exerciseId: string): Point[] {
  return sessions
    .filter((s) => s.done)
    .sort((a, b) => (a.date < b.date ? -1 : 1))
    .flatMap((s) =>
      s.entries
        .filter((e) => e.exerciseId === exerciseId && e.sets.some((x) => x.reps > 0))
        .map((e) => ({ date: s.date, load: e.load, reps: repsOf(e) })),
    )
}

export type Point = { date: string; load: number; reps: number[] }

const sum = (a: number[]) => a.reduce((x, y) => x + y, 0)
const avg = (a: number[]) => (a.length ? sum(a) / a.length : 0)

/**
 * 그래프 아래 한 줄.
 * 세로축이 '실제 든 무게'라서, 무게는 그대로인데 횟수가 늘어난 성장은 선이 평평하다.
 * 그 경우를 말로 짚어주지 않으면 그래프가 정체로 읽힌다.
 */
export function trendNote(ex: Exercise, pts: Point[], phase: Phase): string {
  if (pts.length < 2) return '기록이 2회는 쌓여야 흐름이 보입니다.'

  const half = Math.min(3, Math.floor(pts.length / 2))
  const prev = pts.slice(-half * 2, -half)
  const recent = pts.slice(-half)
  const repsUp = avg(recent.map((p) => sum(p.reps))) - avg(prev.map((p) => sum(p.reps)))

  if (ex.loadType === 'body') {
    if (repsUp > 0.5) return `총 횟수가 늘고 있습니다. 맨몸 종목은 이게 성장입니다.`
    if (repsUp < -0.5) return '총 횟수가 줄고 있습니다. 회복이나 자세를 먼저 보세요.'
    return '횟수가 제자리입니다. 더 어려운 변형을 시도할 때일 수 있습니다.'
  }

  // 어시스트는 보조중량이 낮아지는 게 성장이라 방향을 뒤집는다
  const dir = ex.loadType === 'assist' ? -1 : 1
  const loadUp = (avg(recent.map((p) => p.load)) - avg(prev.map((p) => p.load))) * dir

  if (loadUp > 0) return '무게가 오르고 있습니다.'
  if (loadUp < 0) {
    return phase === 'cut'
      ? '무게가 내려갔습니다. 감량기에는 흔한 일이라 실패로 볼 것은 아닙니다.'
      : '무게가 내려갔습니다. 회복 점수와 수면을 먼저 확인하세요.'
  }
  if (repsUp > 0.5) return '무게는 그대로지만 횟수가 늘고 있습니다. 선은 평평해도 성장 중입니다.'
  if (repsUp < -0.5) return '무게도 횟수도 제자리에서 밀리고 있습니다. 회복을 보세요.'
  return '무게도 횟수도 제자리입니다.'
}

const roundTo = (v: number, step: number) => (step ? Math.round(v / step) * step : v)

export function repsOf(e: Entry): number[] {
  return e.sets.filter((s) => s.reps > 0).map((s) => s.reps)
}

export function avgRir(e: Entry): number | null {
  const r = e.sets.map((s) => s.rir).filter((x): x is number => x !== null && x !== undefined)
  return r.length ? r.reduce((a, b) => a + b, 0) / r.length : null
}

export function formatLoad(ex: Exercise, load: number): string {
  if (ex.loadType === 'body') return load > 0 ? `+${load}kg` : '맨몸'
  if (ex.loadType === 'assist') return `보조 ${load}kg`
  return `${load}kg`
}

export function formatReps(e: Entry): string {
  return repsOf(e).join(' / ')
}

const mean = (a: number[]) => a.reduce((x, y) => x + y, 0) / a.length

/**
 * 다음 세션 권장안.
 * @param history 최신순 기록 (historyFor 결과)
 * @param recovery 오늘 회복 점수 (없으면 null)
 */
export function advise(
  ex: Exercise,
  history: Entry[],
  plannedSets: number,
  recovery: number | null,
  phase: Phase,
): Advice {
  const base = adviseBase(ex, history, plannedSets, phase)

  // 회복이 낮으면 세트를 하나 덜어낸다. 이미 감량 권고면 그대로 둔다.
  if (recovery !== null && recovery < 60 && base.action !== 'down' && base.sets > 1) {
    return {
      ...base,
      action: 'deload',
      sets: base.sets - 1,
      targetReps: base.targetReps.slice(0, base.sets - 1),
      message: `회복 ${recovery}점 — 세트 하나 덜고 ${base.sets - 1}세트만. ${formatLoad(ex, base.load)} 유지.`,
    }
  }
  return base
}

function adviseBase(ex: Exercise, history: Entry[], plannedSets: number, phase: Phase): Advice {
  const dir = ex.loadType === 'assist' ? -1 : 1
  const last = history[0]

  if (!last) {
    return {
      action: 'start',
      load: 0,
      sets: plannedSets,
      targetReps: Array(plannedSets).fill(ex.repMin),
      message: `첫 기록입니다. ${ex.repMin}~${ex.repMax}회를 RIR 2로 마칠 수 있는 무게부터.`,
    }
  }

  const reps = repsOf(last)
  const rir = avgRir(last)
  const allMax = reps.length >= plannedSets && reps.every((r) => r >= ex.repMax)
  const belowMin = (e: Entry) => repsOf(e).some((r) => r < ex.repMin)

  // 감량기에는 정체가 정상이므로 감량 판단을 한 세션 더 늦춘다.
  const strikesNeeded = phase === 'cut' ? 3 : 2
  const strikes = history.slice(0, strikesNeeded).filter(belowMin).length
  const lastLine = `지난 ${formatReps(last)}${rir === null ? '' : ` · 평균 RIR ${rir.toFixed(1)}`}`

  if (strikes >= strikesNeeded) {
    if (ex.loadType === 'body') {
      return {
        action: 'down', load: last.load, sets: Math.max(1, plannedSets - 1),
        targetReps: Array(Math.max(1, plannedSets - 1)).fill(ex.repMin),
        message: `${strikesNeeded}회 연속 ${ex.repMin}회 미달. 세트를 줄이고 자세부터 회복하세요.`,
      }
    }
    const cut = Math.max(ex.step, roundTo(last.load * 0.07, ex.step))
    const next = Math.max(0, last.load - dir * cut)
    return {
      action: 'down', load: next, sets: plannedSets,
      targetReps: Array(plannedSets).fill(ex.repMin),
      message: `${strikesNeeded}회 연속 하한 미달. ${formatLoad(ex, last.load)} → ${formatLoad(ex, next)}로 낮춰 자세부터.`,
    }
  }

  if (allMax && rir !== null && rir >= 1 && !last.formBroke) {
    if (ex.loadType === 'body') {
      return {
        action: 'up', load: last.load, sets: plannedSets,
        targetReps: Array(plannedSets).fill(ex.repMax),
        message: `전 세트 ${ex.repMax}회 달성. 더 어려운 변형이나 가중을 붙일 때입니다.`,
      }
    }
    const next = Math.max(0, last.load + dir * ex.step)
    const form = ex.formSensitive ? ' 반동이 늘면 증량은 미루세요.' : ''
    return {
      action: 'up', load: next, sets: plannedSets,
      targetReps: Array(plannedSets).fill(ex.repMin),
      message: `${lastLine} · ${formatLoad(ex, last.load)} → ${formatLoad(ex, next)}로 올리고 ${ex.repMin}회부터 다시.${form}`,
    }
  }

  if (allMax) {
    const why = last.formBroke ? '자세가 무너졌습니다' : '마지막 세트 RIR 0'
    return {
      action: 'hold', load: last.load, sets: plannedSets,
      targetReps: Array(plannedSets).fill(ex.repMax),
      message: `반복수는 채웠지만 ${why}. ${formatLoad(ex, last.load)} 한 번 더 같은 무게로.`,
    }
  }

  const target = Array.from({ length: plannedSets }, (_, i) =>
    Math.min(ex.repMax, (reps[i] ?? ex.repMin) + 1),
  )
  const cutNote =
    phase === 'cut' && strikes > 0
      ? ' 감량기에는 같은 무게를 지키는 것만으로도 성공입니다.'
      : ''
  return {
    action: 'reps', load: last.load, sets: plannedSets,
    targetReps: target,
    message: `${lastLine} → ${formatLoad(ex, last.load)} 그대로, ${target.join('/')} 목표.${cutNote}`,
  }
}

/** 운동을 마친 직후 그 종목에 대해 남기는 요약 한 줄 */
export function reviewEntry(ex: Exercise, e: Entry, plannedSets: number): string {
  const reps = repsOf(e)
  if (!reps.length) return '기록 없음'
  const rir = avgRir(e)
  const allMax = reps.length >= plannedSets && reps.every((r) => r >= ex.repMax)
  if (allMax && rir !== null && rir >= 1 && !e.formBroke) {
    return `${reps.join('/')} 완료 · 평균 RIR ${rir.toFixed(1)} → 다음엔 증량`
  }
  if (allMax) return `${reps.join('/')} 완료 · 다음에도 같은 무게`
  return `${reps.join('/')} · 평균 ${mean(reps).toFixed(1)}회`
}
