import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import AppNav from '@/components/AppNav'

const inter = Inter({
  variable: '--font-inter',
  subsets: ['latin'],
  display: 'swap',
})

export const metadata: Metadata = {
  title: {
    default: 'CAD Review — Industry Platform',
    template: '%s | CAD Review',
  },
  description:
    'Professional CAD collaboration platform for reviewing 3D models, annotating engineering drawings, and team design reviews.',
  keywords: ['CAD', '3D viewer', 'engineering', 'collaboration', 'design review', 'annotation'],
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} font-sans antialiased`} suppressHydrationWarning>
        {/* Persistent sidebar nav — hides itself on fullscreen pages */}
        <AppNav />

        {/* Page content — offset by sidebar width on non-fullscreen pages */}
        <div id="main-content">
          {children}
        </div>
      </body>
    </html>
  )
}
