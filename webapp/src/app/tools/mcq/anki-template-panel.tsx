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

function CodeBlock({ label, target, content }: { label: string; target: string; content: string }) {
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    await navigator.clipboard.writeText(content)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div>
      <div className="code-header">
        <span>{label}</span>
        <button onClick={handleCopy} className="btn btn-secondary btn-xs">
          {copied ? '已複製！' : '複製'}
        </button>
      </div>
      <textarea readOnly value={content} id={target} className="code-area" />
    </div>
  )
}

export default function AnkiTemplatePanel() {
  const [tab, setTab] = useState<TabId>('fields')

  return (
    <div className="card-panel mt-6">
      <div className="panel-header">
        <h2>💻 Anki 萬用選擇題模板程式碼</h2>
      </div>
      <div className="panel-body">
        <p className="instruction-text">
          只要在 Anki 中新增一個自訂卡片類型，將以下程式碼貼入對應位置，就能在手機/電腦上呈現完全一樣的效果！
        </p>

        <div className="tab-headers">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`tab-btn ${tab === t.id ? 'active' : ''}`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab === 'fields' && (
          <div>
            <p className="tab-intro">
              在 Anki 新增卡片類型 (Note Type) 時，請建立且精確命名以下 10 個欄位：
            </p>
            <div className="fields-list">
              {ANKI_FIELDS.map((f) => (
                <div key={f.name} className="field-item">
                  <code>{f.name}</code>
                  <span className="field-desc">{f.desc}</span>
                </div>
              ))}
            </div>
          </div>
        )}
        {tab === 'front' && (
          <CodeBlock label="正面模板 (Front Template)" target="code-front" content={ANKI_FRONT_TEMPLATE} />
        )}
        {tab === 'back' && (
          <CodeBlock label="背面模板 (Back Template)" target="code-back" content={ANKI_BACK_TEMPLATE} />
        )}
        {tab === 'css' && (
          <CodeBlock label="共享 CSS 樣式 (Styling CSS)" target="code-css" content={ANKI_CSS_TEMPLATE} />
        )}
      </div>
    </div>
  )
}
