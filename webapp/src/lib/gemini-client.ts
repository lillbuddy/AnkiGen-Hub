// 直接從瀏覽器呼叫 Gemini API（使用者自己的 API key，不經過我們的伺服器）。
// 回傳內容固定要求 JSON 格式，呼叫端自己決定預期的資料形狀（陣列的卡片、或陣列的字串等等）。
export async function callGeminiJson(apiKey: string, model: string, prompt: string): Promise<unknown> {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: 'application/json' },
      }),
    }
  )

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}))
    throw new Error(errData.error?.message || `Gemini API 呼叫失敗（HTTP ${response.status}）`)
  }

  const data = await response.json()
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text
  if (!text) throw new Error('Gemini 回傳了空內容')

  return JSON.parse(text.trim())
}
