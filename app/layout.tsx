import type { Metadata } from 'next'
import './globals.css'
import { createClient } from '@/lib/supabase/server'
import { logout } from '@/app/login/actions'

export const metadata: Metadata = {
  title: 'AI Assistant',
  description: 'Created with AI Assistant',
  generator: 'AI Assistant',
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  return (
    <html lang="en">
      <head>
        <link rel="icon" href="/icon-1.png" />
      </head>
      <body>
        {children}
      </body>
    </html>
  )
}

