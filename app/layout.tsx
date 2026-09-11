import { Analytics } from '@vercel/analytics/next'
import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import { QueryProvider } from '@/components/query-provider'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Archer Invest',
  description: 'Jouw 7-daagse gratis trial bij Archer Invest.',
  generator: 'archer-invest',
}

export const viewport: Viewport = {
  colorScheme: 'light',
  themeColor: '#F5F8FF',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="nl" className="bg-background" style={{ fontFamily: inter.style.fontFamily }}>
      <body className="antialiased bg-background text-foreground font-sans">
        <QueryProvider>{children}</QueryProvider>
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}
