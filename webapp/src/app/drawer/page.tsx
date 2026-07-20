'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  getDrawerCards,
  removeFromDrawer,
  updateDrawerCard,
  type AnyDrawerCard,
  type ImageDrawerCard,
  type TextDrawerCard,
} from '@/lib/drawer-storage'
import DrawerCardEditor from './drawer-card-editor'
import TextCardEditor from './text-card-editor'

export default function DrawerPage() {
  const [cards, setCards] = useState<AnyDrawerCard[]>([])
  const [selectedKey, setSelectedKey] = useState<string | null>(null)

  useEffect(() => {
    // localStorage 只存在瀏覽器端，故意等 mount 後才讀，避免 SSR 輸出跟 client 端內容對不上。
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCards(getDrawerCards())
  }, [])

  // 選取的卡片被移除時，自動退回目前列表的第一張，避免畫面卡在已經不存在的卡片上。
  const selected = cards.find((c) => c.key === selectedKey) ?? cards[0] ?? null
  // 抽屜同一時間只會有一種類型的卡片，用第一張卡片判斷「開始整理」該去哪個工具頁面。
  const cardType = cards[0]?.cardType ?? null
  const startHref = cardType === 'mcq' ? '/tools/mcq?from=drawer' : '/tools/slides?from=drawer'

  function handleRemove(key: string) {
    removeFromDrawer(key)
    setCards(getDrawerCards())
  }

  function handleUpdate(key: string, patch: Partial<ImageDrawerCard> | Partial<TextDrawerCard>) {
    updateDrawerCard(key, patch)
    setCards(getDrawerCards())
  }

  return (
    <main className="w-full flex-1 px-6 py-6 sm:px-10">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold">抽屜</h1>
        <Link href="/history" className="text-sm text-primary underline">
          回歷史紀錄列表
        </Link>
      </div>

      {cards.length === 0 ? (
        <p className="text-sm text-text-secondary">
          抽屜是空的。到歷史紀錄的「查看」頁面，點卡片旁邊的「加入抽屜」就可以把想沿用的卡片收集到這裡。圖片選擇題和文字選擇題的卡片不能同時放在抽屜裡，一次只能整理一種。
        </p>
      ) : (
        <>
          <div className="flex flex-col gap-6 md:flex-row md:items-start">
            <div className="flex w-full flex-col gap-2 md:w-72 md:flex-shrink-0">
              {cards.map((card) => (
                <button
                  key={card.key}
                  onClick={() => setSelectedKey(card.key)}
                  className={`history-list-item flex items-center gap-3 ${
                    selected?.key === card.key ? 'history-list-item-active' : ''
                  }`}
                >
                  {card.cardType === 'slides-mcq' && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={`/api/google-drive/image/${card.drivePreviewFileId}`}
                      alt=""
                      className="h-12 w-12 flex-shrink-0 rounded object-cover"
                    />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm">{card.questionText || '（沒有題目）'}</div>
                    {card.cardType === 'slides-mcq' && (
                      <div className="truncate text-xs text-text-secondary">{card.filename}</div>
                    )}
                  </div>
                </button>
              ))}
            </div>

            {selected && (
              <div className="min-w-0 flex-1">
                {selected.cardType === 'slides-mcq' ? (
                  <DrawerCardEditor
                    card={selected}
                    onUpdate={(patch) => handleUpdate(selected.key, patch)}
                    onRemove={() => handleRemove(selected.key)}
                  />
                ) : (
                  <TextCardEditor
                    card={selected}
                    onUpdate={(patch) => handleUpdate(selected.key, patch)}
                    onRemove={() => handleRemove(selected.key)}
                  />
                )}
              </div>
            )}
          </div>

          <Link href={startHref} className="mt-6 inline-block btn btn-primary">
            開始整理（{cards.length} 張卡片）
          </Link>
        </>
      )}
    </main>
  )
}
