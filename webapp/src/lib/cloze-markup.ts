// 克漏字卡片的挖空標記：AI 生成例句時，用簡單的 **文字** 標記法框出「這個單字
// 在句子裡實際出現的形式」（例如單字是 run，句子裡用 running，就框 **running**）
// ——同時自然處理了單字詞形變化的問題。這個標記直接存進 Anki 的 Sentence 欄位，
// 由 AnkiGen Hub 自訂筆記類型自己的模板 script 解析渲染，不需要轉換成 Anki 內建
// Cloze 類型的 {{c1::}} 語法。這裡的拆解函式是給網站自己的模擬器/歷史紀錄顯示用。
const CLOZE_MARKER = /\*\*(.+?)\*\*/

export function splitClozeSentence(
  sentence: string
): { before: string; blank: string; after: string } | null {
  const match = sentence.match(CLOZE_MARKER)
  if (!match || match.index === undefined) return null
  return {
    before: sentence.slice(0, match.index),
    blank: match[1],
    after: sentence.slice(match.index + match[0].length),
  }
}
