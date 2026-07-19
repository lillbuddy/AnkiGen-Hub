'use client'

import { useEffect, useState, type ChangeEvent } from 'react'
import { createPreviewBlob } from '@/lib/create-preview-blob'
import { clearDrawer, getDrawerCards } from '@/lib/drawer-storage'

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
              <button
                onClick={() => removeCard(card.localId)}
                className="self-start text-xs text-red-600 underline"
              >
                移除這張卡片
              </button>
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
