'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { getDrawerCards, removeFromDrawer, type DrawerCard } from '@/lib/drawer-storage'

export default function DrawerPage() {
  const [cards, setCards] = useState<DrawerCard[]>([])

  useEffect(() => {
    // localStorage 只存在瀏覽器端，故意等 mount 後才讀，避免 SSR 輸出跟 client 端內容對不上。
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCards(getDrawerCards())
  }, [])

  function handleRemove(key: string) {
    removeFromDrawer(key)
    setCards(getDrawerCards())
  }

  return (
    <main className="mx-auto max-w-2xl p-6">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold">抽屜</h1>
        <Link href="/history" className="text-sm text-primary underline">
          回歷史紀錄列表
        </Link>
      </div>

      {cards.length === 0 ? (
        <p className="text-sm text-text-secondary">
          抽屜是空的。到歷史紀錄的「查看」頁面，點卡片旁邊的「加入抽屜」就可以把想沿用的卡片收集到這裡。
        </p>
      ) : (
        <>
          <div className="flex flex-col gap-3">
            {cards.map((card) => (
              <div
                key={card.key}
                className="flex items-center gap-3 card-panel p-3"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`/api/google-drive/image/${card.drivePreviewFileId}`}
                  alt={card.filename}
                  className="h-16 w-16 flex-shrink-0 rounded object-cover"
                />
                <div className="flex-1 text-sm">{card.questionText || '（沒有題目）'}</div>
                <button
                  onClick={() => handleRemove(card.key)}
                  className="text-xs text-danger underline"
                >
                  移除
                </button>
              </div>
            ))}
          </div>

          <Link
            href="/tools/image-mcq?from=drawer"
            className="mt-4 inline-block btn btn-primary"
          >
            開始整理（{cards.length} 張卡片）
          </Link>
        </>
      )}
    </main>
  )
}
