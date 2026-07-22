'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import Script from 'next/script'
import { buildClozeCsv, downloadCsv } from '@/lib/export-csv'
import { useCurrentUser } from '@/lib/use-current-user'
import { getSavedGeminiApiKey, saveGeminiApiKey } from '@/lib/gemini-key-storage'
import { callGeminiJson } from '@/lib/gemini-client'
import type { ClozeCard } from '@/lib/history-types'
import {
  addClozeCardsToAnki,
  ensureClozeModelAvailable,
  ensureDeckExists,
  type AnkiClozeCardInput,
} from '@/lib/anki-connect'
import SaveToAnkiButton from '@/components/save-to-anki-button'
import ClozeSimulator from './cloze-simulator'

// 使用者還沒生成任何卡片時，模擬器先顯示一張範例卡片，讓人一眼看懂這個功能在做什麼。
const SAMPLE_PREVIEW_CARD: ClozeCard = {
  word: 'ubiquitous',
  sentence:
    'Smartphones have become **ubiquitous** in modern society, appearing in nearly every aspect of daily life.',
  notes: 'adj. 無所不在的；普遍存在的',
}

const SAMPLE_WORDS = `ubiquitous
ephemeral
pragmatic`

const PROMPT_TEMPLATE = (words: string) => `你是一個幫忙把單字轉換成 Anki 克漏字（Cloze）卡片的助手。請針對下面每一個單字，各自生成一句自然、有上下文語境的例句，並且用兩個星號 ** 把「這個單字在句子中實際出現的部分」框起來（例如單字是 run，句子裡用了 running，就框 **running**）。用 JSON 陣列格式回傳，不要有其他文字或說明。

每個元素的格式：
{
  "word": "原始單字",
  "sentence": "包含 ** 標記的例句",
  "notes": "單字的詞性、意思、或簡短補充說明（選填，沒有就留空字串）"
}

規則：
- 例句裡一定要有用 ** ** 框起來的部分，且框起來的內容要能對應到這個單字
- 每行輸入是一個單字（也可能用逗號分隔多個單字），忽略空白行

單字列表：
"""
${words}
"""`

async function callGemini(apiKey: string, model: string, words: string): Promise<ClozeCard[]> {
  const parsed = await callGeminiJson(apiKey, model, PROMPT_TEMPLATE(words))
  if (!Array.isArray(parsed)) throw new Error('Gemini 回傳的格式不是陣列')
  return parsed as ClozeCard[]
}

interface CardState extends ClozeCard {
  localId: string
}

function makeCardState(card: Partial<ClozeCard> = {}): CardState {
  return {
    localId: crypto.randomUUID(),
    word: card.word ?? '',
    sentence: card.sentence ?? '',
    notes: card.notes ?? '',
  }
}

