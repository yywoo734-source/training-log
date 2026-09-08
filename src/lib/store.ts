import { useSyncExternalStore } from 'react'
import type { BodyLog, DB, Entry, Food, MealLog, RecoveryLog, Session, Settings } from './types.ts'
import { EXERCISES, FOODS, ROUTINES, emptyDB } from './seed.ts'
import { addDays, dayOf, weekDays, weekStart, ymd } from './date.ts'
import { isHard, recoveryScore } from './recovery.ts'

const KEY = 'gymlog-v1'

function mergeById<T extends { id: string }>(seed: T[], saved: T[] | undefined): T[] {
  if (!saved?.length) return seed
  const ids = new Set(saved.map((x) => x.id))
  return [...saved, ...seed.filter((s) => !ids.has(s.id))]
}

function hydrate(saved: DB): DB {
  return {
    ...emptyDB(),
    ...saved,
    settings: { ...emptyDB().settings, ...saved.settings },
    exercises: mergeById(EXERCISES, saved.exercises),
    routines: mergeById(ROUTINES, saved.routines),
    foods: mergeById(FOODS, saved.foods),
  }
}

function load(): DB {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) return hydrate(JSON.parse(raw) as DB)
  } catch {
    // 저장본이 깨졌으면 초기값으로 시작한다. 덮어쓰기는 다음 저장 때.
  }
  return emptyDB()
}

let db: DB = load()
const subs = new Set<() => void>()

export function update(fn: (d: DB) => void) {
  const next = structuredClone(db)
  fn(next)
  next.updatedAt = Date.now()
  db = next
  saveLocal()
  push()
  notify()
}

function saveLocal() {
  try {
    localStorage.setItem(KEY, JSON.stringify(db))
  } catch (e) {
    console.error('저장 실패', e)
  }
}

const notify = () => subs.forEach((s) => s())

// ── 기기 간 동기화 ───────────────────────────────────────────
// 이 페이지가 claude.ai 위에서 열렸을 때만 붙는다. 그 밖에서는 이 폰(브라우저) 안에만 남는다.
type RemoteDoc = {
  set(data: Record<string, unknown>): Promise<void>
  onSnapshot(
    next: (s: { exists: boolean; data(): Record<string, unknown> | undefined; metadata?: { hasPendingWrites?: boolean } }) => void,
    error?: (e: unknown) => void,
  ): () => void
}
type Host = { use(name: string): Promise<{ doc(path: string): RemoteDoc } | null> }

export type SyncStatus = 'connecting' | 'on' | 'off'

let remote: RemoteDoc | null = null
let status: SyncStatus = 'connecting'
let pushTimer: ReturnType<typeof setTimeout> | undefined

function setStatus(s: SyncStatus) {
  if (status === s) return
  status = s
  notify()
}

export function getSyncStatus() {
  return status
}

export function useSyncStatus(): SyncStatus {
  return useSyncExternalStore(
    (s) => {
      subs.add(s)
      return () => subs.delete(s)
    },
    () => status,
  )
}

/**
 * ponytail: 기록 전체를 문서 하나에 통째로 넣고 나중에 쓴 쪽이 이긴다.
 * 혼자 쓰는 앱이라 이 정도면 충분하다. 두 기기를 동시에 열어두고 양쪽에서
 * 입력하면 늦게 저장된 쪽만 남는다. 그게 문제가 되면 그때 세션 단위로 쪼갤 것.
 */
function push() {
  if (!remote) return
  clearTimeout(pushTimer)
  pushTimer = setTimeout(() => {
    remote
      ?.set({ payload: JSON.stringify(db), updatedAt: db.updatedAt ?? Date.now() })
      .then(() => setStatus('on'))
      .catch(() => setStatus('off'))
  }, 600)
}

async function connect() {
  const host = (globalThis as { claude?: Host }).claude
  if (!host?.use) return setStatus('off')
  try {
    const cap = await host.use('db')
    if (!cap) return setStatus('off')
    remote = cap.doc('state/main')
    remote.onSnapshot(
      (snap) => {
        if (snap.metadata?.hasPendingWrites) return
        const body = snap.exists ? snap.data() : undefined
        const remoteAt = typeof body?.updatedAt === 'number' ? body.updatedAt : 0
        const localAt = db.updatedAt ?? 0
        if (typeof body?.payload === 'string' && remoteAt > localAt) {
          try {
            db = hydrate(JSON.parse(body.payload) as DB)
            saveLocal()
            notify()
          } catch {
            // 서버 저장본이 깨졌으면 무시하고 이 기기 기록을 유지한다
          }
        } else if (localAt > remoteAt) {
          push()
        }
        setStatus('on')
      },
      () => setStatus('off'),
    )
    setStatus('on')
  } catch {
    setStatus('off')
  }
}

