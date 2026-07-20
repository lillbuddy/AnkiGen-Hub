'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import type { User } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/client'

export default function SiteHeader() {
  const pathname = usePathname()
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [ready, setReady] = useState(false)
  const [signingOut, setSigningOut] = useState(false)

  useEffect(() => {
    const supabase = createClient()

    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user)
      setReady(true)
    })

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })

    return () => subscription.subscription.unsubscribe()
  }, [])

  async function handleSignOut() {
    setSigningOut(true)
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  const isHome = pathname === '/'
  const isLogin = pathname === '/login'

  return (
    <header className="sticky top-0 z-50 border-b border-panel-border bg-white/85 py-3 backdrop-blur-md">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-6">
        <Link
          href="/"
          className="flex shrink-0 items-center gap-3 font-display text-2xl font-extrabold tracking-tight text-text-primary"
        >
          <span className="text-primary">💡</span>
          <span>
            AnkiGen <span className="text-primary">Hub</span>
          </span>
        </Link>

        <span className="hidden truncate text-sm italic text-text-secondary xl:inline">
          The central hub for instant Anki creation
        </span>

        <nav className="flex items-center gap-2">
          {ready && user && (
            <>
              {!isHome && (
                <Link href="/" className="nav-link">
                  🏠 回首頁
                </Link>
              )}
              <Link href="/history" className="nav-link">
                🕘 歷史紀錄
              </Link>
              <button
                onClick={handleSignOut}
                disabled={signingOut}
                className="btn btn-secondary btn-sm"
              >
                {signingOut ? '登出中...' : '登出'}
              </button>
            </>
          )}
          {ready && !user && !isLogin && (
            <Link href="/login" className="btn btn-primary btn-sm">
              登入
            </Link>
          )}
        </nav>
      </div>
    </header>
  )
}
