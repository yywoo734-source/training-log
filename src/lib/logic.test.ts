import { describe, expect, it } from 'vitest'
import { EXERCISES } from './seed.ts'
import { advise, seriesFor, trendNote } from './progression.ts'
import { recoveryScore } from './recovery.ts'
import type { Entry, Exercise, RecoveryLog, Session, SetLog } from './types.ts'

const ex = (id: string): Exercise => EXERCISES.find((e) => e.id === id)!

const mk = (load: number, reps: number[], rir: number | null): Entry => ({
  exerciseId: 'x',
  load,
  sets: reps.map<SetLog>((r) => ({ reps: r, rir })),
})

describe('증량 추천', () => {
  it('어시스트 풀업은 보조중량이 내려가는 방향으로 증량한다', () => {
    const a = advise(ex('pullup'), [mk(25, [8, 8, 8, 8], 2)], 4, 80, 'cut')
    expect(a.action).toBe('up')
    expect(a.load).toBe(20)
  })

  it('일반 중량 종목은 올라가는 방향으로 증량한다', () => {
    const a = advise(ex('latpull'), [mk(55, [12, 12, 12], 2)], 3, 80, 'cut')
    expect(a.action).toBe('up')
    expect(a.load).toBe(60)
  })

  it('상한을 채웠어도 RIR 0이면 유지한다', () => {
    const a = advise(ex('latpull'), [mk(55, [12, 12, 12], 0)], 3, 80, 'cut')
    expect(a.action).toBe('hold')
    expect(a.load).toBe(55)
  })

  it('자세가 무너졌다고 표시하면 상한을 채워도 유지한다', () => {
    const e = { ...mk(12, [20, 20, 20, 20], 2), formBroke: true }
    const a = advise(ex('lat_stand'), [e], 4, 80, 'cut')
    expect(a.action).toBe('hold')
  })

  it('유지기에는 2회 연속 하한 미달이면 감량한다', () => {
    const h = [mk(60, [7, 7, 6], 0), mk(60, [7, 6, 6], 0)]
    const a = advise(ex('latpull'), h, 3, 80, 'maintain')
    expect(a.action).toBe('down')
    expect(a.load).toBe(55)
  })

  it('감량기에는 같은 상황에서 한 세션 더 기다린다', () => {
    const h = [mk(60, [7, 7, 6], 0), mk(60, [7, 6, 6], 0)]
    expect(advise(ex('latpull'), h, 3, 80, 'cut').action).toBe('reps')
    expect(advise(ex('latpull'), [...h, mk(60, [7, 7, 7], 0)], 3, 80, 'cut').action).toBe('down')
  })

  it('회복 점수가 낮으면 세트를 하나 줄인다', () => {
    const a = advise(ex('latpull'), [mk(55, [12, 12, 12], 2)], 3, 45, 'cut')
    expect(a.action).toBe('deload')
    expect(a.sets).toBe(2)
    expect(a.targetReps).toHaveLength(2)
  })

  it('맨몸 종목은 무게 대신 난이도를 올리라고 한다', () => {
    const a = advise(ex('hlr'), [mk(0, [15, 15, 15], 2)], 3, 80, 'cut')
    expect(a.action).toBe('up')
    expect(a.load).toBe(0)
    expect(a.message).toContain('가중')
  })

  it('기록이 없으면 첫 기록 안내를 준다', () => {
    expect(advise(ex('bench'), [], 3, null, 'cut').action).toBe('start')
  })
})

describe('회복 점수', () => {
  const base: RecoveryLog = { date: '2026-09-08', sleepH: 8, sleepQuality: 5, fatigue: 1, soreness: 1 }

  it('모든 항목이 최상이고 전날 쉬었으면 100점', () => {
    expect(recoveryScore(base, false)).toBe(100)
  })

  it('전날 고강도 운동이면 10점이 빠진다', () => {
    expect(recoveryScore(base, true)).toBe(90)
  })

  it('최악이면 20점 아래로 떨어진다', () => {
    const bad: RecoveryLog = {
      date: '2026-09-08', sleepH: 4, sleepQuality: 1, fatigue: 5, soreness: 5, painElbow: 5,
    }
    expect(recoveryScore(bad, true)).toBeLessThan(20)
  })

  it('0~100 범위를 벗어나지 않는다', () => {
    const over: RecoveryLog = { date: '2026-09-08', sleepH: 20, sleepQuality: 5, fatigue: 1, soreness: 1 }
    expect(recoveryScore(over, false)).toBe(100)
  })
})


