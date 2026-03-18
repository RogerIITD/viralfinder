export const maxDuration = 120;
export const dynamic = 'force-dynamic';

const PLATFORM_CONFIG = {
  Instagram: {
    url: 'https://www.instagram.com/explore/',
    goal: (niche) => `Go to Instagram explore page and search for "${niche}". Analyze the top 8 trending reels and posts in this niche. For EACH of the top posts extract: 1) Content type (Reel/Carousel/Post), 2) Estimated views or likes, 3) Hook - what the first 3 seconds show or say, 4) Visual style (talking head, b-roll, text overlay, POV), 5) Caption style, 6) Hashtags used. Then provide a SUMMARY covering: most common formats, recurring hook styles, visual patterns, hashtag clusters, what drives the most engagement. Be specific.`,
  },
  YouTube: {
    url: 'https://www.youtube.com',
    goal: (niche) => `Search YouTube for "${niche}" content. Look at the top results sorted by most viewed. For the top 6 videos extract: 1) Full title, 2) View count and upload date, 3) Thumbnail description, 4) Video length, 5) Channel subscribers if visible, 6) Video format (tutorial/vlog/short/reaction/explainer). Then SUMMARIZE: which formats are dominating, title patterns that repeat, thumbnail strategies, optimal video length, topics getting outsized views.`,
  },
  TikTok: {
    url: 'https://www.tiktok.com',
    goal: (niche) => `Go to TikTok and search for "${niche}". Sort by most popular. For the top 6 trending videos extract: 1) Hook - opening line or visual, 2) View count and likes, 3) Video length in seconds, 4) Sound used (trending or original), 5) Visual format (talking head/text overlay/montage/POV/transition), 6) Comment themes. Then SUMMARIZE: top hashtags, trending sounds, video structures that repeat, creator types going viral, the formula for a viral video in this niche right now.`,
  },
  'X / Twitter': {
    url: 'https://twitter.com/explore',
    goal: (niche) => `Search X (Twitter) for "${niche}" and look at Top posts. For the top 6 viral tweets/threads extract: 1) Opening hook, 2) Engagement metrics, 3) Content type (thread/hot take/image/video/poll), 4) Account size if visible, 5) Key angle taken. Then SUMMARIZE: what topics generate debate and shares, what posting styles drive engagement, trending hashtags, account archetypes that dominate, what works uniquely on X for this niche.`,
  },
  LinkedIn: {
    url: 'https://www.linkedin.com/feed/',
    goal: (niche) => `Search LinkedIn for "${niche}" content. Find the most engaging recent posts. For the top 5 posts extract: 1) Opening hook, 2) Post format (text/carousel/video/article), 3) Engagement metrics, 4) Post length and structure, 5) Personal story vs professional insight ratio. Then SUMMARIZE: what formats get most engagement, storytelling angles that work, ideal post length, personal branding approaches that resonate.`,
  },
};

export async function POST(request) {
  try {
    const { platform, niche, tfApiKey } = await request.json();
    const apiKey = tfApiKey || process.env.TINYFISH_API_KEY;

    if (!apiKey) {
      return Response.json({ error: 'No TinyFish API key provided' }, { status: 400 });
    }

    const config = PLATFORM_CONFIG[platform];
    if (!config) {
      return Response.json({ error: 'Unknown platform: ' + platform }, { status: 400 });
    }

    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      async start(controller) {
        const send = (obj) => {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));
        };

        try {
          const tfRes = await fetch('https://agent.tinyfish.ai/v1/automation/run-sse', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-API-Key': apiKey,
            },
            body: JSON.stringify({
              url: config.url,
              goal: config.goal(niche),
              browser_profile: 'stealth',
              proxy_config: { enabled: true, country_code: 'US' },
            }),
          });

          if (!tfRes.ok) {
            let msg = `TinyFish error ${tfRes.status}`;
            try {
              const err = await tfRes.json();
              msg = err?.error?.message || err?.message || msg;
            } catch {}
            send({ type: 'ERROR', message: msg });
            controller.close();
            return;
          }

          const reader = tfRes.body.getReader();
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
              if (!raw || raw === '[DONE]') continue;
              try {
                const evt = JSON.parse(raw);
                send(evt);
                if (evt.type === 'COMPLETE' || evt.type === 'ERROR') {
                  controller.close();
                  return;
                }
              } catch {}
            }
          }
          controller.close();
        } catch (err) {
          send({ type: 'ERROR', message: err.message });
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no',
      },
    });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
