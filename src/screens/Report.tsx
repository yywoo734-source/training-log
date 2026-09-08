import type { DB, Entry, Exercise } from '../lib/types.ts'
import { addDays, shortKo, weekDays, weekNo, weekStart } from '../lib/date.ts'
import { repsOf } from '../lib/progression.ts'
import { isHard, recoveryScore } from '../lib/recovery.ts'
import { avgWeight, exerciseById, latestBody, nutritionFor, routineById, sessionFor, useDB } from '../lib/store.ts'
import { Panel, Stat, round1 } from '../ui.tsx'

const CAT_LABEL: Record<Exercise['category'], string> = {
  pull: '등/당기기', push: '가슴/밀기', shoulders: '어깨', legs: '하체', core: '코어',
}

/** 방향을 고려한 "가장 좋은 로드" — 어시스트는 낮을수록 좋다 */
function bestLoad(ex: Exercise, entries: Entry[]): number | null {
  const loads = entries.map((e) => e.load)
  if (!loads.length) return null
  return ex.loadType === 'assist' ? Math.min(...loads) : Math.max(...loads)
}

function weekStats(db: DB, anchor: string) {
  const start = weekStart(anchor)
  const days = weekDays(start)
  const inWeek = db.sessions.filter((s) => s.done && days.includes(s.date))

  const setsByCat: Record<string, number> = {}
  let totalSets = 0
  const byExercise = new Map<string, Entry[]>()
  for (const s of inWeek) {
    for (const e of s.entries) {
      const ex = exerciseById(db, e.exerciseId)
      if (!ex) continue
      const n = repsOf(e).length
      totalSets += n
      setsByCat[ex.category] = (setsByCat[ex.category] ?? 0) + n
      byExercise.set(e.exerciseId, [...(byExercise.get(e.exerciseId) ?? []), e])
    }
  }

  // 지난 기록과 비교해 올라간 종목 / 제자리인 종목
  const up: string[] = []
  const flat: string[] = []
  for (const [exId, entries] of byExercise) {
    const ex = exerciseById(db, exId)
    if (!ex) continue
    const before = db.sessions
      .filter((s) => s.done && s.date < start)
      .flatMap((s) => s.entries.filter((e) => e.exerciseId === exId))
    const now = bestLoad(ex, entries)
    const then = bestLoad(ex, before)
    if (now === null || then === null) continue
    const better = ex.loadType === 'assist' ? now < then : now > then
    if (better) up.push(ex.name)
    else if (now === then) flat.push(ex.name)
  }

  const mealDays = days.filter((d) => db.meals.some((m) => m.date === d))
  const nuts = mealDays.map((d) => nutritionFor(db, d))
  const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null)

  const recLogs = db.recovery.filter((r) => days.includes(r.date))
  const scores = recLogs.map((r) => {
    const prev = sessionFor(db, addDays(r.date, -1))
    return recoveryScore(r, prev ? isHard(prev) : false)
  })

  const kindCount = (kind: string) =>
    inWeek.filter((s) => routineById(db, s.routineId)?.kind === kind).length

  const sumMetric = (kind: string, key: string) =>
    inWeek
      .filter((s) => routineById(db, s.routineId)?.kind === kind)
      .reduce((a, s) => a + (s.metrics?.[key] ?? 0), 0)

  const maxMetric = (kind: string, key: string) =>
    Math.max(0, ...inWeek.filter((s) => routineById(db, s.routineId)?.kind === kind).map((s) => s.metrics?.[key] ?? 0))

  const end = days[6]
  const wNow = avgWeight(db, end)
  const wPrev = avgWeight(db, addDays(start, -1))
  const waistNow = db.body.filter((b) => b.waist && days.includes(b.date)).slice(-1)[0]?.waist ?? null
  const waistPrev = db.body.filter((b) => b.waist && b.date < start).slice(-1)[0]?.waist ?? null

  return {
    start, days, inWeek, totalSets, setsByCat, up, flat,
    weightSessions: kindCount('weight'),
    runSessions: kindCount('run'),
    climbSessions: kindCount('climb'),
    bagSessions: kindCount('bag'),
    kegelDays: days.filter((d) => db.kegel.includes(d)).length,
    avgKcal: avg(nuts.map((n) => n.kcal)),
    avgP: avg(nuts.map((n) => n.p)),
    proteinHitDays: nuts.filter((n) => n.p >= db.settings.targetP).length,
    mealDays: mealDays.length,
    avgSleep: avg(recLogs.map((r) => r.sleepH)),
    avgScore: avg(scores),
    runMinutes: sumMetric('run', 'minutes'),
    runKm: sumMetric('run', 'km'),
    climbSends: sumMetric('climb', 'sends'),
    climbFlashes: sumMetric('climb', 'flashes'),
    climbTop: maxMetric('climb', 'topGrade'),
    wNow, wPrev, waistNow, waistPrev,
  }
}

