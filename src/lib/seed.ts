import type { DB, Exercise, Food, Routine, Settings } from './types.ts'

const ex = (
  id: string,
  name: string,
  en: string,
  category: Exercise['category'],
  sets: number,
  repMin: number,
  repMax: number,
  restSec: number,
  step: number,
  loadType: Exercise['loadType'] = 'weight',
  formSensitive = false,
): Exercise => ({ id, name, en, category, loadType, sets, repMin, repMax, restSec, step, formSensitive })

export const EXERCISES: Exercise[] = [
  // ── 등 / 당기기 ─────────────────────────────
  ex('pullup', '어시스트 풀업', 'Assisted Pull-up', 'pull', 4, 5, 8, 180, 5, 'assist'),
  ex('latpull', '랫풀다운', 'Lat Pulldown', 'pull', 3, 8, 12, 120, 5),
  ex('cablerow', '시티드 케이블 로우', 'Seated Cable Row', 'pull', 3, 8, 12, 120, 5),
  ex('machinerow', '머신 로우', 'Machine Row', 'pull', 3, 8, 12, 120, 5),
  ex('onearmlat', '원암 케이블 랫풀다운', 'One-arm Cable Pulldown', 'pull', 3, 10, 15, 90, 2.5),
  // ── 가슴 / 밀기 ─────────────────────────────
  ex('incline', '인클라인 프레스', 'Incline Press', 'push', 3, 8, 12, 120, 2.5),
  ex('bench', '벤치프레스', 'Bench Press', 'push', 3, 6, 10, 150, 2.5),
  // ── 어깨 ────────────────────────────────────
  ex('ohp', '숄더프레스', 'Overhead Press', 'shoulders', 3, 6, 10, 120, 2.5),
  ex('lat_stand', '스탠딩 레터럴 레이즈', 'Standing Lateral Raise', 'shoulders', 4, 12, 20, 70, 1, 'weight', true),
  ex('lat_seat', '시티드 레터럴 레이즈', 'Seated Lateral Raise', 'shoulders', 4, 12, 20, 70, 1, 'weight', true),
  ex('revpec', '리버스 펙덱', 'Reverse Pec Deck', 'shoulders', 3, 12, 20, 75, 5),
  // ── 하체 ────────────────────────────────────
  ex('vsquat', '리버스 V스쿼트', 'Reverse V-Squat', 'legs', 3, 6, 10, 180, 5),
  ex('rdl', 'RDL (루마니안 데드리프트)', 'Romanian Deadlift', 'legs', 3, 6, 10, 180, 5, 'weight', true),
  ex('hipthrust', '힙쓰러스트', 'Hip Thrust', 'legs', 3, 8, 12, 120, 5),
  ex('legcurl', '레그컬', 'Leg Curl', 'legs', 2, 10, 15, 90, 5),
  // ── 코어 ────────────────────────────────────
  ex('hlr', '행잉 레그레이즈', 'Hanging Leg Raise', 'core', 3, 8, 15, 90, 0, 'body'),
  ex('cablecrunch', '케이블 크런치', 'Cable Crunch', 'core', 3, 10, 15, 60, 5),
]

export const ROUTINES: Routine[] = [
  {
    id: 'upperA', name: '상체 A · 광배/어깨', kind: 'weight', defaultDay: 1,
    items: [
      { exerciseId: 'pullup' }, { exerciseId: 'latpull' }, { exerciseId: 'incline' },
      { exerciseId: 'cablerow' }, { exerciseId: 'lat_stand' }, { exerciseId: 'revpec' },
      { exerciseId: 'hlr' },
    ],
  },
  { id: 'run', name: 'Zone 2 러닝', kind: 'run', defaultDay: 2, items: [] },
  {
    id: 'lower', name: '하체 + 어깨', kind: 'weight', defaultDay: 3,
    items: [
      { exerciseId: 'vsquat' }, { exerciseId: 'rdl' }, { exerciseId: 'hipthrust' },
      { exerciseId: 'legcurl' }, { exerciseId: 'ohp' }, { exerciseId: 'lat_stand' },
      { exerciseId: 'cablecrunch' },
    ],
  },
  { id: 'bag', name: '불가리안백', kind: 'bag', defaultDay: 4, items: [] },
  {
    id: 'upperB', name: '상체 B · 광배/가슴/어깨', kind: 'weight', defaultDay: 5,
    items: [
      { exerciseId: 'pullup' }, { exerciseId: 'bench' }, { exerciseId: 'onearmlat' },
      { exerciseId: 'incline', sets: 2 }, { exerciseId: 'machinerow' },
      { exerciseId: 'lat_seat' }, { exerciseId: 'revpec' },
    ],
  },
  { id: 'climb', name: '클라이밍', kind: 'climb', defaultDay: 6, items: [] },
  { id: 'rest', name: '완전 휴식', kind: 'rest', defaultDay: 0, items: [] },
]

const fd = (id: string, name: string, unit: string, kcal: number, p: number, c: number, f: number): Food =>
  ({ id, name, unit, kcal, p, c, f })

/** 자주 먹는 음식 기본값. 탭 한 번으로 기록되는 게 이 앱 식단 기능의 전부다. */
export const FOODS: Food[] = [
  fd('chicken', '닭가슴살', '100g', 110, 23, 0, 1.5),
  fd('egg', '계란', '1개', 72, 6.3, 0.4, 5),
  fd('protein', '프로틴 쉐이크', '1스쿱', 120, 24, 3, 1.5),
  fd('rice', '현미밥', '1공기 210g', 310, 6, 68, 2),
  fd('whiterice', '흰쌀밥', '1공기 210g', 336, 5.6, 74, 0.6),
  fd('sweetpotato', '고구마', '150g', 130, 2, 31, 0.2),
  fd('oat', '오트밀', '40g', 152, 5.4, 27, 2.8),
  fd('greekyog', '그릭요거트', '100g', 59, 10, 3.6, 0.4),
  fd('tuna', '참치캔 (기름뺀)', '100g', 116, 26, 0, 1),
  fd('salmon', '연어', '100g', 208, 20, 0, 13),
  fd('beef', '소고기 우둔', '100g', 135, 22, 0, 5),
  fd('tofu', '두부', '150g', 120, 13, 3, 7),
  fd('milk', '우유', '200ml', 124, 6.6, 9.6, 6.8),
  fd('banana', '바나나', '1개', 105, 1.3, 27, 0.4),
  fd('apple', '사과', '1개', 104, 0.5, 28, 0.3),
  fd('almond', '아몬드', '30g', 174, 6, 6, 15),
  fd('kimbap', '김밥', '1줄', 480, 12, 75, 13),
  fd('americano', '아메리카노', '1잔', 10, 0, 1, 0),
]

export const DEFAULT_SETTINGS: Settings = {
  phase: 'cut',
  targetKcal: 2300,
  targetP: 170,
  targetF: 68,
  targetC: 250,
  kegelPerWeek: 5,
}

export function emptyDB(): DB {
  return {
    v: 1,
    settings: DEFAULT_SETTINGS,
    exercises: EXERCISES,
    routines: ROUTINES,
    sessions: [],
    recovery: [],
    foods: FOODS,
    meals: [],
    body: [],
    kegel: [],
  }
}
