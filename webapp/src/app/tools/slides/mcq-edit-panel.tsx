'use client'

const OPTION_KEYS = ['optionA', 'optionB', 'optionC', 'optionD', 'optionE', 'optionF'] as const

export interface McqEditCard {
  url: string
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
}

function normalizeAnswer(value: string): string {
  return value.toUpperCase().replace(/[^A-F]/g, '').split('').join(', ')
}

export default function McqEditPanel({
  card,
  onUpdate,
  onGenerateDistractors,
  generating,
}: {
  card: McqEditCard
  onUpdate: (patch: Partial<McqEditCard>) => void
  onGenerateDistractors: () => void
  generating: boolean
}) {
  return (
    <div className="mcq-edit-panel">
      <div className="mcq-edit-header">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="mcq-edit-thumb" src={card.url} alt="" />
        <div>
          <div className="mcq-edit-filename">{card.filename}</div>
          <div className="field-hint">正在編輯這張卡片的內容</div>
        </div>
      </div>

      <label className="field-label">提問文字</label>
      <textarea
        className="cell-input"
        rows={4}
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

      <div className="mt-3 flex items-center justify-between">
        <label className="field-label" style={{ margin: 0 }}>
          選項（A-F，留空表示沒有這個選項）
        </label>
        <button
          onClick={onGenerateDistractors}
          disabled={generating}
          className="btn btn-secondary btn-sm"
          type="button"
          title="優先從牌組裡其他卡片已標記的答案挑選干擾選項，不夠的話再由 AI 生成，只會填入目前空白的 B/C/D 欄位"
        >
          {generating ? '產生中...' : '✨ AI 產生干擾選項'}
        </button>
      </div>
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
    </div>
  )
}
