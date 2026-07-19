'use client'

import { useState } from 'react'
import { buildMcqCsv, downloadCsv } from '@/lib/export-csv'
import type { McqCard } from '@/lib/history-types'

interface CardState extends McqCard {
  localId: string
}

const OPTION_KEYS = ['optionA', 'optionB', 'optionC', 'optionD', 'optionE', 'optionF'] as const

const PROMPT_TEMPLATE = (sourceText: string) => `你是一個幫忙把文字內容轉換成 Anki 選擇題卡片的助手。請閱讀以下文字內容，盡量抽取或改寫成多張選擇題，用 JSON 陣列格式回傳，不要有其他文字或說明。

每個元素的格式：
{
  "questionText": "題目內容",
  "optionA": "選項A", "optionB": "選項B", "optionC": "選項C", "optionD": "選項D", "optionE": "選項E", "optionF": "選項F",
  "answer": "正確答案的字母，例如「A」；如果是多選題就用多個字母，例如「AC」",
  "isMultiple": true 或 false（是否為多選題）,
  "notes": "簡短的解釋或補充說明（選填，沒有就留空字串）"
}

規則：
- 至少要有 optionA 和 optionB，用不到的選項留空字串 ""
- 如果內容本身包含數學公式，維持原本的寫法（例如 $x^2$ 或 \\(x^2\\)），不要自己改寫

文字內容：
"""
${sourceText}
"""`

async function callGemini(apiKey: string, model: string, sourceText: string): Promise<McqCard[]> {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: PROMPT_TEMPLATE(sourceText) }] }],
        generationConfig: { responseMimeType: 'application/json' },
      }),
    }
  )

  if (!response.ok) {
    throw new Error(`Gemini API 呼叫失敗（${response.status}）：${await response.text()}`)
  }

  const data = await response.json()
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text
  if (!text) throw new Error('Gemini 沒有回傳內容')

  const parsed = JSON.parse(text)
  if (!Array.isArray(parsed)) throw new Error('Gemini 回傳的格式不是陣列')
  return parsed
}

function makeCardState(card: Partial<McqCard> = {}): CardState {
  return {
    localId: crypto.randomUUID(),
    questionText: card.questionText ?? '',
    optionA: card.optionA ?? '',
    optionB: card.optionB ?? '',
    optionC: card.optionC ?? '',
    optionD: card.optionD ?? '',
    optionE: card.optionE ?? '',
    optionF: card.optionF ?? '',
    answer: card.answer ?? '',
    isMultiple: card.isMultiple ?? false,
    notes: card.notes ?? '',
  }
}

