'use client'
import { View } from '../app/page'

const NAV = [
  { id: 'dashboard', label: 'Dashboard', icon: '⬡' },
  { id: 'feasibility', label: 'Decision Engine', icon: '◎' },
  { id: 'copilot', label: 'AI Copilot', icon: '◈' },
  { id: 'signatures', label: 'Golden Signatures', icon: '✦' },
  { id: 'batches', label: 'Batch Explorer', icon: '▦' },
] as const

export default function Sidebar({
  currentView,
  onNavigate,
}: {
  currentView: View
  onNavigate: (v: View) => void
}) {
  return (
    <aside style={{
      width: 220,
      background: 'var(--surface)',
      borderRight: '1px solid var(--border)',
      display: 'flex',
      flexDirection: 'column',
      padding: '24px 0',
      flexShrink: 0,
    }}>
      {/* Logo */}
      <div style={{ padding: '0 20px 32px' }}>
        <div style={{ color: 'var(--cyan)', fontSize: 18, fontWeight: 700, letterSpacing: 1 }}>
          ⬡ BATCHMIND
        </div>
        <div style={{ color: 'var(--text-secondary)', fontSize: 11, marginTop: 4 }}>
          Causal AI Copilot
        </div>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1 }}>
        {NAV.map(item => {
          const active = currentView === item.id
          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id as View)}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '12px 20px',
                background: active ? 'rgba(0,212,255,0.08)' : 'transparent',
                border: 'none',
                borderLeft: active ? '2px solid var(--cyan)' : '2px solid transparent',
                color: active ? 'var(--cyan)' : 'var(--text-secondary)',
                fontSize: 13,
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'all 0.15s',
              }}
            >
              <span style={{ fontSize: 16 }}>{item.icon}</span>
              {item.label}
            </button>
          )
        })}
      </nav>

      {/* Footer */}
      <div style={{ padding: '16px 20px', borderTop: '1px solid var(--border)' }}>
        <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
          Model Accuracy
        </div>
        <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--green)' }}>
          98.41%
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>
          GPR · 60 batches · 6 targets
        </div>
      </div>
    </aside>
  )
}