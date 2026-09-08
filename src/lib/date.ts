/** YYYY-MM-DD (로컬 시간 기준) */
export function ymd(d: Date = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

export function parse(s: string): Date {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function addDays(s: string, n: number): string {
  const d = parse(s)
  d.setDate(d.getDate() + n)
  return ymd(d)
}

const DAY_KO = ['일', '월', '화', '수', '목', '금', '토']

export function dayOf(s: string): number {
  return parse(s).getDay()
}

export function labelKo(s: string): string {
  const d = parse(s)
  return `${d.getMonth() + 1}월 ${d.getDate()}일 (${DAY_KO[d.getDay()]})`
}

export function shortKo(s: string): string {
  const d = parse(s)
  return `${d.getMonth() + 1}.${d.getDate()}`
}

/** 그 날이 속한 주의 월요일 */
export function weekStart(s: string): string {
  const day = dayOf(s)
  return addDays(s, day === 0 ? -6 : 1 - day)
}

/** 월요일부터 7일 */
export function weekDays(mondayYmd: string): string[] {
  return Array.from({ length: 7 }, (_, i) => addDays(mondayYmd, i))
}

/** ISO 주차 번호 — 홈 상단 표시용 */
export function weekNo(s: string): number {
  const d = parse(s)
  const t = new Date(d.getFullYear(), 0, 1)
  const diff = (d.getTime() - t.getTime()) / 86400000
  return Math.floor((diff + t.getDay()) / 7) + 1
}

export const DAY_NAMES = DAY_KO
