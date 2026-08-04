import type { Metadata } from 'next'
import { Bricolage_Grotesque, DM_Sans } from 'next/font/google'
import './globals.css'

const displayFont = Bricolage_Grotesque({
  variable: '--font-display',
  subsets: ['latin'],
  weight: ['400', '600', '700', '800'],
})

const bodyFont = DM_Sans({
  variable: '--font-sans',
  subsets: ['latin'],
  weight: ['400', '500', '700'],
})

export const metadata: Metadata = {
  title: 'Pickleball Court Booking',
  description: 'Book pickleball courts, add-ons, and café items in one session.',
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${displayFont.variable} ${bodyFont.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  )
}
