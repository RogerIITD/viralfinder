# ViralFinder ⚡

> Real-time viral trend intelligence for content creators — powered by TinyFish browser agents + Claude AI synthesis.

## What it does

Deploys stealth browser agents across Instagram, YouTube, TikTok, X, and LinkedIn to extract real-time trend data for any creator niche. Claude then synthesizes it into an actionable intelligence brief covering hook templates, content formats, virality factors, and growth strategy.

## Deploy to Vercel (5 minutes)

### 1. Push to GitHub

```bash
git init
git add .
git commit -m "Initial ViralFinder"
git remote add origin https://github.com/YOUR_USERNAME/viralfinder.git
git push -u origin main
```

### 2. Import to Vercel

1. Go to [vercel.com/new](https://vercel.com/new)
2. Import your GitHub repo
3. Add environment variable:
   - `ANTHROPIC_API_KEY` = your key from [console.anthropic.com](https://console.anthropic.com)
4. Click Deploy

### 3. Use the app

1. Open your Vercel URL
2. Enter your TinyFish API key (get free credits at [agent.tinyfish.ai/api-keys](https://agent.tinyfish.ai/api-keys))
3. Pick your niche + platforms
4. Deploy agents and get your intelligence brief

## Run locally

```bash
npm install
cp .env.example .env.local
# Add ANTHROPIC_API_KEY to .env.local
npm run dev
# Open http://localhost:3000
```

## Stack

- **Next.js 14** (App Router) — frontend + API routes
- **TinyFish Web Agent API** — stealth browser agents for social platforms
- **Claude claude-sonnet-4-20250514** — cross-platform synthesis and intelligence brief
- **Vercel** — deployment with 120s serverless function timeout for long agent runs

## TinyFish Accelerator

Built for the [TinyFish Accelerator](https://tinyfish.ai/accelerator) — a 9-week program backed by $2M seed funding from Mango Capital.

Demo Day: April 25, 2026.

#TinyFishAccelerator #BuildInPublic
