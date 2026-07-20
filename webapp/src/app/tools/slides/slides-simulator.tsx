'use client'

import { useEffect, useState } from 'react'
import { convertMathDelimiters } from '@/lib/convert-math-delimiters'
import { stripExtension } from '@/lib/slide-filename'
import '../mcq/anki-simulator.css'

const OPTION_KEYS = ['optionA', 'optionB', 'optionC', 'optionD', 'optionE', 'optionF'] as const

export interface SlideSimCard {
  url: string
  // 沿用抽屜卡片時，url 會指向畫質較好的原始檔案；如果那個檔案剛好讀不到
  // （例如很久以前的舊資料、原始檔已經不在了），圖片載入失敗時會自動改用這個
  // 保底網址（通常是縮圖用的預覽檔），至少讓圖片顯示得出來，不會整張變問號。
  fallbackUrl?: string
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

function renderMath(text: string) {
  return convertMathDelimiters(text).replace(/\n/g, '<br>')
}

declare global {
  interface Window {
    MathJax?: {
      typesetPromise?: () => Promise<void>
      typesetClear?: () => void
    }
  }
}

// 跟 tools/mcq 的 AnkiSimulator 一樣用 key-reset 寫法：呼叫端傳入隨作用中圖片變動的 key，
// 讓這個元件整個重新掛載來重置翻牌/作答狀態，而不是在 effect 裡呼叫 setState。
export default function SlidesSimulator({
  mode,
  card,
}: {
  mode: 'mcq' | 'occlusion'
  card: SlideSimCard | null
}) {
  const [flipped, setFlipped] = useState(false)
  const [selected, setSelected] = useState<string[]>([])

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

  function toggleOption(letter: string, e: React.MouseEvent) {
    e.stopPropagation()
    if (card!.isMultiple) {
      setSelected((prev) =>
        prev.includes(letter) ? prev.filter((l) => l !== letter) : [...prev, letter]
      )
    } else {
      setSelected((prev) => (prev.includes(letter) ? [] : [letter]))
    }
  }

  const emptyLabel = mode === 'mcq' ? '請先選取並標記圖片' : '請先選取圖片'

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
              {!card ? (
                <div className="sim-question">{emptyLabel}</div>
              ) : mode === 'mcq' ? (
                <McqFront card={card} selected={selected} onToggle={toggleOption} />
              ) : (
                <OcclusionFront card={card} />
              )}
            </div>

            {/* 背面 */}
            <div className="anki-card-face anki-card-back">
              {!card ? (
                <div className="sim-question">{emptyLabel}</div>
              ) : mode === 'mcq' ? (
                <McqBack card={card} selected={selected} />
              ) : (
                <OcclusionBack card={card} />
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function McqFront({
  card,
  selected,
  onToggle,
}: {
  card: SlideSimCard
  selected: string[]
  onToggle: (letter: string, e: React.MouseEvent) => void
}) {
  const options = OPTION_KEYS.map((key, i) => ({
    letter: String.fromCharCode(65 + i),
    text: card[key],
  })).filter((opt) => opt.text)

  return (
    <>
      <div className="sim-badge-container">
        <span className={`sim-card-type-badge ${card.isMultiple ? 'multiple' : ''}`}>
          {card.isMultiple ? '多選題' : '單選題'}
        </span>
        <span className="sim-card-tag">Front (正面)</span>
      </div>
      <div
        className="sim-question"
        dangerouslySetInnerHTML={{
          __html: `<img src="${card.url}" onerror="this.onerror=null;this.src='${card.fallbackUrl ?? card.url}'"><br>${renderMath(card.questionText)}`,
        }}
      />
      <div className="sim-options-list">
        {options.map((opt) => (
          <button
            key={opt.letter}
            className={`sim-option-btn ${selected.includes(opt.letter) ? 'selected' : ''}`}
            onClick={(e) => onToggle(opt.letter, e)}
          >
            <span className="sim-option-prefix">{opt.letter}</span>
            <span
              className="sim-option-text"
              dangerouslySetInnerHTML={{ __html: renderMath(opt.text) }}
            />
          </button>
        ))}
      </div>
      <div className="sim-tip">
        {card.isMultiple
          ? '提示：可複選任意數量的選項'
          : '提示：點選一個選項進行標記，改選其他選項會自動取代原本的選擇'}
      </div>
    </>
  )
}

function McqBack({ card, selected }: { card: SlideSimCard; selected: string[] }) {
  const options = OPTION_KEYS.map((key, i) => ({
    letter: String.fromCharCode(65 + i),
    text: card[key],
  })).filter((opt) => opt.text)

  const correctLetters = (card.answer || '').toUpperCase().replace(/[^A-F]/g, '').split('')
  const isFullyCorrect =
    selected.length === correctLetters.length && correctLetters.every((l) => selected.includes(l))

  return (
    <>
      <div className="sim-badge-container">
        <span className={`sim-card-type-badge ${card.isMultiple ? 'multiple' : ''}`}>
          {card.isMultiple ? '多選題' : '單選題'}
        </span>
        <span className="sim-card-tag">Back (背面)</span>
      </div>
      <div
        className="sim-question"
        dangerouslySetInnerHTML={{
          __html: `<img src="${card.url}" onerror="this.onerror=null;this.src='${card.fallbackUrl ?? card.url}'"><br>${renderMath(card.questionText)}`,
        }}
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
                dangerouslySetInnerHTML={{ __html: renderMath(opt.text) }}
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
            dangerouslySetInnerHTML={{ __html: renderMath(card.notes) }}
          />
        </div>
      )}
    </>
  )
}

function OcclusionFront({ card }: { card: SlideSimCard }) {
  return (
    <>
      <div className="sim-badge-container">
        <span className="sim-card-type-badge">Image Occlusion</span>
        <span className="sim-card-tag">Front (正面)</span>
      </div>
      <div className="occlusion-image-wrap">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={card.url}
          alt=""
          onError={(e) => {
            if (card.fallbackUrl && e.currentTarget.src !== card.fallbackUrl) {
              e.currentTarget.src = card.fallbackUrl
            }
          }}
        />
      </div>
      <div className="sim-question">{stripExtension(card.filename)}</div>
      <div className="sim-tip">提示：遮蓋範圍需要匯入 Anki 後手動框選，這裡只預覽圖片與標題是否正確</div>
    </>
  )
}

function OcclusionBack({ card }: { card: SlideSimCard }) {
  return (
    <>
      <div className="sim-badge-container">
        <span className="sim-card-type-badge">Image Occlusion</span>
        <span className="sim-card-tag">Back (背面)</span>
      </div>
      <div className="occlusion-image-wrap">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={card.url}
          alt=""
          onError={(e) => {
            if (card.fallbackUrl && e.currentTarget.src !== card.fallbackUrl) {
              e.currentTarget.src = card.fallbackUrl
            }
          }}
        />
      </div>
      <div className="sim-question">{stripExtension(card.filename)}</div>
      {card.notes && (
        <div className="sim-explanation">
          <div className="sim-explanation-title">備註 (Back Extra)</div>
          <div className="sim-explanation-content">{card.notes}</div>
        </div>
      )}
    </>
  )
}