export default function McqToolPage() {
  const [apiKey, setApiKey] = useState('')
  const [model, setModel] = useState('gemini-3.5-flash')
  const [sourceText, setSourceText] = useState('')
  const [cards, setCards] = useState<CardState[]>([])
  const [purpose, setPurpose] = useState('')
  const [parsing, setParsing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: 'ok' | 'error'; text: string } | null>(null)

  async function handleParse() {
    if (!apiKey.trim()) {
      setMessage({ type: 'error', text: '請先輸入 Gemini API Key' })
      return
    }
    if (!sourceText.trim()) {
      setMessage({ type: 'error', text: '請先貼上要解析的文字內容' })
      return
    }

    setParsing(true)
    setMessage(null)
    try {
      const parsed = await callGemini(apiKey.trim(), model, sourceText)
      setCards((prev) => [...prev, ...parsed.map((c) => makeCardState(c))])
      setMessage({ type: 'ok', text: `解析出 ${parsed.length} 張卡片` })
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : String(error) })
    } finally {
      setParsing(false)
    }
  }

  function updateCard(localId: string, patch: Partial<CardState>) {
    setCards((prev) => prev.map((c) => (c.localId === localId ? { ...c, ...patch } : c)))
  }

  function removeCard(localId: string) {
    setCards((prev) => prev.filter((c) => c.localId !== localId))
  }

  function addEmptyCard() {
    setCards((prev) => [...prev, makeCardState()])
  }

  function handleDownloadCsv() {
    if (cards.length === 0) return
    downloadCsv(`ankigen_mcq_${Date.now()}.csv`, buildMcqCsv(cards))
  }

  async function handleSave() {
    if (cards.length === 0) {
      setMessage({ type: 'error', text: '請先至少準備一張卡片' })
      return
    }
    const missingText = cards.some((c) => !c.questionText.trim() || !c.answer.trim())
    if (missingText) {
      setMessage({ type: 'error', text: '每張卡片都要填題目和答案' })
      return
    }

    setSaving(true)
    setMessage(null)
    try {
      const response = await fetch('/api/history/mcq', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          purpose,
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          cards: cards.map(({ localId, ...rest }) => rest),
        }),
      })
      const data = await response.json()
      if (!response.ok) {
        setMessage({ type: 'error', text: data.error ?? '存入歷史紀錄失敗' })
        return
      }
      setMessage({ type: 'ok', text: '已成功存入歷史紀錄！' })
      setCards([])
      setPurpose('')
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : String(error) })
    } finally {
      setSaving(false)
    }
  }

  return (
    <main className="mx-auto max-w-2xl p-6">
      <h1 className="mb-4 text-xl font-semibold">文字選擇題產生器</h1>

      <div className="mb-4 flex flex-col gap-2">
        <div className="flex gap-2">
          <input
            type="password"
            placeholder="Gemini API Key"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            className="flex-1 rounded border border-gray-300 px-2 py-1 text-sm"
          />
          <select
            value={model}
            onChange={(e) => setModel(e.target.value)}
            className="rounded border border-gray-300 px-2 py-1 text-sm"
          >
            <option value="gemini-3.5-flash">gemini-3.5-flash（推薦）</option>
            <option value="gemini-3.1-flash-lite">gemini-3.1-flash-lite（極速）</option>
            <option value="gemini-3.1-pro-preview">gemini-3.1-pro-preview（深度解析）</option>
          </select>
        </div>
        <textarea
          placeholder="貼上要轉換成選擇題的文字內容"
          value={sourceText}
          onChange={(e) => setSourceText(e.target.value)}
          rows={8}
          className="rounded border border-gray-300 px-2 py-1 text-sm"
        />
        <div className="flex gap-2">
          <button
            onClick={handleParse}
            disabled={parsing}
            className="rounded bg-blue-600 px-3 py-2 text-white disabled:opacity-50"
          >
            {parsing ? '解析中...' : 'AI 解析'}
          </button>
          <button onClick={addEmptyCard} className="rounded border border-gray-300 px-3 py-2 text-sm">
            手動新增一張空卡片
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-4">
        {cards.map((card, index) => (
          <div key={card.localId} className="rounded border border-gray-300 p-3">
            <div className="mb-2 text-xs text-gray-500">第 {index + 1} 張</div>
            <input
              placeholder="題目"
              value={card.questionText}
              onChange={(e) => updateCard(card.localId, { questionText: e.target.value })}
              className="mb-2 w-full rounded border border-gray-300 px-2 py-1 text-sm"
            />
            <div className="mb-2 grid grid-cols-3 gap-1">
              {OPTION_KEYS.map((key, i) => (
                <input
                  key={key}
                  placeholder={`選項 ${String.fromCharCode(65 + i)}`}
                  value={card[key]}
                  onChange={(e) => updateCard(card.localId, { [key]: e.target.value })}
                  className="rounded border border-gray-300 px-2 py-1 text-sm"
                />
              ))}
            </div>
            <div className="mb-2 flex items-center gap-3">
              <input
                placeholder="正確答案，例如 A 或 AC"
                value={card.answer}
                onChange={(e) => updateCard(card.localId, { answer: e.target.value })}
                className="rounded border border-gray-300 px-2 py-1 text-sm"
              />
              <label className="flex items-center gap-1 text-sm">
                <input
                  type="checkbox"
                  checked={card.isMultiple}
                  onChange={(e) => updateCard(card.localId, { isMultiple: e.target.checked })}
                />
                多選題
              </label>
            </div>
            <textarea
              placeholder="備註（選填）"
              value={card.notes}
              onChange={(e) => updateCard(card.localId, { notes: e.target.value })}
              className="mb-2 w-full rounded border border-gray-300 px-2 py-1 text-sm"
            />
            <button
              onClick={() => removeCard(card.localId)}
              className="text-xs text-red-600 underline"
            >
              移除這張卡片
            </button>
          </div>
        ))}
      </div>

      {cards.length > 0 && (
        <div className="mt-4 flex flex-col gap-2">
          <input
            placeholder="這批卡片是為了什麼而做的？（選填）"
            value={purpose}
            onChange={(e) => setPurpose(e.target.value)}
            className="rounded border border-gray-300 px-2 py-1 text-sm"
          />
          <div className="flex gap-2">
            <button
              onClick={handleSave}
              disabled={saving}
              className="rounded bg-blue-600 px-3 py-2 text-white disabled:opacity-50"
            >
              {saving ? '存入中...' : '存入歷史紀錄'}
            </button>
            <button
              onClick={handleDownloadCsv}
              className="rounded border border-gray-300 px-3 py-2 text-sm"
            >
              下載 CSV
            </button>
          </div>
        </div>
      )}

      {message && (
        <p className={`mt-3 text-sm ${message.type === 'ok' ? 'text-green-700' : 'text-red-600'}`}>
          {message.text}
        </p>
      )}
    </main>
  )
}
