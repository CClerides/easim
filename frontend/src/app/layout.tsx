import type { Metadata } from 'next'
import { Sora, JetBrains_Mono } from 'next/font/google'
import './globals.css'
import { CookieBanner } from '@/components/site/cookie-banner'
import { Header } from '@/components/site/header'
import { Footer } from '@/components/site/footer'
import { CartProvider } from '@/lib/cart/cart-context'

/**
 * Sora for everything, JetBrains Mono for machine text.
 *
 * Sora is geometric and slightly technical without being another grotesque.
 * The obvious picks here would have been Inter or Geist, and both are so
 * common in this kind of interface that they read as a default rather than a
 * decision.
 *
 * The mono is not decoration. This product's most important strings are an
 * ICCID and an activation code, which a customer has to read, compare and
 * sometimes type. Tabular, unambiguous glyphs matter for those; a 0 that
 * cannot be confused with an O is a usability feature.
 */
const sans = Sora({
  variable: '--font-sans',
  subsets: ['latin'],
  display: 'swap',
})

const mono = JetBrains_Mono({
  variable: '--font-mono',
  subsets: ['latin'],
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Easim - data plans that arrive in seconds',
  description:
    'Prepaid eSIM data plans for travel. Pick a country, pay, and the QR code lands in your account automatically.',
}

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="en" className={`${sans.variable} ${mono.variable} h-full antialiased`}>
      <head>
        {/*
          Scroll-reveal elements are rendered at opacity 0 and made visible by
          JavaScript. If that JavaScript never runs, the page is technically
          present and visually blank. This restores it.
        */}
        <noscript>
          <style>{`[data-reveal]{opacity:1!important;transform:none!important}`}</style>
        </noscript>
      </head>
      <body className="flex min-h-full flex-col">
        <CartProvider>
          <Header />
          <main className="flex flex-1 flex-col">{children}</main>
          <Footer />
        </CartProvider>
        <CookieBanner />
      </body>
    </html>
  )
}
