'use client'

import { ensureFileExtension } from '@/lib/slide-filename'

export interface SlideCardData {
  localId: string
  url: string
  filename: string
  ext: string
  notes: string
  included: boolean
}

// 這個階段（匯入圖片、重新命名）還沒有產生任何卡片內容（題目/選項/答案要到步驟二選好匯出模式才會編輯），
// 所以這裡不需要「即時模擬預覽」之類跟卡片內容相關的動作，只單純管理圖片本身。
export default function SlideCard({
  card,
  isDuplicate,
  onUpdate,
  onRemove,
}: {
  card: SlideCardData
  isDuplicate: boolean
  onUpdate: (patch: Partial<SlideCardData>) => void
  onRemove: () => void
}) {
  return (
    <div className={`slide-card ${card.included ? '' : 'slide-card-excluded'}`}>
      <div className="slide-thumb-wrap">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="slide-thumb" src={card.url} alt="" />
      </div>
      <div className="slide-fields">
        <label className="field-label">檔案名稱</label>
        <input
          type="text"
          className={`cell-input ${isDuplicate ? 'slide-filename-input-error' : ''}`}
          defaultValue={card.filename}
          key={card.filename}
          onBlur={(e) => onUpdate({ filename: ensureFileExtension(e.target.value, card.ext) })}
        />
        {isDuplicate && (
          <span className="slide-filename-warning">⚠️ 檔名重複，會互相覆蓋</span>
        )}
        <label className="field-label">備註</label>
        <textarea
          className="cell-input"
          rows={2}
          placeholder="備註（選填）"
          value={card.notes}
          onChange={(e) => onUpdate({ notes: e.target.value })}
        />
      </div>
      <div className="slide-card-actions">
        <label className="slide-include-toggle">
          <input
            type="checkbox"
            checked={card.included}
            onChange={(e) => onUpdate({ included: e.target.checked })}
          />
          納入匯出
        </label>
        <button className="btn btn-danger-outline btn-xs" onClick={onRemove} title="移除">
          🗑️
        </button>
      </div>
    </div>
  )
}
