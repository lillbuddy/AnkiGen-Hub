'use client'

import { useEffect, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/client'

// 跟 site-header.tsx 同一套邏輯（先讀一次現有 session，再訂閱後續變化），
// 抽出來給 /tools/mcq、/tools/slides 用，讓「存入紀錄」按鈕在使用者還沒
// 登入時就能主動顯示成不可用，而不是等按下去被 API 擋下來才知道。
export function useCurrentUser() {
  const [user, setUser] = useState<User | null>(null)
  const [ready, setReady] = useState(false)

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

  return { user, ready }
}
