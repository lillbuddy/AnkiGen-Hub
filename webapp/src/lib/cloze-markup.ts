// 克漏字卡片的挖空標記：AI 生成例句時，用簡單的 **文字** 標記法框出「這個單字
// 在句子裡實際出現的形式」（例如單字是 run，句子裡用 running，就框 **running**），
// 而不是直接請 AI 輸出 Anki 的 {{c1::}} 語法——避免 AI 格式輸出不穩定，同時也
// 自然處理了單字詞形變化的問題。這裡負責把 ** 標記轉換成 Anki 真正吃的語法，
// 或拆解成「前段/挖空內容/後段」三段給模擬器分別渲染。
const CLOZE_MARKER = /\*\*(.+?)\*\*/

// Anki 的 Cloze 筆記類型是看 Text 欄位裡有沒有真的 {{cN::...}} 標記來決定要不要
// 產生卡片，純文字（就算非空）也會被拒收——所以這個轉換是「能不能存進 Anki」的關鍵。
export function toAnkiClozeSyntax(sentence: string): string {
  return sentence.replace(new RegExp(CLOZE_MARKER, 'g'), '{{c1::$1}}')
}

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
