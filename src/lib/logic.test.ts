import { describe, expect, it } from 'vitest'
import { EXERCISES } from './seed.ts'
import { advise } from './progression.ts'
import { recoveryScore } from './recovery.ts'
import type { Entry, Exercise, RecoveryLog, SetLog } from './types.ts'

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