function verdict(st: ReturnType<typeof weekStats>): string {
  const waistDown = st.waistNow !== null && st.waistPrev !== null && st.waistNow < st.waistPrev
  const weightDown = st.wNow !== null && st.wPrev !== null && st.wNow < st.wPrev
  const perfUp = st.up.length > 0
  const stalled = st.flat.length >= 3 && !perfUp

  if (st.inWeek.length === 0) return '이번 주 완료된 세션이 없습니다. 기록부터 다시 시작하세요.'
  if (waistDown && (perfUp || !stalled)) {
    return '허리둘레가 줄었고 수행 능력은 유지되고 있습니다. 지금 칼로리와 운동량을 그대로 유지하세요.'
  }
  if (weightDown && stalled) {
    return '체중은 줄었지만 주요 종목이 제자리입니다. 칼로리를 조금 올리거나 수면을 먼저 점검하세요.'
  }
  if (!waistDown && !weightDown && !perfUp) {
    return '체형도 수행도 큰 변화가 없습니다. 칼로리를 소폭 줄이거나 걸음 수를 늘려보세요.'
  }
  if (perfUp) return `${st.up.length}개 종목이 올라갔습니다. 회복이 따라오는 한 지금 방식을 유지하세요.`
  return '지표가 엇갈립니다. 다음 주 허리둘레와 풀업 성적을 함께 보고 판단하세요.'
}

