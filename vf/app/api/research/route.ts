import { NextRequest } from 'next/server'

export const runtime = 'nodejs'
export const maxDuration = 120

const PLATFORM_GOALS: Record<string, (niche: string, focus: string) => string> = {
  Instagram: (niche, focus) => `
Navigate to https://www.instagram.com/explore/ and search for "${niche}" content.
Analyze the top trending Reels and posts in this niche right now.

For each of the top 5 results, extract:
1. Content type (Reel / Carousel / Static Post)
2. Likes and view count if visible
3. The hook — what does the first 2 seconds show or say?
4. What the content is about (format, style, topic)
5. Hashtags used in the caption
6. Account size (follower count if visible)

Then provide a SUMMARY covering:
- Which content formats dominate (Reels vs carousels vs posts — % breakdown)
- What hook styles work best in this niche
- Optimal Reel length based on what you see
- Most used hashtags (list top 10)
- Posting frequency of top accounts
- What visual styles and editing approaches repeat most
- One "secret pattern" you noticed that beginners miss

${focus ? `Extra focus: ${focus}` : ''}

Return everything as clear structured text with headers.
`.trim(),

  YouTube: (niche, focus) => `
Navigate to https://www.youtube.com and search for "${niche}".
Look at the top results — sort by relevance/trending if possible.

For each of the top 5 videos, extract:
1. Exact title (note the structure/formula)
2. Thumbnail description — what's in it, text overlay, faces?
3. View count and like count
4. Video length (exact minutes:seconds)
5. Channel name and subscriber count if visible
6. Upload date
7. What makes the hook work? (first 10 seconds description)

Then provide a SUMMARY covering:
- Title formulas that repeat (templates, structures)
- Thumbnail patterns (talking head / text-only / before-after / etc)
- Ideal video length for this niche
- Long-form vs Shorts performance
- Content formats winning (tutorials / vlogs / reactions / explainers / reviews)
- What the top channels post that small channels don't
- SEO keyword patterns in titles and descriptions

${focus ? `Extra focus: ${focus}` : ''}

Return everything as clear structured text with headers.
`.trim(),

  TikTok: (niche, focus) => `
Navigate to https://www.tiktok.com and search for "${niche}".
Analyze the top trending videos in this niche.

For each of the top 5 videos, extract:
1. The opening hook — exact words or visuals used in first 2 seconds
2. View count, likes, comments, shares
3. Video duration (in seconds)
4. Audio/sound used — trending sound, original audio, or voiceover?
5. Visual style — talking head / text overlay / montage / POV / green screen / etc
6. Creator account size if visible

Then provide a SUMMARY covering:
- Hook patterns that are going viral right now
- Optimal video length (most common seconds range)
- Top sounds and audio trends in this niche
- Most used hashtags (top 10)
- Video structures that work (problem-agitate-solve / storytelling / listicle / etc)
- What types of creators are blowing up (solo / brand / educational / entertainment)
- Best posting time signals if visible
- The one format combination that crushes engagement

${focus ? `Extra focus: ${focus}` : ''}

Return everything as clear structured text with headers.
`.trim(),

  'X / Twitter': (niche, focus) => `
Navigate to https://twitter.com/search?q=${encodeURIComponent(niche)}&f=top
Analyze the top viral tweets and threads in this niche.

For each of the top 5 posts, extract:
1. The opening line / hook
2. Content type (thread / image / video / poll / single tweet)
3. Like, retweet, and reply counts
4. Account follower count if visible
5. What makes it shareable?

Then provide a SUMMARY covering:
- What angles and opinions get the most engagement
- Thread vs single tweet performance
- Image/video vs text-only posts
- Best hook formulas used in this niche
- Top hashtags
- What posting style builds the fastest following

${focus ? `Extra focus: ${focus}` : ''}

Return everything as clear structured text with headers.
`.trim(),

  LinkedIn: (niche, focus) => `
Navigate to https://www.linkedin.com/search/results/content/?keywords=${encodeURIComponent(niche)}&sortBy=relevance
Analyze the top performing posts in this niche.

For each of the top 5 posts, extract:
1. Opening hook line (first sentence)
2. Post format (text wall / carousel / video / article / image)
3. Engagement metrics (likes, comments, shares if visible)
4. Post length and structure
5. Author follower count if visible

Then provide a SUMMARY covering:
- What post formats perform best
- Optimal post length
- Hook styles that stop the scroll
- Content angles that build authority
- How top creators use carousels vs text posts
- Best time and frequency signals

${focus ? `Extra focus: ${focus}` : ''}

Return everything as clear structured text with headers.
`.trim(),
}

const PLATFORM_START_URLS: Record<string, string> = {
  Instagram: 'https://www.instagram.com/explore/',
  YouTube: 'https://www.youtube.com',
  TikTok: 'https://www.tiktok.com',
  'X / Twitter': 'https://twitter.com',
  LinkedIn: 'https://www.linkedin.com/feed/',
}

export async function POST(req: NextRequest) {
  const { platform, niche, focus, apiKey } = await req.json()

  if (!platform || !niche || !apiKey) {
    return new Response(JSON.stringify({ error: 'Missing required fields' }), { status: 400 })
  }

  const goalFn = PLATFORM_GOALS[platform]
  if (!goalFn) {
    return new Response(JSON.stringify({ error: `Unknown platform: ${platform}` }), { status: 400 })
  }

  const goal = goalFn(niche, focus || '')
  const url = PLATFORM_START_URLS[platform] || 'https://google.com'

  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: object) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))
      }

      try {
        const tfRes = await fetch('https://agent.tinyfish.ai/v1/automation/run-sse', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-API-Key': apiKey,
          },
          body: JSON.stringify({
            url,
            goal,
            browser_profile: 'stealth',
            proxy_config: { enabled: true, country_code: 'US' },
          }),
        })

        if (!tfRes.ok) {
          const errText = await tfRes.text()
          let errMsg = `TinyFish error ${tfRes.status}`
          try { errMsg = JSON.parse(errText)?.error?.message || errMsg } catch {}
          send({ type: 'ERROR', message: errMsg })
          controller.close()
          return
        }

        const reader = tfRes.body!.getReader()
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
            if (!raw || raw === '[DONE]') continue
            try {
              const evt = JSON.parse(raw)
              send(evt)
              if (evt.type === 'COMPLETE' || evt.type === 'ERROR') {
                controller.close()
                return
              }
            } catch {}
          }
        }

        controller.close()
      } catch (err: any) {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'ERROR', message: err.message })}\n\n`))
          controller.close()
        } catch {}
      }
    }
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  })
}
