'use client';
import { useState, useEffect, useRef, useCallback } from 'react';

const NICHES = [
  { label: 'F1 Racing', value: 'F1 Formula One racing' },
  { label: 'Finance', value: 'personal finance investing stocks' },
  { label: 'Gaming', value: 'gaming esports' },
  { label: 'Fitness', value: 'fitness gym workout' },
  { label: 'AI & Tech', value: 'AI tools technology reviews' },
  { label: 'Travel', value: 'travel lifestyle vlog' },
  { label: 'Beauty', value: 'beauty skincare makeup' },
  { label: 'Food', value: 'food cooking recipes' },
  { label: 'Crypto', value: 'crypto bitcoin web3' },
  { label: 'Fashion', value: 'fashion streetwear style' },
  { label: 'Real Estate', value: 'real estate investing property' },
  { label: 'Comedy', value: 'comedy sketches funny videos' },
];

const PLATFORMS = [
  { id: 'Instagram', icon: '📸' },
  { id: 'YouTube', icon: '▶' },
  { id: 'TikTok', icon: '♪' },
  { id: 'X / Twitter', icon: '𝕏' },
  { id: 'LinkedIn', icon: 'in' },
];

const INITIAL_PLATFORMS = ['Instagram', 'YouTube', 'TikTok'];

export default function ViralFinder() {
  const [screen, setScreen] = useState('setup'); // setup | running | results
  const [selectedPlatforms, setSelectedPlatforms] = useState(INITIAL_PLATFORMS);
  const [selectedNiche, setSelectedNiche] = useState('');
  const [customNiche, setCustomNiche] = useState('');
  const [tfKey, setTfKey] = useState('');
  const [agentStatuses, setAgentStatuses] = useState({});
  const [results, setResults] = useState({});
  const [synthesis, setSynthesis] = useState(null);
  const [synthesizing, setSynthesizing] = useState(false);
  const [activeTab, setActiveTab] = useState('synthesis');
  const [currentNiche, setCurrentNiche] = useState('');
  const [setupError, setSetupError] = useState('');
  const [synthError, setSynthError] = useState('');
  const abortRef = useRef({});

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('vf_tf_key');
      if (saved) setTfKey(saved);
    }
  }, []);

  const togglePlatform = (p) => {
    setSelectedPlatforms(prev =>
      prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p]
    );
  };

  const niche = selectedNiche || customNiche.trim();

  const updateAgentStatus = useCallback((platform, update) => {
    setAgentStatuses(prev => ({
      ...prev,
      [platform]: { ...(prev[platform] || {}), ...update }
    }));
  }, []);

  const runAgent = useCallback(async (platform, niche, apiKey) => {
    updateAgentStatus(platform, { status: 'running', steps: [], result: null, error: null });

    const controller = new AbortController();
    abortRef.current[platform] = controller;

    try {
      const res = await fetch('/api/research', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ platform, niche, tfApiKey: apiKey }),
        signal: controller.signal,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Server error ' + res.status);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split('\n');
        buf = lines.pop();

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const raw = line.slice(6).trim();
          if (!raw) continue;
          try {
            const evt = JSON.parse(raw);
            if (evt.type === 'PROGRESS' && evt.purpose) {
              updateAgentStatus(platform, { latestStep: evt.purpose });
              setAgentStatuses(prev => ({
                ...prev,
                [platform]: {
                  ...prev[platform],
                  steps: [...(prev[platform]?.steps || []).slice(-4), evt.purpose],
                  latestStep: evt.purpose,
                }
              }));
            } else if (evt.type === 'COMPLETE') {
              const resultData = typeof evt.result === 'string' ? evt.result : JSON.stringify(evt.result, null, 2);
              updateAgentStatus(platform, { status: 'done', result: evt.result });
              setResults(prev => ({ ...prev, [platform]: { ok: true, data: evt.result, text: resultData } }));
              return { ok: true, data: evt.result };
            } else if (evt.type === 'ERROR') {
              throw new Error(evt.message || 'Agent error');
            }
          } catch (e) {
            if (e.name === 'AbortError') throw e;
            if (!e.message?.includes('JSON')) throw e;
          }
        }
      }
    } catch (err) {
      if (err.name === 'AbortError') {
        updateAgentStatus(platform, { status: 'error', error: 'Cancelled' });
        return { ok: false, error: 'Cancelled' };
      }
      updateAgentStatus(platform, { status: 'error', error: err.message });
      setResults(prev => ({ ...prev, [platform]: { ok: false, error: err.message } }));
      return { ok: false, error: err.message };
    }
  }, [updateAgentStatus]);

  const runSynthesis = useCallback(async (niche, platforms, results) => {
    setSynthesizing(true);
    setSynthError('');
    try {
      const res = await fetch('/api/synthesize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ niche, platforms, results }),
      });
      const data = await res.json();
      if (data.ok && data.synthesis) {
        setSynthesis(data.synthesis);
        setActiveTab('synthesis');
      } else {
        setSynthError(data.error || 'Synthesis failed');
        setActiveTab(platforms[0]);
      }
    } catch (err) {
      setSynthError(err.message);
      setActiveTab(platforms[0]);
    } finally {
      setSynthesizing(false);
    }
  }, []);

  const startResearch = async () => {
    setSetupError('');
    if (!tfKey.trim()) { setSetupError('Enter your TinyFish API key.'); return; }
    if (!niche) { setSetupError('Select or type a niche.'); return; }
    if (!selectedPlatforms.length) { setSetupError('Select at least one platform.'); return; }

    localStorage.setItem('vf_tf_key', tfKey.trim());

    setCurrentNiche(niche);
    setAgentStatuses({});
    setResults({});
    setSynthesis(null);
    setSynthError('');
    setScreen('running');

    const initialStatuses = {};
    selectedPlatforms.forEach(p => { initialStatuses[p] = { status: 'pending', steps: [], latestStep: '' }; });
    setAgentStatuses(initialStatuses);

    // Run all agents in parallel
    const platformResults = {};
    await Promise.all(
      selectedPlatforms.map(async (platform) => {
        const r = await runAgent(platform, niche, tfKey.trim());
        platformResults[platform] = r;
      })
    );

    setScreen('results');

    // Run Claude synthesis
    const successResults = {};
    selectedPlatforms.forEach(p => {
      if (platformResults[p]?.ok) successResults[p] = { ok: true, data: platformResults[p].data };
    });

    if (Object.keys(successResults).length > 0) {
      await runSynthesis(niche, selectedPlatforms, successResults);
    } else {
      setActiveTab(selectedPlatforms[0]);
    }
  };

  const reset = () => {
    setScreen('setup');
    setResults({});
    setSynthesis(null);
    setAgentStatuses({});
    setSynthError('');
  };

  if (screen === 'setup') return <Setup
    tfKey={tfKey} setTfKey={setTfKey}
    selectedPlatforms={selectedPlatforms} togglePlatform={togglePlatform}
    selectedNiche={selectedNiche} setSelectedNiche={setSelectedNiche}
    customNiche={customNiche} setCustomNiche={setCustomNiche}
    onStart={startResearch} error={setupError}
  />;

  if (screen === 'running') return <Running
    platforms={selectedPlatforms} niche={currentNiche}
    agentStatuses={agentStatuses}
  />;

  return <Results
    niche={currentNiche} platforms={selectedPlatforms}
    results={results} synthesis={synthesis}
    synthesizing={synthesizing} synthError={synthError}
    activeTab={activeTab} setActiveTab={setActiveTab}
    onReset={reset}
  />;
}

