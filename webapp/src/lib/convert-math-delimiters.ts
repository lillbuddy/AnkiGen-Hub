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

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

// 兩個「Anki 效果即時模擬器」（anki-simulator.tsx、slides-simulator.tsx）都是用
// dangerouslySetInnerHTML 顯示卡片內容（題目、選項、備註），這些文字來自 AI 解析
// 結果或使用者直接編輯，一定要先跳脫 HTML 特殊字元再轉換數學公式分隔符號，
// 不然打進 <script>、<img onerror=...> 這種內容會被當成真正的 HTML 執行，變成
// 儲存型 XSS，可能被用來偷瀏覽器 localStorage 裡存的 Gemini API Key。
// 跳脫用的字元（&<>"'）跟數學分隔符號用的字元（$[]\()）完全不重疊，所以
// escapeHtml 在 convertMathDelimiters 前後執行結果一樣，不會互相干擾。
export function renderCardHtml(text: string): string {
  if (!text) return ''
  return convertMathDelimiters(escapeHtml(String(text))).replace(/\n/g, '<br>')
}
