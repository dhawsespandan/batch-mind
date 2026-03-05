export default function Card({
  children,
  title,
  subtitle,
  badge,
  style,
}: {
  children: React.ReactNode
  title?: string
  subtitle?: string
  badge?: { label: string; color?: string }
  style?: React.CSSProperties
}) {
  return (
    <div style={{
      background: 'var(--surface)',
      border: '1px solid var(--border)',
      borderRadius: 12,
      padding: 20,
      ...style,
    }}>
      {(title || badge) && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
          <div>
            {title && (
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>
                {title}
              </div>
            )}
            {subtitle && (
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 3 }}>
                {subtitle}
              </div>
            )}
          </div>
          {badge && (
            <span style={{
              fontSize: 11,
              padding: '3px 10px',
              borderRadius: 20,
              background: `${badge.color || 'var(--cyan)'}22`,
              color: badge.color || 'var(--cyan)',
              border: `1px solid ${badge.color || 'var(--cyan)'}44`,
              fontWeight: 600,
            }}>
              {badge.label}
            </span>
          )}
        </div>
      )}
      {children}
    </div>
  )
}