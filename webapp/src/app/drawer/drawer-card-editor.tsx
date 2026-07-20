'use client'

import type { DrawerCard } from '@/lib/drawer-storage'

const OPTION_KEYS = ['optionA', 'optionB', 'optionC', 'optionD', 'optionE', 'optionF'] as const

function normalizeAnswer(value: string): string {
  return value.toUpperCase().replace(/[^A-F]/g, '').split('').join(', ')
}

export default function DrawerCardEditor({
  card,
  onUpdate,
  onRemove,
}: {
  card: DrawerCard
  onUpdate: (patch: Partial<DrawerCard>) => void
  onRemove: () => void
}) {
  return (
    <div className="mcq-edit-panel">
      <div className="mcq-edit-header">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          className="mcq-edit-thumb"
          src={`/api/google-drive/image/${card.drivePreviewFileId}`}
          alt=""
        />
        <div className="min-w-0 flex-1">
          <div className="mcq-edit-filename">{card.filename}</div>
          <div className="field-hint">這裡的修改只會影響抽屜裡的這份副本，不會動到原本的歷史紀錄</div>
        </div>
        <button onClick={onRemove} className="btn btn-danger-outline btn-xs shrink-0">
          從抽屜移除
        </button>
      </div>

      <label className="field-label">提問文字</label>
      <textarea
        className="cell-input"
        rows={2}
        value={card.questionText}
        onChange={(e) => onUpdate({ questionText: e.target.value })}
      />

      <div className="mcq-edit-two-col mt-3">
        <div>
          <label className="field-label">題型</label>
          <select
            className="cell-select w-100"
            value={card.isMultiple ? 'y' : ''}
            onChange={(e) => onUpdate({ isMultiple: e.target.value === 'y' })}
          >
            <option value="">單選題</option>
            <option value="y">多選題</option>
          </select>
        </div>
        <div>
          <label className="field-label">答案（例：A 或 A, C）</label>
          <input
            type="text"
            className="cell-input"
            defaultValue={card.answer}
            key={card.answer}
            placeholder="A, C"
            onBlur={(e) => onUpdate({ answer: normalizeAnswer(e.target.value) })}
          />
        </div>
      </div>

      <label className="field-label mt-3">選項（A-F，留空表示沒有這個選項）</label>
      <div className="mcq-edit-options-grid mt-3">
        {OPTION_KEYS.map((key, i) => (
          <div key={key} className="mcq-edit-opt-wrap">
            <span className="cell-opt-lbl">{String.fromCharCode(65 + i)}</span>
            <input
              type="text"
              className="cell-input"
              placeholder={i >= 4 ? '(無)' : undefined}
              value={card[key]}
              onChange={(e) => onUpdate({ [key]: e.target.value })}
            />
          </div>
        ))}
      </div>

      <label className="field-label mt-3">備註</label>
      <textarea
        className="cell-input"
        rows={2}
        placeholder="備註（選填）"
        value={card.notes}
        onChange={(e) => onUpdate({ notes: e.target.value })}
      />

      <div className="mt-3">
        <a
          href={`/api/google-drive/image/${card.driveFileId}`}
          download={card.filename}
          className="text-xs text-primary underline"
        >
          下載原始圖片
        </a>
      </div>
    </div>
  )
}
