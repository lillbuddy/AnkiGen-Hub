// 直接把卡片寫進使用者本機的 Anki（透過 AnkiConnect 這個 Anki add-on 開的
// localhost:8765 API）。這一切都只能從瀏覽器端呼叫——AnkiConnect 只監聽
// 使用者「自己這台電腦」，我們的 Vercel 伺服器連不到使用者的 localhost。
import { YankiConnect } from 'yanki-connect/standalone'
import { convertMathDelimiters } from '@/lib/convert-math-delimiters'
import {
  ANKI_BACK_TEMPLATE,
  ANKI_CSS_TEMPLATE,
  ANKI_FIELDS,
  ANKI_FRONT_TEMPLATE,
  ANKI_MODEL_NAME,
} from '@/lib/anki-mcq-templates'
function getClient() {
  return new YankiConnect()
}

export type AnkiConnectCheckResult =
  | { ok: true }
  | { ok: false; reason: 'unreachable' | 'denied' }

// 應該是每次「存入 Anki」流程第一步呼叫的動作：確認本機 Anki 有開、AnkiConnect
// 有裝，而且這個網站的來源已經被允許存取（第一次呼叫時 Anki 會跳出視窗問使用者
// 要不要同意，同意後 AnkiConnect 會記住這個來源，之後不用再問）。
export async function checkAnkiConnectAndRequestPermission(): Promise<AnkiConnectCheckResult> {
  try {
    const result = await getClient().miscellaneous.requestPermission()
    return result.permission === 'granted' ? { ok: true } : { ok: false, reason: 'denied' }
  } catch (error) {
    // "unreachable" 這個分類其實包了好幾種不同的失敗原因（連不上、CORS 被擋、
    // AnkiConnect 回傳格式不對...），把真正的錯誤印出來才能對照瀏覽器主控台判斷。
    console.error('[anki-connect] requestPermission 失敗', error)
    return { ok: false, reason: 'unreachable' }
  }
}

// 確保「AnkiGen Hub 選擇題」這個自訂筆記類型存在，不存在就用現有的欄位/模板/CSS 建立
// （跟「萬用選擇題模板程式碼」那份手動教學用的是同一份內容，不要另外改寫）。
export async function ensureAnkiGenModelExists(): Promise<void> {
  const client = getClient()
  const existingModels = await client.model.modelNames()
  if (existingModels.includes(ANKI_MODEL_NAME)) return

  await client.model.createModel({
    modelName: ANKI_MODEL_NAME,
    inOrderFields: ANKI_FIELDS.map((f) => f.name),
    css: ANKI_CSS_TEMPLATE,
    cardTemplates: [{ Name: '選擇題', Front: ANKI_FRONT_TEMPLATE, Back: ANKI_BACK_TEMPLATE }],
  })
}

export async function ensureDeckExists(deckName: string): Promise<void> {
  await getClient().deck.createDeck({ deck: deckName })
}

// 把瀏覽器裡已經有的圖片（File 或從 Drive 抓下來的 bytes）轉成 AnkiConnect 要的 base64 字串。
export async function fileToBase64(file: Blob): Promise<string> {
  const buffer = await file.arrayBuffer()
  let binary = ''
  const bytes = new Uint8Array(buffer)
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary)
}

// 給「圖片已經在 Google Drive 上」的呼叫端用（例如歷史紀錄）：直接呼叫我們自己的
// 同源 proxy route 抓圖片 bytes，沒有 CORS 問題。
export async function fetchImageAsBase64(url: string): Promise<string> {
  const response = await fetch(url)
  if (!response.ok) throw new Error(`圖片下載失敗（${response.status}）`)
  return fileToBase64(await response.blob())
}

// 刻意不直接沿用 history-types.ts 的 McqCard/SlidesMcqCard——三個呼叫端（文字選擇題、
// 圖片標記工具進行中的 session、歷史紀錄）的圖片來源都不一樣（本機 File、抽屜沿用、
// Google Drive），所以圖片一律由呼叫端自己轉成 base64 後再傳進來，這裡只負責寫進 Anki。
export interface AnkiCardInput {
  questionText: string
  optionA: string
  optionB: string
  optionC: string
  optionD: string
  optionE: string
  optionF: string
  answer: string
  isMultiple: boolean
  notes: string
  image?: { filename: string; base64: string }
}

// 文字卡和圖片卡共用同一個筆記類型，差別只在圖片卡多帶一個 picture，
// AnkiConnect 會自動把 <img> 標籤附加到 Question 欄位。
export async function addCardsToAnki(deckName: string, cards: AnkiCardInput[]): Promise<void> {
  const client = getClient()

  const notes = cards.map((card) => {
    const fields: Record<string, string> = {
      Question: convertMathDelimiters(card.questionText),
      OptionA: card.optionA,
      OptionB: card.optionB,
      OptionC: card.optionC,
      OptionD: card.optionD,
      OptionE: card.optionE,
      OptionF: card.optionF,
      Answer: card.answer,
      IsMultiple: card.isMultiple ? '1' : '',
      Explanation: convertMathDelimiters(card.notes),
    }

    return {
      deckName,
      modelName: ANKI_MODEL_NAME,
      fields,
      options: { allowDuplicate: true },
      picture: card.image
        ? [{ filename: card.image.filename, data: card.image.base64, fields: ['Question'] }]
        : undefined,
    }
  })

  const result = await client.note.addNotes({ notes })
  if (!result || result.every((id) => id === null)) {
    throw new Error('Anki 沒有成功建立任何卡片，請確認 Anki 沒有顯示錯誤訊息。')
  }
}
