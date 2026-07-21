// 觸發瀏覽器下載一個檔案，統一用「建立暫時的 <a download> 再點擊」這個技巧，
// 避免同樣的邏輯在好幾個地方各自重複寫一次。
export function downloadUrl(url: string, filename: string): void {
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.style.visibility = 'hidden'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

// 給還沒有現成 URL、只有 fetch 回來的 bytes（例如 Google Drive 上的原始圖片）用：
// 自己先建立一個暫時的 object URL，下載完馬上釋放掉，不會佔用記憶體。
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  downloadUrl(url, filename)
  URL.revokeObjectURL(url)
}
