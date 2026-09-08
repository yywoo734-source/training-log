import { useState } from 'react'
import type { Phase } from '../lib/types.ts'
import { exportJSON, importJSON, resetAll, saveSettings, useDB, useSyncStatus } from '../lib/store.ts'
import { Panel } from '../ui.tsx'
import Plan from './Plan.tsx'

const PHASES: { id: Phase; label: string; desc: string }[] = [
  { id: 'cut', label: '감량기', desc: '체지방·허리둘레를 줄이는 국면. 중량이 제자리여도 성공으로 봅니다.' },
  { id: 'maintain', label: '유지기', desc: '체중을 유지하며 수행 능력을 올리는 국면.' },
  { id: 'bulk', label: '증량기', desc: '근육량을 늘리는 국면. 중량이 오르지 않으면 문제로 봅니다.' },
]

export default function Settings({ onClose }: { onClose: () => void }) {
  const db = useDB()
  const sync = useSyncStatus()
  const s = db.settings
  const [msg, setMsg] = useState('')
  const [text, setText] = useState('')
  const [plan, setPlan] = useState(false)

  const num = (k: 'targetKcal' | 'targetP' | 'targetF' | 'targetC' | 'kegelPerWeek', label: string, unit: string) => (
    <label className="field" key={k}>
      <span className="k">{label} {unit}</span>
      <input type="number" inputMode="numeric" value={s[k]} onChange={(e) => saveSettings({ [k]: Number(e.target.value) })} />
    </label>
  )

  // 파일 내려받기는 어떤 환경에서는 막힌다. 복사·붙여넣기는 어디서나 된다.
  const copy = async () => {
    const json = exportJSON()
    setText(json)
    try {
      await navigator.clipboard.writeText(json)
      setMsg('복사했습니다. 메모앱이나 메일에 붙여넣어 보관하세요.')
    } catch {
      setMsg('아래 칸을 길게 눌러 전체 선택 후 복사하세요.')
    }
  }

  if (plan) return <Plan onClose={() => setPlan(false)} />

  return (
    <>
      <div className="topbar">
        <h1>설정</h1>
        <button type="button" className="btn sm" onClick={onClose}>닫기</button>
      </div>

      <div className="sec"><span>루틴과 종목</span></div>
      <button type="button" className="tile wide" onClick={() => setPlan(true)}>
        <span className="k">고치기</span>
        <span className="v" style={{ fontSize: 18 }}>루틴 {db.routines.length}개 · 종목 {db.exercises.length}개</span>
        <span className="d mut" style={{ fontWeight: 400, whiteSpace: 'normal' }}>
          루틴에 종목을 넣고 빼고 순서를 바꿉니다. 종목을 누르면 성장 그래프와 세트·휴식 설정이 나옵니다.
        </span>
      </button>

      <div className="sec"><span>지금 어떤 국면인가</span></div>
      <div className="stack">
        {PHASES.map((p) => (
          <button
            key={p.id}
            type="button"
            className={`tile wide ${s.phase === p.id ? 'lead' : ''}`}
            onClick={() => saveSettings({ phase: p.id })}
          >
            <span className="k">{s.phase === p.id ? '선택됨' : ''}</span>
            <span className="v" style={{ fontSize: 18 }}>{p.label}</span>
            <span className="d mut" style={{ fontWeight: 400, whiteSpace: 'normal' }}>{p.desc}</span>
          </button>
        ))}
      </div>
      <div className="note">
        국면에 따라 증량·감량 추천 기준이 달라집니다. 감량기에는 하한 미달을 한 세션 더 지켜본 뒤 무게를 낮춥니다.
      </div>

      <div className="sec"><span>하루 목표</span></div>
      <div className="g2">
        {num('targetKcal', '칼로리', 'kcal')}
        {num('targetP', '단백질', 'g')}
        {num('targetC', '탄수화물', 'g')}
        {num('targetF', '지방', 'g')}
      </div>
      <div className="g2">{num('kegelPerWeek', '케겔 주간 목표', '회')}</div>
      <div className="note">
        이 숫자는 고정 목표가 아니라 시작점입니다. 허리둘레와 수행 능력을 보고 몇 주 뒤 조정하세요.
      </div>

      <div className="sec"><span>데이터</span></div>
      <div className={`tile wide ${sync === 'on' ? 'lead-grn' : ''}`}>
        <span className="k">저장 위치</span>
        <span className="v" style={{ fontSize: 18 }}>
          {sync === 'connecting' ? '확인 중…' : sync === 'on' ? '계정에 저장 · 기기끼리 공유' : '이 기기 안에만 저장'}
        </span>
        <span className="d mut" style={{ whiteSpace: 'normal', fontWeight: 400 }}>
          {sync === 'on'
            ? '폰에서 적든 컴퓨터에서 적든 같은 기록입니다. 다른 기기에서 연 창은 잠시 뒤 저절로 따라옵니다.'
            : sync === 'off'
              ? '이 브라우저 안에만 남습니다. 브라우저 데이터를 지우면 사라지니 아래에서 백업해두세요.'
              : ''}
        </span>
      </div>
      <Panel title="쌓인 기록">
        <div className="note" style={{ paddingBottom: 8 }}>
          기록 {db.sessions.length}세션 · 식사 {db.meals.length}건 · 회복 {db.recovery.length}일 · 측정 {db.body.length}일
        </div>
        <div className="g2">
          <button type="button" className="btn" onClick={copy}>백업 복사하기</button>
          <button
            type="button"
            className="btn"
            disabled={!text.trim()}
            onClick={() => setMsg(importJSON(text) ? '불러왔습니다.' : '형식이 맞지 않습니다.')}
          >
            붙여넣은 것 불러오기
          </button>
        </div>
        <label className="field" style={{ marginTop: 8 }}>
          <span className="k">백업 내용 · 보관했다가 여기 붙여넣으면 복구됩니다</span>
          <textarea
            rows={4}
            value={text}
            placeholder="백업 복사하기를 누르면 여기에 내용이 나옵니다"
            onChange={(e) => setText(e.target.value)}
          />
        </label>
        {msg && <div className="note" style={{ paddingTop: 8 }}><b>{msg}</b></div>}
      </Panel>

      <button
        type="button"
        className="btn danger"
        onClick={() => {
          if (confirm('모든 기록을 지웁니다. 되돌릴 수 없습니다.')) {
            resetAll()
            setMsg('전체 기록을 지웠습니다.')
          }
        }}
      >
        전체 기록 삭제
      </button>
    </>
  )
}