void connect()

export function useDB(): DB {
  return useSyncExternalStore(
    (s) => {
      subs.add(s)
      return () => subs.delete(s)
    },
    () => db,
  )
}

export const getDB = () => db

// ── 내보내기 / 가져오기 ──────────────────────────────────────
export function exportJSON(): string {
  return JSON.stringify(db, null, 2)
}

export function importJSON(text: string): boolean {
  try {
    const parsed = JSON.parse(text) as DB
    if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.sessions)) return false
    update((d) => Object.assign(d, parsed))
    return true
  } catch {
    return false
  }
}

const uid = () => Math.random().toString(36).slice(2, 10)

// ── 조회 ────────────────────────────────────────────────────
export function exerciseById(d: DB, id: string) {
  return d.exercises.find((e) => e.id === id)
}

export function routineById(d: DB, id: string) {
  return d.routines.find((r) => r.id === id)
}

export function sessionFor(d: DB, date: string): Session | undefined {
  return d.sessions.find((s) => s.date === date)
}

/** 그 날 할 일: 이미 만든 세션이 있으면 그것, 없으면 요일 기본값 */
export function plannedRoutineId(d: DB, date: string): string {
  const s = sessionFor(d, date)
  if (s) return s.routineId
  const day = dayOf(date)
  return d.routines.find((r) => r.defaultDay === day)?.id ?? 'rest'
}

export function nutritionFor(d: DB, date: string) {
  const meals = d.meals.filter((m) => m.date === date)
  const sum = (k: 'kcal' | 'p' | 'c' | 'f') => meals.reduce((a, m) => a + m[k], 0)
  return { meals, kcal: sum('kcal'), p: sum('p'), c: sum('c'), f: sum('f') }
}

export function recoveryFor(d: DB, date: string) {
  const log = d.recovery.find((r) => r.date === date)
  if (!log) return { log: undefined, score: null as number | null }
  const prev = sessionFor(d, addDays(date, -1))
  return { log, score: recoveryScore(log, prev ? isHard(prev) : false) }
}

export function bodyFor(d: DB, date: string): BodyLog | undefined {
  return d.body.find((b) => b.date === date)
}

/** 최근 n일 체중 평균 (기록된 날만) */
export function avgWeight(d: DB, date: string, n = 7): number | null {
  const from = addDays(date, -(n - 1))
  const ws = d.body.filter((b) => b.date >= from && b.date <= date && b.weight).map((b) => b.weight!)
  return ws.length ? ws.reduce((a, b) => a + b, 0) / ws.length : null
}

/** 가장 최근에 기록된 측정값 */
export function latestBody(d: DB, key: keyof BodyLog): { date: string; value: number } | null {
  const found = [...d.body]
    .filter((b) => typeof b[key] === 'number')
    .sort((a, b) => (a.date < b.date ? 1 : -1))[0]
  return found ? { date: found.date, value: found[key] as number } : null
}

/**
 * 가장 최근 측정값과 그 직전 측정값. 인바디처럼 띄엄띄엄 찍는 값의 변화를 보는 데 쓴다.
 * 매일 재는 체중과 달리 "지난번 대비"가 유일하게 의미 있는 비교라서 두 개만 돌려준다.
 */
export function bodyTrend(d: DB, key: keyof BodyLog) {
  const xs = [...d.body]
    .filter((b) => typeof b[key] === 'number')
    .sort((a, b) => (a.date < b.date ? 1 : -1))
  if (!xs.length) return null
  return {
    date: xs[0].date,
    value: xs[0][key] as number,
    prev: (xs[1]?.[key] as number | undefined) ?? null,
    prevDate: xs[1]?.date ?? null,
  }
}

export function weekProgress(d: DB, date: string) {
  const days = weekDays(weekStart(date))
  const done = (kind: string) =>
    days.filter((day) => {
      const s = sessionFor(d, day)
      return s?.done && routineById(d, s.routineId)?.kind === kind
    }).length
  const planned = (kind: string) => d.routines.filter((r) => r.kind === kind).length
  return {
    days,
    weight: { done: done('weight'), target: planned('weight') },
    run: { done: done('run'), target: 1 },
    climb: { done: done('climb'), target: 1 },
    bag: { done: done('bag'), target: 1 },
    kegel: { done: days.filter((day) => d.kegel.includes(day)).length, target: d.settings.kegelPerWeek },
  }
}

