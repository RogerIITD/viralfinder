import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'ViralFinder — AI Trend Intelligence for Content Creators',
  description: 'Deploy browser agents across Instagram, YouTube and TikTok to find exactly what is going viral in your niche.',
  openGraph: {
    title: 'ViralFinder',
    description: 'Real-time viral trend intelligence for content creators.',
  }
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
