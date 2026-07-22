'use client'

import { useEffect, useState } from 'react'
import { renderCardHtml } from '@/lib/convert-math-delimiters'
import { splitClozeSentence } from '@/lib/cloze-markup'
import '../mcq/anki-simulator.css'

export interface ClozeSimCard {
  word: string
  sentence: string
  notes: string
}

declare global {
  interface Window {
    MathJax?: {
      typesetPromise?: () => Promise<void>
      typesetClear?: () => void
    }
  }
}

// 跟其他兩個工具的模擬器一樣用 key-reset 寫法：呼叫端傳入隨卡片變動的 key，
// 讓這個元件整個重新掛載來重置翻牌狀態，而不是在 effect 裡呼叫 setState。
export default function ClozeSimulator({ card }: { card: ClozeSimCard | null }) {
  const [flipped, setFlipped] = useState(false)

  useEffect(() => {
    if (window.MathJax?.typesetPromise) {
      window.MathJax.typesetClear?.()
      window.MathJax.typesetPromise().catch((err: unknown) => console.error('MathJax 渲染失敗:', err))
    }
  })

  useEffect(() => {
    function handleKeydown(e: KeyboardEvent) {
      const tag = (document.activeElement as HTMLElement | null)?.tagName
      if (e.code === 'Space' && tag !== 'TEXTAREA' && tag !== 'INPUT') {
        e.preventDefault()
        setFlipped((f) => !f)
      }
    }
    window.addEventListener('keydown', handleKeydown)
    return () => window.removeEventListener('keydown', handleKeydown)
  }, [])

  if (!card) {
    return (
      <div className="card-panel">
        <div className="panel-header">
          <h2>📱 Anki 效果即時模擬器</h2>
        </div>
        <div className="panel-body">
          <p className="text-sm text-text-secondary">目前沒有卡片可以預覽。</p>
        </div>
      </div>
    )
  }

  const parts = splitClozeSentence(card.sentence)

  return (
    <div className="card-panel">
      <div className="panel-header">
        <h2>📱 Anki 效果即時模擬器</h2>
        <button onClick={() => setFlipped((f) => !f)} className="btn btn-secondary btn-sm">
          🔄 翻轉卡片（Space）
        </button>
      </div>
      <div className="panel-body flex items-center justify-center py-6">
        <div
          className={`anki-card-container ${flipped ? 'flipped' : ''}`}
          onClick={() => setFlipped((f) => !f)}
        >
          <div className="anki-card-inner">
            {/* 正面：挖空 */}
            <div className="anki-card-face anki-card-front">
              <div className="sim-badge-container">
                <span className="sim-card-type-badge">克漏字</span>
                <span className="sim-card-tag">Front (正面)</span>
              </div>
              {parts ? (
                <div
                  className="sim-question"
                  dangerouslySetInnerHTML={{
                    __html: `${renderCardHtml(parts.before)}<span class="cloze-blank">[...]</span>${renderCardHtml(parts.after)}`,
                  }}
                />
              ) : (
                <div className="sim-question" dangerouslySetInnerHTML={{ __html: renderCardHtml(card.sentence) }} />
              )}
              <div className="sim-tip">提示：想一想被挖空的地方是什麼字，再翻牌看答案</div>
            </div>

            {/* 背面：答案 */}
            <div className="anki-card-face anki-card-back">
              <div className="sim-badge-container">
                <span className="sim-card-type-badge">克漏字</span>
                <span className="sim-card-tag">Back (背面)</span>
              </div>
              {parts ? (
                <div
                  className="sim-question"
                  dangerouslySetInnerHTML={{
                    __html: `${renderCardHtml(parts.before)}<span class="cloze-answer">${renderCardHtml(parts.blank)}</span>${renderCardHtml(parts.after)}`,
                  }}
                />
              ) : (
                <div className="sim-question" dangerouslySetInnerHTML={{ __html: renderCardHtml(card.sentence) }} />
              )}
              <hr className="sim-divider" />
              <div className="sim-answer-box">
                單字：<span className="sim-correct-ans">{card.word}</span>
              </div>
              {card.notes && (
                <div className="sim-explanation">
                  <div className="sim-explanation-title">備註</div>
                  <div
                    className="sim-explanation-content"
                    dangerouslySetInnerHTML={{ __html: renderCardHtml(card.notes) }}
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
