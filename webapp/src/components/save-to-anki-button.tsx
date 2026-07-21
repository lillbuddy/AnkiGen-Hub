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
// 來源也不同（本機 File、抽屜沿用、Google Drive）。這個元件只負責「按一下 ->
// 呼叫 AnkiConnect -> 顯示結果」，實際怎麼組出 AnkiCardInput[]（要不要先抓圖片
// 轉 base64）交給呼叫端的 getCards，按下按鈕才會呼叫，避免使用者根本沒點
// 「存入 Anki」也白白抓一次圖片。牌組名稱直接沿用呼叫端傳進來的用途標籤，不用
// 使用者另外再填一次。
export default function SaveToAnkiButton({
  getCards,
  defaultDeckName = 'AnkiGen Hub',
  size = 'sm',
  onTrigger,
}: {
  getCards: () => Promise<AnkiCardInput[]>
  defaultDeckName?: string
  // 讓呼叫端可以跟旁邊的按鈕對齊高度：mcq 頁面和歷史紀錄的同排按鈕是 btn-sm，
  // slides 頁面的同排按鈕沒有加 btn-sm（比較大顆），兩邊都要能對上。
  size?: 'sm' | 'md'
  // 按下按鈕的當下順便觸發的動作（例如同步存入歷史紀錄），不等待、不影響這裡
  // 自己的存入 Anki 流程，失敗也不會顯示在這個元件的訊息區。
  onTrigger?: () => void
}) {
  const sizeClass = size === 'sm' ? ' btn-sm' : ''
  const [status, setStatus] = useState<'idle' | 'working'>('idle')
  const [message, setMessage] = useState<{ type: 'ok' | 'error'; text: string } | null>(null)

  async function handleClick() {
    const deckName = defaultDeckName.trim() || 'AnkiGen Hub'
    onTrigger?.()

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
          check.reason === 'safari-mixed-content'
            ? 'Safari 瀏覽器的安全機制（混合內容限制）不允許這個網站直接連到本機的 Anki，這是瀏覽器本身的限制，AnkiConnect 設定再怎麼調整也沒辦法繞過。請改用 Chrome 開啟本網站使用「存入 Anki」，或是改用「匯出 CSV」搭配 Anki 手動匯入。'
            : check.reason === 'unreachable'
              ? `偵測不到本機 Anki，可能原因：(1) Anki 沒開啟，或還沒安裝 AnkiConnect 附加元件（工具 > 附加元件 > 瀏覽並安裝，代碼輸入 2055492159）；(2) AnkiConnect 的網址白名單沒有把這個網站加進去——請到 Anki 的「工具 > 附加元件」，點選 AnkiConnect 後按「Config」，把 "webCorsOriginList" 這個欄位加上 "${origin}"（或先用 "*" 測試看看，能連上之後再改回只列出你實際會用到的網址比較安全），存檔後完全關閉並重新開啟 Anki 再試一次。`
              : '請先在 Anki 跳出的視窗裡按下允許存取，然後再按一次「存入 Anki」。',
      })
      return
    }

    try {
      const cards = await getCards()
      await ensureAnkiGenModelExists()
      await ensureDeckExists(deckName)
      await addCardsToAnki(deckName, cards)
      setMessage({ type: 'ok', text: `已成功存入 Anki 的「${deckName}」牌組！` })
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
      <button onClick={handleClick} disabled={status === 'working'} className={`btn btn-primary${sizeClass}`}>
        {status === 'working' ? '存入中...' : '📥 存入 Anki'}
      </button>
      {message && (
        <p className={`text-xs ${message.type === 'ok' ? 'text-success' : 'text-danger'}`}>
          {message.text}
        </p>
      )}
    </div>
  )
}
