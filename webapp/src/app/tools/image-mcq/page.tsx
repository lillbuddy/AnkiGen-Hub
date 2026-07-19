'use client'

import { useEffect, useState, type ChangeEvent } from 'react'
import { createPreviewBlob } from '@/lib/create-preview-blob'
import { clearDrawer, getDrawerCards } from '@/lib/drawer-storage'
import { callGeminiJson } from '@/lib/gemini-client'
import { buildDistractorPrompt, getGlossaryPoolExcluding, parseGlossaryMarkdown } from '@/lib/glossary'

// 干擾選項只鎖定 B/C/D 這三個「標準四選一」的欄位，且只補目前空白的，已經有內容的不會被覆蓋。
// 這個功能假設選項 A 放的就是正確答案（沿用舊版的既有慣例）。
const DISTRACTOR_TARGET_FIELDS = ['optionB', 'optionC', 'optionD'] as const

// 'new'：新選的圖片，還沒上傳，存 File + 縮圖 Blob，稍後要整個上傳。
// 'reused'：從抽屜沿用的舊卡片，圖片已經在 Drive 上了，直接沿用既有的 driveFileId，不用重新上傳。
interface CardState {
  localId: string
  kind: 'new' | 'reused'
  file?: File
  previewBlob?: Blob
  driveFileId?: string
  drivePreviewFileId?: string
  previewObjectUrl: string
  filename: string
  questionText: string
  optionA: string
  optionB: string
  optionC: string
  optionD: string
  optionE: string
  optionF: string
  answer: string
  isMultiple: boolean
  notes: string
}

function makeNewCard(file: File, previewBlob: Blob): CardState {
  return {
    localId: crypto.randomUUID(),
    kind: 'new',
    file,
    previewBlob,
    previewObjectUrl: URL.createObjectURL(previewBlob),
    filename: file.name,
    questionText: '',
    optionA: '',
    optionB: '',
    optionC: '',
    optionD: '',
    optionE: '',
    optionF: '',
    answer: '',
    isMultiple: false,
    notes: '',
  }
}

const OPTION_KEYS = ['optionA', 'optionB', 'optionC', 'optionD', 'optionE', 'optionF'] as const

