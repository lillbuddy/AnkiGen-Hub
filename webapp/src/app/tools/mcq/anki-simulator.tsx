'use client'

import { useEffect, useState } from 'react'
import { renderCardHtml } from '@/lib/convert-math-delimiters'
import type { McqCard } from '@/lib/history-types'
import './anki-simulator.css'

const OPTION_KEYS = ['optionA', 'optionB', 'optionC', 'optionD', 'optionE', 'optionF'] as const

declare global {
  interface Window {
    MathJax?: {
      typesetPromise?: () => Promise<void>
      typesetClear?: () => void
    }
  }
}

// 換一張卡片預覽時要重置翻牌狀態和作答紀錄，比照 Anki 正面重新顯示時的行為。
// 用 React 的 key-reset 寫法（呼叫端傳入會隨卡片變動的 key 讓這個元件整個重新掛載），
// 比在 effect 裡呼叫 setState 更直接，也不會多一次不必要的重新渲染。
export default function AnkiSimulator({ card }: { card: McqCard | null }) {
  const [flipped, setFlipped] = useState(false)
  const [selected, setSelected] = useState<string[]>([])

  // 內容或作答狀態變動後，觸發 MathJax 重新渲染卡片內所有數學公式。
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

  const options = OPTION_KEYS.map((key, i) => ({
    letter: String.fromCharCode(65 + i),
    text: card[key],
  })).filter((opt) => opt.text)

  const correctLetters = (card.answer || '').toUpperCase().replace(/[^A-F]/g, '').split('')
  const isFullyCorrect =
    selected.length === correctLetters.length && correctLetters.every((l) => selected.includes(l))

  function toggleOption(letter: string, e: React.MouseEvent) {
    e.stopPropagation() // 防止觸發翻牌
    if (card!.isMultiple) {
      setSelected((prev) =>
        prev.includes(letter) ? prev.filter((l) => l !== letter) : [...prev, letter]
      )
    } else {
      setSelected((prev) => (prev.includes(letter) ? [] : [letter]))
    }
  }

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
          {/* 正面 */}
          <div className="anki-card-face anki-card-front">
            <div className="sim-badge-container">
              <span className={`sim-card-type-badge ${card.isMultiple ? 'multiple' : ''}`}>
                {card.isMultiple ? '多選題' : '單選題'}
              </span>
              <span className="sim-card-tag">Front (正面)</span>
            </div>
            <div
              className="sim-question"
              dangerouslySetInnerHTML={{ __html: renderCardHtml(card.questionText) }}
            />
            <div className="sim-options-list">
              {options.map((opt) => (
                <button
                  key={opt.letter}
                  className={`sim-option-btn ${selected.includes(opt.letter) ? 'selected' : ''}`}
                  onClick={(e) => toggleOption(opt.letter, e)}
                >
                  <span className="sim-option-prefix">{opt.letter}</span>
                  <span
                    className="sim-option-text"
                    dangerouslySetInnerHTML={{ __html: renderCardHtml(opt.text) }}
                  />
                </button>
              ))}
            </div>
            <div className="sim-tip">
              {card.isMultiple
                ? '提示：可複選任意數量的選項'
                : '提示：點選一個選項進行標記，改選其他選項會自動取代原本的選擇'}
            </div>
          </div>

          {/* 背面 */}
          <div className="anki-card-face anki-card-back">
            <div className="sim-badge-container">
              <span className={`sim-card-type-badge ${card.isMultiple ? 'multiple' : ''}`}>
                {card.isMultiple ? '多選題' : '單選題'}
              </span>
              <span className="sim-card-tag">Back (背面)</span>
            </div>
            <div
              className="sim-question"
              dangerouslySetInnerHTML={{ __html: renderCardHtml(card.questionText) }}
            />
            <div className="sim-options-list">
              {options.map((opt) => {
                const isCorrect = correctLetters.includes(opt.letter)
                const isSelected = selected.includes(opt.letter)
                const cls = isCorrect ? 'correct' : isSelected ? 'wrong' : 'unselected'
                return (
                  <div key={opt.letter} className={`sim-option-btn ${cls}`}>
                    <span className="sim-option-prefix">{opt.letter}</span>
                    <span
                      className="sim-option-text"
                      dangerouslySetInnerHTML={{ __html: renderCardHtml(opt.text) }}
                    />
                  </div>
                )
              })}
            </div>
            <hr className="sim-divider" />
            <div className="sim-answer-box">
              正確答案：<span className="sim-correct-ans">{card.answer}</span>
            </div>
            {card.notes && (
              <div className={`sim-explanation ${isFullyCorrect ? 'sim-exp-correct' : 'sim-exp-wrong'}`}>
                <div className="sim-explanation-title">解析</div>
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
