export function cn(...classes: (string | undefined | false)[]) {
  return classes.filter(Boolean).join(' ')
}

export function formatNumber(n: number, decimals = 1) {
  return n?.toFixed(decimals) ?? '—'
}

export function getStatusColor(value: number, min?: number, max?: number) {
  if (min !== undefined && value < min) return '#ff4466'
  if (max !== undefined && value > max) return '#ff4466'
  if (min !== undefined && value < min * 1.05) return '#ffaa00'
  if (max !== undefined && value > max * 0.95) return '#ffaa00'
  return '#00ff88'
}

export function getBatchStatusColor(batch: {
  dissolution_rate: number
  friability: number
  hardness: number
  in_feasible_zone?: boolean
}) {
  if (batch.in_feasible_zone) return '#00ff88'
  if (batch.dissolution_rate > 93 || batch.friability < 0.6) return '#ffaa00'
  return '#ff4466'
}