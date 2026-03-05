'use client'
import { useState } from 'react'
import Sidebar from '../components/Sidebar'
import DashboardView from '../components/views/DashboardView'
import FeasibilityView from '../components/views/FeasibilityView'
import CopilotView from '../components/views/CopilotView'
import SignaturesView from '../components/views/SignaturesView'
import BatchExplorerView from '../components/views/BatchExplorerView'

export type View = 'dashboard' | 'feasibility' | 'copilot' | 'signatures' | 'batches'

export default function Home() {
  const [view, setView] = useState<View>('dashboard')

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      <Sidebar currentView={view} onNavigate={setView} />
      <main style={{ flex: 1, overflow: 'auto', background: 'var(--background)' }}>
        {view === 'dashboard' && <DashboardView />}
        {view === 'feasibility' && <FeasibilityView />}
        {view === 'copilot' && <CopilotView />}
        {view === 'signatures' && <SignaturesView />}
        {view === 'batches' && <BatchExplorerView />}
      </main>
    </div>
  )
}