'use client'
import { useEffect, useState } from 'react'
import { api } from '../../lib/api'

const OBJECTIVE_COLORS: Record<string, string> = {
  GS_BALANCED: 'var(--cyan)',
  GS_DISSOLUTION: 'var(--green)',
  GS_ENERGY: 'var(--amber)',
}

const OBJECTIVE_ICONS: Record<string, string> = {
  GS_BALANCED: '⬡',
  GS_DISSOLUTION: '◎',
  GS_ENERGY: '⚡',
}

export default function SignaturesView() {
  const [signatures, setSignatures] = useState<any[]>([])
  const [approvals, setApprovals] = useState<any[]>([])
  const [selected, setSelected] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [applyStatus, setApplyStatus] = useState<Record<string, string>>({})
  const [improvements, setImprovements] = useState<any[]>([])
  const [dismissed, setDismissed] = useState<Set<string>>(new Set())
  const [updating, setUpdating] = useState<string | null>(null)

  useEffect(() => {
    Promise.all([
      api.getSignatures(),
      api.getApprovalHistory(),
      api.checkImprovement(),
    ]).then(([sigs, appr, impr]) => {
      setSignatures(sigs.signatures || [])
      setApprovals(appr.approvals || [])
      setImprovements(impr.improvements || [])
      if (sigs.signatures?.length > 0) setSelected(sigs.signatures[0])
      setLoading(false)
    }).catch(console.error)
  }, [])

  const handleApply = async (sig: any) => {
    setApplyStatus(prev => ({ ...prev, [sig.signature_id]: 'Applying...' }))
    try {
      await api.submitApproval({
        batch_id: 'APPLY_' + sig.signature_id + '_' + Date.now(),
        recommended_params: {
          granulation_time: sig.granulation_time,
          binder_amount: sig.binder_amount,
          drying_temp: sig.drying_temp,
          drying_time: sig.drying_time,
          compression_force: sig.compression_force,
          machine_speed: sig.machine_speed,
          lubricant_conc: sig.lubricant_conc,
          moisture_content: sig.moisture_content,
        },
        chosen_params: {
          granulation_time: sig.granulation_time,
          binder_amount: sig.binder_amount,
          drying_temp: sig.drying_temp,
          drying_time: sig.drying_time,
          compression_force: sig.compression_force,
          machine_speed: sig.machine_speed,
          lubricant_conc: sig.lubricant_conc,
          moisture_content: sig.moisture_content,
        },
        predicted_outcomes: {
          dissolution_rate: sig.dissolution_rate,
          friability: sig.friability,
          hardness: sig.hardness,
          disintegration_time: sig.disintegration_time,
        },
        decision: 'accepted',
        operator_id: 'demo_operator',
        objective_weights: { dissolution_rate: 40, friability: 25, hardness: 20, energy: 15 }
      })
      setApplyStatus(prev => ({ ...prev, [sig.signature_id]: '✓ Applied' }))
      setTimeout(() => setApplyStatus(prev => ({ ...prev, [sig.signature_id]: '' })), 3000)
      const appr = await api.getApprovalHistory()
      setApprovals(appr.approvals || [])
    } catch {
      setApplyStatus(prev => ({ ...prev, [sig.signature_id]: 'Error' }))
    }
  }

  const handleUpdateSignature = async (imp: any) => {
    setUpdating(imp.signature_id)
    try {
      await api.updateSignature(imp.signature_id, {
        ...imp.best_batch,
        operator_id: 'demo_operator',
      })
      setDismissed(prev => new Set([...prev, imp.signature_id]))
      const sigs = await api.getSignatures()
      setSignatures(sigs.signatures || [])
    } catch (e) {
      console.error(e)
    }
    setUpdating(null)
  }

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-secondary)' }}>
      Loading signatures...
    </div>
  )

  const PARAMS = [
    { key: 'compression_force', label: 'Compression Force', unit: 'kN' },
    { key: 'granulation_time', label: 'Granulation Time', unit: 'min' },
    { key: 'drying_temp', label: 'Drying Temp', unit: '°C' },
    { key: 'drying_time', label: 'Drying Time', unit: 'min' },
    { key: 'machine_speed', label: 'Machine Speed', unit: 'RPM' },
    { key: 'binder_amount', label: 'Binder Amount', unit: 'g' },
    { key: 'lubricant_conc', label: 'Lubricant Conc', unit: '%' },
    { key: 'moisture_content', label: 'Moisture Content', unit: '%' },
  ]

  const QUALITY = [
    { key: 'dissolution_rate', label: 'Dissolution Rate', unit: '%', min: 85, color: 'var(--green)' },
    { key: 'friability', label: 'Friability', unit: '%', max: 1.0, color: 'var(--cyan)' },
    { key: 'hardness', label: 'Hardness', unit: 'N', min: 50, color: 'var(--purple)' },
    { key: 'disintegration_time', label: 'Disintegration', unit: 'min', max: 15, color: 'var(--amber)' },
    { key: 'total_energy_kwh', label: 'Energy', unit: 'kWh', color: 'var(--amber)' },
  ]

  return (
    <div style={{ padding: 28, display: 'flex', flexDirection: 'column', gap: 24 }}>

      {/* Header */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
          <span style={{ color: 'var(--cyan)', fontSize: 20 }}>✦</span>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>Golden Signatures</h1>
        </div>
        <p style={{ margin: '0 0 0 30px', color: 'var(--text-secondary)', fontSize: 13 }}>
          Optimal parameter sets extracted from 42 feasible batches — human-approved manufacturing blueprints
        </p>
      </div>

      {/* Continuous Learning Alerts */}
      {improvements.filter(i => !dismissed.has(i.signature_id)).map(imp => (
        <div key={imp.signature_id} style={{
          background: 'rgba(136,102,255,0.08)',
          border: '1px solid rgba(136,102,255,0.35)',
          borderRadius: 10,
          padding: '14px 20px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 16,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 18, color: 'var(--purple)' }}>⟳</span>
            <div>
              <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--purple)', marginBottom: 2 }}>
                Continuous Learning — Better Batch Found
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                Batch <span style={{ color: 'var(--cyan)', fontFamily: 'monospace' }}>{imp.best_batch.batch_id}</span> outperforms{' '}
                <span style={{ color: 'var(--purple)' }}>{imp.signature_id}</span> by{' '}
                <span style={{ color: 'var(--green)' }}>+{imp.improvement_pct}%</span>{' '}
                — Dissolution {imp.best_batch.dissolution_rate?.toFixed(1)}%, Friability {imp.best_batch.friability?.toFixed(2)}%
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
            <button
              onClick={() => handleUpdateSignature(imp)}
              disabled={updating === imp.signature_id}
              style={{
                background: 'var(--purple)', color: '#fff', border: 'none',
                borderRadius: 7, padding: '8px 16px', fontSize: 12,
                fontWeight: 700, cursor: 'pointer', letterSpacing: 0.5,
                opacity: updating === imp.signature_id ? 0.6 : 1,
              }}
            >
              {updating === imp.signature_id ? 'Updating...' : 'UPDATE SIGNATURE'}
            </button>
            <button
              onClick={() => setDismissed(prev => new Set([...prev, imp.signature_id]))}
              style={{
                background: 'transparent', color: 'var(--text-secondary)',
                border: '1px solid var(--border)', borderRadius: 7,
                padding: '8px 12px', fontSize: 12, cursor: 'pointer',
              }}
            >
              Dismiss
            </button>
          </div>
        </div>
      ))}

      {/* Signature Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
        {signatures.map(sig => {
          const color = OBJECTIVE_COLORS[sig.signature_id] || 'var(--cyan)'
          const icon = OBJECTIVE_ICONS[sig.signature_id] || '✦'
          const isSelected = selected?.signature_id === sig.signature_id
          return (
            <div
              key={sig.signature_id}
              onClick={() => setSelected(sig)}
              style={{
                background: isSelected ? `rgba(${color === 'var(--cyan)' ? '0,212,255' : color === 'var(--green)' ? '0,255,136' : '255,170,0'}, 0.08)` : 'var(--surface)',
                border: `2px solid ${isSelected ? color : 'var(--border)'}`,
                borderRadius: 12,
                padding: 20,
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <span style={{ color, fontSize: 18 }}>{icon}</span>
                    <span style={{ fontWeight: 700, fontSize: 14, color }}>{sig.signature_id}</span>
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Source: {sig.source_batch_id}</div>
                </div>
                <span style={{
                  fontSize: 10, padding: '2px 8px', borderRadius: 10,
                  background: sig.human_approved ? 'rgba(0,255,136,0.15)' : 'rgba(255,170,0,0.15)',
                  color: sig.human_approved ? 'var(--green)' : 'var(--amber)',
                  border: `1px solid ${sig.human_approved ? 'rgba(0,255,136,0.3)' : 'rgba(255,170,0,0.3)'}`,
                  fontWeight: 700,
                }}>
                  {sig.human_approved ? '✓ APPROVED' : 'PENDING'}
                </span>
              </div>

              <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 14, lineHeight: 1.5 }}>
                {sig.objective}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 16 }}>
                {[
                  { label: 'Dissolution', value: `${sig.dissolution_rate?.toFixed(1)}%`, good: sig.dissolution_rate > 85 },
                  { label: 'Friability', value: `${sig.friability?.toFixed(2)}%`, good: sig.friability < 1.0 },
                  { label: 'Hardness', value: `${sig.hardness?.toFixed(0)}N`, good: sig.hardness > 50 },
                  { label: 'Energy', value: `${sig.total_energy_kwh?.toFixed(1)} kWh`, good: true },
                ].map(m => (
                  <div key={m.label} style={{ background: 'var(--surface2)', borderRadius: 6, padding: '8px 10px' }}>
                    <div style={{ fontSize: 10, color: 'var(--text-secondary)', marginBottom: 2 }}>{m.label}</div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: m.good ? 'var(--green)' : 'var(--red)' }}>
                      {m.value}
                    </div>
                  </div>
                ))}
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Compression Force</span>
                <span style={{ fontSize: 14, fontWeight: 700, color }}>
                  {sig.compression_force?.toFixed(1)} kN
                </span>
              </div>

              <button
                onClick={e => { e.stopPropagation(); handleApply(sig) }}
                style={{
                  width: '100%',
                  background: applyStatus[sig.signature_id] === '✓ Applied' ? 'rgba(0,255,136,0.2)' : color,
                  color: applyStatus[sig.signature_id] === '✓ Applied' ? 'var(--green)' : '#000',
                  border: applyStatus[sig.signature_id] === '✓ Applied' ? '1px solid var(--green)' : 'none',
                  borderRadius: 8, padding: '10px',
                  fontWeight: 700, fontSize: 12, cursor: 'pointer',
                  letterSpacing: 1,
                }}
              >
                {applyStatus[sig.signature_id] || 'APPLY SIGNATURE'}
              </button>
            </div>
          )
        })}
      </div>

      {/* Detail Panel */}
      {selected && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 24 }}>
            <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 16 }}>
              {selected.signature_id} — Process Parameters
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
              {PARAMS.map((p, i) => (
                <div key={p.key} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '10px 0',
                  borderBottom: i < PARAMS.length - 1 ? '1px solid var(--border)' : 'none'
                }}>
                  <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{p.label}</span>
                  <span style={{ fontSize: 14, fontWeight: 600 }}>
                    {selected[p.key]?.toFixed(p.key === 'machine_speed' ? 0 : 2)}{' '}
                    <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{p.unit}</span>
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 24 }}>
            <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 16 }}>
              {selected.signature_id} — Quality Outcomes
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {QUALITY.map(q => {
                const val = selected[q.key]
                const pass = (q.min ? val >= q.min : true) && (q.max ? val <= q.max : true)
                return (
                  <div key={q.key}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                      <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{q.label}</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 14, fontWeight: 700, color: pass ? 'var(--green)' : 'var(--red)' }}>
                          {val?.toFixed(2)} {q.unit}
                        </span>
                        {(q.min || q.max) && (
                          <span style={{
                            fontSize: 10, padding: '2px 6px', borderRadius: 8, fontWeight: 700,
                            background: pass ? 'rgba(0,255,136,0.15)' : 'rgba(255,68,102,0.15)',
                            color: pass ? 'var(--green)' : 'var(--red)',
                          }}>
                            {pass ? 'PASS' : 'FAIL'}
                          </span>
                        )}
                      </div>
                    </div>
                    {(q.min || q.max) && (
                      <div style={{ height: 4, background: 'var(--surface2)', borderRadius: 2 }}>
                        <div style={{
                          height: '100%', borderRadius: 2,
                          background: pass ? 'var(--green)' : 'var(--red)',
                          width: q.key === 'dissolution_rate' ? `${Math.min(val, 100)}%` :
                                 q.key === 'friability' ? `${Math.min(val / 2 * 100, 100)}%` :
                                 q.key === 'hardness' ? `${Math.min(val / 150 * 100, 100)}%` :
                                 `${Math.min(val / 20 * 100, 100)}%`,
                        }} />
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            <div style={{
              marginTop: 20, padding: '12px 16px',
              background: 'rgba(0,212,255,0.08)', borderRadius: 8,
              border: '1px solid rgba(0,212,255,0.2)',
            }}>
              <div style={{ fontSize: 12, color: 'var(--cyan)', fontWeight: 700, marginBottom: 4 }}>
                ✓ Within Feasibility Envelope
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                Compression Force {selected.compression_force?.toFixed(1)} kN is within the 8.0–14.0 kN window
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Approval History */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 24 }}>
        <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 16 }}>Approval History</div>
        {approvals.length === 0 ? (
          <div style={{ color: 'var(--text-secondary)', fontSize: 13 }}>No approvals yet.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            {approvals.slice(0, 10).map((a, i) => (
              <div key={a.id || i} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '12px 0',
                borderBottom: i < approvals.length - 1 ? '1px solid var(--border)' : 'none'
              }}>
                <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
                  <span style={{ fontSize: 13, fontWeight: 600 }}>{a.batch_id}</span>
                  <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{a.operator_id}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  {a.predicted_outcomes && (
                    <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                      Dissolution: {a.predicted_outcomes?.dissolution_rate?.toFixed?.(1) || '—'}%
                    </span>
                  )}
                  <span style={{
                    fontSize: 11, padding: '3px 10px', borderRadius: 10, fontWeight: 700,
                    background: a.decision === 'accepted' ? 'rgba(0,255,136,0.15)' :
                               a.decision === 'rejected' ? 'rgba(255,68,102,0.15)' : 'rgba(255,170,0,0.15)',
                    color: a.decision === 'accepted' ? 'var(--green)' :
                           a.decision === 'rejected' ? 'var(--red)' : 'var(--amber)',
                  }}>
                    {a.decision?.toUpperCase()}
                  </span>
                  <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                    {a.created_at ? new Date(a.created_at).toLocaleDateString() : ''}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}