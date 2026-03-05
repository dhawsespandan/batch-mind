'use client'
import { useEffect, useState } from 'react'
import { api } from '../../lib/api'
import Card from '../Card'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  ScatterChart, Scatter, ReferenceLine, Cell
} from 'recharts'

export default function DashboardView() {
  const [overview, setOverview] = useState<any>(null)
  const [phaseEnergy, setPhaseEnergy] = useState<any[]>([])
  const [modelStats, setModelStats] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      api.getOverview(),
      api.getPhaseEnergy(),
      api.getModelStats(),
    ]).then(([ov, pe, ms]) => {
      setOverview(ov)
      setPhaseEnergy(pe.phases || [])
      setModelStats(ms.models || [])
      setLoading(false)
    }).catch(console.error)
  }, [])

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-secondary)' }}>
      Loading artifacts...
    </div>
  )

  const statCards = [
    { label: 'Model Accuracy', value: `${overview?.model_accuracy}%`, color: 'var(--green)', sub: 'GPR Leave-One-Out' },
    { label: 'Feasible Batches', value: `${overview?.feasible_batches}/60`, color: 'var(--cyan)', sub: overview?.feasibility_window },
    { label: 'Energy Saving', value: `${overview?.energy_saving_potential_pct}%`, color: 'var(--amber)', sub: `Min: ${overview?.min_energy_kwh} kWh` },
    { label: 'Golden Signatures', value: overview?.golden_signatures, color: 'var(--purple)', sub: 'Feasibility-constrained' },
  ]

  return (
    <div style={{ padding: 28, display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>System Overview</h1>
          <p style={{ margin: '4px 0 0', color: 'var(--text-secondary)', fontSize: 13 }}>
            Causal-First AI · 60 Real Batches · Pharmaceutical Manufacturing
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--green)' }} />
          <span style={{ fontSize: 12, color: 'var(--green)' }}>SYSTEM ONLINE</span>
        </div>
      </div>

      {/* Stat Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
        {statCards.map(s => (
          <Card key={s.label}>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 8 }}>{s.label}</div>
            <div style={{ fontSize: 28, fontWeight: 700, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 6 }}>{s.sub}</div>
          </Card>
        ))}
      </div>

      {/* Charts Row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        {/* Phase Energy */}
        <Card title="Phase Energy Attribution" subtitle="Mean kWh per phase · 60 batches">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={phaseEnergy} layout="vertical" margin={{ left: 20 }}>
              <XAxis type="number" tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} />
              <YAxis dataKey="phase" type="category" tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} width={90} />
              <Tooltip
                contentStyle={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 8 }}
                labelStyle={{ color: 'var(--text-primary)' }}
                formatter={(v: any) => [`${v} kWh`, 'Energy']}
              />
              <Bar dataKey="mean_kwh" radius={[0, 4, 4, 0]}>
                {phaseEnergy.map((entry, i) => (
                  <Cell
                    key={i}
                    fill={entry.phase === 'Compression' ? 'var(--cyan)' :
                          entry.phase === 'Drying' ? 'var(--amber)' : '#3a3a5a'}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <div style={{ marginTop: 12, padding: '10px 14px', background: 'rgba(255,170,0,0.08)', borderRadius: 8, border: '1px solid rgba(255,170,0,0.2)' }}>
            <span style={{ color: 'var(--amber)', fontSize: 12, fontWeight: 600 }}>⚡ Compression = {overview?.compression_energy_pct}% of total energy</span>
            <div style={{ color: 'var(--text-secondary)', fontSize: 11, marginTop: 3 }}>
              Same variable driving quality trade-off also drives energy
            </div>
          </div>
        </Card>

        {/* Model Accuracy */}
        <Card title="Prediction Model Performance" subtitle="GPR Leave-One-Out · 6 quality targets">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 8 }}>
            {modelStats.map(m => (
              <div key={m.target}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontSize: 12, color: 'var(--text-secondary)', textTransform: 'capitalize' }}>
                    {m.target.replace('_', ' ')}
                  </span>
                  <span style={{ fontSize: 12, fontWeight: 600, color: m.accuracy > 97 ? 'var(--green)' : m.accuracy > 93 ? 'var(--cyan)' : 'var(--amber)' }}>
                    {m.accuracy}%
                  </span>
                </div>
                <div style={{ height: 6, background: 'var(--surface2)', borderRadius: 3, overflow: 'hidden' }}>
                  <div style={{
                    height: '100%',
                    width: `${m.accuracy}%`,
                    background: m.accuracy > 97 ? 'var(--green)' : m.accuracy > 93 ? 'var(--cyan)' : 'var(--amber)',
                    borderRadius: 3,
                    transition: 'width 0.8s ease',
                  }} />
                </div>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 16, display: 'flex', justifyContent: 'space-between' }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--green)' }}>98.41%</div>
              <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Avg Accuracy</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--cyan)' }}>95.3%</div>
              <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Conformal Coverage</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--purple)' }}>60</div>
              <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Training Batches</div>
            </div>
          </div>
        </Card>
      </div>

      {/* Key Finding */}
      <Card style={{ background: 'rgba(0,212,255,0.04)', border: '1px solid rgba(0,212,255,0.2)' }}>
        <div style={{ display: 'flex', gap: 20, alignItems: 'center' }}>
          <div style={{ fontSize: 32 }}>⚠</div>
          <div>
            <div style={{ fontWeight: 700, color: 'var(--cyan)', marginBottom: 4 }}>
              Core Finding: Zero batches in this dataset satisfy all regulatory constraints simultaneously
            </div>
            <div style={{ color: 'var(--text-secondary)', fontSize: 13 }}>
              The Dissolution–Friability trade-off is structurally embedded in Compression Force.
              Feasibility window: <strong style={{ color: 'var(--text-primary)' }}>8.0–14.0 kN</strong> is the only region where compliant batches exist.
              BatchMind identifies this envelope and constrains all optimization to it.
            </div>
          </div>
        </div>
      </Card>
    </div>
  )
}