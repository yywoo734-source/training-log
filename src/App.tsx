import { useState } from 'react'
import type { ReactNode } from 'react'
import { ymd } from './lib/date.ts'
import Home from './screens/Home.tsx'
import Workout from './screens/Workout.tsx'
import Food from './screens/Food.tsx'
import Recovery from './screens/Recovery.tsx'
import Report from './screens/Report.tsx'
import Settings from './screens/Settings.tsx'

type Tab = 'home' | 'workout' | 'food' | 'recovery' | 'report'

const TABS: { id: Tab; label: string; icon: ReactNode }[] = [
  {
    id: 'home', label: '홈',
    icon: <svg viewBox="0 0 24 24"><rect x="3" y="3" width="8" height="8" /><rect x="13" y="3" width="8" height="5" /><rect x="13" y="10" width="8" height="11" /><rect x="3" y="13" width="8" height="8" /></svg>,
  },
  {
    id: 'workout', label: '운동',
    icon: <svg viewBox="0 0 24 24"><path d="M4 9v6M7 6v12M17 6v12M20 9v6M7 12h10" /></svg>,
  },
  {
    id: 'food', label: '식단',
    icon: <svg viewBox="0 0 24 24"><path d="M5 3v8a2 2 0 0 0 4 0V3M7 11v10M15 3c-1.5 2-1.5 6 0 8v10" /></svg>,
  },
  {
    id: 'recovery', label: '회복',
    icon: <svg viewBox="0 0 24 24"><path d="M20 13a8 8 0 1 1-8-9 6.5 6.5 0 0 0 8 9Z" /></svg>,
  },
  {
    id: 'report', label: '리포트',
    icon: <svg viewBox="0 0 24 24"><path d="M4 20V9M10 20V4M16 20v-7M22 20H2" /></svg>,
  },
]

export default function App() {
  const [tab, setTab] = useState<Tab>('home')
  const [date, setDate] = useState(ymd())
  const [showSettings, setShowSettings] = useState(false)

  const goWorkout = () => { setTab('workout'); setShowSettings(false) }

  return (
    <>
      <div className="app">
        {showSettings ? (
          <Settings onClose={() => setShowSettings(false)} />
        ) : tab === 'home' ? (
          <Home date={date} setDate={setDate} onOpenWorkout={goWorkout} onOpenSettings={() => setShowSettings(true)} onGo={setTab} />
        ) : tab === 'workout' ? (
          <Workout date={date} setDate={setDate} />
        ) : tab === 'food' ? (
          <Food date={date} setDate={setDate} />
        ) : tab === 'recovery' ? (
          <Recovery date={date} setDate={setDate} />
        ) : (
          <Report date={date} setDate={setDate} />
        )}
      </div>

      <nav className="tabs">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            className={!showSettings && tab === t.id ? 'on' : ''}
            onClick={() => { setTab(t.id); setShowSettings(false) }}
            aria-current={!showSettings && tab === t.id}
          >
            {t.icon}
            <b>{t.label}</b>
          </button>
        ))}
      </nav>
    </>
  )
}
