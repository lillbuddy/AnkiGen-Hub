'use client'

import { useState, type ChangeEvent } from 'react'
import { createPreviewBlob } from '@/lib/create-preview-blob'

interface CardState {
  localId: string
  file: File
  previewBlob: Blob
  previewObjectUrl: string
  filename: string
  notes: string
}

function makeCard(file: File, previewBlob: Blob): CardState {
  return {
    localId: crypto.randomUUID(),
    file,
    previewBlob,
    previewObjectUrl: URL.createObjectURL(previewBlob),
    filename: file.name,
    notes: '',
  }
}

export default function ImageOcclusionPage() {
  const [cards, setCards] = useState<CardState[]>([])
  const [purpose, setPurpose] = useState('')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: 'ok' | 'error'; text: string } | null>(null)

  async function handleFilesSelected(e: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    e.target.value = ''

    const newCards = await Promise.all(
      files.map(async (file) => makeCard(file, await createPreviewBlob(file)))
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

    setSaving(true)
    setMessage(null)
    try {
      const formData = new FormData()
      formData.append('purpose', purpose)
      formData.append(
        'meta',
        JSON.stringify(cards.map((c) => ({ filename: c.filename, notes: c.notes })))
      )
      cards.forEach((c, i) => {
        formData.append(`original_${i}`, c.file, c.file.name)
        formData.append(`preview_${i}`, c.previewBlob, 'preview.jpg')
      })

      const response = await fetch('/api/history/slides-occlusion', {
        method: 'POST',
        body: formData,
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
      <h1 className="mb-1 text-xl font-semibold">Image Occlusion 圖片標記工具</h1>
      <p className="mb-4 text-sm text-text-secondary">
        這裡只準備圖片和備註，實際的遮蓋框線要匯入 Anki 後，在 Anki 裡對每張圖片手動畫。
      </p>

      <input type="file" accept="image/*" multiple onChange={handleFilesSelected} className="mb-4" />

      <div className="flex flex-col gap-4">
        {cards.map((card, index) => (
          <div key={card.localId} className="flex gap-4 card-panel p-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={card.previewObjectUrl}
              alt={card.filename}
              className="h-24 w-24 flex-shrink-0 rounded object-cover"
            />
            <div className="flex flex-1 flex-col gap-2">
              <div className="text-xs text-text-secondary">
                第 {index + 1} 張：{card.filename}
              </div>
              <textarea
                placeholder="備註（選填）"
                value={card.notes}
                onChange={(e) => updateCard(card.localId, { notes: e.target.value })}
                className="field-input"
              />
              <button
                onClick={() => removeCard(card.localId)}
                className="self-start text-xs text-danger underline"
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
            className="field-input"
          />
          <button
            onClick={handleSave}
            disabled={saving}
            className="btn btn-primary"
          >
            {saving ? '存入中...' : '存入歷史紀錄'}
          </button>
        </div>
      )}

      {message && (
        <p className={`mt-3 text-sm ${message.type === 'ok' ? 'text-success' : 'text-danger'}`}>
          {message.text}
        </p>
      )}
    </main>
  )
}
