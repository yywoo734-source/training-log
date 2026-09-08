import type { RecoveryLog, Session } from './types.ts'

/**
 * 회복 점수 가중치. 근거가 있는 수치가 아니라 시작점이다.
 * 몇 주 써보고 체감과 안 맞으면 여기만 고치면 된다.
 * ponytail: 고정 가중치 선형합. 개인 데이터가 쌓이면 회귀로 보정할 여지 있음.
 */
export const WEIGHTS = {
  sleepHours: 30,
  sleepQuality: 15,
  fatigue: 20,
  soreness: 15,
  pain: 10,
  prevLoad: 10,
}

/** 이 시간을 자면 수면 항목 만점 */
export const SLEEP_TARGET_H = 7.5

const clamp01 = (x: number) => Math.max(0, Math.min(1, x))
/** 1~5 척도에서 "높을수록 좋음" → 0~1 */
const good = (v: number) => clamp01((v - 1) / 4)
/** 1~5 척도에서 "높을수록 나쁨" → 0~1 */
const bad = (v: number) => clamp01((5 - v) / 4)

export function maxPain(r: RecoveryLog): number {
  return Math.max(r.painElbow ?? 1, r.painShoulder ?? 1, r.painBack ?? 1, r.painFinger ?? 1)
}

/**
 * 0~100. prevHard = 전날 고강도 세션이 있었는지.
 */
export function recoveryScore(r: RecoveryLog, prevHard: boolean): number {
  const s =
    clamp01(r.sleepH / SLEEP_TARGET_H) * WEIGHTS.sleepHours +
    good(r.sleepQuality) * WEIGHTS.sleepQuality +
    bad(r.fatigue) * WEIGHTS.fatigue +
    bad(r.soreness) * WEIGHTS.soreness +
    bad(maxPain(r)) * WEIGHTS.pain +
    (prevHard ? 0 : WEIGHTS.prevLoad)
  return Math.round(s)
}

export type Band = 'good' | 'watch' | 'low'

export function band(score: number): Band {
  if (score >= 75) return 'good'
  if (score >= 60) return 'watch'
  return 'low'
}

export const BAND_LABEL: Record<Band, string> = {
  good: '정상 강도',
  watch: '주의 · 무리 금지',
  low: '강도 낮추기',
}

/** 웨이트/클라이밍/불가리안백은 고강도로 본다 */
export function isHard(s: Session): boolean {
  return s.done && s.routineId !== 'rest' && s.routineId !== 'run'
}
