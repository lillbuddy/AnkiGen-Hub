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
    <Link
      href="/drawer"
      className="fixed bottom-4 right-4 z-50 rounded-full btn btn-primary shadow-lg"
    >
      🗂️ 抽屜（{count}）
    </Link>
  )
}
