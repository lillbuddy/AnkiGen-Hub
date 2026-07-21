'use client'

import { useState } from 'react'
import {
  addCardsToAnki,
  checkAnkiConnectAndRequestPermission,
  ensureAnkiGenModelExists,
  ensureDeckExists,
  type AnkiCardInput,
} from '@/lib/anki-connect'

// 三個呼叫端（文字選擇題、圖片標記工具、歷史紀錄）的卡片資料形狀都不一樣，圖片
// 來源也不同（本機 File、抽屜沿用、Google Drive）。這個元件只負責「開牌組名稱
// 輸入框 -> 呼叫 AnkiConnect -> 顯示結果」，實際怎麼組出 AnkiCardInput[]（要不要
// 先抓圖片轉 base64）交給呼叫端的 getCards，按下確認才會呼叫，避免使用者根本沒
// 點「存入 Anki」也白白抓一次圖片。
export default function SaveToAnkiButton({
  getCards,
  defaultDeckName = 'AnkiGen Hub',
  size = 'sm',
}: {
  getCards: () => Promise<AnkiCardInput[]>
  defaultDeckName?: string
  // 讓呼叫端可以跟旁邊的按鈕對齊高度：mcq 頁面和歷史紀錄的同排按鈕是 btn-sm，
  // slides 頁面的同排按鈕沒有加 btn-sm（比較大顆），兩邊都要能對上。
  size?: 'sm' | 'md'
}) {
  const sizeClass = size === 'sm' ? ' btn-sm' : ''
  const [open, setOpen] = useState(false)
  const [deckName, setDeckName] = useState(defaultDeckName)
  const [status, setStatus] = useState<'idle' | 'working'>('idle')
  const [message, setMessage] = useState<{ type: 'ok' | 'error'; text: string } | null>(null)

  async function handleConfirm() {
    if (!deckName.trim()) return

    setStatus('working')
    setMessage(null)

    const check = await checkAnkiConnectAndRequestPermission()
    if (!check.ok) {
      setStatus('idle')
      // AnkiConnect 官方文件說 requestPermission 應該不管來源都能呼叫，但實測發現：
      // 預設的 webCorsOriginList 只信任 http://localhost，連這個網站部署後的網域
      // （例如 Vercel 網址）都不在裡面，瀏覽器端的請求還是會被擋下來、看起來就像連不上。
      // 一定要請使用者自己去 AnkiConnect 設定加白名單才會通。
      const origin = typeof window !== 'undefined' ? window.location.origin : ''
      setMessage({
        type: 'error',
        text:
          check.reason === 'unreachable'
            ? `偵測不到本機 Anki，可能原因：(1) Anki 沒開啟，或還沒安裝 AnkiConnect 附加元件（工具 > 附加元件 > 瀏覽並安裝，代碼輸入 2055492159）；(2) AnkiConnect 的網址白名單沒有把這個網站加進去——請到 Anki 的「工具 > 附加元件」，點選 AnkiConnect 後按「Config」，把 "webCorsOriginList" 這個欄位加上 "${origin}"（或先用 "*" 測試看看，能連上之後再改回只列出你實際會用到的網址比較安全），存檔後完全關閉並重新開啟 Anki 再試一次。`
            : '請先在 Anki 跳出的視窗裡按下允許存取，然後再按一次「存入 Anki」。',
      })
      return
    }

    try {
      const cards = await getCards()
      await ensureAnkiGenModelExists()
      await ensureDeckExists(deckName.trim())
      await addCardsToAnki(deckName.trim(), cards)
      setMessage({ type: 'ok', text: `已成功存入 Anki 的「${deckName.trim()}」牌組！` })
      setOpen(false)
    } catch (error) {
      setMessage({
        type: 'error',
        text: `存入 Anki 失敗：${error instanceof Error ? error.message : String(error)}`,
      })
    } finally {
      setStatus('idle')
    }
  }

  return (
    <div className="inline-flex flex-col items-start gap-2">
      {!open ? (
        <button onClick={() => setOpen(true)} className={`btn btn-primary${sizeClass}`}>
          📥 存入 Anki
        </button>
      ) : (
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={deckName}
            onChange={(e) => setDeckName(e.target.value)}
            placeholder="目標牌組名稱"
            className="field-input"
            style={{ width: '160px' }}
          />
          <button
            onClick={handleConfirm}
            disabled={status === 'working'}
            className={`btn btn-primary${sizeClass}`}
          >
            {status === 'working' ? '存入中...' : '確認'}
          </button>
          <button onClick={() => setOpen(false)} className={`btn btn-secondary${sizeClass}`}>
            取消
          </button>
        </div>
      )}
      {message && (
        <p className={`text-xs ${message.type === 'ok' ? 'text-success' : 'text-danger'}`}>
          {message.text}
        </p>
      )}
    </div>
  )
}
