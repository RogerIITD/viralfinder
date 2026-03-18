export const maxDuration = 60;
export const dynamic = 'force-dynamic';

export async function POST(request) {
  try {
    const { niche, platforms, results } = await request.json();
    const apiKey = process.env.ANTHROPIC_API_KEY;

    if (!apiKey) {
      return Response.json({ ok: false, error: 'ANTHROPIC_API_KEY not set in Vercel environment variables.' }, { status: 400 });
    }

    const researchData = Object.entries(results)
      .filter(([, r]) => r?.ok && r?.data)
      .map(([platform, r]) => {
        const text = typeof r.data === 'string' ? r.data : JSON.stringify(r.data, null, 2);
        return `=== ${platform.toUpperCase()} ===\n${text}`;
      })
      .join('\n\n');

    const prompt = `You are the world's best viral content strategist. You have just received real-time research data scraped live from ${platforms.join(', ')} about "${niche}" content.

RAW RESEARCH DATA:
${researchData}

Based on this live data, generate a precise strategic brief for a content creator entering the "${niche}" niche. Return ONLY a valid JSON object with this exact structure - no markdown, no explanation, just the JSON:

{
  "verdict": "One punchy sentence on the opportunity in this niche right now",
  "opportunityScore": 78,
  "topFormats": [
    { "name": "Format name", "score": 92, "platforms": ["Instagram", "TikTok"], "why": "Why this format is working right now based on the data" },
    { "name": "Format name", "score": 84, "platforms": ["YouTube"], "why": "..." },
    { "name": "Format name", "score": 71, "platforms": ["Instagram"], "why": "..." }
  ],
  "viralHooks": [
    "Hook template 1 with [brackets] for fill-in",
    "Hook template 2",
    "Hook template 3",
    "Hook template 4",
    "Hook template 5"
  ],
  "postingStrategy": {
    "frequency": "e.g. 5x per week",
    "bestTimes": "e.g. 7-9am and 7-9pm local time",
    "priorityPlatform": "Which single platform to focus on first and why",
    "contentMix": "e.g. 60% short-form, 30% long-form, 10% carousels"
  },
  "quickWins": [
    { "title": "Specific video idea title", "angle": "The unique angle that makes it viral", "format": "60s Reel", "platform": "Instagram" },
    { "title": "...", "angle": "...", "format": "...", "platform": "..." },
    { "title": "...", "angle": "...", "format": "...", "platform": "..." }
  ],
  "topCreators": ["Creator name or archetype 1", "Creator name or archetype 2", "Creator name or archetype 3"],
  "avoid": [
    "Specific mistake creators make in this niche",
    "Mistake 2",
    "Mistake 3"
  ],
  "viralityFactors": [
    { "factor": "Hook strength", "score": 8, "note": "Brief tactical note" },
    { "factor": "Visual quality", "score": 7, "note": "..." },
    { "factor": "Posting consistency", "score": 9, "note": "..." },
    { "factor": "Trend-jacking speed", "score": 6, "note": "..." },
    { "factor": "Educational value", "score": 8, "note": "..." },
    { "factor": "Entertainment", "score": 7, "note": "..." },
    { "factor": "Community engagement", "score": 6, "note": "..." }
  ],
  "trendingTopics": ["Topic blowing up right now", "Topic 2", "Topic 3", "Topic 4"]
}

Be specific, tactical, and based entirely on the research data. All viralityFactors scores out of 10, other scores out of 100.`;

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2500,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return Response.json({ ok: false, error: err?.error?.message || 'Claude API error ' + res.status }, { status: 500 });
    }

    const data = await res.json();
    const raw = data.content?.[0]?.text || '';
    const clean = raw.replace(/```json\n?|\n?```/g, '').trim();

    try {
      const synthesis = JSON.parse(clean);
      return Response.json({ ok: true, synthesis });
    } catch {
      return Response.json({ ok: false, error: 'Failed to parse synthesis', raw }, { status: 500 });
    }
  } catch (err) {
    return Response.json({ ok: false, error: err.message }, { status: 500 });
  }
}
