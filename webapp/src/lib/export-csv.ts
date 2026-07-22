// 產生 Anki 可以匯入的 CSV（逗號分隔、每欄都加引號），純前端組字串，
// 不需要額外打伺服器 API——歷史紀錄頁面本來就已經有完整的卡片資料。
import type { ClozeCard, McqCard, SlidesMcqCard } from '@/lib/history-types'
import { convertMathDelimiters } from '@/lib/convert-math-delimiters'

function escapeCsvField(value: string | number | boolean | null | undefined): string {
  const str = String(value ?? '')
  return `"${str.replace(/"/g, '""')}"`
}

function csvRow(fields: (string | number | boolean | null | undefined)[]): string {
  return fields.map(escapeCsvField).join(',') + '\n'
}

// 純文字選擇題（沒有圖片）：[題目, 選項A~F, 答案, 是否多選, 備註]，題目和備註要先轉換數學公式分隔符號。
export function buildMcqCsv(cards: McqCard[]): string {
  return cards
    .map((card) =>
      csvRow([
        convertMathDelimiters(card.questionText),
        card.optionA,
        card.optionB,
        card.optionC,
        card.optionD,
        card.optionE,
        card.optionF,
        card.answer,
        card.isMultiple ? '1' : '',
        convertMathDelimiters(card.notes),
      ])
    )
    .join('')
}

// 圖片選擇題：[題目(含<img>), 選項A~F, 答案, 是否多選, 備註]
export function buildSlidesMcqCsv(cards: SlidesMcqCard[]): string {
  return cards
    .map((card) => {
      const questionHtml = `<img src="${card.filename}"><br>${card.questionText}`
      return csvRow([
        questionHtml,
        card.optionA,
        card.optionB,
        card.optionC,
        card.optionD,
        card.optionE,
        card.optionF,
        card.answer,
        card.isMultiple ? '1' : '',
        card.notes,
      ])
    })
    .join('')
}

// Image Occlusion（Anki 原生筆記類型）：[Occlusion(占位字串), Image, Header, Back Extra, Comments]
// Occlusion 欄位一定要有非空字串，Anki 的匯入規則是第一欄空白就會整筆跳過。
export function buildSlidesOcclusionCsv(
  cards: { filename: string; notes: string }[]
): string {
  return cards
    .map((card) =>
      csvRow([`尚未框選：${card.filename}`, `<img src="${card.filename}">`, '', card.notes, ''])
    )
    .join('')
}

// 克漏字卡片（AnkiGen Hub 自訂筆記類型）：[Sentence(含 **word** 原文標記), Word, Explanation]
export function buildClozeCsv(cards: ClozeCard[]): string {
  return cards.map((card) => csvRow([card.sentence, card.word, card.notes])).join('')
}

export function downloadCsv(filename: string, content: string) {
  const blob = new Blob(['\ufeff' + content], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.style.visibility = 'hidden'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
