import { useState } from 'react'
import type { Slot } from '../lib/types.ts'
import { addFood, bumpMeal, logFood, nutritionFor, removeFood, useDB } from '../lib/store.ts'
import { Bar, DateNav, Panel, Stat, round1 } from '../ui.tsx'

const SLOTS: Slot[] = ['아침', '점심', '저녁', '간식']

export default function Food({ date, setDate }: { date: string; setDate: (d: string) => void }) {
  const db = useDB()
  const s = db.settings
  const nut = nutritionFor(db, date)
  const [slot, setSlot] = useState<Slot>(guessSlot())
  const [adding, setAdding] = useState(false)

  const pTone = nut.p >= s.targetP ? 'grn' : nut.p >= s.targetP * 0.88 ? 'amb' : 'red'

  return (
    <>
      <div className="topbar">
        <DateNav date={date} setDate={setDate} />
        <span className="sub">목표 {s.targetKcal}kcal · 단백질 {s.targetP}g</span>
      </div>

      <div className="tile wide lead">
        <span className="k">단백질</span>
        <span className="v">{Math.round(nut.p)}<small> / {s.targetP} g</small></span>
        <span className={`pill ${pTone}`}>
          {nut.p >= s.targetP ? '목표 달성' : nut.p >= s.targetP * 0.88 ? '거의 달성' : `${Math.round(s.targetP - nut.p)}g 부족`}
        </span>
        <Bar value={nut.p} target={s.targetP} tone={pTone} />
      </div>

      <div className="g3">
        <Stat k="칼로리" v={Math.round(nut.kcal)} d={`/ ${s.targetKcal}`} />
        <Stat k="탄수" v={Math.round(nut.c)} d={`/ ${s.targetC} g`} />
        <Stat k="지방" v={Math.round(nut.f)} d={`/ ${s.targetF} g`} />
      </div>

      <div className="sec"><span>어느 끼니에 담을까</span></div>
      <div className="seg">
        {SLOTS.map((x) => (
          <button key={x} type="button" className={slot === x ? 'on' : ''} onClick={() => setSlot(x)}>{x}</button>
        ))}
      </div>

      <div className="sec">
        <span>자주 먹는 것 · 탭하면 담김</span>
        <button type="button" className="btn sm" onClick={() => setAdding(!adding)}>{adding ? '닫기' : '+ 음식'}</button>
      </div>

      {adding && <NewFood onDone={() => setAdding(false)} />}

      <div className="g2">
        {db.foods.map((f) => (
          <button key={f.id} type="button" className="tile" onClick={() => logFood(date, slot, f)}>
            <span className="k">{f.unit}</span>
            <span className="n" style={{ fontSize: 14, fontWeight: 600 }}>{f.name}</span>
            <span className="d mut">{Math.round(f.kcal)}kcal · 단 {round1(f.p)}g</span>
          </button>
        ))}
      </div>

      <div className="sec"><span>오늘 먹은 것</span><span>{nut.meals.length}개</span></div>
      {SLOTS.filter((x) => nut.meals.some((m) => m.slot === x)).map((x) => (
        <Panel title={x} key={x} right={`${Math.round(nut.meals.filter((m) => m.slot === x).reduce((a, m) => a + m.kcal, 0))} kcal`}>
          {nut.meals.filter((m) => m.slot === x).map((m) => (
            <div className="row" key={m.id}>
              <span className="n">
                {m.name}
                <small>{Math.round(m.kcal)}kcal · 단 {round1(m.p)} 탄 {round1(m.c)} 지 {round1(m.f)}</small>
              </span>
              <span style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
                <button type="button" className="btn sm" onClick={() => bumpMeal(m.id, -1)} aria-label="줄이기">−</button>
                <b className="num" style={{ minWidth: 26, textAlign: 'center' }}>{round1(m.qty)}</b>
                <button type="button" className="btn sm" onClick={() => bumpMeal(m.id, 1)} aria-label="늘리기">+</button>
              </span>
            </div>
          ))}
        </Panel>
      ))}
      {nut.meals.length === 0 && <div className="empty">아직 기록이 없습니다. 위에서 음식을 탭하세요.</div>}

      {db.foods.some((f) => f.custom) && (
        <Panel title="내가 추가한 음식">
          {db.foods.filter((f) => f.custom).map((f) => (
            <div className="row" key={f.id}>
              <span className="n">{f.name}<small>{f.unit} · {Math.round(f.kcal)}kcal</small></span>
              <button type="button" className="btn sm danger" onClick={() => removeFood(f.id)}>삭제</button>
            </div>
          ))}
        </Panel>
      )}
    </>
  )
}

function guessSlot(): Slot {
  const h = new Date().getHours()
  if (h < 10) return '아침'
  if (h < 15) return '점심'
  if (h < 21) return '저녁'
  return '간식'
}

function NewFood({ onDone }: { onDone: () => void }) {
  const [v, setV] = useState({ name: '', unit: '100g', kcal: '', p: '', c: '', f: '' })
  const set = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement>) => setV({ ...v, [k]: e.target.value })
  const ok = v.name.trim() !== '' && v.kcal !== ''
  return (
    <div className="tile wide">
      <span className="k">새 음식 · 기준량 1회분 기준으로</span>
      <div className="g2" style={{ marginTop: 6 }}>
        <label className="field"><span className="k">이름</span><input value={v.name} onChange={set('name')} /></label>
        <label className="field"><span className="k">기준량</span><input value={v.unit} onChange={set('unit')} /></label>
        <label className="field"><span className="k">칼로리</span><input type="number" inputMode="decimal" value={v.kcal} onChange={set('kcal')} /></label>
        <label className="field"><span className="k">단백질 g</span><input type="number" inputMode="decimal" value={v.p} onChange={set('p')} /></label>
        <label className="field"><span className="k">탄수 g</span><input type="number" inputMode="decimal" value={v.c} onChange={set('c')} /></label>
        <label className="field"><span className="k">지방 g</span><input type="number" inputMode="decimal" value={v.f} onChange={set('f')} /></label>
      </div>
      <button
        type="button"
        className="btn pri"
        style={{ marginTop: 8 }}
        disabled={!ok}
        onClick={() => {
          addFood({
            name: v.name.trim(), unit: v.unit.trim() || '1회',
            kcal: Number(v.kcal) || 0, p: Number(v.p) || 0, c: Number(v.c) || 0, f: Number(v.f) || 0,
          })
          onDone()
        }}
      >
        추가
      </button>
    </div>
  )
}
