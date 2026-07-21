'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { getDrawerCards } from '@/lib/drawer-storage'
import { useCurrentUser } from '@/lib/use-current-user'

export default function DrawerIndicator() {
  const { user } = useCurrentUser()
  const [count, setCount] = useState(0)

  useEffect(() => {
    const update = () => setCount(getDrawerCards().length)
    update()
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
    <Link href="/drawer" className="drawer-fab" title={`抽屜：目前收集了 ${count} 張卡片`}>
      🗄️
      <span className="drawer-fab-badge">{count}</span>
    </Link>
  )
}