export default function ImageMcqPage() {
  const [cards, setCards] = useState<CardState[]>([])
  const [purpose, setPurpose] = useState('')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: 'ok' | 'error'; text: string } | null>(null)
  const [fromDrawer, setFromDrawer] = useState(false)
  const [apiKey, setApiKey] = useState('')
  const [model, setModel] = useState('gemini-3.5-flash')
  const [glossary, setGlossary] = useState<string[]>([])
  const [glossaryStatus, setGlossaryStatus] = useState('')
  const [generatingFor, setGeneratingFor] = useState<string | null>(null)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('from') !== 'drawer') return

    // 同上：window.location 和抽屜的 localStorage 都只在瀏覽器端讀得到，故意等 mount 後才讀。
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setFromDrawer(true)
    const drawerCards = getDrawerCards()
    setCards(
      drawerCards.map((c) => ({
        localId: crypto.randomUUID(),
        kind: 'reused',
        driveFileId: c.driveFileId,
        drivePreviewFileId: c.drivePreviewFileId,
        previewObjectUrl: `/api/google-drive/image/${c.drivePreviewFileId}`,
        filename: c.filename,
        questionText: c.questionText,
        optionA: c.optionA,
        optionB: c.optionB,
        optionC: c.optionC,
        optionD: c.optionD,
        optionE: c.optionE,
        optionF: c.optionF,
        answer: c.answer,
        isMultiple: c.isMultiple,
        notes: c.notes,
      }))
    )
  }, [])

  async function handleFilesSelected(e: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    e.target.value = '' // 讓使用者可以重複選同一個檔案

    const newCards = await Promise.all(
      files.map(async (file) => makeNewCard(file, await createPreviewBlob(file)))
    )
    setCards((prev) => [...prev, ...newCards])
  }

  function updateCard(localId: string, patch: Partial<CardState>) {
    setCards((prev) => prev.map((c) => (c.localId === localId ? { ...c, ...patch } : c)))
  }

  function removeCard(localId: string) {
    setCards((prev) => prev.filter((c) => c.localId !== localId))
  }

  async function handleGlossaryFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = '' // 允許重複選取同一個檔案
    if (!file) return

    try {
      const text = await file.text()
      const terms = parseGlossaryMarkdown(text)
      setGlossary(terms)
      setGlossaryStatus(
        terms.length > 0
          ? `已載入 ${terms.length} 個詞彙（${file.name}）`
          : `「${file.name}」裡沒有解析到任何詞彙，請確認格式（一行一個詞彙，或用逗號、頓號分隔）`
      )
    } catch {
      setGlossaryStatus('讀取檔案失敗，請確認檔案格式是否正確。')
    }
  }

  async function handleGenerateDistractors(localId: string) {
    const card = cards.find((c) => c.localId === localId)
    if (!card) return

    if (!apiKey.trim()) {
      setMessage({ type: 'error', text: '請先輸入 Gemini API Key' })
      return
    }
    if (!card.optionA.trim()) {
      setMessage({ type: 'error', text: '請先在選項 A 填入正確答案，AI 才知道要根據什麼產生干擾選項' })
      return
    }
    const emptyFields = DISTRACTOR_TARGET_FIELDS.filter((field) => !card[field].trim())
    if (emptyFields.length === 0) {
      setMessage({
        type: 'error',
        text: '選項 B、C、D 都已經有內容了。如果想讓 AI 重新產生，請先清空想要覆蓋的欄位',
      })
      return
    }

    setGeneratingFor(localId)
    setMessage(null)
    try {
      const pool = getGlossaryPoolExcluding(glossary, card.optionA)
      const prompt = buildDistractorPrompt(card.questionText, card.optionA, emptyFields.length, pool)
      const distractors = await callGeminiJson(apiKey.trim(), model, prompt)
      if (!Array.isArray(distractors)) throw new Error('Gemini 回傳的格式不是陣列')

      const patch: Partial<CardState> = {}
      emptyFields.forEach((field, idx) => {
        if (distractors[idx]) patch[field] = String(distractors[idx]).trim()
      })
      updateCard(localId, patch)
    } catch (error) {
      setMessage({
        type: 'error',
        text: `AI 產生干擾選項失敗：${error instanceof Error ? error.message : String(error)}`,
      })
    } finally {
      setGeneratingFor(null)
    }
  }

  async function handleSave() {
    if (cards.length === 0) {
      setMessage({ type: 'error', text: '請先選取至少一張圖片' })
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
      const formData = new FormData()
      formData.append('purpose', purpose)
      formData.append(
        'meta',
        JSON.stringify(
          cards.map((c) => ({
            filename: c.filename,
            questionText: c.questionText,
            optionA: c.optionA,
            optionB: c.optionB,
            optionC: c.optionC,
            optionD: c.optionD,
            optionE: c.optionE,
            optionF: c.optionF,
            answer: c.answer,
            isMultiple: c.isMultiple,
            notes: c.notes,
            // 沿用的卡片直接帶舊的 Drive 檔案 ID，伺服器端看到這兩個值就不會再要求上傳檔案。
            ...(c.kind === 'reused'
              ? { driveFileId: c.driveFileId, drivePreviewFileId: c.drivePreviewFileId }
              : {}),
          }))
        )
      )
      cards.forEach((c, i) => {
        if (c.kind === 'new' && c.file && c.previewBlob) {
          formData.append(`original_${i}`, c.file, c.file.name)
          formData.append(`preview_${i}`, c.previewBlob, 'preview.jpg')
        }
      })

      const response = await fetch('/api/history/slides-mcq', {
        method: 'POST',
        body: formData,
      })
      const data = await response.json()

      if (!response.ok) {
        setMessage({ type: 'error', text: data.error ?? '存入歷史紀錄失敗' })
        return
      }

      if (fromDrawer) clearDrawer()

      setMessage({ type: 'ok', text: '已成功存入歷史紀錄！' })
      setCards([])
      setPurpose('')
      setFromDrawer(false)
    } catch (error) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : String(error),
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <main className="mx-auto max-w-2xl p-6">
      <h1 className="mb-1 text-xl font-semibold">圖片選擇題工具（最簡版）</h1>
      {fromDrawer && (
        <p className="mb-3 text-sm text-gray-500">
          已經從抽屜載入 {cards.length} 張卡片，可以直接修改，也可以再選新的圖片一起加進來。
        </p>
      )}

      <div className="mb-4 flex flex-col gap-2 rounded border border-gray-300 p-3">
        <div className="flex gap-2">
          <input
            type="password"
            placeholder="Gemini API Key（AI 產生干擾選項用）"
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
        <div className="flex items-center gap-2">
          <label className="rounded border border-gray-300 px-2 py-1 text-sm">
            上傳詞彙表 (.md)
            <input type="file" accept=".md,text/markdown" onChange={handleGlossaryFile} className="hidden" />
          </label>
          {glossaryStatus && <span className="text-xs text-gray-500">{glossaryStatus}</span>}
        </div>
      </div>

      <input type="file" accept="image/*" multiple onChange={handleFilesSelected} className="mb-4" />

      <div className="flex flex-col gap-4">
        {cards.map((card, index) => (
          <div key={card.localId} className="flex gap-4 rounded border border-gray-300 p-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={card.previewObjectUrl}
              alt={card.filename}
              className="h-24 w-24 flex-shrink-0 rounded object-cover"
            />
            <div className="flex flex-1 flex-col gap-2">
              <div className="text-xs text-gray-500">
                第 {index + 1} 張：{card.filename}
                {card.kind === 'reused' && '（沿用舊圖片）'}
              </div>
              <input
                placeholder="題目"
                value={card.questionText}
                onChange={(e) => updateCard(card.localId, { questionText: e.target.value })}
                className="rounded border border-gray-300 px-2 py-1 text-sm"
              />
              <div className="grid grid-cols-3 gap-1">
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
              <div className="flex items-center gap-3">
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
                className="rounded border border-gray-300 px-2 py-1 text-sm"
              />
              <div className="flex gap-3">
                <button
                  onClick={() => handleGenerateDistractors(card.localId)}
                  disabled={generatingFor === card.localId}
                  className="text-xs text-blue-600 underline disabled:opacity-50"
                >
                  {generatingFor === card.localId ? '產生中...' : 'AI 產生干擾選項（B/C/D）'}
                </button>
                <button
                  onClick={() => removeCard(card.localId)}
                  className="text-xs text-red-600 underline"
                >
                  移除這張卡片
                </button>
              </div>
            </div>
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
          <button
            onClick={handleSave}
            disabled={saving}
            className="rounded bg-blue-600 px-3 py-2 text-white disabled:opacity-50"
          >
            {saving ? '存入中...' : '存入歷史紀錄'}
          </button>
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