export default function ClozeToolPage() {
  const { user, ready: userReady } = useCurrentUser()
  const [apiKey, setApiKey] = useState('')
  const [model, setModel] = useState('gemini-3.5-flash')
  const [wordsText, setWordsText] = useState('')
  const [cards, setCards] = useState<CardState[]>([])
  const [purpose, setPurpose] = useState('')
  const [parsing, setParsing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: 'ok' | 'error'; text: string } | null>(null)
  const [previewIndex, setPreviewIndex] = useState(0)
  const lastSavedSignatureRef = useRef<string | null>(null)

  useEffect(() => {
    // localStorage 只在瀏覽器端讀得到，故意等 mount 後才讀，讓使用者用過一次的
    // key 之後打開頁面就自動帶出來，不用每次都重打。
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setApiKey(getSavedGeminiApiKey())
  }, [])

  async function handleGenerate() {
    if (!apiKey.trim()) {
      setMessage({ type: 'error', text: '請先輸入 Gemini API Key' })
      return
    }
    if (!wordsText.trim()) {
      setMessage({ type: 'error', text: '請先輸入要背的單字' })
      return
    }

    setParsing(true)
    setMessage(null)
    try {
      const parsed = await callGemini(apiKey.trim(), model, wordsText)
      setCards((prev) => [...prev, ...parsed.map((c) => makeCardState(c))])
      setMessage({ type: 'ok', text: `生成了 ${parsed.length} 張克漏字卡片` })
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : String(error) })
    } finally {
      setParsing(false)
    }
  }

  function updateCard(localId: string, patch: Partial<CardState>) {
    setCards((prev) => prev.map((c) => (c.localId === localId ? { ...c, ...patch } : c)))
  }

  function removeCard(index: number) {
    if (!confirm(`確定要刪除第 ${index + 1} 張卡片嗎？`)) return
    setCards((prev) => prev.filter((_, i) => i !== index))
    setPreviewIndex((prev) => Math.min(prev, cards.length - 2))
  }

  function handleLoadSample() {
    setWordsText(SAMPLE_WORDS)
  }

  function handleClear() {
    setWordsText('')
    setCards([])
    setMessage(null)
  }

  function handleDownloadCsv() {
    if (cards.length === 0) return
    downloadCsv(`ankigen_cloze_${Date.now()}.csv`, buildClozeCsv(cards))
    void ensureSavedToHistory()
  }

  // 不管使用者是按「存入紀錄」、「匯出 CSV」還是「存入 Anki」，都應該順手把這批卡片
  // 存進歷史紀錄，不用另外再點一次。用內容的簽章判斷「這批卡片跟上次存的一不一樣」，
  // 一樣就跳過（避免同一批卡片因為連續按了兩個按鈕而存成兩筆重複的歷史紀錄）。
  function buildHistorySignature() {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    return JSON.stringify({ purpose, cards: cards.map(({ localId, ...rest }) => rest) })
  }

  async function ensureSavedToHistory(): Promise<{ ok: boolean; alreadySaved: boolean; error?: string }> {
    if (!user) return { ok: false, alreadySaved: false, error: '請先登入才能存入歷史紀錄' }
    if (cards.length === 0) return { ok: false, alreadySaved: false, error: '請先至少準備一張卡片' }
    if (cards.some((c) => !c.word.trim() || !c.sentence.trim())) {
      return { ok: false, alreadySaved: false, error: '每張卡片都要填單字和例句' }
    }

    const signature = buildHistorySignature()
    if (signature === lastSavedSignatureRef.current) {
      return { ok: true, alreadySaved: true }
    }

    try {
      const response = await fetch('/api/history/cloze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          purpose,
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          cards: cards.map(({ localId, ...rest }) => rest),
        }),
      })
      const data = await response.json()
      if (!response.ok) return { ok: false, alreadySaved: false, error: data.error ?? '存入歷史紀錄失敗' }
      lastSavedSignatureRef.current = signature
      return { ok: true, alreadySaved: false }
    } catch (error) {
      return { ok: false, alreadySaved: false, error: error instanceof Error ? error.message : String(error) }
    }
  }

  async function handleSave() {
    setSaving(true)
    setMessage(null)
    const result = await ensureSavedToHistory()
    setSaving(false)
    if (!result.ok) {
      setMessage({ type: 'error', text: result.error ?? '存入歷史紀錄失敗' })
      return
    }
    setMessage({
      type: 'ok',
      text: result.alreadySaved ? '這份卡組已經存入歷史紀錄囉！' : '已成功存入歷史紀錄！',
    })
  }

  const previewCard = cards[Math.min(previewIndex, cards.length - 1)] ?? SAMPLE_PREVIEW_CARD
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const ankiCards: AnkiClozeCardInput[] = cards.map(({ localId, ...card }) => card)

  return (
    <main className="app-container">
      {/* 左欄：輸入與編輯區 */}
      <section className="flex flex-col gap-6">
        <div className="card-panel">
          <div className="panel-header">
            <h2>📝 1. 輸入要背的單字</h2>
            <div className="row-actions">
              <button onClick={handleLoadSample} className="btn btn-secondary btn-sm">
                💡 載入範例
              </button>
              <button onClick={handleClear} className="btn btn-danger-outline btn-sm">
                🗑️ 清除
              </button>
            </div>
          </div>
          <div className="panel-body">
            <p className="instruction-text">
              一行輸入一個單字（也可以用逗號分隔），AI 會針對每個單字各自生成一句例句，並自動挖空成克漏字卡片。
            </p>

            <div className="api-key-wrapper">
              <span>🔑</span>
              <input
                type="password"
                placeholder="輸入您的 Gemini API Key"
                value={apiKey}
                onChange={(e) => {
                  setApiKey(e.target.value)
                  saveGeminiApiKey(e.target.value.trim())
                }}
                className="api-key-input"
              />
              <span className="api-key-divider">|</span>
              <span>🤖</span>
              <select
                value={model}
                onChange={(e) => setModel(e.target.value)}
                className="model-select"
              >
                <option value="gemini-3.5-flash">gemini-3.5-flash（推薦）</option>
                <option value="gemini-3.1-flash-lite">gemini-3.1-flash-lite（極速）</option>
                <option value="gemini-3.1-pro-preview">gemini-3.1-pro-preview（深度解析）</option>
              </select>
              <a
                href="https://aistudio.google.com/"
                target="_blank"
                rel="noopener noreferrer"
                className="whitespace-nowrap text-xs font-semibold text-accent"
              >
                ❓ 獲取 Key
              </a>
            </div>

            <textarea
              placeholder={'貼上要背的單字，一行一個，例如：\nubiquitous\nephemeral\npragmatic'}
              value={wordsText}
              onChange={(e) => setWordsText(e.target.value)}
              rows={10}
              className="field-input mb-4 font-mono"
            />

            <button onClick={handleGenerate} disabled={parsing} className="btn btn-primary w-full">
              {parsing ? '✨ 生成中...' : '✨ AI 生成例句卡片'}
            </button>
          </div>
        </div>

        {cards.length > 0 && (
          <div className="card-panel">
            <div className="panel-header">
              <h2>✅ 2. 預覽與修改例句卡片 ({cards.length} 張)</h2>
            </div>
            <div className="panel-body">
              <label className="field-label">🏷️ 這批卡片的用途標籤</label>
              <input
                placeholder="方便日後在歷史紀錄搜尋，也是存入 Anki 時的牌組名稱"
                value={purpose}
                onChange={(e) => setPurpose(e.target.value)}
                className="field-input mb-3"
              />
              <div className="row-actions mb-3">
                <button
                  onClick={handleSave}
                  disabled={saving || (userReady && !user)}
                  title={userReady && !user ? '登入後才能存入歷史紀錄' : undefined}
                  className="btn btn-secondary btn-sm"
                >
                  {saving ? '存入中...' : userReady && !user ? '🔒 存入紀錄' : '🔖 存入紀錄'}
                </button>
                <button onClick={handleDownloadCsv} className="btn btn-success btn-sm">
                  📄 匯出 CSV
                </button>
                <SaveToAnkiButton
                  saveCards={async (deckName) => {
                    await ensureClozeModelAvailable()
                    await ensureDeckExists(deckName)
                    await addClozeCardsToAnki(deckName, ankiCards)
                  }}
                  defaultDeckName={purpose || 'AnkiGen Hub'}
                  onTrigger={() => void ensureSavedToHistory()}
                />
              </div>
              {userReady && !user && (
                <p className="mb-3 text-xs text-text-secondary">
                  🔒 登入後可以把這份卡組存入歷史紀錄。{' '}
                  <Link href="/login" className="font-semibold text-accent">
                    前往登入
                  </Link>
                </p>
              )}
              <p className="instruction-text mb-2">
                「例句」裡的 **文字** 標記代表會被挖空的部分，可以直接編輯調整要挖空哪一段。
              </p>
              <div className="table-container">
                <table className="editable-table">
                  <thead>
                    <tr>
                      <th>單字</th>
                      <th>例句（** 標記挖空處）</th>
                      <th>備註</th>
                      <th>操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cards.map((card, index) => (
                      <tr
                        key={card.localId}
                        className={index === previewIndex ? 'table-row-active' : ''}
                        onClick={(e) => {
                          const tag = (e.target as HTMLElement).tagName
                          if (['INPUT', 'SELECT', 'BUTTON', 'TEXTAREA'].includes(tag)) return
                          setPreviewIndex(index)
                        }}
                      >
                        <td>
                          <input
                            className="cell-input"
                            value={card.word}
                            onChange={(e) => updateCard(card.localId, { word: e.target.value })}
                          />
                        </td>
                        <td>
                          <textarea
                            className="cell-input"
                            rows={2}
                            value={card.sentence}
                            onChange={(e) => updateCard(card.localId, { sentence: e.target.value })}
                          />
                        </td>
                        <td>
                          <input
                            className="cell-input"
                            value={card.notes}
                            onChange={(e) => updateCard(card.localId, { notes: e.target.value })}
                          />
                        </td>
                        <td>
                          <div className="row-actions">
                            <button
                              onClick={() => setPreviewIndex(index)}
                              className="btn btn-secondary btn-xs"
                              title="即時模擬預覽"
                            >
                              👁️
                            </button>
                            <button
                              onClick={() => removeCard(index)}
                              className="btn btn-danger-outline btn-xs"
                              title="刪除本題"
                            >
                              🗑️
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {message && (
          <p className={`text-sm ${message.type === 'ok' ? 'text-success' : 'text-danger'}`}>
            {message.text}
          </p>
        )}
      </section>

      {/* 右欄：卡片預覽 */}
      <section className="flex flex-col gap-6">
        <ClozeSimulator
          key={previewCard === SAMPLE_PREVIEW_CARD ? 'sample' : previewIndex}
          card={previewCard}
        />
      </section>

      {/* 讓模擬器能比照 Anki 內部渲染數學公式，而不是顯示未渲染的原始語法。 */}
      <Script id="mathjax-config" strategy="afterInteractive">
        {`window.MathJax = {
          tex: {
            inlineMath: [['\\\\(', '\\\\)']],
            displayMath: [['\\\\[', '\\\\]']],
            processEscapes: true
          },
          options: {
            skipHtmlTags: ['script', 'noscript', 'style', 'textarea', 'pre']
          }
        };`}
      </Script>
      <Script
        id="mathjax-script"
        src="https://cdnjs.cloudflare.com/ajax/libs/mathjax/3.2.2/es5/tex-chtml.js"
        strategy="afterInteractive"
      />
    </main>
  )
}