export default function Report({ date, setDate }: { date: string; setDate: (d: string) => void }) {
  const db = useDB()
  const st = weekStats(db, date)
  const s = db.settings
  const waist = latestBody(db, 'waist')

  return (
    <>
      <div className="topbar">
        <div style={{ display: 'flex', gap: 4 }}>
          <button type="button" className="btn sm" onClick={() => setDate(addDays(date, -7))} aria-label="지난 주">‹</button>
          <button type="button" className="btn sm" style={{ minWidth: 132 }}>
            {shortKo(st.start)} – {shortKo(st.days[6])}
          </button>
          <button type="button" className="btn sm" onClick={() => setDate(addDays(date, 7))} aria-label="다음 주">›</button>
        </div>
        <span className="sub">W{weekNo(st.start)}</span>
      </div>

      <div className="tile wide lead">
        <span className="k">이번 주 평가</span>
        <div className="note" style={{ fontSize: 14, color: 'var(--ink)', paddingTop: 2 }}>{verdict(st)}</div>
      </div>

      <div className="sec"><span>운동</span><span>{st.inWeek.length}세션</span></div>
      <div className="g3">
        <Stat k="웨이트" v={`${st.weightSessions}/3`} d={`${st.totalSets}세트`} />
        <Stat k="러닝" v={`${st.runSessions}/1`} d={st.runMinutes ? `${st.runMinutes}분` : '—'} />
        <Stat k="클라이밍" v={`${st.climbSessions}/1`} d={st.climbSends ? `완등 ${st.climbSends}` : '—'} />
      </div>
      <div className="g3">
        <Stat k="불가리안백" v={`${st.bagSessions}/1`} d="회" />
        <Stat k="케겔" v={`${st.kegelDays}/${s.kegelPerWeek}`} d="일" />
        <Stat k="Flash" v={st.climbFlashes || '—'} d={st.climbTop ? `최고 ${st.climbTop}` : '개'} />
      </div>

      {Object.keys(st.setsByCat).length > 0 && (
        <Panel title="부위별 세트">
          {Object.entries(st.setsByCat)
            .sort((a, b) => b[1] - a[1])
            .map(([cat, n]) => (
              <div className="row" key={cat}>
                <span className="n">{CAT_LABEL[cat as Exercise['category']]}</span>
                <span className="s">{n}세트</span>
              </div>
            ))}
        </Panel>
      )}

      <Panel title="종목 추세">
        {st.up.length > 0 && (
          <div className="row"><span className="n">올라간 종목</span><span className="s" style={{ color: 'var(--grn)' }}>{st.up.join(', ')}</span></div>
        )}
        {st.flat.length > 0 && (
          <div className="row"><span className="n">제자리</span><span className="s">{st.flat.join(', ')}</span></div>
        )}
        {st.up.length === 0 && st.flat.length === 0 && <div className="empty">비교할 지난 기록이 아직 없습니다.</div>}
      </Panel>

      <div className="sec"><span>식단</span><span>{st.mealDays}일 기록</span></div>
      <div className="g3">
        <Stat k="평균 칼로리" v={st.avgKcal ? Math.round(st.avgKcal) : '—'} d={`목표 ${s.targetKcal}`} />
        <Stat
          k="평균 단백질"
          v={st.avgP ? Math.round(st.avgP) : '—'}
          d={`목표 ${s.targetP}g`}
          tone={st.avgP && st.avgP >= s.targetP ? 'grn' : 'amb'}
        />
        <Stat k="목표 달성" v={`${st.proteinHitDays}일`} d="단백질 기준" tone={st.proteinHitDays >= 5 ? 'grn' : 'mut'} />
      </div>

      <div className="sec"><span>회복</span></div>
      <div className="g3">
        <Stat
          k="평균 수면"
          v={st.avgSleep ? `${Math.floor(st.avgSleep)}:${String(Math.round((st.avgSleep % 1) * 60)).padStart(2, '0')}` : '—'}
          d="시간"
          tone={st.avgSleep && st.avgSleep >= 7 ? 'grn' : 'amb'}
        />
        <Stat
          k="평균 회복"
          v={st.avgScore ? Math.round(st.avgScore) : '—'}
          d="/100"
          tone={st.avgScore && st.avgScore >= 75 ? 'grn' : st.avgScore && st.avgScore >= 60 ? 'amb' : 'red'}
        />
        <Stat k="기록일" v={`${db.recovery.filter((r) => st.days.includes(r.date)).length}일`} d="/7" />
      </div>

      <div className="sec"><span>체형</span><span>체중보다 허리를 봅니다</span></div>
      <div className="g3">
        <Stat
          k="허리"
          v={st.waistNow ? round1(st.waistNow) : waist ? round1(waist.value) : '—'}
          d={st.waistNow && st.waistPrev ? `${st.waistNow - st.waistPrev > 0 ? '+' : ''}${round1(st.waistNow - st.waistPrev)}` : 'cm'}
          tone={st.waistNow && st.waistPrev ? (st.waistNow < st.waistPrev ? 'grn' : 'red') : 'mut'}
        />
        <Stat
          k="평균 체중"
          v={st.wNow ? round1(st.wNow) : '—'}
          d={st.wNow && st.wPrev ? `${st.wNow - st.wPrev > 0 ? '+' : ''}${round1(st.wNow - st.wPrev)} kg` : 'kg'}
          tone={st.wNow && st.wPrev ? (st.wNow < st.wPrev ? 'grn' : 'mut') : 'mut'}
        />
        <Stat k="러닝 거리" v={st.runKm ? round1(st.runKm) : '—'} d="km" />
      </div>

      <div className="note" style={{ marginTop: 6 }}>
        하루 단위 변화는 수분과 글리코겐에 크게 흔들립니다. 3~4주 흐름으로 보세요.
      </div>
    </>
  )
}
