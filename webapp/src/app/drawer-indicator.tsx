'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { getDrawerCards } from '@/lib/drawer-storage'

export default function DrawerIndicator() {
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

  if (count === 0) return null

  return (
    <Link href="/drawer" className="drawer-fab" title={`抽屜：目前收集了 ${count} 張卡片`}>
      🗄️
      <span className="drawer-fab-badge">{count}</span>
    </Link>
  )
}
