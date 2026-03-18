# ViralFinder 🐟
> TinyFish Accelerator — Real-time viral trend intelligence for content creators

## Deploy to Vercel (5 minutes)

### Step 1 — Push to GitHub
```bash
cd viralfinder
git init
git add .
git commit -m "ViralFinder - TinyFish Accelerator"
```
Create a new repo on github.com, then:
```bash
git remote add origin https://github.com/YOUR_USERNAME/viralfinder.git
git push -u origin main
```

### Step 2 — Deploy on Vercel
1. Go to [vercel.com](https://vercel.com) → New Project
2. Import your GitHub repo
3. Add environment variable:
   - Key: `ANTHROPIC_API_KEY`
   - Value: `sk-ant-xxxxxxxxxx` (your Anthropic key)
4. Click **Deploy**

That's it. Your app is live!

### Step 3 — Add your TinyFish key
Enter your TinyFish API key in the UI when you open the app.
Get it at: https://agent.tinyfish.ai/api-keys

## How it works
1. Select platforms (Instagram, YouTube, TikTok, etc.)
2. Pick your creator niche
3. Hit Deploy Agents — real stealth browsers navigate live platforms
4. Claude synthesizes findings into an actionable strategy brief

## Local dev
```bash
npm install
echo "ANTHROPIC_API_KEY=sk-ant-xxx" > .env.local
npm run dev
# Open http://localhost:3000
```

## Architecture
- **Next.js 14** App Router
- **TinyFish API** — stealth browser agents scraping live social platforms
- **Anthropic Claude** — synthesizes raw data into structured strategy
- **SSE streaming** — real-time agent progress updates
- Vercel serverless with 120s timeout for TinyFish routes