/* ─── SETUP SCREEN ─── */
function Setup({ tfKey, setTfKey, selectedPlatforms, togglePlatform, selectedNiche, setSelectedNiche, customNiche, setCustomNiche, onStart, error }) {
  return (
    <div style={s.page}>
      <style>{globalCSS}</style>
      <div style={s.setupWrap}>
        <div style={s.setupLeft}>
          <div style={s.heroTag}>TinyFish Accelerator</div>
          <h1 style={s.heroTitle}>ViralFinder</h1>
          <p style={s.heroSub}>Real browser agents navigate Instagram, YouTube & TikTok live — extracting what's actually going viral in your niche right now.</p>
          <div style={s.pills}>
            <span style={s.pill}>Live web scraping</span>
            <span style={s.pill}>Parallel agents</span>
            <span style={s.pill}>AI synthesis</span>
            <span style={s.pill}>Zero cache</span>
          </div>
          <div style={s.statsRow}>
            <div style={s.stat}><div style={s.statNum}>60k</div><div style={s.statLabel}>Credits</div></div>
            <div style={s.statDiv}/>
            <div style={s.stat}><div style={s.statNum}>5</div><div style={s.statLabel}>Platforms</div></div>
            <div style={s.statDiv}/>
            <div style={s.stat}><div style={s.statNum}>∞</div><div style={s.statLabel}>Niches</div></div>
          </div>
        </div>

        <div style={s.setupCard}>
          <div style={s.fieldGroup}>
            <label style={s.fieldLabel}>TinyFish API Key</label>
            <input
              type="password"
              value={tfKey}
              onChange={e => setTfKey(e.target.value)}
              placeholder="tf_live_xxxxxxxxxxxx"
              style={s.input}
            />
            <div style={s.fieldHint}>
              <a href="https://agent.tinyfish.ai/api-keys" target="_blank" rel="noreferrer" style={s.link}>Get your key →</a>
              <span style={{ color: '#555' }}> · Saved locally, never transmitted</span>
            </div>
          </div>

          <div style={s.fieldGroup}>
            <label style={s.fieldLabel}>Platforms</label>
            <div style={s.platformGrid}>
              {PLATFORMS.map(p => (
                <button
                  key={p.id}
                  onClick={() => togglePlatform(p.id)}
                  style={{ ...s.platformBtn, ...(selectedPlatforms.includes(p.id) ? s.platformBtnOn : {}) }}
                >
                  <span style={s.pIcon}>{p.icon}</span>
                  <span>{p.id}</span>
                  <span style={{ ...s.check, ...(selectedPlatforms.includes(p.id) ? s.checkOn : {}) }}>✓</span>
                </button>
              ))}
            </div>
          </div>

          <div style={s.fieldGroup}>
            <label style={s.fieldLabel}>Creator Niche</label>
            <div style={s.nicheGrid}>
              {NICHES.map(n => (
                <button
                  key={n.value}
                  onClick={() => { setSelectedNiche(n.value === selectedNiche ? '' : n.value); setCustomNiche(''); }}
                  style={{ ...s.nicheBtn, ...(selectedNiche === n.value ? s.nicheBtnOn : {}) }}
                >
                  {n.label}
                </button>
              ))}
            </div>
            <input
              type="text"
              value={customNiche}
              onChange={e => { setCustomNiche(e.target.value); setSelectedNiche(''); }}
              placeholder="Or type your own: Stand-up comedy, Chess, Real estate..."
              style={{ ...s.input, marginTop: '8px' }}
            />
          </div>

          {error && <div style={s.errorBar}>{error}</div>}

          <button onClick={onStart} style={s.runBtn}>
            Deploy Agents ↗
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── RUNNING SCREEN ─── */
function Running({ platforms, niche, agentStatuses }) {
  const done = platforms.filter(p => ['done','error'].includes(agentStatuses[p]?.status)).length;
  return (
    <div style={s.page}>
      <style>{globalCSS}</style>
      <div style={s.runningWrap}>
        <div style={s.runningHeader}>
          <div style={s.runningTag}><span style={s.liveDot}/> Agents running</div>
          <h2 style={s.runningTitle}>{niche}</h2>
          <div style={s.progressLine}>
            <div style={{ ...s.progressFill, width: `${platforms.length ? (done/platforms.length)*100 : 0}%` }} />
          </div>
          <div style={s.runningCount}>{done} of {platforms.length} platforms complete</div>
        </div>

        <div style={s.agentsGrid}>
          {platforms.map(p => {
            const st = agentStatuses[p] || {};
            return (
              <div key={p} style={{ ...s.agentCard, ...(st.status === 'running' ? s.agentCardRunning : st.status === 'done' ? s.agentCardDone : st.status === 'error' ? s.agentCardError : {}) }}>
                <div style={s.agentTop}>
                  <div style={s.agentIcon}>{PLATFORMS.find(x=>x.id===p)?.icon || '🌐'}</div>
                  <div style={s.agentMeta}>
                    <div style={s.agentName}>{p}</div>
                    <div style={s.agentStatusText}>
                      {st.status === 'pending' && 'Queued'}
                      {st.status === 'running' && 'Browser agent active'}
                      {st.status === 'done' && '✓ Complete'}
                      {st.status === 'error' && '✗ Failed'}
                    </div>
                  </div>
                  <div style={{ ...s.agentBadge, ...(st.status === 'running' ? s.badgeRunning : st.status === 'done' ? s.badgeDone : st.status === 'error' ? s.badgeError : s.badgePending) }}>
                    {st.status || 'pending'}
                  </div>
                </div>
                {st.status === 'running' && st.steps?.length > 0 && (
                  <div style={s.stepsBox}>
                    {st.steps.slice(-3).map((step, i, arr) => (
                      <div key={i} style={{ ...s.stepRow, opacity: i < arr.length - 1 ? 0.45 : 1 }}>
                        {i === arr.length - 1 ? <span style={s.spinner}/> : <span style={s.stepDotDone}/>}
                        <span>{step}</span>
                      </div>
                    ))}
                  </div>
                )}
                {st.status === 'error' && (
                  <div style={s.errorStep}>{st.error}</div>
                )}
              </div>
            );
          })}
        </div>

        <div style={s.waitNote}>Stealth browser agents are navigating live social platforms — this takes 1–2 minutes per platform</div>
      </div>
    </div>
  );
}

/* ─── RESULTS SCREEN ─── */
function Results({ niche, platforms, results, synthesis, synthesizing, synthError, activeTab, setActiveTab, onReset }) {
  const ok = platforms.filter(p => results[p]?.ok);
  const tabs = ['synthesis', ...platforms];

  return (
    <div style={s.page}>
      <style>{globalCSS}</style>
      <div style={s.resultsWrap}>
        {/* Header */}
        <div style={s.resultsHeader}>
          <div>
            <div style={s.resultsTag}>Research complete</div>
            <h2 style={s.resultsTitle}>{niche}</h2>
            <div style={s.resultsStats}>
              <span style={s.resStat}>{ok.length} platforms scraped</span>
              {synthesizing && <span style={s.resStat}><span style={s.spinnerSm}/> AI synthesizing...</span>}
              {synthesis && <span style={{ ...s.resStat, color: '#22c55e' }}>✓ AI brief ready</span>}
            </div>
          </div>
          <button onClick={onReset} style={s.resetBtn}>← New research</button>
        </div>

        {/* Tabs */}
        <div style={s.tabs}>
          {tabs.map(t => (
            <button key={t} onClick={() => setActiveTab(t)} style={{ ...s.tab, ...(activeTab === t ? s.tabActive : {}) }}>
              {t === 'synthesis' ? '✦ AI Brief' : (PLATFORMS.find(p=>p.id===t)?.icon + ' ' + t)}
            </button>
          ))}
        </div>

        {/* Synthesis tab */}
        {activeTab === 'synthesis' && (
          synthesizing ? (
            <div style={s.synthLoading}>
              <div style={s.synthSpinner}/>
              <div style={s.synthLoadingText}>Claude is analyzing all platform data...</div>
              <div style={s.synthLoadingSub}>Generating your personalized strategy brief</div>
            </div>
          ) : synthesis ? (
            <SynthesisView synthesis={synthesis} niche={niche} />
          ) : synthError ? (
            <div style={s.errCard}>Synthesis error: {synthError}</div>
          ) : (
            <div style={s.synthLoading}><div style={s.synthLoadingText}>Waiting for agents to finish...</div></div>
          )
        )}

        {/* Platform tabs */}
        {activeTab !== 'synthesis' && (
          <PlatformView platform={activeTab} result={results[activeTab]} />
        )}
      </div>
    </div>
  );
}

/* ─── SYNTHESIS VIEW ─── */
function SynthesisView({ synthesis: s2, niche }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Verdict */}
      <div style={s.verdictCard}>
        <div style={s.verdictLabel}>AI Verdict</div>
        <div style={s.verdictText}>{s2.verdict}</div>
        {s2.opportunityScore && (
          <div style={s.oppScore}>
            <div style={s.oppLabel}>Opportunity score</div>
            <div style={s.oppBar}>
              <div style={{ ...s.oppFill, width: `${s2.opportunityScore}%` }} />
            </div>
            <div style={s.oppNum}>{s2.opportunityScore}/100</div>
          </div>
        )}
      </div>

      {/* Top formats + virality factors row */}
      <div style={s.twoCol}>
        {/* Top formats */}
        <div style={s.infoCard}>
          <div style={s.cardTitle}>Top performing formats</div>
          {s2.topFormats?.map((f, i) => (
            <div key={i} style={s.formatRow}>
              <div style={s.formatName}>{f.name}</div>
              <div style={s.formatPlatforms}>{f.platforms?.join(' · ')}</div>
              <div style={s.barWrap}>
                <div style={{ ...s.barFill, width: `${f.score}%` }} />
              </div>
              <div style={s.barScore}>{f.score}</div>
              <div style={s.formatWhy}>{f.why}</div>
            </div>
          ))}
        </div>

        {/* Virality factors */}
        <div style={s.infoCard}>
          <div style={s.cardTitle}>Virality factors for this niche</div>
          {s2.viralityFactors?.map((vf, i) => (
            <div key={i} style={s.vfRow}>
              <div style={s.vfLabel}>{vf.factor}</div>
              <div style={s.vfTrack}><div style={{ ...s.vfFill, width: `${(vf.score/10)*100}%` }} /></div>
              <div style={s.vfScore}>{vf.score}/10</div>
              {vf.note && <div style={s.vfNote}>{vf.note}</div>}
            </div>
          ))}
        </div>
      </div>

      {/* Viral hooks */}
      <div style={s.infoCard}>
        <div style={s.cardTitle}>Proven hook templates</div>
        <div style={s.hooksGrid}>
          {s2.viralHooks?.map((h, i) => (
            <div key={i} style={s.hookChip} onClick={() => navigator.clipboard?.writeText(h)} title="Click to copy">
              <span style={s.hookNum}>{i+1}</span>
              <span style={s.hookText}>{h}</span>
              <span style={s.hookCopy}>copy</span>
            </div>
          ))}
        </div>
      </div>

      {/* Quick wins */}
      <div style={s.infoCard}>
        <div style={s.cardTitle}>3 quick win content ideas — make these first</div>
        <div style={s.quickGrid}>
          {s2.quickWins?.map((q, i) => (
            <div key={i} style={s.quickCard}>
              <div style={s.quickNum}>0{i+1}</div>
              <div style={s.quickTitle}>{q.title}</div>
              <div style={s.quickAngle}>{q.angle}</div>
              <div style={s.quickMeta}>
                <span style={s.quickTag}>{q.format}</span>
                <span style={s.quickTag}>{q.platform}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Posting strategy + trending topics */}
      <div style={s.twoCol}>
        <div style={s.infoCard}>
          <div style={s.cardTitle}>Posting strategy</div>
          {s2.postingStrategy && Object.entries(s2.postingStrategy).map(([k, v]) => (
            <div key={k} style={s.stratRow}>
              <div style={s.stratKey}>{k.replace(/([A-Z])/g, ' $1').toLowerCase()}</div>
              <div style={s.stratVal}>{v}</div>
            </div>
          ))}
        </div>

        <div style={s.infoCard}>
          <div style={s.cardTitle}>Trending topics right now</div>
          {s2.trendingTopics?.map((t, i) => (
            <div key={i} style={s.trendRow}>
              <span style={s.trendHash}>#</span>
              <span style={s.trendText}>{t}</span>
            </div>
          ))}
          {s2.topCreators?.length > 0 && (
            <>
              <div style={{ ...s.cardTitle, marginTop: '16px' }}>Study these creators</div>
              {s2.topCreators.map((c, i) => (
                <div key={i} style={s.creatorRow}><span style={s.creatorAt}>→</span> {c}</div>
              ))}
            </>
          )}
        </div>
      </div>

      {/* Avoid */}
      <div style={s.avoidCard}>
        <div style={s.cardTitle}>⚠ What NOT to do</div>
        <div style={s.avoidGrid}>
          {s2.avoid?.map((a, i) => (
            <div key={i} style={s.avoidItem}>
              <span style={s.avoidX}>✗</span>
              <span>{a}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ─── PLATFORM RAW VIEW ─── */
function PlatformView({ platform, result }) {
  if (!result) return <div style={s.errCard}>No data for {platform}.</div>;
  if (!result.ok) return <div style={s.errCard}>Agent failed: {result.error}</div>;

  const text = result.text || (typeof result.data === 'string' ? result.data : JSON.stringify(result.data, null, 2));

  return (
    <div style={s.infoCard}>
      <div style={s.cardTitle}>{platform} — Live research findings</div>
      <pre style={s.rawText}>{text}</pre>
    </div>
  );
}

/* ─── STYLES ─── */
const ACC = '#d4ff47';
const ACC_BG = 'rgba(212,255,71,0.08)';
const BG = '#0a0a0a';
const SURF = '#131313';
const SURF2 = '#1a1a1a';
const BOR = '#262626';
const BOR2 = '#333';
const TEXT = '#efefef';
const MUTED = '#888';
const DIM = '#555';
const GREEN = '#22c55e';
const RED = '#ef4444';
const R = '10px';
const RSM = '7px';

const s = {
  page: { minHeight: '100vh', background: BG, color: TEXT, fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" },

  // Setup
  setupWrap: { display: 'flex', gap: '48px', minHeight: '100vh', padding: '48px 5%', alignItems: 'flex-start', maxWidth: '1100px', margin: '0 auto' },
  setupLeft: { flex: '0 0 340px', paddingTop: '12px', position: 'sticky', top: '48px' },
  heroTag: { fontSize: '11px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: ACC, marginBottom: '16px', padding: '4px 10px', background: ACC_BG, display: 'inline-block', borderRadius: RSM },
  heroTitle: { fontSize: '52px', fontWeight: 800, letterSpacing: '-0.03em', marginBottom: '16px', lineHeight: 1 },
  heroSub: { fontSize: '15px', color: MUTED, lineHeight: 1.6, marginBottom: '24px' },
  pills: { display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '32px' },
  pill: { fontSize: '11px', padding: '4px 10px', border: `1px solid ${BOR2}`, borderRadius: '20px', color: MUTED },
  statsRow: { display: 'flex', alignItems: 'center', gap: '24px' },
  stat: { textAlign: 'center' },
  statNum: { fontSize: '24px', fontWeight: 700, color: TEXT },
  statLabel: { fontSize: '11px', color: DIM, marginTop: '2px' },
  statDiv: { width: '1px', height: '32px', background: BOR },

  setupCard: { flex: 1, display: 'flex', flexDirection: 'column', gap: '20px', background: SURF, border: `1px solid ${BOR}`, borderRadius: R, padding: '28px' },
  fieldGroup: { display: 'flex', flexDirection: 'column', gap: '0px' },
  fieldLabel: { fontSize: '11px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: DIM, marginBottom: '8px' },
  fieldHint: { fontSize: '11px', marginTop: '6px' },
  link: { color: MUTED, textDecoration: 'none' },
  input: { width: '100%', background: SURF2, border: `1px solid ${BOR}`, borderRadius: RSM, padding: '10px 14px', fontSize: '13px', color: TEXT, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' },
  platformGrid: { display: 'flex', flexDirection: 'column', gap: '6px' },
  platformBtn: { display: 'flex', alignItems: 'center', gap: '10px', padding: '9px 12px', borderRadius: RSM, border: `1px solid ${BOR}`, background: 'transparent', color: MUTED, fontSize: '13px', fontWeight: 500, cursor: 'pointer', textAlign: 'left', width: '100%' },
  platformBtnOn: { borderColor: BOR2, background: SURF2, color: TEXT },
  pIcon: { fontSize: '14px', width: '22px' },
  check: { marginLeft: 'auto', width: '16px', height: '16px', borderRadius: '4px', border: `1px solid ${BOR2}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '9px', color: 'transparent' },
  checkOn: { background: ACC, borderColor: ACC, color: '#000' },
  nicheGrid: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px' },
  nicheBtn: { padding: '7px 10px', borderRadius: RSM, border: `1px solid ${BOR}`, background: 'transparent', fontSize: '12px', color: MUTED, cursor: 'pointer', textAlign: 'center' },
  nicheBtnOn: { borderColor: ACC, color: ACC, background: ACC_BG },
  errorBar: { background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: RSM, padding: '10px 14px', fontSize: '13px', color: RED },
  runBtn: { width: '100%', padding: '13px', borderRadius: RSM, border: 'none', background: ACC, color: '#000', fontSize: '14px', fontWeight: 800, cursor: 'pointer', letterSpacing: '0.01em', marginTop: '4px' },

  // Running
  runningWrap: { maxWidth: '680px', margin: '0 auto', padding: '60px 20px' },
  runningHeader: { textAlign: 'center', marginBottom: '32px' },
  runningTag: { display: 'inline-flex', alignItems: 'center', gap: '7px', fontSize: '12px', color: ACC, fontWeight: 600, marginBottom: '12px' },
  liveDot: { display: 'inline-block', width: '7px', height: '7px', borderRadius: '50%', background: ACC, animation: 'blink 1.2s infinite' },
  runningTitle: { fontSize: '24px', fontWeight: 700, marginBottom: '16px' },
  progressLine: { height: '3px', background: BOR2, borderRadius: '2px', marginBottom: '10px', overflow: 'hidden' },
  progressFill: { height: '100%', background: ACC, borderRadius: '2px', transition: 'width 0.5s ease' },
  runningCount: { fontSize: '13px', color: MUTED },
  agentsGrid: { display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '24px' },
  agentCard: { background: SURF, border: `1px solid ${BOR}`, borderRadius: R, padding: '14px 16px', transition: 'border-color 0.2s' },
  agentCardRunning: { borderColor: 'rgba(212,255,71,0.4)' },
  agentCardDone: { borderColor: 'rgba(34,197,94,0.4)' },
  agentCardError: { borderColor: 'rgba(239,68,68,0.4)' },
  agentTop: { display: 'flex', alignItems: 'center', gap: '12px' },
  agentIcon: { width: '36px', height: '36px', borderRadius: '9px', background: SURF2, border: `1px solid ${BOR}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px', flexShrink: 0 },
  agentMeta: { flex: 1 },
  agentName: { fontSize: '14px', fontWeight: 600 },
  agentStatusText: { fontSize: '12px', color: MUTED, marginTop: '2px' },
  agentBadge: { fontSize: '10px', fontWeight: 700, padding: '3px 9px', borderRadius: '4px', textTransform: 'uppercase', letterSpacing: '0.05em' },
  badgePending: { background: SURF2, color: DIM },
  badgeRunning: { background: ACC_BG, color: ACC },
  badgeDone: { background: 'rgba(34,197,94,0.1)', color: GREEN },
  badgeError: { background: 'rgba(239,68,68,0.1)', color: RED },
  stepsBox: { marginTop: '10px', paddingTop: '10px', borderTop: `1px solid ${BOR}`, display: 'flex', flexDirection: 'column', gap: '5px' },
  stepRow: { display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11px', color: MUTED },
  stepDotDone: { width: '6px', height: '6px', borderRadius: '50%', background: GREEN, flexShrink: 0 },
  errorStep: { marginTop: '8px', fontSize: '12px', color: RED },
  waitNote: { textAlign: 'center', fontSize: '12px', color: DIM, lineHeight: 1.5 },

  // Results
  resultsWrap: { maxWidth: '1000px', margin: '0 auto', padding: '40px 24px 60px' },
  resultsHeader: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px', marginBottom: '24px' },
  resultsTag: { fontSize: '11px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: DIM, marginBottom: '6px' },
  resultsTitle: { fontSize: '28px', fontWeight: 700, letterSpacing: '-0.02em', marginBottom: '8px' },
  resultsStats: { display: 'flex', alignItems: 'center', gap: '12px' },
  resStat: { fontSize: '13px', color: MUTED, display: 'flex', alignItems: 'center', gap: '6px' },
  resetBtn: { background: 'transparent', border: `1px solid ${BOR}`, borderRadius: RSM, padding: '8px 16px', fontSize: '12px', color: MUTED, cursor: 'pointer', flexShrink: 0 },
  tabs: { display: 'flex', gap: '2px', borderBottom: `1px solid ${BOR}`, marginBottom: '24px', overflowX: 'auto' },
  tab: { padding: '9px 16px', fontSize: '13px', fontWeight: 500, color: MUTED, cursor: 'pointer', borderBottom: '2px solid transparent', marginBottom: '-1px', background: 'transparent', border: 'none', borderBottom: '2px solid transparent', whiteSpace: 'nowrap' },
  tabActive: { color: ACC, borderBottomColor: ACC },

  // Synthesis
  synthLoading: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', padding: '80px 0' },
  synthLoadingText: { fontSize: '16px', fontWeight: 500, color: TEXT },
  synthLoadingSub: { fontSize: '13px', color: MUTED },

  verdictCard: { background: 'linear-gradient(135deg, rgba(212,255,71,0.06) 0%, transparent 60%)', border: `1px solid rgba(212,255,71,0.25)`, borderRadius: R, padding: '24px' },
  verdictLabel: { fontSize: '11px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: ACC, marginBottom: '10px' },
  verdictText: { fontSize: '18px', fontWeight: 500, lineHeight: 1.4, marginBottom: '20px' },
  oppScore: { display: 'flex', alignItems: 'center', gap: '12px' },
  oppLabel: { fontSize: '12px', color: MUTED, flexShrink: 0 },
  oppBar: { flex: 1, height: '6px', background: BOR2, borderRadius: '3px', overflow: 'hidden' },
  oppFill: { height: '100%', background: ACC, borderRadius: '3px', transition: 'width 1s ease' },
  oppNum: { fontSize: '13px', fontWeight: 600, color: ACC, flexShrink: 0 },

  twoCol: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' },
  infoCard: { background: SURF, border: `1px solid ${BOR}`, borderRadius: R, padding: '20px' },
  cardTitle: { fontSize: '11px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: DIM, marginBottom: '16px' },

  formatRow: { marginBottom: '14px' },
  formatName: { fontSize: '13px', fontWeight: 600, marginBottom: '2px' },
  formatPlatforms: { fontSize: '11px', color: DIM, marginBottom: '6px' },
  barWrap: { height: '4px', background: BOR2, borderRadius: '2px', overflow: 'hidden', marginBottom: '6px' },
  barFill: { height: '100%', background: ACC, borderRadius: '2px', transition: 'width 1s ease' },
  barScore: { fontSize: '11px', color: MUTED, marginBottom: '4px' },
  formatWhy: { fontSize: '12px', color: MUTED, lineHeight: 1.4 },

  vfRow: { marginBottom: '10px' },
  vfLabel: { fontSize: '12px', color: MUTED, marginBottom: '4px' },
  vfTrack: { height: '4px', background: BOR2, borderRadius: '2px', overflow: 'hidden', marginBottom: '4px' },
  vfFill: { height: '100%', background: ACC, borderRadius: '2px', transition: 'width 1s ease' },
  vfScore: { fontSize: '11px', color: DIM, marginBottom: '2px' },
  vfNote: { fontSize: '11px', color: DIM, fontStyle: 'italic' },

  hooksGrid: { display: 'flex', flexDirection: 'column', gap: '8px' },
  hookChip: { display: 'flex', alignItems: 'flex-start', gap: '10px', background: SURF2, border: `1px solid ${BOR}`, borderRadius: RSM, padding: '10px 12px', cursor: 'pointer' },
  hookNum: { fontSize: '11px', fontWeight: 700, color: ACC, flexShrink: 0, marginTop: '1px' },
  hookText: { fontSize: '13px', lineHeight: 1.4, flex: 1 },
  hookCopy: { fontSize: '10px', color: DIM, flexShrink: 0, marginTop: '2px' },

  quickGrid: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' },
  quickCard: { background: SURF2, border: `1px solid ${BOR}`, borderRadius: RSM, padding: '14px' },
  quickNum: { fontSize: '22px', fontWeight: 800, color: BOR2, marginBottom: '8px' },
  quickTitle: { fontSize: '13px', fontWeight: 600, marginBottom: '6px', lineHeight: 1.3 },
  quickAngle: { fontSize: '12px', color: MUTED, lineHeight: 1.4, marginBottom: '10px' },
  quickMeta: { display: 'flex', gap: '5px', flexWrap: 'wrap' },
  quickTag: { fontSize: '10px', padding: '2px 7px', borderRadius: '4px', background: BOR, color: MUTED },

  stratRow: { display: 'flex', flexDirection: 'column', gap: '2px', marginBottom: '12px' },
  stratKey: { fontSize: '11px', color: DIM, textTransform: 'capitalize' },
  stratVal: { fontSize: '13px', color: TEXT, fontWeight: 500 },

  trendRow: { display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' },
  trendHash: { fontSize: '14px', fontWeight: 700, color: ACC },
  trendText: { fontSize: '13px', color: MUTED },
  creatorRow: { fontSize: '13px', color: MUTED, marginBottom: '7px' },
  creatorAt: { color: ACC },

  avoidCard: { background: 'rgba(239,68,68,0.04)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: R, padding: '20px' },
  avoidGrid: { display: 'flex', flexDirection: 'column', gap: '8px' },
  avoidItem: { display: 'flex', alignItems: 'flex-start', gap: '10px', fontSize: '13px', color: MUTED, lineHeight: 1.4 },
  avoidX: { color: RED, fontWeight: 700, flexShrink: 0 },

  rawText: { fontSize: '12px', lineHeight: 1.7, color: MUTED, whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontFamily: 'monospace', maxHeight: '600px', overflowY: 'auto' },

  errCard: { background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: R, padding: '16px', fontSize: '13px', color: RED },

  spinner: { display: 'inline-block', width: '10px', height: '10px', border: `1.5px solid ${BOR2}`, borderTopColor: ACC, borderRadius: '50%', animation: 'spin 0.7s linear infinite', flexShrink: 0 },
  spinnerSm: { display: 'inline-block', width: '9px', height: '9px', border: `1.5px solid ${BOR2}`, borderTopColor: MUTED, borderRadius: '50%', animation: 'spin 0.7s linear infinite' },
  synthSpinner: { width: '28px', height: '28px', border: `2px solid ${BOR2}`, borderTopColor: ACC, borderRadius: '50%', animation: 'spin 0.8s linear infinite' },
};

const globalCSS = `
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { margin: 0; }
  button { font-family: inherit; }
  input, textarea { font-family: inherit; }
  input:focus, textarea:focus { border-color: #444 !important; outline: none; }
  button:hover { opacity: 0.85; }
  @keyframes spin { to { transform: rotate(360deg); } }
  @keyframes blink { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }
  ::-webkit-scrollbar { width: 4px; height: 4px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: #333; border-radius: 2px; }
  @media (max-width: 800px) {
    .twoCol { grid-template-columns: 1fr !important; }
    .quickGrid { grid-template-columns: 1fr !important; }
    .nicheGrid { grid-template-columns: repeat(2, 1fr) !important; }
    .setupWrap { flex-direction: column !important; padding: 24px !important; }
    .setupLeft { position: static !important; }
  }
`;
