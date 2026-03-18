'use client'
import { useState, useEffect, useRef } from 'react'
import { api } from '../../lib/api'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

function renderMarkdown(text: string) {
  const lines = text.split('\n')
  const elements: React.ReactNode[] = []
  let i = 0

  while (i < lines.length) {
    const line = lines[i]

    // Table
    if (line.startsWith('|') && i + 1 < lines.length && lines[i + 1].startsWith('|---')) {
      const headers = line.split('|').filter(c => c.trim()).map(c => c.trim())
      i += 2
      const rows: string[][] = []
      while (i < lines.length && lines[i].startsWith('|')) {
        rows.push(lines[i].split('|').filter(c => c.trim()).map(c => c.trim()))
        i++
      }
      elements.push(
        <div key={i} style={{ overflowX: 'auto', margin: '10px 0' }}>
          <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 12 }}>
            <thead>
              <tr>{headers.map((h, j) => <th key={j} style={{ padding: '6px 12px', borderBottom: '1px solid var(--border)', color: 'var(--cyan)', textAlign: 'left', fontWeight: 700 }}>{h}</th>)}</tr>
            </thead>
            <tbody>
              {rows.map((row, j) => (
                <tr key={j} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                  {row.map((cell, k) => <td key={k} style={{ padding: '6px 12px', color: 'var(--text-primary)' }}>{cell}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )
      continue
    }

    // Heading
    if (line.startsWith('**') && line.endsWith('**') && !line.slice(2, -2).includes('**')) {
      elements.push(<div key={i} style={{ fontWeight: 700, color: 'var(--cyan)', fontSize: 14, margin: '10px 0 6px' }}>{line.slice(2, -2)}</div>)
      i++
      continue
    }

    // Bullet
    if (line.startsWith('- ')) {
      const content = line.slice(2)
      elements.push(
        <div key={i} style={{ display: 'flex', gap: 8, margin: '3px 0' }}>
          <span style={{ color: 'var(--cyan)', flexShrink: 0 }}>•</span>
          <span>{inlineFormat(content)}</span>
        </div>
      )
      i++
      continue
    }

    // Empty line
    if (line.trim() === '') {
      elements.push(<div key={i} style={{ height: 6 }} />)
      i++
      continue
    }

    // Normal paragraph
    elements.push(<div key={i} style={{ margin: '2px 0', lineHeight: 1.7 }}>{inlineFormat(line)}</div>)
    i++
  }

  return elements
}

function inlineFormat(text: string): React.ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*)/g)
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i} style={{ color: 'var(--text-primary)', fontWeight: 700 }}>{part.slice(2, -2)}</strong>
    }
    return <span key={i}>{part}</span>
  })
}

