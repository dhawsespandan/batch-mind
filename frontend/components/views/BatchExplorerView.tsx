'use client'
import { useEffect, useState } from 'react'
import { api } from '../../lib/api'

const STATUS_CONFIG: Record<string, { color: string; bg: string; label: string }> = {
  feasible: { color: 'var(--green)', bg: 'rgba(0,255,136,0.12)', label: 'FEASIBLE' },
  infeasible: { color: 'var(--red)', bg: 'rgba(255,68,102,0.12)', label: 'INFEASIBLE' },
  borderline: { color: 'var(--amber)', bg: 'rgba(255,170,0,0.12)', label: 'BORDERLINE' },
}

const COLUMNS = [
  { key: 'batch_id', label: 'Batch ID', width: 90 },
  { key: 'dissolution_rate', label: 'Dissolution', width: 110 },
  { key: 'friability', label: 'Friability', width: 100 },
  { key: 'hardness', label: 'Hardness', width: 100 },
  { key: 'disintegration_time', label: 'Disint. (min)', width: 110 },
  { key: 'tablet_weight', label: 'Weight (mg)', width: 105 },
  { key: 'content_uniformity', label: 'Content Unif.', width: 115 },
  { key: 'fully_compliant', label: 'Status', width: 110 },
]

function QualityBar({ value, min, max, reverse = false }: { value: number; min?: number; max?: number; reverse?: boolean }) {
  const pct = min != null ? Math.min(value / (min * 1.4) * 100, 100) : max != null ? Math.min(value / max * 100, 100) : 50
  const pass = min != null ? value >= min : max != null ? value <= max : true
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <span style={{ fontWeight: 600, fontSize: 13, color: pass ? 'var(--green)' : 'var(--red)', minWidth: 42, textAlign: 'right' }}>
        {value?.toFixed(1)}
      </span>
      <div style={{ width: 40, height: 3, background: 'var(--surface2)', borderRadius: 2, overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: pass ? 'var(--green)' : 'var(--red)', borderRadius: 2 }} />
      </div>
    </div>
  )
}

export default function BatchExplorerView() {
  const [batches, setBatches] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<any>(null)
  const [filter, setFilter] = useState<'all' | 'feasible' | 'infeasible'>('all')
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState<{ key: string; dir: 'asc' | 'desc' }>({ key: 'batch_id', dir: 'asc' })

  useEffect(() => {
    api.getAllBatches().then(data => {
      setBatches(data.batches || [])
      setLoading(false)
    }).catch(console.error)
  }, [])

  const filtered = batches
  .filter(b => {
    if (filter === 'all') return true
    if (filter === 'feasible') return b.fully_compliant === true
    if (filter === 'infeasible') return b.fully_compliant === false
    return true
  })
  .filter(b => b.batch_id?.toLowerCase().includes(search.toLowerCase()))
  .sort((a, b) => {
    const av = a[sort.key], bv = b[sort.key]
    if (typeof av === 'string') return sort.dir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av)
    if (typeof av === 'boolean') return sort.dir === 'asc' ? (av ? -1 : 1) : (av ? 1 : -1)
    return sort.dir === 'asc' ? av - bv : bv - av
  })

