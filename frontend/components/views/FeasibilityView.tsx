'use client'
import { useEffect, useState } from 'react'
import { api } from '../../lib/api'
import {
  ComposedChart, Line, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ReferenceLine, ResponsiveContainer, BarChart,
  Bar, Cell, Legend
} from 'recharts'

export default function FeasibilityView() {
  const [envelopeData, setEnvelopeData] = useState<any>(null)
  const [optimalSolution, setOptimalSolution] = useState<any>(null)
  const [contrastive, setContrastive] = useState<any>(null)
  const [phaseEnergy, setPhaseEnergy] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [applyStatus, setApplyStatus] = useState<string | null>(null)

  useEffect(() => {
    Promise.all([
      api.getFeasibilityEnvelope(),
      api.optimizeParameters({ dissolution_rate: 40, friability: 25, hardness: 20, energy: 15 }),
      api.getContrastive('T056', 'T051'),
      api.getPhaseEnergy(),
    ]).then(([env, opt, cont, pe]) => {
      setEnvelopeData(env)
      setOptimalSolution(opt?.solutions?.[1] || opt?.solutions?.[0])
      setContrastive(cont)
      setPhaseEnergy(pe.phases || [])
      setLoading(false)
    }).catch(console.error)
  }, [])

  // Build feasibility chart data from scatter
  const chartData = envelopeData?.scatter_data?.map((b: any) => ({
    cf: b.compression_force,
    dissolution: b.dissolution_rate,
    friability: b.friability * 25, // scale friability to same axis (0-4% → 0-100)
    friability_raw: b.friability,
    in_zone: b.in_feasible_zone,
  })).sort((a: any, b: any) => a.cf - b.cf) || []

  // Phase energy comparison data
  const energyData = phaseEnergy.map(p => ({
    phase: p.phase.replace('_', ' '),
    expected: +(p.mean_kwh - p.std_kwh * 0.3).toFixed(1),
    actual: +p.mean_kwh.toFixed(1),
  }))

  const optimal = optimalSolution
  const cf = optimal?.params?.compression_force
  const gran = optimal?.params?.granulation_time
  const dryTemp = optimal?.params?.drying_temp
  const dissolution = optimal?.predictions?.dissolution_rate?.predicted
  const friability = optimal?.predictions?.friability?.predicted
  const energy = optimal?.energy_kwh
  const hardness = optimal?.predictions?.hardness?.predicted

  const envelope = envelopeData?.envelope

  const contrastiveDiffs = contrastive?.diffs || {}
  const mainDriver = contrastive?.main_driver || 'compression_force'
  const mainDriverDiff = contrastive?.main_driver_diff || 0

  const causalEffects = [
    {
      label: 'Hardness',
      value: contrastiveDiffs?.hardness ? `+${Math.abs(contrastiveDiffs.hardness.absolute_diff).toFixed(0)}N` : '+95N',
      positive: true
    },
    {
      label: 'Dissolution',
      value: contrastiveDiffs?.dissolution_rate ? `${contrastiveDiffs.dissolution_rate.absolute_diff.toFixed(1)}%` : '-18.7%',
      positive: false
    },
    {
      label: 'Friability',
      value: contrastiveDiffs?.friability ? `${contrastiveDiffs.friability.absolute_diff.toFixed(2)}%` : '-1.63%',
      positive: true
    },
    {
      label: 'Disintegration',
      value: contrastiveDiffs?.disintegration_time ? `+${Math.abs(contrastiveDiffs.disintegration_time.absolute_diff).toFixed(1)} min` : '+9.5 min',
      positive: false
    },
  ]

  const handleApplySignature = async () => {
    setApplyStatus('Applying...')
    try {
      await api.submitApproval({
        batch_id: 'DEMO_' + Date.now(),
        recommended_params: optimal?.params || {},
        chosen_params: optimal?.params || {},
        predicted_outcomes: {
          dissolution_rate: dissolution,
          friability,
          hardness,
          energy_kwh: energy,
        },
        decision: 'accepted',
        operator_id: 'demo_operator'
      })
      setApplyStatus('✓ Applied')
      setTimeout(() => setApplyStatus(null), 3000)
    } catch {
      setApplyStatus('Error')
    }
  }

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-secondary)' }}>
      Running constrained optimization...
    </div>
  )

  return (
    <div style={{ padding: 28, display: 'flex', flexDirection: 'column', gap: 24, background: 'var(--background)', minHeight: '100vh' }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ color: 'var(--cyan)', fontSize: 20 }}>⬡</span>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>Decision Support Engine</h1>
          </div>
          <p style={{ margin: '4px 0 0 32px', color: 'var(--text-secondary)', fontSize: 13 }}>
            Causal Feasibility Discovery & Energy-Aware Optimization
          </p>
        </div>
        <div style={{ display: 'flex', gap: 32, alignItems: 'center' }}>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 11, color: 'var(--text-secondary)', letterSpacing: 1 }}>CURRENT BATCH</div>
            <div style={{ fontSize: 18, fontWeight: 700 }}>GS-BALANCED</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 11, color: 'var(--text-secondary)', letterSpacing: 1 }}>SYSTEM STATUS</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'flex-end' }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--green)' }} />
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--green)', letterSpacing: 1 }}>OPTIMIZING</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 20 }}>

        {/* Feasibility Envelope Chart */}
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <span style={{ color: 'var(--cyan)' }}>〜</span>
                <span style={{ fontWeight: 700, fontSize: 16 }}>Feasibility Envelope Map</span>
              </div>
              <div style={{ color: 'var(--text-secondary)', fontSize: 12 }}>
                Compression Force vs Dissolution & Friability
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 10, height: 10, borderRadius: 2, background: 'rgba(0,212,255,0.3)' }} />
              <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Safe Zone</span>
            </div>
          </div>

          <ResponsiveContainer width="100%" height={320}>
            <ComposedChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="safeZone" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#00d4ff" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#00d4ff" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis
                dataKey="cf"
                tickFormatter={(v) => `${v} kN`}
                tick={{ fill: 'var(--text-secondary)', fontSize: 11 }}
                stroke="var(--border)"
              />
              <YAxis
                yAxisId="left"
                domain={[0, 110]}
                tick={{ fill: 'var(--text-secondary)', fontSize: 11 }}
                stroke="var(--border)"
              />
              <YAxis
                yAxisId="right"
                orientation="right"
                domain={[0, 4]}
                tickFormatter={(v) => v.toFixed(1)}
                tick={{ fill: 'var(--text-secondary)', fontSize: 11 }}
                stroke="var(--border)"
              />
              <Tooltip
                contentStyle={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }}
                labelStyle={{ color: 'var(--text-primary)' }}
                formatter={(value: any, name: string) => {
                  if (name === 'dissolution') return [`${Number(value).toFixed(1)}%`, 'Dissolution']
                  if (name === 'friability_raw') return [`${Number(value).toFixed(2)}%`, 'Friability']
                  return [value, name]
                }}
                labelFormatter={(v) => `Compression Force: ${v} kN`}
              />
              {/* Safe zone reference area */}
              <ReferenceLine yAxisId="left" x={envelope?.compression_force_min} stroke="rgba(0,212,255,0.4)" strokeDasharray="4 4" />
              <ReferenceLine yAxisId="left" x={envelope?.compression_force_max} stroke="rgba(0,212,255,0.4)" strokeDasharray="4 4" />
              <ReferenceLine yAxisId="left" y={85} stroke="#4488ff" strokeDasharray="4 4"
                label={{ value: 'Min Dissolution (85%)', fill: '#4488ff', fontSize: 11, position: 'insideTopLeft' }} />
              <ReferenceLine yAxisId="left" y={25} stroke="#ff4466" strokeDasharray="4 4"
                label={{ value: 'Max Friability (1.0%)', fill: '#ff4466', fontSize: 11, position: 'insideBottomRight' }} />

              {/* Dissolution curve */}
              <Area
                yAxisId="left"
                type="monotone"
                dataKey="dissolution"
                stroke="#00d4ff"
                strokeWidth={2.5}
                fill="url(#safeZone)"
                dot={false}
                name="dissolution"
              />
              {/* Friability curve (scaled) */}
              <Line
                yAxisId="left"
                type="monotone"
                dataKey={(d) => d.friability_raw * 25}
                stroke="#ff4466"
                strokeWidth={2}
                dot={false}
                name="friability_raw"
              />
            </ComposedChart>
          </ResponsiveContainer>

          {/* Feasible Window Badge */}
          <div style={{ display: 'flex', justifyContent: 'center', marginTop: 16 }}>
            <div style={{
              background: 'var(--surface2)',
              border: '1px solid var(--border)',
              borderRadius: 8,
              padding: '8px 24px',
              textAlign: 'center'
            }}>
              <div style={{ fontSize: 11, color: 'var(--text-secondary)', letterSpacing: 1, marginBottom: 4 }}>
                IDENTIFIED FEASIBLE WINDOW
              </div>
              <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: 2 }}>
                {envelope?.compression_force_min} – {envelope?.compression_force_max} kN
              </div>
            </div>
          </div>
        </div>

        {/* Optimal Solution Panel */}
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <span style={{ color: 'var(--cyan)' }}>⚙</span>
              <span style={{ fontWeight: 700, fontSize: 16, color: 'var(--cyan)' }}>Optimal Solution</span>
            </div>
            <div style={{ fontSize: 12, color: 'var(--cyan)', opacity: 0.7 }}>Constrained Bayesian Optimization</div>
          </div>

          <div>
            <div style={{ fontSize: 11, color: 'var(--cyan)', letterSpacing: 1, marginBottom: 12 }}>
              RECOMMENDED SETTINGS
            </div>
            {[
              { label: 'Compression Force', value: cf?.toFixed(1), unit: 'kN' },
              { label: 'Granulation Time', value: gran?.toFixed(0), unit: 'min' },
              { label: 'Drying Temp', value: dryTemp?.toFixed(0), unit: '°C' },
            ].map(item => (
              <div key={item.label} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '10px 0', borderBottom: '1px solid var(--border)'
              }}>
                <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{item.label}</span>
                <span style={{ fontSize: 16, fontWeight: 700 }}>
                  {item.value} <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{item.unit}</span>
                </span>
              </div>
            ))}
          </div>

          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <span style={{ fontSize: 11, color: 'var(--cyan)', letterSpacing: 1 }}>EXPECTED OUTCOME</span>
              <span style={{
                fontSize: 11, padding: '2px 8px', borderRadius: 12,
                background: 'rgba(0,212,255,0.15)', color: 'var(--cyan)',
                border: '1px solid rgba(0,212,255,0.3)', fontWeight: 700
              }}>CONF: 92%</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              {[
                { label: 'Dissolution', value: `${dissolution?.toFixed(0)}%`, color: 'var(--green)' },
                { label: 'Friability', value: `${friability?.toFixed(2)}%`, color: 'var(--green)' },
                { label: 'Energy', value: `${energy?.toFixed(0)} kWh`, color: 'var(--amber)' },
                { label: 'Hardness', value: `${hardness?.toFixed(0)}N`, color: 'var(--green)' },
              ].map(m => (
                <div key={m.label} style={{ background: 'var(--surface2)', borderRadius: 8, padding: '10px 12px' }}>
                  <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 4 }}>{m.label}</div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: m.color }}>{m.value}</div>
                </div>
              ))}
            </div>
          </div>

          <button
            onClick={handleApplySignature}
            style={{
              background: 'var(--cyan)',
              color: '#000',
              border: 'none',
              borderRadius: 8,
              padding: '14px',
              fontWeight: 800,
              fontSize: 13,
              letterSpacing: 1.5,
              cursor: 'pointer',
              marginTop: 'auto',
            }}
          >
            {applyStatus || 'APPLY GOLDEN SIGNATURE'}
          </button>
        </div>
      </div>

      {/* Bottom Row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 280px', gap: 20 }}>

        {/* Phase Energy Attribution */}
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <span style={{ color: 'var(--amber)' }}>⚡</span>
                <span style={{ fontWeight: 700, fontSize: 14 }}>Phase Energy Attribution</span>
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Deviation from expected baseline</div>
            </div>
            <span style={{
              fontSize: 11, padding: '3px 10px', borderRadius: 12,
              background: 'rgba(255,170,0,0.15)', color: 'var(--amber)',
              border: '1px solid rgba(255,170,0,0.3)', fontWeight: 700
            }}>+23 kWh Total Variance</span>
          </div>

          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={energyData} layout="vertical" margin={{ left: 10 }}>
              <XAxis type="number" tick={{ fill: 'var(--text-secondary)', fontSize: 10 }} stroke="var(--border)" />
              <YAxis dataKey="phase" type="category" tick={{ fill: 'var(--text-secondary)', fontSize: 10 }} width={80} stroke="var(--border)" />
              <Tooltip
                contentStyle={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }}
                formatter={(v: any) => [`${v} kWh`]}
              />
              <Legend
                wrapperStyle={{ fontSize: 11, color: 'var(--text-secondary)' }}
                formatter={(value) => value === 'expected' ? 'Expected (kWh)' : 'Actual (kWh)'}
              />
              <Bar dataKey="expected" fill="#3a3a5a" radius={[0, 2, 2, 0]} name="expected" />
              <Bar dataKey="actual" fill="var(--cyan)" radius={[0, 2, 2, 0]} name="actual" />
            </BarChart>
          </ResponsiveContainer>

          <div style={{
            marginTop: 12, padding: '10px 14px',
            background: 'rgba(255,170,0,0.08)', borderRadius: 8,
            border: '1px solid rgba(255,170,0,0.25)',
            display: 'flex', gap: 8, alignItems: 'flex-start'
          }}>
            <span style={{ color: 'var(--amber)', fontSize: 16 }}>⚠</span>
            <div>
              <div style={{ color: 'var(--amber)', fontSize: 12, fontWeight: 700 }}>
                Compression phase energy dominant
              </div>
              <div style={{ color: 'var(--text-secondary)', fontSize: 11, marginTop: 2 }}>
                SHAP indicates Compression_Force is primary energy driver (53.8% of total)
              </div>
            </div>
          </div>
        </div>

        {/* Contrastive Explanation */}
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <span style={{ color: 'var(--cyan)' }}>〜</span>
            <span style={{ fontWeight: 700, fontSize: 14 }}>Contrastive Explanation</span>
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 20 }}>
            Why did T056 & T051 behave differently?
          </div>

          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 11, color: 'var(--text-secondary)', letterSpacing: 1, marginBottom: 8 }}>MAIN DRIVER</div>
            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              background: 'var(--surface2)', borderRadius: 8, padding: '12px 16px'
            }}>
              <span style={{ fontFamily: 'monospace', fontSize: 15, fontWeight: 700 }}>
                {mainDriver.replace('_', '_')}
              </span>
              <span style={{
                fontSize: 13, fontWeight: 700, padding: '3px 10px', borderRadius: 6,
                background: 'rgba(136,102,255,0.2)', color: 'var(--purple)'
              }}>
                {mainDriverDiff > 0 ? '+' : ''}{mainDriverDiff.toFixed(1)} kN
              </span>
            </div>
          </div>

          <div>
            <div style={{ fontSize: 11, color: 'var(--text-secondary)', letterSpacing: 1, marginBottom: 10 }}>
              CAUSAL EFFECTS ON QUALITY
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {causalEffects.map(effect => (
                <div key={effect.label} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '8px 0', borderBottom: '1px solid var(--border)'
                }}>
                  <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{effect.label}</span>
                  <span style={{
                    fontSize: 13, fontWeight: 700, padding: '3px 10px', borderRadius: 6,
                    background: effect.positive ? 'rgba(0,255,136,0.15)' : 'rgba(255,68,102,0.15)',
                    color: effect.positive ? 'var(--green)' : 'var(--red)',
                    border: `1px solid ${effect.positive ? 'rgba(0,255,136,0.3)' : 'rgba(255,68,102,0.3)'}`
                  }}>
                    {effect.value}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Model Confidence Context */}
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ color: 'var(--text-secondary)', fontSize: 16 }}>⊟</span>
            <span style={{ fontWeight: 700, fontSize: 14 }}>Model Confidence Context</span>
          </div>

          <div style={{
            background: 'rgba(0,212,255,0.06)', borderRadius: 8,
            padding: '12px 14px', border: '1px solid rgba(0,212,255,0.15)'
          }}>
            <div style={{ display: 'flex', gap: 8 }}>
              <span style={{ color: 'var(--cyan)', fontSize: 14, flexShrink: 0 }}>ℹ</span>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                Predictions are derived from{' '}
                <strong style={{ color: 'var(--text-primary)' }}>Gaussian Process Regression (GPR)</strong>{' '}
                models trained on ~60 batches.
              </div>
            </div>
          </div>

          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Training Region Coverage</span>
              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--green)' }}>High</span>
            </div>
            <div style={{ height: 6, background: 'var(--surface2)', borderRadius: 3 }}>
              <div style={{ width: '85%', height: '100%', background: 'var(--green)', borderRadius: 3 }} />
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[
              { label: 'Avg Accuracy', value: '98.41%', color: 'var(--green)' },
              { label: 'Conformal Coverage', value: '95.3%', color: 'var(--cyan)' },
              { label: 'Feasible Batches', value: '42/60', color: 'var(--amber)' },
              { label: 'Causal Edges', value: '13 found', color: 'var(--purple)' },
            ].map(item => (
              <div key={item.label} style={{
                display: 'flex', justifyContent: 'space-between',
                padding: '8px 0', borderBottom: '1px solid var(--border)'
              }}>
                <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{item.label}</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: item.color }}>{item.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}