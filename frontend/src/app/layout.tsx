import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import './globals.css'
import { CookieBanner } from '@/components/site/cookie-banner'
import { Header } from '@/components/site/header'
import { Footer } from '@/components/site/footer'
import { CartProvider } from '@/lib/cart/cart-context'

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] })
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Easim — data plans that arrive in seconds',
  description:
    'Prepaid eSIM data plans for travel. Pick a country, pay, and the QR code lands in your account automatically.',
}

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
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
