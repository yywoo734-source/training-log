import { addDays, labelKo, weekNo } from '../lib/date.ts'
import { advise, formatLoad, historyFor } from '../lib/progression.ts'
import { BAND_LABEL, band } from '../lib/recovery.ts'
import {
  avgWeight, exerciseById, latestBody, nutritionFor, plannedRoutineId,
  recoveryFor, routineById, sessionFor, useDB, weekProgress,
} from '../lib/store.ts'
import { Bar, DateNav, Dots, Panel, Stat, round1 } from '../ui.tsx'

const PHASE_LABEL = { cut: '감량기', maintain: '유지기', bulk: '증량기' } as const

export default function Home({
  date, setDate, onOpenWorkout, onOpenSettings, onGo,
}: {
  date: string
  setDate: (d: string) => void
  onOpenWorkout: () => void
  onOpenSettings: () => void
  onGo: (t: 'workout' | 'food' | 'recovery' | 'report') => void
}) {
  const db = useDB()
  const routineId = plannedRoutineId(db, date)
  const routine = routineById(db, routineId)!
  const session = sessionFor(db, date)
  const { log: rec, score } = recoveryFor(db, date)
  const nut = nutritionFor(db, date)
  const wk = weekProgress(db, date)
  const s = db.settings

  const wAvg = avgWeight(db, date)
  const wPrev = avgWeight(db, addDays(date, -7))
  const waist = latestBody(db, 'waist')
  const waistOld = db.body
    .filter((b) => typeof b.waist === 'number' && b.date <= addDays(date, -28))
    .sort((a, b) => (a.date < b.date ? 1 : -1))[0]

  const pullHist = historyFor(db.sessions, 'pullup', undefined)
  const pullNow = pullHist[0]
  const pullOld = pullHist.find((_, i) => i >= 3)

  const proteinTone = nut.p >= s.targetP ? 'grn' : nut.p >= s.targetP * 0.88 ? 'amb' : 'red'
  const proteinLabel = nut.p >= s.targetP ? '목표 달성' : nut.p >= s.targetP * 0.88 ? '거의 달성' : '부족'

  return (
    <>
      <div className="topbar">
        <DateNav date={date} setDate={setDate} />
        <button type="button" className="btn sm" onClick={onOpenSettings} aria-label="설정">설정</button>
      </div>

      <div className="topbar" style={{ paddingTop: 0 }}>
        <h1>{routine.name}</h1>
        <span className="sub">
          {PHASE_LABEL[s.phase]} · W{weekNo(date)}
        </span>
      </div>

      <div className="g3">
        <Stat
          k="회복"
          v={score ?? '—'}
          d={score === null ? '기록하기' : BAND_LABEL[band(score)]}
          tone={score === null ? 'mut' : band(score) === 'good' ? 'grn' : band(score) === 'watch' ? 'amb' : 'red'}
          lead={score === null ? undefined : band(score) === 'low' ? 'red' : 'amb'}
          onClick={() => onGo('recovery')}
        />
        <Stat
          k="수면"
          v={rec ? `${Math.floor(rec.sleepH)}:${String(Math.round((rec.sleepH % 1) * 60)).padStart(2, '0')}` : '—'}
          d={rec ? `만족도 ${rec.sleepQuality}/5` : '미기록'}
          onClick={() => onGo('recovery')}
        />
        <Stat
          k="케겔"
          v={`${wk.kegel.done}/${wk.kegel.target}`}
          d={db.kegel.includes(date) ? '오늘 완료' : '오늘 아직'}
          tone={db.kegel.includes(date) ? 'grn' : 'mut'}
          onClick={() => onGo('recovery')}
        />
      </div>

      <div className="g2">
        <button type="button" className="tile" onClick={() => onGo('food')}>
          <span className="k">단백질</span>
          <span className="v">{Math.round(nut.p)}<small>/{s.targetP}g</small></span>
          <span className={`pill ${proteinTone}`}>{proteinLabel}</span>
          <Bar value={nut.p} target={s.targetP} tone={proteinTone} />
        </button>
        <button type="button" className="tile" onClick={() => onGo('food')}>
          <span className="k">칼로리</span>
          <span className="v">{Math.round(nut.kcal)}<small>/{s.targetKcal}</small></span>
          <span className={`pill ${nut.kcal > s.targetKcal * 1.1 ? 'red' : 'grn'}`}>
            {nut.kcal > s.targetKcal * 1.1 ? '초과' : `남은 ${Math.max(0, Math.round(s.targetKcal - nut.kcal))}`}
          </span>
          <Bar value={nut.kcal} target={s.targetKcal} tone={nut.kcal > s.targetKcal * 1.1 ? 'red' : 'grn'} />
        </button>
      </div>

      <Panel
        title={routine.kind === 'weight' ? `오늘 운동 · ${routine.items.length}종목` : '오늘 세션'}
        right={session?.done ? '완료' : ''}
      >
        {routine.kind === 'rest' ? (
          <div className="empty">완전 휴식일입니다. 잘 쉬는 것도 훈련입니다.</div>
        ) : routine.kind !== 'weight' ? (
          <div className="row">
            <span className="n">{routine.name}</span>
            <span className="s">{session?.done ? '완료' : '예정'}</span>
          </div>
        ) : (
          routine.items.slice(0, 4).map((it) => {
            const ex = exerciseById(db, it.exerciseId)
            if (!ex) return null
            const a = advise(ex, historyFor(db.sessions, ex.id, date), it.sets ?? ex.sets, score, s.phase)
            return (
              <div className="row" key={it.exerciseId}>
                <span className="n">{ex.name}</span>
                <span className="s">
                  {a.action === 'start' ? '첫 기록' : formatLoad(ex, a.load)} · {a.sets}×{ex.repMin}–{ex.repMax}
                </span>
              </div>
            )
          })
        )}
        {routine.kind === 'weight' && routine.items.length > 4 && (
          <div className="note" style={{ paddingTop: 6 }}>외 {routine.items.length - 4}종목</div>
        )}
        {routine.kind !== 'rest' && (
          <button type="button" className="btn pri" style={{ marginTop: 8 }} onClick={onOpenWorkout}>
            {session?.done ? '기록 보기' : session ? '이어서 하기' : '시작하기'}
          </button>
        )}
      </Panel>

      <Panel title="이번 주 세션">
        <div className="row"><span className="n">웨이트</span><Dots done={wk.weight.done} total={wk.weight.target} /></div>
        <div className="row"><span className="n">Zone 2 러닝</span><Dots done={wk.run.done} total={wk.run.target} /></div>
        <div className="row"><span className="n">클라이밍</span><Dots done={wk.climb.done} total={wk.climb.target} /></div>
        <div className="row"><span className="n">불가리안백</span><Dots done={wk.bag.done} total={wk.bag.target} /></div>
        <div className="row"><span className="n">케겔</span><Dots done={wk.kegel.done} total={wk.kegel.target} /></div>
      </Panel>

      <div className="sec"><span>핵심 지표</span><span>체중보다 이쪽을 봅니다</span></div>
      <div className="g3">
        <Stat
          k="허리"
          v={waist ? round1(waist.value) : '—'}
          d={waist && waistOld?.waist ? `4주 ${round1(waist.value - waistOld.waist) > 0 ? '+' : ''}${round1(waist.value - waistOld.waist)}` : 'cm'}
          tone={waist && waistOld?.waist ? (waist.value < waistOld.waist ? 'grn' : 'red') : 'mut'}
          onClick={() => onGo('recovery')}
        />
        <Stat
          k="체중 7일"
          v={wAvg ? round1(wAvg) : '—'}
          d={wAvg && wPrev ? `${round1(wAvg - wPrev) > 0 ? '+' : ''}${round1(wAvg - wPrev)} kg` : 'kg'}
          tone={wAvg && wPrev ? (wAvg < wPrev ? 'grn' : 'mut') : 'mut'}
          onClick={() => onGo('recovery')}
        />
        <Stat
          k="풀업 보조"
          v={pullNow ? pullNow.load : '—'}
          d={pullNow && pullOld ? `${round1(pullNow.load - pullOld.load)} kg` : 'kg'}
          tone={pullNow && pullOld && pullNow.load < pullOld.load ? 'grn' : 'mut'}
          onClick={() => onGo('report')}
        />
      </div>

      <div className="note" style={{ marginTop: 4 }}>
        {labelKo(date)} 기준 · 기록은 이 폰 안에만 저장됩니다
      </div>
    </>
  )
}
