import { decodeText } from './text-obfuscation'

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

// 跟 anki-mcq-templates.ts / anki-cloze-templates.ts 同樣的考量：把這段 Prompt 指示
// 用 decodeText(base64) 包起來，避免打包後的 JS 檔案裡可以直接搜尋到完整內容。要修改
// 內容時，先把 base64 還原成明文修改（留意 %%COUNT%% / %%QUESTION%% / %%ANSWER%% /
// %%POOL_SECTION%% 這幾個佔位字串要保留在正確位置），改完再重新編碼回去。
const DISTRACTOR_PROMPT_B64 =
  '5L2g5piv5LiA5YCL5bCI5qWt55qE5ris6amX6Kit6KiI5bir44CC6KuL5qC55pOa5Lul5LiL6YG45pOH6aGM6LOH6KiK77yM55Si55SfICUlQ09VTlQlJSDlgIvjgIzpjK/oqqTkvYbnnIvotbfkvoblkIjnkIbjgI3nmoTlubLmk77pgbjpoIXjgIIKCumhjOebru+8miUlUVVFU1RJT04lJQrmraPnorrnrZTmoYjvvJolJUFOU1dFUiUlCiUlUE9PTF9TRUNUSU9OJSUK6KaB5rGC77yaCi0g6KuL5YSq5YWI5b6e5LiK6Z2i5o+Q5L6b55qE5riF5Zau5Lit77yM5oyR6YG46Lef5q2j56K6562U5qGI5ZCM6aGe5Yil44CB5a655piT6K6T5Lq65re35reG55qE6aCF55uu55W25L2c5bmy5pO+6YG46aCF77yb5riF5Zau5Lit5rKS5pyJ6Laz5aSg6YGp5ZCI55qE6aCF55uu5pmC77yI5pW46YeP5LiN5aSg77yM5oiW6aGe5Yil5LiN56ym77yJ77yM5omN6Ieq5bex6aGN5aSW55Sf5oiQ6LK85YiH55qE5bmy5pO+6YG46aCF5L6G6KOc6Laz5Yiw5Ymb5aW9ICUlQ09VTlQlJSDlgIvjgIIKLSDlubLmk77pgbjpoIXlv4XpoIjlkozmraPnorrnrZTmoYjlsazmlrzlkIzkuIDpoZ7liKXvvIjkvovlpoLmraPnorrnrZTmoYjmmK/lmajlrpjlkI3nqLHvvIzlubLmk77pgbjpoIXkuZ/opoHmmK/lhbbku5blmajlrpjlkI3nqLHvvJvmraPnorrnrZTmoYjmmK/nlr7nl4XlkI3nqLHvvIzlubLmk77pgbjpoIXkuZ/opoHmmK/lhbbku5bnlr7nl4XlkI3nqLHvvInvvIzkuI3og73mmK/mmI7poa/nhKHpl5zjgIHkuIDnnIvlsLHnn6XpgZPmmK/pjK/nmoTlhaflrrnjgIIKLSAlJUNPVU5UJSUg5YCL5bmy5pO+6YG46aCF5b285q2k5LmL6ZaT5LiN6IO96YeN6KSH77yM5Lmf5LiN6IO95ZKM5q2j56K6562U5qGI6YeN6KSH5oiW5oSP5oCd55u45ZCM44CCCi0g5Y+q6ZyA6KaB57Ch55+t55qE5ZCN6Kme5oiW6Kme57WE77yM5LiN6KaB5Yqg5LiKIEEuIEIuIOetiee3qOiZn+WJjee2tO+8jOS5n+S4jeimgemZhOWKoOS7u+S9leiqquaYjuaWh+Wtl+OAggotIOi8uOWHuuagvOW8j+W/hemgiOaYr+e0lCBKU09OIOmZo+WIl++8jOijoemdouWJm+WlveWMheWQqyAlJUNPVU5UJSUg5YCL5a2X5Liy77yM5LiN6KaB5YyF6KO55ZyoIGBgYGpzb24g5YWn77yM5LiN6KaB5pyJ5YW25LuW5paH5a2X44CC'

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

  return decodeText(DISTRACTOR_PROMPT_B64)
    .split('%%COUNT%%').join(String(count))
    .split('%%QUESTION%%').join(questionText)
    .split('%%ANSWER%%').join(correctAnswer)
    .split('%%POOL_SECTION%%').join(poolSection)
}
