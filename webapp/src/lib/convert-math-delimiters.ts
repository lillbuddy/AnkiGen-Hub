// 把各種常見的數學公式寫法統一轉換成 MathJax 原生可辨識的 \(...\) \[...\] 格式
// （這是舊版 app.js 驗證過能在真正 Anki 裡正確渲染的格式，Anki 內建的 MathJax
// 就是設定成辨認 \( \) 和 \[ \] 這兩種分隔符號，不是 [$][/$] 這種寫法）。
// 支援輸入：Anki 專屬的 [$]...[/$] [$$]...[/$$]，以及一般 Markdown 常見的 $...$ $$...$$。
export function convertMathDelimiters(text: string): string {
  if (!text) return ''
  let out = String(text)

  // Anki 專屬語法 -> 標準 MathJax 分隔符號
  out = out
    .replace(/\[\$\$\]/g, '\\[')
    .replace(/\[\/\$\$\]/g, '\\]')
    .replace(/\[\$\]/g, '\\(')
    .replace(/\[\/\$\]/g, '\\)')

  // 區塊公式 $$...$$ -> \[...\]（需在行內公式判斷之前處理，避免誤判）
  out = out.replace(/\$\$([\s\S]+?)\$\$/g, (_m, inner) => `\\[${inner}\\]`)

  // 行內公式 $...$ -> \(...\)，避免誤判金額（如 $100、$5 - $10）：
  // 開頭 $ 前面不可緊接數字或另一個 $；公式內容頭尾不可為空白；結尾 $ 後面不可緊接數字
  out = out.replace(
    /(^|[^$\d])\$([^\s$](?:[^$\n]*[^\s$])?)\$(?!\d)/g,
    (_m, pre, inner) => `${pre}\\(${inner}\\)`
  )

  return out
}
