import { NextRequest } from 'next/server'

export const runtime = 'nodejs'
export const maxDuration = 60

export async function POST(req: NextRequest) {
  const { niche, platforms, results } = await req.json()

  if (!niche || !results) {
    return new Response(JSON.stringify({ error: 'Missing fields' }), { status: 400 })
  }

  const anthropicKey = process.env.ANTHROPIC_API_KEY
  if (!anthropicKey) {
    return new Response(JSON.stringify({ error: 'ANTHROPIC_API_KEY not configured' }), { status: 500 })
  }

  const platformData = Object.entries(results)
    .filter(([, v]: any) => v?.ok)
    .map(([platform, v]: any) => {
      const text = typeof v.data === 'string' ? v.data : JSON.stringify(v.data, null, 2)
      return `## ${platform}\n${text.substring(0, 2000)}`
    })
    .join('\n\n---\n\n')

  const systemPrompt = `You are an expert viral content strategist and social media analyst. 
You analyze raw platform research data and distill it into sharp, actionable creator intelligence.
Your output is always direct, specific, and immediately actionable — no fluff, no generic advice.
You think like a creator who has studied thousands of viral videos.`

  const userPrompt = `I ran browser agents across ${platforms.join(', ')} to research the "${niche}" niche. Here's the raw data:

${platformData}

Based on this research, produce a ViralFinder Intelligence Report with these exact sections:

**VIRALITY SCORE** (rate each factor 1-10 for this niche right now):
- Hook Strength required
- Visual Quality bar  
- Posting Consistency needed
- Educational value
- Entertainment factor
- Trend-jacking speed
- Relatability
- Controversy/Opinion

**TOP 3 CONTENT FORMATS** that are crushing it right now (be specific with platform, format, length)

**5 VIRAL HOOK TEMPLATES** (copy-paste ready hooks creators in this niche are using)

**WHAT'S WORKING** (3-5 specific patterns across platforms — be very concrete)

**WHAT'S NOT WORKING** (2-3 mistakes killing creator growth in this niche)

**PLATFORM PRIORITY** (rank the platforms from highest to lowest ROI for a new creator in this niche, with one-line reason each)

**30-DAY QUICK WIN** (one specific content strategy a new creator could execute in 30 days to get their first 1,000 followers in this niche)

Be extremely specific. Use numbers where the research provides them. Name specific formats, hook styles, and patterns. This is for a serious creator who wants real intelligence, not generic tips.`

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': anthropicKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2000,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
      }),
    })

    if (!res.ok) {
      const err = await res.json()
      return new Response(JSON.stringify({ error: err.error?.message || 'Claude API error' }), { status: 500 })
    }

    const data = await res.json()
    const text = data.content?.find((b: any) => b.type === 'text')?.text || ''

    return new Response(JSON.stringify({ synthesis: text }), {
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 })
  }
}