// ── 성장 그래프 ─────────────────────────────────────────────
const pt = (date: string, load: number, reps: number[]) => ({ date, load, reps })

describe('성장 그래프 한 줄 요약', () => {
  it('무게가 그대로여도 횟수가 늘면 성장이라고 말한다', () => {
    // 세로축이 실제 무게라 선은 평평하다. 이걸 말로 짚지 않으면 정체로 읽힌다.
    const pts = [
      pt('2026-01-01', 50, [8, 8, 8]),
      pt('2026-01-08', 50, [8, 8, 8]),
      pt('2026-01-15', 50, [10, 10, 10]),
      pt('2026-01-22', 50, [11, 11, 10]),
    ]
    expect(trendNote(ex('latpull'), pts, 'cut')).toContain('횟수가 늘고')
  })

  it('무게가 오르면 그렇게 말한다', () => {
    const pts = [
      pt('2026-01-01', 50, [8, 8, 8]),
      pt('2026-01-08', 50, [8, 8, 8]),
      pt('2026-01-15', 55, [8, 8, 8]),
      pt('2026-01-22', 60, [8, 8, 8]),
    ]
    expect(trendNote(ex('latpull'), pts, 'cut')).toBe('무게가 오르고 있습니다.')
  })

  it('어시스트 풀업은 보조중량이 내려간 것을 성장으로 읽는다', () => {
    const pts = [
      pt('2026-01-01', 25, [8, 8, 8]),
      pt('2026-01-08', 25, [8, 8, 8]),
      pt('2026-01-15', 20, [8, 8, 8]),
      pt('2026-01-22', 15, [8, 8, 8]),
    ]
    expect(trendNote(ex('pullup'), pts, 'cut')).toBe('무게가 오르고 있습니다.')
  })

  it('감량기에 무게가 내려간 것은 실패로 말하지 않는다', () => {
    const pts = [
      pt('2026-01-01', 60, [8, 8, 8]),
      pt('2026-01-08', 60, [8, 8, 8]),
      pt('2026-01-15', 55, [8, 8, 8]),
      pt('2026-01-22', 50, [8, 8, 8]),
    ]
    expect(trendNote(ex('latpull'), pts, 'cut')).toContain('감량기에는')
    expect(trendNote(ex('latpull'), pts, 'bulk')).toContain('회복 점수')
  })

  it('맨몸 종목은 무게 대신 총 횟수로 판단한다', () => {
    const pts = [
      pt('2026-01-01', 0, [8, 8, 8]),
      pt('2026-01-08', 0, [8, 8, 8]),
      pt('2026-01-15', 0, [12, 12, 12]),
      pt('2026-01-22', 0, [13, 13, 12]),
    ]
    expect(trendNote(ex('hlr'), pts, 'cut')).toContain('총 횟수가 늘고')
  })

  it('기록이 하나뿐이면 흐름을 말하지 않는다', () => {
    expect(trendNote(ex('latpull'), [pt('2026-01-01', 50, [8])], 'cut')).toContain('2회는 쌓여야')
  })
})

describe('그래프에 넣을 기록 고르기', () => {
  const session = (date: string, done: boolean, load: number, reps: number[]): Session => ({
    id: date, date, routineId: 'upperA', done,
    entries: [{ exerciseId: 'latpull', load, sets: reps.map<SetLog>((r) => ({ reps: r, rir: 2 })) }],
  })

  it('완료하지 않은 세션은 빼고, 오래된 순으로 준다', () => {
    const out = seriesFor(
      [session('2026-01-15', true, 55, [8]), session('2026-01-08', false, 50, [8]), session('2026-01-01', true, 50, [8])],
      'latpull',
    )
    expect(out.map((p) => p.date)).toEqual(['2026-01-01', '2026-01-15'])
  })
})
