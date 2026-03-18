'use client'

import { useState, useRef } from 'react'

// ─── Types ───────────────────────────────────────────────────────────────────

type Platform = 'Instagram' | 'YouTube' | 'TikTok' | 'X / Twitter' | 'LinkedIn'
type AgentStatus = 'idle' | 'running' | 'done' | 'error'

interface AgentState {
  status: AgentStatus
  steps: string[]
  result: any
  error?: string
}

interface Results {
  [platform: string]: AgentState
}

// ─── Constants ───────────────────────────────────────────────────────────────

const PLATFORMS: { id: Platform; icon: string; color: string }[] = [
  { id: 'Instagram', icon: '📸', color: '#E1306C' },
  { id: 'YouTube',   icon: '▶',  color: '#FF0000' },
  { id: 'TikTok',    icon: '♪',  color: '#69C9D0' },
  { id: 'X / Twitter', icon: '𝕏', color: '#1DA1F2' },
  { id: 'LinkedIn',  icon: 'in', color: '#0A66C2' },
]

const NICHES = [
  { label: 'F1 Racing',       value: 'F1 Formula One racing' },
  { label: 'Personal Finance', value: 'personal finance investing' },
  { label: 'Gaming & Esports', value: 'gaming esports streaming' },
  { label: 'Fitness & Gym',   value: 'fitness gym workouts strength training' },
  { label: 'AI & Tech',       value: 'artificial intelligence AI tools technology' },
  { label: 'Travel & Vlog',   value: 'travel lifestyle vlog' },
  { label: 'Beauty & Makeup', value: 'beauty skincare makeup tutorials' },
  { label: 'Food & Cooking',  value: 'food cooking recipes' },
  { label: 'Crypto & Web3',   value: 'cryptocurrency bitcoin web3 trading' },
  { label: 'Fashion',         value: 'fashion streetwear style outfits' },
  { label: 'Real Estate',     value: 'real estate investing property' },
  { label: 'Comedy & Skits',  value: 'comedy skits humor entertainment' },
]

// ─── Helper components ────────────────────────────────────────────────────────

function Spinner() {
  return (
    <div style={{
      width: 14, height: 14, borderRadius: '50%',
      border: '2px solid var(--border2)',
      borderTopColor: 'var(--accent)',
      animation: 'spin 0.7s linear infinite',
      flexShrink: 0,
    }} />
  )
}

