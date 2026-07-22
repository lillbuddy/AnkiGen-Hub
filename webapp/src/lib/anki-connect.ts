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
import {
  ANKI_CLOZE_BACK_TEMPLATE,
  ANKI_CLOZE_CSS_TEMPLATE,
  ANKI_CLOZE_FIELDS,
  ANKI_CLOZE_FRONT_TEMPLATE,
  ANKI_CLOZE_MODEL_NAME,
} from '@/lib/anki-cloze-templates'
function getClient() {
  return new YankiConnect()
}

export type AnkiConnectCheckResult =
  | { ok: true }
  | { ok: false; reason: 'unreachable' | 'denied' | 'safari-mixed-content' }

// Safari（跟 Chrome 不同）沒有把 loopback 位址（127.0.0.1/localhost）排除在「混合
// 內容」限制之外：HTTPS 頁面呼叫 http://127.0.0.1:8765 會直接被瀏覽器擋下、連請求
// 都送不出去，而且沒有任何網站端設定可以繞過（這是瀏覽器本身的安全機制）。用
// User-Agent 判斷 Safari 雖然不是最嚴謹的方式，但這裡只是用來提早給使用者正確的
// 說明，避免使用者照著「偵測不到本機 Anki」的一般排查步驟去改 AnkiConnect 設定，
// 卻怎麼調都沒用。
function isSafari(): boolean {
  if (typeof navigator === 'undefined') return false
  return /^((?!chrome|android).)*safari/i.test(navigator.userAgent)
}