const counts = {
  all: batches.length,
  feasible: batches.filter(b => b.fully_compliant === true).length,
  infeasible: batches.filter(b => b.fully_compliant === false).length,
  borderline: 0,
}

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-secondary)' }}>
      Loading batches...
    </div>
  )

  return (
    <div style={{ padding: 28, display: 'flex', flexDirection: 'column', gap: 20, height: '100%' }}>

      {/* Header */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
          <span style={{ color: 'var(--cyan)', fontSize: 20 }}>◈</span>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>Batch Explorer</h1>
        </div>
        <p style={{ margin: '0 0 0 30px', color: 'var(--text-secondary)', fontSize: 13 }}>
          GPR predictions across all {batches.length} historical batches — click any row for details
        </p>
      </div>

      {/* Filter tabs + search */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16 }}>
        <div style={{ display: 'flex', gap: 8 }}>
          {(['all', 'feasible', 'infeasible', 'borderline'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              style={{
                padding: '6px 14px', borderRadius: 8, fontSize: 12, fontWeight: 700,
                cursor: 'pointer', letterSpacing: 0.5,
                border: filter === f
                  ? `1px solid ${f === 'all' ? 'var(--cyan)' : f === 'feasible' ? 'var(--green)' : f === 'infeasible' ? 'var(--red)' : 'var(--amber)'}`
                  : '1px solid var(--border)',
                background: filter === f
                  ? f === 'all' ? 'rgba(0,212,255,0.1)' : f === 'feasible' ? 'rgba(0,255,136,0.1)' : f === 'infeasible' ? 'rgba(255,68,102,0.1)' : 'rgba(255,170,0,0.1)'
                  : 'var(--surface)',
                color: filter === f
                  ? f === 'all' ? 'var(--cyan)' : f === 'feasible' ? 'var(--green)' : f === 'infeasible' ? 'var(--red)' : 'var(--amber)'
                  : 'var(--text-secondary)',
              }}
            >
              {f.toUpperCase()} <span style={{ opacity: 0.7, fontWeight: 400 }}>({counts[f]})</span>
            </button>
          ))}
        </div>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search batch ID..."
          style={{
            background: 'var(--surface)', border: '1px solid var(--border)',
            borderRadius: 8, padding: '7px 14px', fontSize: 13, color: 'var(--text-primary)',
            outline: 'none', width: 180,
          }}
        />
      </div>

      {/* Summary stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
        {[
          { label: 'Avg Dissolution', value: `${(batches.reduce((s, b) => s + (b.dissolution_rate || 0), 0) / batches.length).toFixed(1)}%`, color: 'var(--green)' },
          { label: 'Avg Friability', value: `${(batches.reduce((s, b) => s + (b.friability || 0), 0) / batches.length).toFixed(2)}%`, color: 'var(--cyan)' },
          { label: 'Avg Energy', value: `${(batches.reduce((s, b) => s + (b.total_energy_kwh || 0), 0) / batches.length).toFixed(1)} kWh`, color: 'var(--amber)' },
          { label: 'Feasibility Rate', value: `${(counts.feasible / batches.length * 100).toFixed(0)}%`, color: 'var(--purple)' },
        ].map(s => (
          <div key={s.label} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '14px 18px' }}>
            <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 }}>{s.label}</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: s.color, fontFamily: 'monospace' }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Main content */}
      <div style={{ display: 'flex', gap: 20, flex: 1, minHeight: 0 }}>

        {/* Table */}
        <div style={{
          flex: 1, background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 12, overflow: 'hidden', display: 'flex', flexDirection: 'column'
        }}>
          {/* Table header */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: COLUMNS.map(c => `${c.width}px`).join(' '),
            padding: '0 16px',
            borderBottom: '1px solid var(--border)',
            background: 'var(--surface2)',
          }}>
            {COLUMNS.map(col => (
              <div
                key={col.key}
                onClick={() => toggleSort(col.key)}
                style={{
                  padding: '11px 4px', fontSize: 11, fontWeight: 700,
                  color: sort.key === col.key ? 'var(--cyan)' : 'var(--text-secondary)',
                  cursor: 'pointer', userSelect: 'none', letterSpacing: 0.5,
                  display: 'flex', alignItems: 'center', gap: 4,
                }}
              >
                {col.label}
                {sort.key === col.key && <span>{sort.dir === 'asc' ? '↑' : '↓'}</span>}
              </div>
            ))}
          </div>

          {/* Table body */}
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {filtered.map((batch, i) => {
              const status = STATUS_CONFIG[batch.feasibility_status] || STATUS_CONFIG.infeasible
              const isSelected = selected?.batch_id === batch.batch_id
              return (
                <div
  key={batch.batch_id}
  onClick={() => setSelected(isSelected ? null : batch)}
  style={{
    display: 'grid',
    gridTemplateColumns: COLUMNS.map(c => `${c.width}px`).join(' '),
    padding: '0 16px',
    borderBottom: '1px solid var(--border)',
    background: isSelected ? 'rgba(0,212,255,0.06)' : i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.015)',
    cursor: 'pointer',
    transition: 'background 0.15s',
  }}
  onMouseEnter={e => { if (!isSelected) (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.04)' }}
  onMouseLeave={e => { if (!isSelected) (e.currentTarget as HTMLElement).style.background = i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.015)' }}
>
  <div style={{ padding: '10px 4px', fontSize: 13, fontWeight: 700, color: 'var(--cyan)', fontFamily: 'monospace' }}>{batch.batch_id}</div>
  <div style={{ padding: '6px 4px' }}><QualityBar value={batch.dissolution_rate} min={85} /></div>
  <div style={{ padding: '6px 4px' }}><QualityBar value={batch.friability} max={1.0} /></div>
  <div style={{ padding: '6px 4px' }}><QualityBar value={batch.hardness} min={50} /></div>
  <div style={{ padding: '10px 4px', fontSize: 13, fontFamily: 'monospace', color: batch.disintegration_time > 15 ? 'var(--red)' : 'var(--text-primary)' }}>
    {batch.disintegration_time?.toFixed(1)}
  </div>
  <div style={{ padding: '10px 4px', fontSize: 13, fontFamily: 'monospace' }}>{batch.tablet_weight?.toFixed(1)}</div>
  <div style={{ padding: '10px 4px', fontSize: 13, fontFamily: 'monospace', color: batch.content_uniformity >= 95 && batch.content_uniformity <= 105 ? 'var(--green)' : 'var(--amber)' }}>
    {batch.content_uniformity?.toFixed(1)}
  </div>
  <div style={{ padding: '8px 4px' }}>
    <span style={{
      fontSize: 10, padding: '3px 8px', borderRadius: 8, fontWeight: 700,
      background: batch.fully_compliant ? 'rgba(0,255,136,0.12)' : 'rgba(255,68,102,0.12)',
      color: batch.fully_compliant ? 'var(--green)' : 'var(--red)',
      border: `1px solid ${batch.fully_compliant ? 'rgba(0,255,136,0.3)' : 'rgba(255,68,102,0.3)'}`,
    }}>
      {batch.fully_compliant ? 'PASS' : 'FAIL'}
    </span>
  </div>
</div>
              )
            })}
          </div>

          <div style={{ padding: '10px 20px', borderTop: '1px solid var(--border)', fontSize: 12, color: 'var(--text-secondary)', background: 'var(--surface2)' }}>
            Showing {filtered.length} of {batches.length} batches
          </div>
        </div>

        {/* Detail panel */}
        {selected && (
          <div style={{
            width: 280, background: 'var(--surface)', border: '1px solid var(--border)',
            borderRadius: 12, padding: 20, display: 'flex', flexDirection: 'column', gap: 16,
            overflowY: 'auto',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--cyan)', fontFamily: 'monospace' }}>{selected.batch_id}</div>
                <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>Batch Detail</div>
              </div>
              <button onClick={() => setSelected(null)} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 18 }}>×</button>
            </div>

            {/* Status */}
            <div style={{
              padding: '10px 14px', borderRadius: 8,
              background: STATUS_CONFIG[selected.feasibility_status]?.bg,
              border: `1px solid ${STATUS_CONFIG[selected.feasibility_status]?.color}33`,
              textAlign: 'center',
            }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: STATUS_CONFIG[selected.feasibility_status]?.color }}>
                {STATUS_CONFIG[selected.feasibility_status]?.label}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>
                CF: {selected.compression_force?.toFixed(1)} kN {selected.compression_force >= 8 && selected.compression_force <= 14 ? '✓ in window' : '✗ out of window'}
              </div>
            </div>

            {/* Quality metrics */}
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', letterSpacing: 0.5, marginBottom: 10, textTransform: 'uppercase' }}>Quality Outcomes</div>
              {[
                { label: 'Dissolution Rate', value: selected.dissolution_rate, unit: '%', pass: selected.dissolution_rate >= 85, spec: '≥85%' },
                { label: 'Friability', value: selected.friability, unit: '%', pass: selected.friability <= 1.0, spec: '≤1.0%' },
                { label: 'Hardness', value: selected.hardness, unit: 'N', pass: selected.hardness >= 50, spec: '≥50N' },
                { label: 'Disintegration', value: selected.disintegration_time, unit: 'min', pass: selected.disintegration_time <= 15, spec: '≤15min' },
              ].map(m => (
                <div key={m.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                  <div>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{m.label}</div>
                    <div style={{ fontSize: 10, color: 'var(--text-secondary)', opacity: 0.6 }}>{m.spec}</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 14, fontWeight: 700, color: m.pass ? 'var(--green)' : 'var(--red)', fontFamily: 'monospace' }}>
                      {m.value?.toFixed(2)}{m.unit}
                    </span>
                    <span style={{ fontSize: 10, color: m.pass ? 'var(--green)' : 'var(--red)' }}>
                      {m.pass ? '✓' : '✗'}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {/* Process params */}
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', letterSpacing: 0.5, marginBottom: 10, textTransform: 'uppercase' }}>Process Parameters</div>
              {[
                { label: 'Granulation Time', value: selected.granulation_time, unit: 'min' },
                { label: 'Drying Temp', value: selected.drying_temp, unit: '°C' },
                { label: 'Drying Time', value: selected.drying_time, unit: 'min' },
                { label: 'Machine Speed', value: selected.machine_speed, unit: 'RPM' },
                { label: 'Binder Amount', value: selected.binder_amount, unit: 'g' },
                { label: 'Lubricant Conc', value: selected.lubricant_conc, unit: '%' },
                { label: 'Moisture Content', value: selected.moisture_content, unit: '%' },
                { label: 'Total Energy', value: selected.total_energy_kwh, unit: 'kWh' },
              ].map(p => (
                <div key={p.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                  <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{p.label}</span>
                  <span style={{ fontSize: 12, fontWeight: 600, fontFamily: 'monospace' }}>{p.value?.toFixed(p.unit === 'RPM' ? 0 : 2)} <span style={{ color: 'var(--text-secondary)', fontWeight: 400 }}>{p.unit}</span></span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}