function StatusBadge({ status }: { status: AgentStatus }) {
  const map = {
    idle:    { label: 'Queued',   bg: 'rgba(255,255,255,0.05)', color: 'var(--dim)' },
    running: { label: 'Running',  bg: 'var(--accent-bg)',       color: 'var(--accent)' },
    done:    { label: 'Done',     bg: 'rgba(34,197,94,0.1)',    color: '#22c55e' },
    error:   { label: 'Failed',   bg: 'rgba(239,68,68,0.1)',    color: '#ef4444' },
  }
  const s = map[status]
  return (
    <span style={{
      fontSize: 10, fontWeight: 700, padding: '3px 9px',
      borderRadius: 4, textTransform: 'uppercase', letterSpacing: '0.06em',
      background: s.bg, color: s.color,
    }}>{s.label}</span>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function ViralFinder() {
  const [view, setView] = useState<'setup' | 'running' | 'results'>('setup')
  const [apiKey, setApiKey] = useState('')
  const [selectedPlatforms, setSelectedPlatforms] = useState<Platform[]>(['Instagram', 'YouTube', 'TikTok'])
  const [selectedNiche, setSelectedNiche] = useState('')
  const [customNiche, setCustomNiche] = useState('')
  const [focus, setFocus] = useState('')
  const [results, setResults] = useState<Results>({})
  const [synthesis, setSynthesis] = useState('')
  const [synthLoading, setSynthLoading] = useState(false)
  const [activeTab, setActiveTab] = useState<string>('')
  const [error, setError] = useState('')
  const [currentNiche, setCurrentNiche] = useState('')
  const abortRef = useRef<AbortController | null>(null)

  const niche = customNiche.trim() || selectedNiche

  function togglePlatform(p: Platform) {
    setSelectedPlatforms(prev =>
      prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p]
    )
  }

  function updateAgent(platform: string, update: Partial<AgentState>) {
    setResults(prev => ({
      ...prev,
      [platform]: { ...prev[platform], ...update }
    }))
  }

  async function runAgent(platform: Platform, niche: string, apiKey: string) {
    updateAgent(platform, { status: 'running', steps: ['Launching stealth browser...'] })

    try {
      const res = await fetch('/api/research', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ platform, niche, focus, apiKey }),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Server error' }))
        throw new Error(err.error || `HTTP ${res.status}`)
      }

      const reader = res.body!.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const raw = line.slice(6).trim()
          if (!raw) continue
          try {
            const evt = JSON.parse(raw)
            if (evt.type === 'PROGRESS' && evt.purpose) {
              setResults(prev => ({
                ...prev,
                [platform]: {
                  ...prev[platform],
                  steps: [...(prev[platform]?.steps || []), evt.purpose].slice(-6),
                }
              }))
            } else if (evt.type === 'COMPLETE') {
              updateAgent(platform, { status: 'done', result: evt.result })
              return
            } else if (evt.type === 'ERROR') {
              throw new Error(evt.message || 'Agent failed')
            }
          } catch (e: any) {
            if (!e.message?.includes('JSON')) throw e
          }
        }
      }
    } catch (err: any) {
      updateAgent(platform, { status: 'error', error: err.message })
    }
  }

  async function synthesize(niche: string, platforms: Platform[], allResults: Results) {
    setSynthLoading(true)
    setSynthesis('')
    try {
      const res = await fetch('/api/synthesize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          niche,
          platforms,
          results: Object.fromEntries(
            Object.entries(allResults).map(([p, s]) => [
              p, { ok: s.status === 'done', data: s.result }
            ])
          )
        })
      })
      const data = await res.json()
      if (data.synthesis) setSynthesis(data.synthesis)
    } catch {}
    setSynthLoading(false)
  }

  async function startResearch() {
    if (!apiKey.trim()) { setError('Enter your TinyFish API key.'); return }
    if (!niche) { setError('Select or type a niche.'); return }
    if (!selectedPlatforms.length) { setError('Select at least one platform.'); return }
    setError('')
    setCurrentNiche(niche)

    const initial: Results = {}
    selectedPlatforms.forEach(p => {
      initial[p] = { status: 'idle', steps: [], result: null }
    })
    setResults(initial)
    setSynthesis('')
    setView('running')
    setActiveTab(selectedPlatforms[0])

    await Promise.all(selectedPlatforms.map(p => runAgent(p, niche, apiKey.trim())))

    setView('results')
    setActiveTab('synthesis')

    // auto-synthesize
    const finalResults: Results = {}
    selectedPlatforms.forEach(p => {
      finalResults[p] = initial[p]
    })
    await synthesize(niche, selectedPlatforms, finalResults)
  }

  // ─── Render helpers ──────────────────────────────────────────────────────

  function resultText(platform: string): string {
    const r = results[platform]
    if (!r?.result) return ''
    return typeof r.result === 'string' ? r.result : JSON.stringify(r.result, null, 2)
  }

  const successPlatforms = selectedPlatforms.filter(p => results[p]?.status === 'done')
  const allDone = selectedPlatforms.every(p => ['done', 'error'].includes(results[p]?.status || 'idle'))

  // ─── SETUP VIEW ──────────────────────────────────────────────────────────
  if (view === 'setup') {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
        {/* Nav */}
        <nav style={{
          borderBottom: '1px solid var(--border)',
          padding: '0 2rem',
          height: 56,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 28, height: 28, borderRadius: 8,
              background: 'var(--accent)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 14,
            }}>⚡</div>
            <span style={{ fontWeight: 700, fontSize: 15, letterSpacing: '-0.01em' }}>ViralFinder</span>
            <span style={{
              fontSize: 10, fontWeight: 600, padding: '2px 7px',
              background: 'var(--accent-bg)', color: 'var(--accent)',
              borderRadius: 4, border: '1px solid var(--accent-border)',
              letterSpacing: '0.06em',
            }}>BETA</span>
          </div>
          <a href="https://agent.tinyfish.ai/api-keys" target="_blank" rel="noreferrer"
            style={{ fontSize: 12, color: 'var(--muted)', textDecoration: 'none' }}>
            Get API key →
          </a>
        </nav>

        {/* Hero */}
        <div style={{ maxWidth: 680, margin: '0 auto', padding: '4rem 1.5rem 2rem', width: '100%' }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            fontSize: 11, color: 'var(--muted)', fontWeight: 600,
            letterSpacing: '0.08em', textTransform: 'uppercase',
            marginBottom: '1.5rem',
            padding: '4px 12px', border: '1px solid var(--border2)', borderRadius: 20,
          }}>
            <div style={{
              width: 6, height: 6, borderRadius: '50%', background: 'var(--accent)',
              animation: 'pulse-dot 2s ease infinite',
            }} />
            Powered by TinyFish Web Agents
          </div>

          <h1 style={{
            fontSize: 'clamp(32px, 5vw, 52px)',
            fontWeight: 800,
            letterSpacing: '-0.03em',
            lineHeight: 1.1,
            marginBottom: '1rem',
          }}>
            Find what goes viral<br />
            <span style={{ color: 'var(--accent)' }}>before everyone else.</span>
          </h1>
          <p style={{ fontSize: 16, color: 'var(--muted)', lineHeight: 1.6, marginBottom: '3rem', maxWidth: 500 }}>
            Deploy stealth browser agents across Instagram, YouTube and TikTok to extract real-time trend intelligence for any creator niche.
          </p>

          {/* Form Card */}
          <div style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 16,
            padding: '1.5rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '1.5rem',
          }}>
            {/* API Key */}
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--dim)', textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: 8 }}>
                TinyFish API Key
              </label>
              <input
                type="password"
                value={apiKey}
                onChange={e => setApiKey(e.target.value)}
                placeholder="tf_live_xxxxxxxxxxxxxxxxxxxx"
                style={{
                  width: '100%', background: 'var(--surface2)', border: '1px solid var(--border)',
                  borderRadius: 8, padding: '10px 14px', fontSize: 13, color: 'var(--text)',
                  fontFamily: 'monospace', outline: 'none',
                }}
              />
              <p style={{ fontSize: 11, color: 'var(--dim)', marginTop: 6 }}>
                Get yours free at{' '}
                <a href="https://agent.tinyfish.ai/api-keys" target="_blank" rel="noreferrer"
                  style={{ color: 'var(--muted)', textDecoration: 'underline' }}>
                  agent.tinyfish.ai/api-keys
                </a>
              </p>
            </div>

            {/* Platforms */}
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--dim)', textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: 10 }}>
                Platforms to scout
              </label>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {PLATFORMS.map(p => {
                  const on = selectedPlatforms.includes(p.id)
                  return (
                    <button key={p.id} onClick={() => togglePlatform(p.id)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 7,
                        padding: '8px 14px', borderRadius: 8, fontSize: 13, fontWeight: 500,
                        cursor: 'pointer', transition: 'all 0.15s',
                        border: on ? '1px solid var(--accent-border)' : '1px solid var(--border)',
                        background: on ? 'var(--accent-bg)' : 'transparent',
                        color: on ? 'var(--accent)' : 'var(--muted)',
                      }}>
                      <span style={{ fontSize: 14 }}>{p.icon}</span>
                      {p.id}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Niche */}
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--dim)', textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: 10 }}>
                Creator niche
              </label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
                {NICHES.map(n => {
                  const on = selectedNiche === n.value
                  return (
                    <button key={n.value} onClick={() => { setSelectedNiche(on ? '' : n.value); setCustomNiche('') }}
                      style={{
                        padding: '5px 13px', borderRadius: 20, fontSize: 12, fontWeight: 500,
                        cursor: 'pointer', transition: 'all 0.15s',
                        border: on ? '1px solid var(--accent-border)' : '1px solid var(--border)',
                        background: on ? 'var(--accent-bg)' : 'transparent',
                        color: on ? 'var(--accent)' : 'var(--muted)',
                      }}>{n.label}</button>
                  )
                })}
              </div>
              <input
                type="text"
                value={customNiche}
                onChange={e => { setCustomNiche(e.target.value); setSelectedNiche('') }}
                placeholder="Or type your own: e.g. Stand-up comedy, Chess, Mountain biking..."
                style={{
                  width: '100%', background: 'var(--surface2)', border: '1px solid var(--border)',
                  borderRadius: 8, padding: '10px 14px', fontSize: 13, color: 'var(--text)', outline: 'none',
                }}
              />
            </div>

            {/* Focus */}
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--dim)', textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: 8 }}>
                Research focus <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0, color: 'var(--dim)', fontSize: 10 }}>(optional)</span>
              </label>
              <input
                type="text"
                value={focus}
                onChange={e => setFocus(e.target.value)}
                placeholder="e.g. Focus on Reels under 60s, trending sounds, hooks used in the last 30 days..."
                style={{
                  width: '100%', background: 'var(--surface2)', border: '1px solid var(--border)',
                  borderRadius: 8, padding: '10px 14px', fontSize: 13, color: 'var(--text)', outline: 'none',
                }}
              />
            </div>

            {error && (
              <div style={{
                background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)',
                borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#ef4444',
              }}>{error}</div>
            )}

            <button onClick={startResearch}
              style={{
                width: '100%', padding: 14, borderRadius: 10, border: 'none',
                background: 'var(--accent)', color: '#000', fontSize: 14, fontWeight: 800,
                cursor: 'pointer', letterSpacing: '0.01em',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              }}>
              <span>Deploy Trend Agents</span>
              <span>↗</span>
            </button>
          </div>

          {/* Stats */}
          <div style={{ display: 'flex', gap: '2rem', marginTop: '2rem', justifyContent: 'center' }}>
            {[['5 Platforms', 'scouted simultaneously'], ['Real-time', 'live web data'], ['AI Synthesis', 'Claude-powered insights']].map(([title, sub]) => (
              <div key={title} style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{title}</div>
                <div style={{ fontSize: 11, color: 'var(--dim)', marginTop: 2 }}>{sub}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  // ─── RUNNING VIEW ─────────────────────────────────────────────────────────
  if (view === 'running') {
    const doneCount = selectedPlatforms.filter(p => ['done', 'error'].includes(results[p]?.status || '')).length
    const progress = Math.round((doneCount / selectedPlatforms.length) * 100)

    return (
      <div style={{ minHeight: '100vh', maxWidth: 680, margin: '0 auto', padding: '3rem 1.5rem' }}>
        <div style={{ marginBottom: '2rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
            <Spinner />
            <span style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              Agents running
            </span>
          </div>
          <h2 style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.02em', marginBottom: 4 }}>
            Researching: {currentNiche}
          </h2>
          <p style={{ fontSize: 13, color: 'var(--muted)' }}>
            {doneCount} of {selectedPlatforms.length} agents complete
          </p>
          {/* Progress bar */}
          <div style={{ height: 3, background: 'var(--border)', borderRadius: 2, marginTop: 16 }}>
            <div style={{
              height: 3, background: 'var(--accent)', borderRadius: 2,
              width: `${progress}%`, transition: 'width 0.5s ease',
            }} />
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {selectedPlatforms.map(platform => {
            const agent = results[platform] || { status: 'idle', steps: [] }
            const platInfo = PLATFORMS.find(p => p.id === platform)!
            return (
              <div key={platform}
                style={{
                  background: 'var(--surface)', borderRadius: 12,
                  border: `1px solid ${agent.status === 'running' ? 'var(--accent-border)' : agent.status === 'done' ? 'rgba(34,197,94,0.3)' : agent.status === 'error' ? 'rgba(239,68,68,0.3)' : 'var(--border)'}`,
                  padding: '1rem 1.25rem',
                  transition: 'border-color 0.3s',
                }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{
                    width: 38, height: 38, borderRadius: 10, background: 'var(--surface2)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 16, border: '1px solid var(--border)', flexShrink: 0,
                  }}>{platInfo.icon}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{platform}</div>
                    <div style={{ fontSize: 11, color: 'var(--dim)', marginTop: 1, fontFamily: 'monospace' }}>
                      {agent.status === 'running' ? (agent.steps[agent.steps.length - 1] || 'Initializing...') :
                       agent.status === 'done' ? '✓ Research complete' :
                       agent.status === 'error' ? `✗ ${agent.error}` : 'Queued'}
                    </div>
                  </div>
                  {agent.status === 'running' ? <Spinner /> : <StatusBadge status={agent.status} />}
                </div>
                {agent.status === 'running' && agent.steps.length > 1 && (
                  <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--border)' }}>
                    {agent.steps.slice(-3).map((step, i) => (
                      <div key={i} style={{ fontSize: 11, color: 'var(--dim)', marginBottom: 3, display: 'flex', gap: 6 }}>
                        <span style={{ color: 'var(--accent)', flexShrink: 0 }}>›</span>
                        <span>{step}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  // ─── RESULTS VIEW ─────────────────────────────────────────────────────────
  const tabs = [
    { id: 'synthesis', label: '✦ Intelligence Brief' },
    ...selectedPlatforms.map(p => ({ id: p, label: PLATFORMS.find(x => x.id === p)!.icon + ' ' + p }))
  ]

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Top bar */}
      <div style={{
        borderBottom: '1px solid var(--border)', padding: '0 2rem',
        display: 'flex', alignItems: 'center', gap: 16, height: 52,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginRight: 8 }}>
          <div style={{ width: 24, height: 24, borderRadius: 6, background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12 }}>⚡</div>
          <span style={{ fontWeight: 700, fontSize: 14 }}>ViralFinder</span>
        </div>
        <div style={{ width: 1, height: 20, background: 'var(--border)' }} />
        <span style={{ fontSize: 13, color: 'var(--muted)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {currentNiche}
        </span>
        <div style={{ display: 'flex', gap: 6 }}>
          <span style={{ fontSize: 11, color: 'var(--dim)' }}>
            {successPlatforms.length}/{selectedPlatforms.length} scraped
          </span>
        </div>
        <button onClick={() => { setView('setup'); setResults({}) }}
          style={{
            background: 'transparent', border: '1px solid var(--border)', borderRadius: 7,
            padding: '5px 12px', fontSize: 12, color: 'var(--muted)', cursor: 'pointer',
          }}>← New Research</button>
      </div>

      {/* Tab bar */}
      <div style={{
        borderBottom: '1px solid var(--border)', padding: '0 2rem',
        display: 'flex', gap: 2, overflowX: 'auto',
      }}>
        {tabs.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            style={{
              padding: '12px 16px', fontSize: 12, fontWeight: 500,
              background: 'transparent', border: 'none', cursor: 'pointer',
              color: activeTab === tab.id ? 'var(--accent)' : 'var(--muted)',
              borderBottom: activeTab === tab.id ? '2px solid var(--accent)' : '2px solid transparent',
              marginBottom: -1, whiteSpace: 'nowrap', transition: 'all 0.15s',
            }}>{tab.label}</button>
        ))}
      </div>

      {/* Content */}
      <div style={{ flex: 1, maxWidth: 860, margin: '0 auto', width: '100%', padding: '2rem 1.5rem' }}>

        {/* SYNTHESIS TAB */}
        {activeTab === 'synthesis' && (
          <div style={{ animation: 'fadeIn 0.3s ease' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '1.5rem', gap: '1rem' }}>
              <div>
                <h2 style={{ fontSize: 20, fontWeight: 700, letterSpacing: '-0.02em', marginBottom: 4 }}>
                  Intelligence Brief
                </h2>
                <p style={{ fontSize: 13, color: 'var(--muted)' }}>
                  Claude-synthesized insights from {successPlatforms.length} platform{successPlatforms.length !== 1 ? 's' : ''}
                </p>
              </div>
              {!synthesis && !synthLoading && successPlatforms.length > 0 && (
                <button onClick={() => synthesize(currentNiche, selectedPlatforms, results)}
                  style={{
                    padding: '8px 16px', borderRadius: 8, border: '1px solid var(--accent-border)',
                    background: 'var(--accent-bg)', color: 'var(--accent)', fontSize: 12,
                    fontWeight: 600, cursor: 'pointer', flexShrink: 0,
                  }}>Generate Brief</button>
              )}
            </div>

            {synthLoading && (
              <div style={{
                background: 'var(--surface)', border: '1px solid var(--border)',
                borderRadius: 12, padding: '2rem',
                display: 'flex', alignItems: 'center', gap: 12,
              }}>
                <Spinner />
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>Claude is synthesizing...</div>
                  <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>Analyzing cross-platform patterns and generating your brief</div>
                </div>
              </div>
            )}

            {synthesis && (
              <div style={{
                background: 'var(--surface)', border: '1px solid var(--border)',
                borderRadius: 12, padding: '1.5rem',
              }}>
                <SynthesisRenderer text={synthesis} />
              </div>
            )}

            {!synthesis && !synthLoading && successPlatforms.length === 0 && (
              <div style={{
                background: 'var(--surface)', border: '1px solid rgba(239,68,68,0.2)',
                borderRadius: 12, padding: '1.5rem', color: '#ef4444', fontSize: 13,
              }}>
                All agents failed. Check your API key and try again.
              </div>
            )}
          </div>
        )}

        {/* PLATFORM TABS */}
        {selectedPlatforms.includes(activeTab as Platform) && (
          <div style={{ animation: 'fadeIn 0.3s ease' }}>
            <div style={{ marginBottom: '1.5rem' }}>
              <h2 style={{ fontSize: 20, fontWeight: 700, letterSpacing: '-0.02em', marginBottom: 4 }}>
                {PLATFORMS.find(p => p.id === activeTab)?.icon} {activeTab} — Raw Findings
              </h2>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <StatusBadge status={results[activeTab]?.status || 'idle'} />
                {results[activeTab]?.status === 'running' && (
                  <span style={{ fontSize: 12, color: 'var(--muted)' }}>
                    {results[activeTab]?.steps?.slice(-1)[0] || 'Working...'}
                  </span>
                )}
              </div>
            </div>

            {results[activeTab]?.status === 'error' && (
              <div style={{
                background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)',
                borderRadius: 12, padding: '1rem 1.25rem', color: '#ef4444', fontSize: 13,
              }}>
                Agent failed: {results[activeTab]?.error}
              </div>
            )}

            {results[activeTab]?.status === 'running' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {results[activeTab]?.steps?.map((step, i) => (
                  <div key={i} style={{
                    background: 'var(--surface)', border: '1px solid var(--border)',
                    borderRadius: 8, padding: '8px 12px', fontSize: 12, color: 'var(--muted)',
                    display: 'flex', gap: 8, alignItems: 'center',
                  }}>
                    {i === (results[activeTab]?.steps?.length || 0) - 1 ? <Spinner /> : <span style={{ color: 'var(--green)' }}>✓</span>}
                    {step}
                  </div>
                ))}
              </div>
            )}

            {results[activeTab]?.status === 'done' && (
              <div style={{
                background: 'var(--surface)', border: '1px solid var(--border)',
                borderRadius: 12, padding: '1.5rem',
              }}>
                <pre style={{
                  fontSize: 13, lineHeight: 1.7, color: 'var(--muted)',
                  whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontFamily: 'inherit',
                }}>
                  {resultText(activeTab)}
                </pre>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Synthesis renderer ───────────────────────────────────────────────────────

function SynthesisRenderer({ text }: { text: string }) {
  const sections = text.split(/\n(?=\*\*[A-Z])/)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {sections.map((section, i) => {
        const lines = section.trim().split('\n')
        const heading = lines[0]?.replace(/\*\*/g, '').trim()
        const body = lines.slice(1).join('\n').trim()

        if (!heading) return null

        return (
          <div key={i}>
            <div style={{
              fontSize: 11, fontWeight: 700, letterSpacing: '0.08em',
              textTransform: 'uppercase', color: 'var(--accent)',
              marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8,
            }}>
              <div style={{ width: 3, height: 14, background: 'var(--accent)', borderRadius: 2 }} />
              {heading}
            </div>
            <div style={{ paddingLeft: 11 }}>
              <FormattedText text={body} />
            </div>
            {i < sections.length - 1 && (
              <div style={{ height: 1, background: 'var(--border)', marginTop: '1.5rem' }} />
            )}
          </div>
        )
      })}
    </div>
  )
}

function FormattedText({ text }: { text: string }) {
  const lines = text.split('\n').filter(l => l.trim())
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {lines.map((line, i) => {
        const isBullet = line.trim().startsWith('- ') || line.trim().startsWith('• ') || line.trim().match(/^\d+\. /)
        const content = line.replace(/^[-•]\s*/, '').replace(/^\d+\.\s*/, '').replace(/\*\*([^*]+)\*\*/g, '$1')
        const isScore = content.match(/^(.+?)[\s:]+(\d+)\/10\s*(.*)$/)

        if (isScore) {
          const [, label, score, rest] = isScore
          const pct = (parseInt(score) / 10) * 100
          return (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
              <div style={{ fontSize: 12, color: 'var(--muted)', width: 180, flexShrink: 0 }}>{label.trim()}</div>
              <div style={{ flex: 1, height: 4, background: 'var(--border)', borderRadius: 2 }}>
                <div style={{ height: 4, background: 'var(--accent)', borderRadius: 2, width: `${pct}%`, transition: 'width 1s ease' }} />
              </div>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text)', width: 32 }}>{score}/10</div>
              {rest && <div style={{ fontSize: 11, color: 'var(--dim)' }}>{rest}</div>}
            </div>
          )
        }

        if (isBullet) {
          return (
            <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
              <div style={{ width: 4, height: 4, borderRadius: '50%', background: 'var(--accent)', marginTop: 7, flexShrink: 0 }} />
              <div style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.6 }}>{content}</div>
            </div>
          )
        }

        return (
          <p key={i} style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.7 }}>{content}</p>
        )
      })}
    </div>
  )
}
