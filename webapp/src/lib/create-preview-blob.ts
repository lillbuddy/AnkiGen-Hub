// 瀏覽器端專用：把圖片縮小成長邊最多 maxDim px 的 JPEG 預覽圖。
// 只是拿來給歷史紀錄列表快速顯示縮圖用，原始畫質的圖片另外整張上傳。
export function createPreviewBlob(file: File, maxDim = 480, quality = 0.75): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      let { width, height } = img
      if (width > height && width > maxDim) {
        height = Math.round(height * (maxDim / width))
        width = maxDim
      } else if (height >= width && height > maxDim) {
        width = Math.round(width * (maxDim / height))
        height = maxDim
      }
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      canvas.getContext('2d')!.drawImage(img, 0, 0, width, height)
      canvas.toBlob(
        (blob) => {
          URL.revokeObjectURL(objectUrl)
          if (blob) resolve(blob)
          else reject(new Error('無法產生預覽圖片'))
        },
        'image/jpeg',
        quality
      )
    }
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl)
      reject(new Error('圖片讀取失敗，無法產生預覽圖'))
    }
    img.src = objectUrl
  })
}
