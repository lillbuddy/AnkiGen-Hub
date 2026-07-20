export function stripExtension(filename: string): string {
  const idx = filename.lastIndexOf('.')
  return idx > 0 ? filename.substring(0, idx) : filename
}

export function getFileExtension(filename: string): string {
  const idx = filename.lastIndexOf('.')
  return idx > 0 ? filename.substring(idx + 1) : ''
}

// 使用者重新命名時很容易忘記加副檔名（.jpg / .png...），但 <img src="..."> 一定要跟實際檔名
// （含副檔名）完全一致，Anki 才讀得到圖片。這裡自動幫使用者補回原始檔案的副檔名，除非他
// 自己已經有輸入看起來像副檔名的結尾。
export function ensureFileExtension(name: string, ext: string): string {
  const trimmed = name.trim()
  if (!trimmed || !ext) return trimmed
  if (/\.[a-zA-Z0-9]{1,6}$/.test(trimmed)) return trimmed
  return `${trimmed}.${ext}`
}

// 若使用者選取的多張圖片檔名相同，加入時自動加上 _2 _3 等後綴，作為一開始的預設值
// （之後使用者仍可以自由重新命名；若改完又跟別的檔案重複，畫面上會即時顯示警告，
// 而不是強制改掉使用者的輸入）
export function computeUniqueFilename(filename: string, existingFilenames: string[]): string {
  const collisions = existingFilenames.filter((f) => f === filename).length
  if (collisions === 0) return filename
  const n = collisions + 1
  const dotIdx = filename.lastIndexOf('.')
  return dotIdx > 0
    ? `${filename.substring(0, dotIdx)}_${n}${filename.substring(dotIdx)}`
    : `${filename}_${n}`
}
