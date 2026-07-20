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
  const [disconnectingDrive, setDisconnectingDrive] = useState(false)
  const [driveStatus, setDriveStatus] = useState<{ connected: boolean; email: string | null }>({
    connected: false,
    email: null,
  })

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

  useEffect(() => {
    // 未登入時 API 本身就會回傳 connected: false，不需要另外特判，避免在 effect 裡同步呼叫 setState。
    fetch('/api/google-drive/status')
      .then((res) => res.json())
      .then((data) => setDriveStatus(data))
      .catch(() => setDriveStatus({ connected: false, email: null }))
  }, [user])

  async function handleSignOut() {
    setSigningOut(true)
    try {
      const supabase = createClient()
      await supabase.auth.signOut()
      router.push('/login')
      router.refresh()
    } finally {
      // 頁首在 root layout 裡，換頁不會重新掛載，所以一定要自己把狀態重設回來，
      // 不然下次再登入時，這個按鈕會從一開始就卡在「登出中...」。
      setSigningOut(false)
    }
  }

  async function handleDisconnectDrive() {
    if (
      !confirm(
        '確定要解除連結 Google Drive 嗎？之後要繼續使用圖片標記工具，需要重新連結一次。（已經上傳的圖片還是會留在你自己的 Google Drive 裡，不會被刪除）'
      )
    ) {
      return
    }

    setDisconnectingDrive(true)
    const response = await fetch('/api/google-drive/disconnect', { method: 'POST' })
    setDisconnectingDrive(false)

    if (!response.ok) {
      alert('解除連結失敗，請稍後再試。')
      return
    }

    setDriveStatus({ connected: false, email: null })
    router.refresh()
  }

  const isHome = pathname === '/'
  const isLogin = pathname === '/login' || pathname === '/signup'

  return (
    <header className="sticky top-0 z-50 border-b border-panel-border bg-white/85 py-3 backdrop-blur-md">
      <div className="flex w-full items-center justify-between gap-4 px-6 sm:px-10">
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
              {driveStatus.connected && (
                <button
                  onClick={handleDisconnectDrive}
                  disabled={disconnectingDrive}
                  className="drive-status-badge hidden sm:inline-flex"
                  title="點擊解除連結 Google Drive"
                >
                  📁 {disconnectingDrive ? '解除連結中...' : (driveStatus.email ?? 'Drive 已連結')}
                  <span className="drive-status-badge-remove">✕</span>
                </button>
              )}
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
