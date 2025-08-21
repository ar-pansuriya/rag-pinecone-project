import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'AI Assistant',
  description: 'Created with AI Assistant',
  generator: 'AI Assistant',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="icon" href="/icon-1.png" />
      </head>
      <body>{children}</body>
    </html>
  )
}
