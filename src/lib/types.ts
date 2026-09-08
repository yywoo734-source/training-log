export type Phase = 'cut' | 'maintain' | 'bulk'

/** weight: 무게가 높을수록 강함 / assist: 보조중량이 낮을수록 강함 / body: 맨몸 */
export type LoadType = 'weight' | 'assist' | 'body'

export type Category = 'pull' | 'push' | 'legs' | 'shoulders' | 'core'

export type Exercise = {
  id: string
  name: string
  en: string
  category: Category
  loadType: LoadType
  sets: number
  repMin: number
  repMax: number
  restSec: number
  /** 최소 증량 단위(kg). body는 0 */
  step: number
  /** 자세가 쉽게 무너지는 종목 — 증량 전 확인 문구를 붙인다 */
  formSensitive?: boolean
}

export type RoutineKind = 'weight' | 'run' | 'climb' | 'bag' | 'rest'

export type RoutineItem = { exerciseId: string; sets?: number }

export type Routine = {
  id: string
  name: string
  kind: RoutineKind
  /** 기본 요일 0=일 … 6=토. 제안일 뿐 고정이 아니다 */
  defaultDay: number
  items: RoutineItem[]
}

export type SetLog = { reps: number; rir: number | null }

export type Entry = {
  exerciseId: string
  load: number
  sets: SetLog[]
  /** 자세가 무너졌다고 사용자가 표시 */
  formBroke?: boolean
}

export type Session = {
  id: string
  /** YYYY-MM-DD */
  date: string
  routineId: string
  entries: Entry[]
  done: boolean
  /** 러닝/클라이밍/불가리안백의 간단 수치 (MVP2에서 확장) */
  metrics?: Record<string, number>
  note?: string
}

export type RecoveryLog = {
  date: string
  /** 취침 시각 HH:MM */
  bed?: string
  /** 기상 시각 HH:MM */
  wake?: string
  /** 총 수면시간(시간) */
  sleepH: number
  /** 1~5, 높을수록 좋음 */
  sleepQuality: number
  /** 1~5, 높을수록 나쁨 */
  fatigue: number
  soreness: number
  stress?: number
  motivation?: number
  /** 1~5, 높을수록 아픔. 없으면 통증 없음 */
  painElbow?: number
  painShoulder?: number
  painBack?: number
  painFinger?: number
  note?: string
}

export type Food = {
  id: string
  name: string
  /** 1회 기준량 설명 (예: "100g", "1개") */
  unit: string
  kcal: number
  p: number
  c: number
  f: number
  /** 사용자가 직접 추가한 음식 */
  custom?: boolean
}

export type Slot = '아침' | '점심' | '저녁' | '간식'

export type MealLog = {
  id: string
  date: string
  slot: Slot
  name: string
  /** 기준량의 배수 */
  qty: number
  kcal: number
  p: number
  c: number
  f: number
}

export type BodyLog = {
  date: string
  weight?: number
  waist?: number
  chest?: number
  shoulder?: number
  arm?: number
  thigh?: number
}

export type Settings = {
  phase: Phase
  targetKcal: number
  targetP: number
  targetF: number
  targetC: number
  kegelPerWeek: number
}

export type DB = {
  v: 1
  /** 마지막으로 바뀐 시각. 기기 간 어느 쪽이 최신인지 가리는 데 쓴다 */
  updatedAt?: number
  settings: Settings
  exercises: Exercise[]
  routines: Routine[]
  sessions: Session[]
  recovery: RecoveryLog[]
  foods: Food[]
  meals: MealLog[]
  body: BodyLog[]
  /** 케겔 완료한 날짜들 */
  kegel: string[]
}
