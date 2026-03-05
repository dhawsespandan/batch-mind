import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'BatchMind — AI Copilot for Pharmaceutical Manufacturing',
  description: 'Causal-First AI Copilot for Batch Manufacturing',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}