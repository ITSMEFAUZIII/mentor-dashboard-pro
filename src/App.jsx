import MentorDashboardPro from './MentorDashboardPro'
import { useState } from 'react'

export default function App() {
  // hanya untuk contoh quick test font & warna global
  const [showTest, setShowTest] = useState(true)

  return (
    <div className="p-4">
      {/* QUICK TEST — untuk cek Tailwind aktif */}
      <div className="mb-4 flex items-center gap-2">
        <button
          className="rounded-lg bg-black px-3 py-1 text-white hover:opacity-90"
          onClick={() => setShowTest((s) => !s)}
        >
          Toggle Quick Test
        </button>
        <span className="text-sm text-gray-600">
          (Kalau Tailwind aktif, kotak di bawah berwarna MERAH & rounded)
        </span>
      </div>

      {showTest && (
        <div className="mb-6 rounded-xl bg-red-200 p-4 text-red-900 shadow">
          Tailwind TEST — warna merah & sudut membulat ✅
        </div>
      )}

      {/* DASHBOARD ASLI */}
      <MentorDashboardPro
        initial={{
          level: 1,
          xp: 0,
          streak: 0,
          track: 'JS Beginner',
          week: 1,
          step: 1,
          stats: {
            bugs_fixed: 0,
            exercises_completed: 0,
            tests_written: 0,
            frameworks_tried: 0,
          },
          badgesUnlocked: [],
        }}
      />
    </div>
  )
}
