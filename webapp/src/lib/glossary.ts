// 把使用者上傳的 .md 詞彙表解析成一個個詞彙：
// - 跳過純標題行（# 開頭），那通常只是分類標籤，不是實際詞彙
// - 去掉常見的清單前綴符號（- * + 或數字編號）
// - 同一行如果用逗號、頓號分隔多個詞彙，也會分開
// - 去除重複（不分大小寫）
export function parseGlossaryMarkdown(text: string): string[] {
  const lines = text.split(/\r?\n/)
  const seen = new Set<string>()
  const terms: string[] = []

  lines.forEach((rawLine) => {
    let line = rawLine.trim()
    if (!line) return
    if (/^#{1,6}\s/.test(line)) return // 跳過標題行

    line = line.replace(/^[-*+]\s+/, '').replace(/^\d+[.、)]\s+/, '')

    // 如果這行是「類別：詞彙、詞彙」這種格式，冒號前視為分類標籤、不當作詞彙，只保留冒號後面的內容
    const colonIdx = line.search(/[:：]/)
    if (colonIdx !== -1) {
      line = line.slice(colonIdx + 1)
    }

    line.split(/[,，、]/).forEach((part) => {
      const term = part.trim()
      if (!term) return
      const key = term.toLowerCase()
      if (seen.has(key)) return
      seen.add(key)
      terms.push(term)
    })
  })

  return terms
}

// 從詞彙表中排除掉跟目前這張卡片正確答案重複的詞，作為干擾選項的候選清單
export function getGlossaryPoolExcluding(glossary: string[], correctAnswer: string): string[] {
  const answer = correctAnswer.trim().toLowerCase()
  return glossary.filter((term) => term.trim().toLowerCase() !== answer)
}

export function buildDistractorPrompt(
  questionText: string,
  correctAnswer: string,
  count: number,
  candidatePool: string[]
): string {
  const poolSection =
    candidatePool.length > 0
      ? `\n這是使用者提供的相關詞彙表（優先從裡面挑選同類別、容易混淆的項目，誘答效果通常比憑空生成更好）：\n${candidatePool.map((t) => `- ${t}`).join('\n')}\n`
      : ''

  return `你是一個專業的測驗設計師。請根據以下選擇題資訊，產生 ${count} 個「錯誤但看起來合理」的干擾選項。

題目：${questionText}
正確答案：${correctAnswer}
${poolSection}
要求：
- 請優先從上面提供的清單中，挑選跟正確答案同類別、容易讓人混淆的項目當作干擾選項；清單中沒有足夠適合的項目時（數量不夠，或類別不符），才自己額外生成貼切的干擾選項來補足到剛好 ${count} 個。
- 干擾選項必須和正確答案屬於同一類別（例如正確答案是器官名稱，干擾選項也要是其他器官名稱；正確答案是疾病名稱，干擾選項也要是其他疾病名稱），不能是明顯無關、一看就知道是錯的內容。
- ${count} 個干擾選項彼此之間不能重複，也不能和正確答案重複或意思相同。
- 只需要簡短的名詞或詞組，不要加上 A. B. 等編號前綴，也不要附加任何說明文字。
- 輸出格式必須是純 JSON 陣列，裡面剛好包含 ${count} 個字串，不要包裹在 \`\`\`json 內，不要有其他文字。`
}