export default function CopilotView() {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: 'BatchMind online. I have access to GPR models trained on 60 batches with 98.41% accuracy. The feasibility window is 8.0–14.0 kN compression force. How can I help you optimize this batch?'
    }
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [suggestions, setSuggestions] = useState<string[]>([])
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    api.getSuggestions().then(r => setSuggestions(r.suggestions || [])).catch(console.error)
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const send = async (text: string) => {
    if (!text.trim() || loading) return
    const userMsg: Message = { role: 'user', content: text }
    setMessages(prev => [...prev, userMsg])
    setInput('')
    setLoading(true)

    try {
      const history = messages.map(m => ({ role: m.role, content: m.content }))
      const res = await api.chat(text, history)
      setMessages(prev => [...prev, { role: 'assistant', content: res.response }])
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Unable to reach BatchMind backend. The server may be waking up — please try again in a moment.' }])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ display: 'flex', height: '100vh', flexDirection: 'column', background: 'var(--background)' }}>

      {/* Header */}
      <div style={{ padding: '20px 28px', borderBottom: '1px solid var(--border)', background: 'var(--surface)', flexShrink: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ color: 'var(--cyan)', fontSize: 20 }}>◈</span>
              <span style={{ fontWeight: 700, fontSize: 18 }}>AI Copilot</span>
              <span style={{
                fontSize: 11, padding: '2px 8px', borderRadius: 12,
                background: 'rgba(0,212,255,0.15)', color: 'var(--cyan)',
                border: '1px solid rgba(0,212,255,0.3)', fontWeight: 600
              }}>KNOWLEDGE ENGINE</span>
            </div>
            <p style={{ margin: '4px 0 0 30px', color: 'var(--text-secondary)', fontSize: 12 }}>
              Causal-aware · GPR-grounded · Regulatory-constrained
            </p>
          </div>
          <div style={{ display: 'flex', gap: 24, fontSize: 12 }}>
            {[
              { label: 'Model Accuracy', value: '98.41%', color: 'var(--green)' },
              { label: 'Feasible Window', value: '8.0–14.0 kN', color: 'var(--cyan)' },
              { label: 'Batches Trained', value: '60', color: 'var(--purple)' },
            ].map(s => (
              <div key={s.label} style={{ textAlign: 'center' }}>
                <div style={{ color: 'var(--text-secondary)', fontSize: 11 }}>{s.label}</div>
                <div style={{ fontWeight: 700, color: s.color }}>{s.value}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflow: 'auto', padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: 16 }}>
        {messages.map((msg, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start', gap: 12, alignItems: 'flex-start' }}>
            {msg.role === 'assistant' && (
              <div style={{
                width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
                background: 'rgba(0,212,255,0.15)', border: '1px solid rgba(0,212,255,0.4)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: 'var(--cyan)', fontSize: 14, fontWeight: 700
              }}>⬡</div>
            )}
            <div style={{
              maxWidth: '72%',
              background: msg.role === 'user' ? 'rgba(0,212,255,0.12)' : 'var(--surface)',
              border: msg.role === 'user' ? '1px solid rgba(0,212,255,0.3)' : '1px solid var(--border)',
              borderRadius: msg.role === 'user' ? '16px 16px 4px 16px' : '4px 16px 16px 16px',
              padding: '12px 16px',
            }}>
              <div style={{ fontSize: 13, color: msg.role === 'user' ? 'var(--cyan)' : 'var(--text-primary)', lineHeight: 1.7 }}>
                {msg.role === 'assistant' ? renderMarkdown(msg.content) : msg.content}
              </div>
              {msg.role === 'assistant' && (
                <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 6 }}>
                  BatchMind · Knowledge Engine response
                </div>
              )}
            </div>
            {msg.role === 'user' && (
              <div style={{
                width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
                background: 'rgba(136,102,255,0.15)', border: '1px solid rgba(136,102,255,0.4)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: 'var(--purple)', fontSize: 14
              }}>⬡</div>
            )}
          </div>
        ))}

        {loading && (
          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
            <div style={{
              width: 32, height: 32, borderRadius: '50%',
              background: 'rgba(0,212,255,0.15)', border: '1px solid rgba(0,212,255,0.4)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'var(--cyan)', fontSize: 14
            }}>⬡</div>
            <div style={{
              background: 'var(--surface)', border: '1px solid var(--border)',
              borderRadius: '4px 16px 16px 16px', padding: '12px 20px',
              display: 'flex', gap: 6, alignItems: 'center'
            }}>
              {[0, 1, 2].map(i => (
                <div key={i} style={{
                  width: 7, height: 7, borderRadius: '50%', background: 'var(--cyan)',
                  animation: 'pulse 1.2s ease-in-out infinite',
                  animationDelay: `${i * 0.2}s`, opacity: 0.7
                }} />
              ))}
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Suggestions */}
      {messages.length <= 2 && suggestions.length > 0 && (
        <div style={{ padding: '0 28px 16px', display: 'flex', flexWrap: 'wrap', gap: 8, flexShrink: 0 }}>
          {suggestions.slice(0, 4).map((s, i) => (
            <button key={i} onClick={() => send(s)} style={{
              background: 'var(--surface)', border: '1px solid var(--border)',
              borderRadius: 20, padding: '6px 14px', fontSize: 12,
              color: 'var(--text-secondary)', cursor: 'pointer',
            }}
              onMouseEnter={e => { (e.target as HTMLElement).style.borderColor = 'var(--cyan)'; (e.target as HTMLElement).style.color = 'var(--cyan)' }}
              onMouseLeave={e => { (e.target as HTMLElement).style.borderColor = 'var(--border)'; (e.target as HTMLElement).style.color = 'var(--text-secondary)' }}
            >{s}</button>
          ))}
        </div>
      )}

      {/* Input */}
      <div style={{ padding: '16px 28px 24px', borderTop: '1px solid var(--border)', background: 'var(--surface)', flexShrink: 0 }}>
        <div style={{ display: 'flex', gap: 12 }}>
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !e.shiftKey && send(input)}
            placeholder="Ask about batch parameters, regulatory compliance, energy optimization..."
            style={{
              flex: 1, background: 'var(--surface2)', border: '1px solid var(--border)',
              borderRadius: 10, padding: '12px 16px', color: 'var(--text-primary)',
              fontSize: 13, outline: 'none',
            }}
            onFocus={e => (e.target.style.borderColor = 'var(--cyan)')}
            onBlur={e => (e.target.style.borderColor = 'var(--border)')}
          />
          <button
            onClick={() => send(input)}
            disabled={loading || !input.trim()}
            style={{
              background: loading || !input.trim() ? 'var(--surface2)' : 'var(--cyan)',
              color: loading || !input.trim() ? 'var(--text-secondary)' : '#000',
              border: 'none', borderRadius: 10, padding: '12px 24px',
              fontWeight: 700, fontSize: 13, cursor: loading || !input.trim() ? 'not-allowed' : 'pointer',
              letterSpacing: 1,
            }}
          >
            {loading ? '...' : 'SEND'}
          </button>
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 8, textAlign: 'center' }}>
          BatchMind Knowledge Engine · Causal context injected · Press Enter to send
        </div>
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 0.3; transform: scale(0.8); }
          50% { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </div>
  )
}