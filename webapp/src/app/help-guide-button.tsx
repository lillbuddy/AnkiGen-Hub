'use client'

import { useEffect, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'
import { DEFAULT_GUIDE, PAGE_GUIDES } from '@/lib/page-guides'

// 左下角浮動的問號按鈕：概念上跟右下角的抽屜按鈕（drawer-fab）一樣是釘在
// RootLayout 裡、跨頁面持續存在的浮動按鈕，但這顆不需要登入就看得到——
// 目的是幫助使用者了解「目前這個頁面」怎麼操作，跟抽屜的隱私考量無關。
export default function HelpGuideButton() {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)

  const guide = PAGE_GUIDES[pathname] ?? DEFAULT_GUIDE

  useEffect(() => {
    if (!open) return

    function handlePointerDown(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }

    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [open])

  return (
    <div ref={panelRef}>
      {open && (
        <div className="help-guide-panel">
          <div className="mb-2 flex items-center justify-between gap-3">
            <h2 className="font-display text-base font-bold text-text-primary">{guide.title}</h2>
            <button
              onClick={() => setOpen(false)}
              className="text-text-secondary hover:text-text-primary"
              aria-label="關閉使用指引"
            >
              ✕
            </button>
          </div>
          <ul className="flex flex-col gap-2 text-sm text-text-secondary">
            {guide.items.map((item, i) => (
              <li key={i} className="flex gap-2">
                <span>•</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      <button
        onClick={() => setOpen((prev) => !prev)}
        className="help-guide-fab"
        title="使用指引"
        aria-label="使用指引"
      >
        ❓
      </button>
    </div>
  )
}