// ── 변경 ────────────────────────────────────────────────────
export function saveSettings(patch: Partial<Settings>) {
  update((d) => Object.assign(d.settings, patch))
}

/** 그 날의 세션을 확보한다 (없으면 만들고 반환) */
export function ensureSession(date: string, routineId: string): Session {
  let found = sessionFor(db, date)
  if (!found || found.routineId !== routineId) {
    update((d) => {
      const i = d.sessions.findIndex((s) => s.date === date)
      const fresh: Session = { id: uid(), date, routineId, entries: [], done: false }
      if (i >= 0) d.sessions[i] = { ...fresh, id: d.sessions[i].id }
      else d.sessions.push(fresh)
    })
    found = sessionFor(db, date)!
  }
  return found
}

export function setEntry(date: string, routineId: string, entry: Entry) {
  ensureSession(date, routineId)
  update((d) => {
    const s = d.sessions.find((x) => x.date === date)!
    const i = s.entries.findIndex((e) => e.exerciseId === entry.exerciseId)
    if (i >= 0) s.entries[i] = entry
    else s.entries.push(entry)
  })
}

export function setSessionDone(date: string, done: boolean) {
  update((d) => {
    const s = d.sessions.find((x) => x.date === date)
    if (s) s.done = done
  })
}

export function setSessionNote(date: string, note: string) {
  update((d) => {
    const s = d.sessions.find((x) => x.date === date)
    if (s) s.note = note
  })
}

export function setMetric(date: string, key: string, value: number) {
  update((d) => {
    const s = d.sessions.find((x) => x.date === date)
    if (s) s.metrics = { ...s.metrics, [key]: value }
  })
}

export function addMeal(m: Omit<MealLog, 'id'>) {
  update((d) => {
    d.meals.push({ ...m, id: uid() })
  })
}

export function removeMeal(id: string) {
  update((d) => {
    d.meals = d.meals.filter((m) => m.id !== id)
  })
}

export function addFood(f: Omit<Food, 'id'>) {
  update((d) => {
    d.foods.push({ ...f, id: uid(), custom: true })
  })
}

export function removeFood(id: string) {
  update((d) => {
    d.foods = d.foods.filter((f) => f.id !== id)
  })
}

export function saveRecovery(log: RecoveryLog) {
  update((d) => {
    const i = d.recovery.findIndex((r) => r.date === log.date)
    if (i >= 0) d.recovery[i] = log
    else d.recovery.push(log)
  })
}

export function saveBody(log: BodyLog) {
  update((d) => {
    const i = d.body.findIndex((b) => b.date === log.date)
    if (i >= 0) d.body[i] = { ...d.body[i], ...log }
    else d.body.push(log)
  })
}

export function toggleKegel(date: string) {
  update((d) => {
    d.kegel = d.kegel.includes(date) ? d.kegel.filter((x) => x !== date) : [...d.kegel, date]
  })
}

/** 전체 삭제. 서버에 올라간 사본까지 비운다 */
export function resetAll() {
  db = emptyDB()
  db.updatedAt = Date.now()
  saveLocal()
  remote?.set({ payload: JSON.stringify(db), updatedAt: db.updatedAt }).catch(() => {})
  notify()
}

export function today() {
  return ymd()
}

/** 프리셋 음식 한 번 탭 = 기준량 1회분. 같은 끼니에 이미 있으면 수량만 올린다. */
export function logFood(date: string, slot: MealLog['slot'], f: Food, mult = 1) {
  update((d) => {
    const m = d.meals.find((x) => x.date === date && x.slot === slot && x.name === f.name)
    if (m) {
      m.qty += mult
      m.kcal += f.kcal * mult
      m.p += f.p * mult
      m.c += f.c * mult
      m.f += f.f * mult
    } else {
      d.meals.push({
        id: uid(), date, slot, name: f.name, qty: mult,
        kcal: f.kcal * mult, p: f.p * mult, c: f.c * mult, f: f.f * mult,
      })
    }
  })
}

/** 수량 증감. 0 이하가 되면 삭제 */
export function bumpMeal(id: string, delta: number) {
  update((d) => {
    const m = d.meals.find((x) => x.id === id)
    if (!m) return
    const unit = { kcal: m.kcal / m.qty, p: m.p / m.qty, c: m.c / m.qty, f: m.f / m.qty }
    const q = m.qty + delta
    if (q <= 0) {
      d.meals = d.meals.filter((x) => x.id !== id)
      return
    }
    m.qty = q
    m.kcal = unit.kcal * q
    m.p = unit.p * q
    m.c = unit.c * q
    m.f = unit.f * q
  })
}
