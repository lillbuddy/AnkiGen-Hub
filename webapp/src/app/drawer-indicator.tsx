'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { getDrawerCards, syncDrawerOwner } from '@/lib/drawer-storage'
import { useCurrentUser } from '@/lib/use-current-user'

export default function DrawerIndicator() {
  const { user, ready } = useCurrentUser()
  const [count, setCount] = useState(0)

  useEffect(() => {
    if (!ready) return
    // 同一台裝置換人登入或登出時，先確認抽屜還是不是屬於目前這個使用者，
    // 不是的話直接清空，不會讓下一個使用者看到上一個人抽屜裡的卡片。
    syncDrawerOwner(user?.id ?? null)
    // localStorage 只在瀏覽器端讀得到，故意等 ready 之後才讀。
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCount(getDrawerCards().length)
  }, [ready, user])

  useEffect(() => {
    const update = () => setCount(getDrawerCards().length)
    window.addEventListener('ankigen-drawer-changed', update)
    window.addEventListener('storage', update) // 跨分頁同步
    return () => {
      window.removeEventListener('ankigen-drawer-changed', update)
      window.removeEventListener('storage', update)
    }
  }, [])

  // 抽屜內容存在 localStorage，不是跟帳號綁定的。同一台裝置換人登入、或登出後，
  // 都不該讓下一個使用者看到上一個人抽屜裡的卡片，所以沒登入時直接不顯示按鈕。
  if (!user || count === 0) return null

  return (
    <Link
      href="/drawer"
      className="drawer-fab"
      title={`抽屜：從歷史紀錄挑選想沿用的卡片，暫存在這裡，之後可以一次拿去繼續編輯、整理成新的卡組。目前收集了 ${count} 張卡片。`}
    >
      🗄️
      <span className="drawer-fab-badge">{count}</span>
    </Link>
  )
}
