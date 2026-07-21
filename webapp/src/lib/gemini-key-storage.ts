// 記住使用者輸入過的 Gemini API Key，下次打開 /tools/mcq、/tools/slides 就不用重打，
// 但欄位本身還是完全可編輯，使用者隨時可以直接蓋掉換一把新的 key。
// 純前端 localStorage，key 只存在使用者自己的瀏覽器裡，不會送到我們的伺服器。
const STORAGE_KEY = 'ankigen_gemini_api_key_v1'

export function getSavedGeminiApiKey(): string {
  if (typeof window === 'undefined') return ''
  try {
    return window.localStorage.getItem(STORAGE_KEY) ?? ''
  } catch {
    return ''
  }
}

export function saveGeminiApiKey(apiKey: string): void {
  if (typeof window === 'undefined') return
  try {
    if (apiKey) {
      window.localStorage.setItem(STORAGE_KEY, apiKey)
    } else {
      window.localStorage.removeItem(STORAGE_KEY)
    }
  } catch {
    // localStorage 不可用（例如無痕模式部分情況）時，記不住就算了，不影響本次操作。
  }
}