// 應該是每次「存入 Anki」流程第一步呼叫的動作：確認本機 Anki 有開、AnkiConnect
// 有裝，而且這個網站的來源已經被允許存取（第一次呼叫時 Anki 會跳出視窗問使用者
// 要不要同意，同意後 AnkiConnect 會記住這個來源，之後不用再問）。
export async function checkAnkiConnectAndRequestPermission(): Promise<AnkiConnectCheckResult> {
  if (typeof window !== 'undefined' && window.location.protocol === 'https:' && isSafari()) {
    return { ok: false, reason: 'safari-mixed-content' }
  }

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

// 確保「AnkiGen Hub 克漏字」這個自訂筆記類型存在，不存在就用現有的欄位/模板/CSS
// 建立——跟選擇題一樣是我們自己的筆記類型（不是 Anki 內建的 Cloze），這樣 Sentence
// 欄位可以直接存放 **word** 原文，由我們自己的模板 script 解析成跟網站模擬器一致
// 的挖空/答案樣式，不受 Anki 內建 Cloze 類型只認得 {{c1::}} 語法的限制。
export async function ensureAnkiGenClozeModelExists(): Promise<void> {
  const client = getClient()
  const existingModels = await client.model.modelNames()
  if (existingModels.includes(ANKI_CLOZE_MODEL_NAME)) return

  await client.model.createModel({
    modelName: ANKI_CLOZE_MODEL_NAME,
    inOrderFields: ANKI_CLOZE_FIELDS.map((f) => f.name),
    css: ANKI_CLOZE_CSS_TEMPLATE,
    cardTemplates: [{ Name: '克漏字', Front: ANKI_CLOZE_FRONT_TEMPLATE, Back: ANKI_CLOZE_BACK_TEMPLATE }],
  })
}

export interface AnkiClozeCardInput {
  word: string
  sentence: string
  notes: string
}

// 欄位順序固定是 Sentence、Word、Explanation（跟現有 CSV 匯出用的順序一致），用
// modelFieldNames 動態抓真正的欄位名稱、照順序對應，比自己寫死欄位名稱字串更能
// 適應不同 Anki 版本可能的細微差異。Sentence 直接存放 **word** 原文，不需要轉換
// 成 Anki 的 {{c1::}} 語法——這是自訂筆記類型才有的好處，一般筆記類型不論欄位
// 內容是什麼一律固定產生 1 張卡片，不像 Anki 內建 Cloze 類型會因為欄位裡沒有真的
// cloze 標記就整張筆記靜默被拒收。
export async function addClozeCardsToAnki(deckName: string, cards: AnkiClozeCardInput[]): Promise<void> {
  const client = getClient()
  const fieldNames = await client.model.modelFieldNames({ modelName: ANKI_CLOZE_MODEL_NAME })

  const notes = cards.map((card) => {
    const values = [card.sentence, card.word, card.notes]
    const fields: Record<string, string> = {}
    fieldNames.forEach((name, i) => {
      fields[name] = values[i] ?? ''
    })

    return {
      deckName,
      modelName: ANKI_CLOZE_MODEL_NAME,
      fields,
      options: { allowDuplicate: true },
    }
  })

  const result = await client.note.addNotes({ notes })
  if (!result || result.every((id) => id === null)) {
    throw new Error('Anki 沒有成功建立任何卡片，請確認 Anki 沒有顯示錯誤訊息。')
  }
}

// Anki 內建的 Image Occlusion 筆記類型（Anki 23.10+ 才有），跟上面「AnkiGen Hub
// 選擇題」不一樣：這是 Anki 本身內建、遮罩編輯器是內部特殊實作，沒辦法用
// createModel 生出來，只能檢查存不存在。
const IMAGE_OCCLUSION_MODEL_NAME = 'Image Occlusion'

export async function ensureImageOcclusionModelAvailable(): Promise<void> {
  const client = getClient()
  const existingModels = await client.model.modelNames()
  if (!existingModels.includes(IMAGE_OCCLUSION_MODEL_NAME)) {
    throw new Error(
      '你的 Anki 沒有內建的「Image Occlusion」筆記類型，請先把 Anki 更新到 23.10（含）以上的版本。'
    )
  }
}

export interface AnkiOcclusionCardInput {
  filename: string
  notes: string
  image: { filename: string; base64: string }
}

// Occlusion 欄位其實是 cloze 欄位（卡片模板用 {{cloze:Occlusion}}），Anki 用
// 裡面有沒有 {{c1::...}} 這種 cloze 標記來決定要不要產生卡片——純文字的提示字
// 樣（例如「尚未框選：xxx」）沒有 cloze 標記，Anki 會直接拒絕整張筆記（實際
// 測試證實：canAddNotesWithErrorDetail 回報 "cannot create note for unknown
// reason"）。遮罩形狀資料的語法是跟 Anki 原始碼（rslib/src/image_occlusion/
// imageocclusion.rs 的測試）核對過的：{{c1::rect:left=L:top=T:width=W:height=H}}，
// 座標是相對圖片尺寸的比例（0~1），不是像素。這裡先給一個置中、佔一半大小的
// 預設遮罩範圍，讓使用者打開筆記時看到看得見、位置合理的起點，再自己調整；
// 跟現有「匯出 CSV 手動匯入」那條路徑最後需要使用者自己畫遮罩是同一件事，只是
// 起點從完全空白變成有一個可以直接拖曳調整的預設框。
const DEFAULT_OCCLUSION_SHAPE = '{{c1::rect:left=0.25:top=0.25:width=0.5:height=0.5}}'

// 欄位順序固定是 Occlusion、Image、Header、Back Extra、Comments（跟現有 CSV
// 匯出用的順序一致），用 modelFieldNames 動態抓真正的欄位名稱、照順序對應，
// 比自己寫死欄位名稱字串更能適應不同 Anki 版本可能的細微差異。
export async function addOcclusionCardsToAnki(
  deckName: string,
  cards: AnkiOcclusionCardInput[]
): Promise<void> {
  const client = getClient()
  const fieldNames = await client.model.modelFieldNames({ modelName: IMAGE_OCCLUSION_MODEL_NAME })
  const imageFieldName = fieldNames[1] ?? 'Image'

  const notes = cards.map((card) => {
    const values = [
      DEFAULT_OCCLUSION_SHAPE,
      '',
      `尚未框選「${card.filename}」，請調整這個遮蓋範圍的位置與大小`,
      card.notes,
      '',
    ]
    const fields: Record<string, string> = {}
    fieldNames.forEach((name, i) => {
      fields[name] = values[i] ?? ''
    })

    return {
      deckName,
      modelName: IMAGE_OCCLUSION_MODEL_NAME,
      fields,
      options: { allowDuplicate: true },
      picture: [{ filename: card.image.filename, data: card.image.base64, fields: [imageFieldName] }],
    }
  })

  const result = await client.note.addNotes({ notes })
  if (!result || result.every((id) => id === null)) {
    throw new Error('Anki 沒有成功建立任何卡片，請確認 Anki 沒有顯示錯誤訊息。')
  }
}
