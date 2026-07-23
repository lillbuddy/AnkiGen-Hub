// 把設計價值比較高的靜態文字（AI Prompt 指示、Anki 卡片模板）用 Base64 包起來，
// 執行時才在瀏覽器端還原，讓打包後的 JS 檔案裡沒辦法直接用關鍵字搜尋到完整內容。
//
// 老實說這只能拉高「隨手複製」的門檻，沒辦法真的防止有心人打開瀏覽器主控台呼叫
// decodeText() 把內容還原——只要是瀏覽器要執行的程式碼，本質上就無法對瀏覽器本身
// 保密。這裡做的事情純粹是把「一眼看懂、Ctrl+F 就找到」變成「需要多一個步驟」。
export function decodeText(base64: string): string {
  const binary = atob(base64)
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0))
  return new TextDecoder('utf-8').decode(bytes)
}
