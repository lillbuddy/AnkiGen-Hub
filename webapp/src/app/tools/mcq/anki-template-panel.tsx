'use client'

import { useState } from 'react'
import {
  ANKI_BACK_TEMPLATE,
  ANKI_CSS_TEMPLATE,
  ANKI_FIELDS,
  ANKI_FRONT_TEMPLATE,
} from '@/lib/anki-mcq-templates'

const TABS = [
  { id: 'fields', label: '1. 欄位設定' },
  { id: 'front', label: '2. 正面 HTML' },
  { id: 'back', label: '3. 背面 HTML' },
  { id: 'css', label: '4. 共享 CSS' },
] as const

type TabId = (typeof TABS)[number]['id']

function CodeBlock({ label, content }: { label: string; content: string }) {
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    await navigator.clipboard.writeText(content)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <span className="text-sm font-medium">{label}</span>
        <button onClick={handleCopy} className="btn btn-secondary btn-xs">
          {copied ? '已複製！' : '複製'}
        </button>
      </div>
      <textarea
        readOnly
        value={content}
        rows={10}
        className="field-input w-full font-mono text-xs"
      />
    </div>
  )
}

export default function AnkiTemplatePanel() {
  const [tab, setTab] = useState<TabId>('fields')

  return (
    <div className="card-panel p-3">
      <p className="mb-2 text-sm text-text-secondary">
        只要在 Anki 新增一個自訂卡片類型，把以下內容貼入對應位置，就能在手機/電腦呈現一樣的效果。
      </p>
      <div className="mb-3 flex gap-3 border-b border-panel-border text-sm">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`pb-2 ${
              tab === t.id
                ? 'border-b-2 border-primary font-medium text-primary'
                : 'text-text-secondary'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'fields' && (
        <div className="flex flex-col gap-1 text-sm">
          <p className="mb-1 text-text-secondary">在 Anki 新增卡片類型時，請建立且精確命名以下 10 個欄位：</p>
          {ANKI_FIELDS.map((f) => (
            <div key={f.name}>
              <code className="rounded bg-gray-100 px-1">{f.name}</code>{' '}
              <span className="text-text-secondary">{f.desc}</span>
            </div>
          ))}
        </div>
      )}
      {tab === 'front' && <CodeBlock label="正面模板 (Front Template)" content={ANKI_FRONT_TEMPLATE} />}
      {tab === 'back' && <CodeBlock label="背面模板 (Back Template)" content={ANKI_BACK_TEMPLATE} />}
      {tab === 'css' && <CodeBlock label="共享 CSS" content={ANKI_CSS_TEMPLATE} />}
    </div>
  )
}
