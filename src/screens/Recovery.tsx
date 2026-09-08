import { useState } from 'react'
import type { BodyLog, RecoveryLog } from '../lib/types.ts'
import { addDays } from '../lib/date.ts'
import { BAND_LABEL, band, isHard, recoveryScore } from '../lib/recovery.ts'
import {
  avgWeight, bodyFor, saveBody, saveRecovery, sessionFor, toggleKegel, useDB, weekProgress,
} from '../lib/store.ts'
import { Bar, DateNav, Scale, Stat, round1 } from '../ui.tsx'

const hhmmToMin = (s: string) => {
  const [h, m] = s.split(':').map(Number)
  return h * 60 + m
}

export default function Recovery({ date, setDate }: { date: string; setDate: (d: string) => void }) {
  const db = useDB()
  const saved = db.recovery.find((r) => r.date === date)
  const prev = sessionFor(db, addDays(date, -1))
  const prevHard = prev ? isHard(prev) : false
  const [more, setMore] = useState(false)

  const log: RecoveryLog = saved ?? { date, sleepH: 7, sleepQuality: 3, fatigue: 3, soreness: 3 }
  const score = recoveryScore(log, prevHard)

  const patch = (p: Partial<RecoveryLog>) => {
    const next = { ...log, ...p }
    if (next.bed && next.wake) {
      next.sleepH = Math.round((((hhmmToMin(next.wake) - hhmmToMin(next.bed) + 1440) % 1440) / 60) * 100) / 100
    }
    saveRecovery(next)
  }

  const wk = weekProgress(db, date)
  const kegelDone = db.kegel.includes(date)
  const body = bodyFor(db, date)
  const wAvg = avgWeight(db, date)

  return (
    <>
      <div className="topbar">
        <DateNav date={date} setDate={setDate} />
        <span className="sub">{saved ? '기록됨' : '미기록'}</span>
      </div>

      <div className={`tile wide ${band(score) === 'low' ? 'lead-red' : band(score) === 'good' ? 'lead-grn' : 'lead'}`}>
        <span className="k">회복 점수</span>
        <span className="v">{score}<small> / 100</small></span>
        <span className={`pill ${band(score) === 'good' ? 'grn' : band(score) === 'watch' ? 'amb' : 'red'}`}>
          {BAND_LABEL[band(score)]}
        </span>
        <Bar value={score} target={100} tone={band(score) === 'good' ? 'grn' : band(score) === 'watch' ? 'amb' : 'red'} />
        <div className="note" style={{ paddingTop: 6 }}>
          {prevHard ? '어제 고강도 세션이 있어 10점이 빠져 있습니다. ' : ''}
          {band(score) === 'low'
            ? '오늘은 세트를 하나 덜거나 러닝을 걷기로 바꾸세요. 운동 화면 추천도 자동으로 낮아집니다.'
            : band(score) === 'watch'
              ? 'RIR 2를 지키고 신기록은 노리지 마세요.'
              : '계획대로 진행하세요.'}
        </div>
      </div>

      <div className="sec"><span>매일 기록 · 4가지</span><span>15초</span></div>

      <div className="tile wide">
        <span className="k">수면</span>
        <div className="g2" style={{ marginTop: 6 }}>
          <label className="field">
            <span className="k">취침</span>
            <input type="time" value={log.bed ?? ''} onChange={(e) => patch({ bed: e.target.value })} />
          </label>
          <label className="field">
            <span className="k">기상</span>
            <input type="time" value={log.wake ?? ''} onChange={(e) => patch({ wake: e.target.value })} />
          </label>
        </div>
        <div className="row" style={{ paddingTop: 8, borderBottom: 'none' }}>
          <span className="n">총 수면</span>
          <span style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <button type="button" className="btn sm" onClick={() => patch({ sleepH: Math.max(0, log.sleepH - 0.5), bed: undefined, wake: undefined })}>−30분</button>
            <b className="num" style={{ fontSize: 20, minWidth: 64, textAlign: 'center' }}>
              {Math.floor(log.sleepH)}:{String(Math.round((log.sleepH % 1) * 60)).padStart(2, '0')}
            </b>
            <button type="button" className="btn sm" onClick={() => patch({ sleepH: log.sleepH + 0.5, bed: undefined, wake: undefined })}>+30분</button>
          </span>
        </div>
      </div>

      <div className="tile wide">
        <span className="k">수면 만족도</span>
        <Scale value={log.sleepQuality} onChange={(v) => patch({ sleepQuality: v })} lowLabel="푹 못 잤다" highLabel="아주 개운" />
      </div>
      <div className="tile wide">
        <span className="k">전신 피로</span>
        <Scale value={log.fatigue} onChange={(v) => patch({ fatigue: v })} lowLabel="가뿐함" highLabel="탈진" />
      </div>
      <div className="tile wide">
        <span className="k">근육통</span>
        <Scale value={log.soreness} onChange={(v) => patch({ soreness: v })} lowLabel="없음" highLabel="심함" />
      </div>

      <button type="button" className="btn" onClick={() => setMore(!more)}>
        {more ? '추가 항목 접기' : '통증·스트레스도 기록하기'}
      </button>

      {more && (
        <>
          <div className="tile wide">
            <span className="k">통증 · 1은 없음</span>
            <div className="g2" style={{ marginTop: 6 }}>
              {([
                ['painElbow', '팔꿈치'], ['painShoulder', '어깨'],
                ['painBack', '허리'], ['painFinger', '손가락/전완'],
              ] as const).map(([k, label]) => (
                <label className="field" key={k}>
                  <span className="k">{label}</span>
                  <div className="seg">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <button key={n} type="button" className={(log[k] ?? 1) === n ? 'on' : ''} onClick={() => patch({ [k]: n })}>{n}</button>
                    ))}
                  </div>
                </label>
              ))}
            </div>
          </div>
          <div className="tile wide">
            <span className="k">스트레스</span>
            <Scale value={log.stress} onChange={(v) => patch({ stress: v })} lowLabel="편안" highLabel="극심" />
          </div>
          <div className="tile wide">
            <span className="k">동기 수준</span>
            <Scale value={log.motivation} onChange={(v) => patch({ motivation: v })} lowLabel="하기 싫음" highLabel="의욕 넘침" />
          </div>
          <label className="field">
            <span className="k">오늘 컨디션 메모</span>
            <textarea rows={2} value={log.note ?? ''} onChange={(e) => patch({ note: e.target.value })} />
          </label>
        </>
      )}

      <div className="sec"><span>골반저근 (케겔)</span><span>이번 주 {wk.kegel.done}/{wk.kegel.target}</span></div>
      <button
        type="button"
        className={`tile wide ${kegelDone ? 'lead-grn' : ''}`}
        onClick={() => toggleKegel(date)}
      >
        <span className="k">오늘 세션</span>
        <span className="v">{kegelDone ? '완료' : '아직'}</span>
        <span className="d mut">느린 수축 5초 × 10회 2세트 · 빠른 수축 1초 × 10회 2세트</span>
      </button>
      <div className="note">
        엉덩이와 복근이 같이 힘 들어가지 않게 하고, 소변 중에는 하지 마세요.
        통증이나 골반이 뻐근하면 횟수를 줄이거나 쉽니다.
      </div>

      <div className="sec"><span>신체 측정</span><span>{wAvg ? `7일 평균 ${round1(wAvg)}kg` : '체중 미기록'}</span></div>
      <BodyForm date={date} body={body} />

      <div className="g2">
        <Stat k="오늘 체중" v={body?.weight ? round1(body.weight) : '—'} d="kg" />
        <Stat k="7일 평균" v={wAvg ? round1(wAvg) : '—'} d="kg" />
      </div>
    </>
  )
}

const FIELDS: [keyof BodyLog, string][] = [
  ['weight', '체중 kg'], ['waist', '허리 cm'], ['chest', '가슴 cm'],
  ['shoulder', '어깨 cm'], ['arm', '팔 cm'], ['thigh', '허벅지 cm'],
  ['smm', '골격근량 kg'], ['bf', '체지방률 %'],
]

function BodyForm({ date, body }: { date: string; body: BodyLog | undefined }) {
  return (
    <div className="tile wide">
      <span className="k">숫자만 넣으면 저장됩니다 · 빈칸은 건너뜀</span>
      <div className="g3" style={{ marginTop: 6 }}>
        {FIELDS.map(([k, label]) => (
          <label className="field" key={k}>
            <span className="k">{label}</span>
            <input
              type="number"
              inputMode="decimal"
              value={(body?.[k] as number | undefined) ?? ''}
              onChange={(e) => saveBody({ date, [k]: e.target.value === '' ? undefined : Number(e.target.value) })}
            />
          </label>
        ))}
      </div>
    </div>
  )
}
