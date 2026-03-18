export const metadata = {
  title: 'ViralFinder — Trend Intelligence for Content Creators',
  description: 'Real-time viral trend research powered by TinyFish web agents.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, padding: 0 }}>{children}</body>
    </html>
  );
}
