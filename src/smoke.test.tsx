// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { expect, test } from 'vitest'
import App from './App.tsx'
import { logFood, saveBody, saveRecovery, setEntry, setSessionDone } from './lib/store.ts'
import { FOODS } from './lib/seed.ts'
import { ymd } from './lib/date.ts'

declare global {
  // eslint-disable-next-line no-var
  var IS_REACT_ACT_ENVIRONMENT: boolean
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true

/** 실제로 써본 사람의 데이터를 넣고 다섯 화면을 모두 그려본다 */
function seedSomeHistory() {
  const t = ymd()
  saveRecovery({ date: t, sleepH: 6.7, sleepQuality: 3, fatigue: 3, soreness: 2 })
  saveBody({ date: t, weight: 78.4, waist: 84.2 })
  logFood(t, '아침', FOODS[0], 2)
  setEntry(t, 'upperA', { exerciseId: 'pullup', load: 25, sets: [{ reps: 8, rir: 2 }, { reps: 8, rir: 1 }] })
  setSessionDone(t, true)
}

test('다섯 탭이 모두 그려지고 기록이 화면에 나온다', async () => {
  seedSomeHistory()
  const el = document.createElement('div')
  document.body.appendChild(el)
  const root = createRoot(el)

  await act(async () => { root.render(<App />) })
  expect(el.textContent).toContain('회복')
  expect(el.textContent).toContain('단백질')

  for (const label of ['운동', '식단', '회복', '리포트', '홈']) {
    const tab = [...el.querySelectorAll('.tabs button')].find((b) => b.textContent?.trim() === label)
    expect(tab, `${label} 탭 없음`).toBeTruthy()
    await act(async () => { (tab as HTMLButtonElement).click() })
    expect(el.textContent?.length).toBeGreaterThan(50)
  }

  // 설정 화면까지
  const gear = [...el.querySelectorAll('button')].find((b) => b.textContent === '설정')
  await act(async () => { (gear as HTMLButtonElement).click() })
  expect(el.textContent).toContain('감량기')

  await act(async () => { root.unmount() })
})
