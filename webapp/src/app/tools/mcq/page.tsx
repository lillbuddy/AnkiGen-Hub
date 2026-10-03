'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import Script from 'next/script'
import { buildMcqCsv, downloadCsv } from '@/lib/export-csv'
import { clearDrawer, getDrawerCards, syncDrawerOwner } from '@/lib/drawer-storage'
import { useCurrentUser } from '@/lib/use-current-user'
import { getSavedGeminiApiKey, saveGeminiApiKey } from '@/lib/gemini-key-storage'
import { callGeminiJson, type GeminiInlineFile } from '@/lib/gemini-client'
import { decodeText } from '@/lib/text-obfuscation'
import type { McqCard } from '@/lib/history-types'
import { addCardsToAnki, ensureAnkiGenModelExists, ensureDeckExists, type AnkiCardInput } from '@/lib/anki-connect'
import SaveToAnkiButton from '@/components/save-to-anki-button'
import AnkiOpenHint from '@/components/anki-open-hint'
import AutoGrowTextarea from '@/components/auto-grow-textarea'
import AnkiSimulator from './anki-simulator'

interface CardState extends McqCard {
  localId: string
}

const OPTION_KEYS = ['optionA', 'optionB', 'optionC', 'optionD', 'optionE', 'optionF'] as const

// 使用者還沒解析出任何卡片時，模擬器先顯示一張範例卡片，讓人一眼看懂這個功能在做什麼。
const SAMPLE_PREVIEW_CARD: McqCard = {
  questionText: '關於心肌梗塞，下列哪項血中心肌酵素最快上升？',
  optionA: 'Myoglobin（肌紅蛋白）',
  optionB: 'Troponin I（心肌肌鈣蛋白 I）',
  optionC: 'CK-MB（肌酸激酶同工酶 MB）',
  optionD: 'LDH（乳酸脫氫酶）',
  optionE: '',
  optionF: '',
  answer: 'A',
  isMultiple: false,
  notes:
    'Myoglobin 在心肌受損後 1-3 小時內最快釋放到血中，但因為它也存在於骨骼肌，特異性較低。Troponin I 則在 3-4 小時後上升，但特異性極高。',
}

const SAMPLE_MARKDOWN = `1. 關於冠狀動脈疾病（CAD）的診斷與評估，下列敘述何者錯誤？
A. 運動心電圖是最常見的初步篩檢工具
B. 心臟電腦斷層血管攝影（CCTA）可用於排除低至中度風險患者的阻塞性病變
C. 核心心臟造影（SPECT）是藉由評估心肌灌流來偵測缺血
D. 冠狀動脈造影（CATH）是診斷的黃金標準，但只有在非侵入性檢查異常時才可進行
答案：D
解析：冠狀動脈造影（導管檢查）是黃金標準，但若患者有急性冠心症（ACS）或不穩定心絞痛且臨床風險極高，可直接進行侵入性導管檢查，不一定要先經過非侵入性檢查。

2. 一位 65 歲男性因呼吸困難入院，聽診在心尖處可聞及舒張期滾動樣雜音（diastolic rumbling murmur），且第一心音變強。下列哪些發現也可能在此患者身上觀察到？（多選）
A. 心房顫動（Atrial Fibrillation）
B. 左心房擴大（Left Atrial Enlargement）
C. 肺動脈高壓（Pulmonary Hypertension）
D. 左心室肥大（Left Ventricular Hypertrophy）
答案：A, B, C
解析：患者聽診特徵為典型的二尖瓣狹窄（Mitral Stenosis）。二尖瓣狹窄會導致左心房壓力增高並擴大，進而引發心房顫動與肺靜脈高壓/肺動脈高壓。然而，因為血液進入左心室受阻，左心室通常不會肥大。`

// 跟 anki-*-templates.ts 同樣的考量：把這段 Prompt 指示用 decodeText(base64) 包起來，
// 避免打包後的 JS 檔案裡可以直接搜尋到完整內容。這段只包含固定不變的 JSON 格式與規則說明；
// 開頭的情境句與結尾的來源文字是明文組出來的（要依有沒有上傳檔案而變化），見 buildPrompt()。
// 要修改內容時，先把 base64 還原成明文修改，改完再重新編碼回去。
const PROMPT_TEMPLATE_B64 =
  '5q+P5YCL5YWD57Sg55qE5qC85byP77yaCnsKICAicXVlc3Rpb25UZXh0IjogIumhjOebruWFp+WuuSIsCiAgIm9wdGlvbkEiOiAi6YG46aCFQSIsICJvcHRpb25CIjogIumBuOmghUIiLCAib3B0aW9uQyI6ICLpgbjpoIVDIiwgIm9wdGlvbkQiOiAi6YG46aCFRCIsICJvcHRpb25FIjogIumBuOmghUUiLCAib3B0aW9uRiI6ICLpgbjpoIVGIiwKICAiYW5zd2VyIjogIuato+eiuuetlOahiOeahOWtl+avje+8jOS+i+WmguOAjEHjgI3vvJvlpoLmnpzmmK/lpJrpgbjpoYzlsLHnlKjlpJrlgIvlrZfmr43vvIzkvovlpoLjgIxBQ+OAjSIsCiAgImlzTXVsdGlwbGUiOiB0cnVlIOaIliBmYWxzZe+8iOaYr+WQpueCuuWkmumBuOmhjO+8iSwKICAibm90ZXMiOiAi57Ch55+t55qE6Kej6YeL5oiW6KOc5YWF6Kqq5piO77yI6YG45aGr77yM5rKS5pyJ5bCx55WZ56m65a2X5Liy77yJIgp9Cgropo/liYfvvJoKLSDoh7PlsJHopoHmnIkgb3B0aW9uQSDlkowgb3B0aW9uQu+8jOeUqOS4jeWIsOeahOmBuOmgheeVmeepuuWtl+S4siAiIgotIOWmguaenOWFp+WuueacrOi6q+WMheWQq+aVuOWtuOWFrOW8j++8jOe2reaMgeWOn+acrOeahOWvq+azle+8iOS+i+WmgiAkeF4yJCDmiJYgXCh4XjJcKe+8ie+8jOS4jeimgeiHquW3seaUueWvqw=='

// files 存在時，情境句改成請 AI 讀附件（可能有文字補充）；沒有 files 就跟原本一樣單純讀文字。
function buildPrompt(sourceText: string, hasFiles: boolean): string {
  const intro = hasFiles
    ? `你是一個幫忙把上傳的 PDF / 照片內容轉換成 Anki 選擇題卡片的助手。請閱讀以下附上的 PDF 檔案／照片圖片（可能有多個檔案或多頁，請視為同一份考卷依序合併判讀）${sourceText ? '，並參考額外補充文字' : ''}，盡量抽取或改寫成多張選擇題，用 JSON 陣列格式回傳，不要有其他文字或說明。若圖片模糊或部分無法辨識，請盡力推斷，不要省略整題。`
    : '你是一個幫忙把文字內容轉換成 Anki 選擇題卡片的助手。請閱讀以下文字內容，盡量抽取或改寫成多張選擇題，用 JSON 陣列格式回傳，不要有其他文字或說明。'

  const tail = sourceText
    ? `\n\n${hasFiles ? '補充文字內容：' : '文字內容：'}\n"""\n${sourceText}\n"""`
    : ''

  return `${intro}\n\n${decodeText(PROMPT_TEMPLATE_B64)}${tail}`
}

async function callGemini(
  apiKey: string,
  model: string,
  sourceText: string,
  files: GeminiInlineFile[]
): Promise<McqCard[]> {
  const prompt = buildPrompt(sourceText, files.length > 0)
  const parsed = await callGeminiJson(apiKey, model, prompt, files)
  if (!Array.isArray(parsed)) throw new Error('Gemini 回傳的格式不是陣列')
  return parsed as McqCard[]
}

const MAX_FILE_SIZE_MB = 15 // 單一檔案大小上限（Gemini inline data 有整體請求大小限制）

interface UploadedFile {
  localId: string
  name: string
  mimeType: string
  base64: string
}

// 把檔案讀成 base64（不含 data:xxx;base64, 前綴），供 Gemini inlineData 使用
function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve((reader.result as string).split(',')[1])
    reader.onerror = () => reject(new Error(`讀取檔案「${file.name}」失敗`))
    reader.readAsDataURL(file)
  })
}

function makeCardState(card: Partial<McqCard> = {}): CardState {
  return {
    localId: crypto.randomUUID(),
    questionText: card.questionText ?? '',
    optionA: card.optionA ?? '',
    optionB: card.optionB ?? '',
    optionC: card.optionC ?? '',
    optionD: card.optionD ?? '',
    optionE: card.optionE ?? '',
    optionF: card.optionF ?? '',
    answer: card.answer ?? '',
    isMultiple: card.isMultiple ?? false,
    notes: card.notes ?? '',
  }
}

export default function McqToolPage() {
  const { user, ready: userReady } = useCurrentUser()
  const [apiKey, setApiKey] = useState('')
  const [model, setModel] = useState('gemini-3.6-flash')
  const [inputMethod, setInputMethod] = useState<'text' | 'file'>('text')
  const [sourceText, setSourceText] = useState('')
  const [cards, setCards] = useState<CardState[]>([])
  const [purpose, setPurpose] = useState('')
  const [parsing, setParsing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: 'ok' | 'error'; text: string } | null>(null)
  const [previewIndex, setPreviewIndex] = useState(0)
  const [fromDrawer, setFromDrawer] = useState(false)
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([])
  const [isDragOver, setIsDragOver] = useState(false)
  const lastSavedSignatureRef = useRef<string | null>(null)
  const hasLoadedFromDrawerRef = useRef(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const simulatorRef = useRef<HTMLElement>(null)

  useEffect(() => {
    // localStorage 只在瀏覽器端讀得到，故意等 mount 後才讀，讓使用者用過一次的
    // key 之後打開頁面就自動帶出來，不用每次都重打。
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setApiKey(getSavedGeminiApiKey())
  }, [])

  useEffect(() => {
    // 用 ref 確保這段「從抽屜載入」的邏輯只在 userReady 第一次變成 true 時執行一次，
    // 不會因為之後 user 物件參照變動（例如 token 自動刷新）又重新觸發、蓋掉使用者
    // 已經在編輯的內容。
    if (!userReady || hasLoadedFromDrawerRef.current) return
    hasLoadedFromDrawerRef.current = true

    const params = new URLSearchParams(window.location.search)
    if (params.get('from') !== 'drawer') return

    // 先確認抽屜還是不是屬於目前這個使用者，再讀取內容，避免看到上一個
    // 使用者留下的卡片。
    syncDrawerOwner(user?.id ?? null)
    // 抽屜同一時間只會裝一種類型的卡片，這裡只認文字選擇題（mcq），防呆用。
    const drawerCards = getDrawerCards().filter((c) => c.cardType === 'mcq')
    if (drawerCards.length === 0) return

    // 同上：window.location 和抽屜的 localStorage 都只在瀏覽器端讀得到，故意等 mount 後才讀。
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setFromDrawer(true)
    setCards(
      drawerCards.map((c) =>
        makeCardState({
          questionText: c.questionText,
          optionA: c.optionA,
          optionB: c.optionB,
          optionC: c.optionC,
          optionD: c.optionD,
          optionE: c.optionE,
          optionF: c.optionF,
          answer: c.answer,
          isMultiple: c.isMultiple,
          notes: c.notes,
        })
      )
    )
  }, [userReady, user])

  async function handleParse() {
    if (!apiKey.trim()) {
      setMessage({ type: 'error', text: '請先輸入 Gemini API Key' })
      return
    }
    if (inputMethod === 'text' && !sourceText.trim()) {
      setMessage({ type: 'error', text: '請先貼上要解析的文字內容' })
      return
    }
    if (inputMethod === 'file' && uploadedFiles.length === 0) {
      setMessage({ type: 'error', text: '請先上傳 PDF 或照片檔案' })
      return
    }

    setParsing(true)
    setMessage(null)
    try {
      // 使用者是透過「輸入方式」分頁二選一，所以只送出目前選擇的那一種來源給 Gemini。
      const effectiveSourceText = inputMethod === 'text' ? sourceText : ''
      const files: GeminiInlineFile[] =
        inputMethod === 'file' ? uploadedFiles.map((f) => ({ mimeType: f.mimeType, base64: f.base64 })) : []
      const parsed = await callGemini(apiKey.trim(), model, effectiveSourceText, files)
      setCards((prev) => [...prev, ...parsed.map((c) => makeCardState(c))])
      setMessage({ type: 'ok', text: `解析出 ${parsed.length} 張卡片` })
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : String(error) })
    } finally {
      setParsing(false)
    }
  }

  // 驗證並讀取使用者選取／拖放的 PDF、照片檔案，轉成 base64 存進 state。
  // 同一批只能是 PDF 或照片其中一種：已有上傳檔案時，用第一個檔案的類型鎖住這批次，
  // 之後選到不同類型的檔案就擋掉，避免 AI 把不同來源的頁面混在一起判讀。
  async function handleFilesSelected(fileList: FileList | null) {
    const files = Array.from(fileList ?? [])
    if (files.length === 0) return

    let lockedCategory: 'pdf' | 'image' | null =
      uploadedFiles.length > 0 ? (uploadedFiles[0].mimeType === 'application/pdf' ? 'pdf' : 'image') : null

    for (const file of files) {
      const isPdf = file.type === 'application/pdf'
      const isImage = file.type.startsWith('image/')
      if (!isPdf && !isImage) {
        alert(`「${file.name}」不是支援的格式，請上傳 PDF 或圖片檔案。`)
        continue
      }
      const category: 'pdf' | 'image' = isPdf ? 'pdf' : 'image'
      if (lockedCategory && category !== lockedCategory) {
        alert(
          `「${file.name}」無法加入：PDF 和照片不能同時上傳，請先移除已上傳的${lockedCategory === 'pdf' ? 'PDF' : '照片'}，或只選同一種類型的檔案。`
        )
        continue
      }
      if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
        alert(`「${file.name}」超過 ${MAX_FILE_SIZE_MB}MB 大小限制，請壓縮後再上傳。`)
        continue
      }
      try {
        const base64 = await readFileAsBase64(file)
        setUploadedFiles((prev) => [...prev, { localId: crypto.randomUUID(), name: file.name, mimeType: file.type, base64 }])
        lockedCategory = category
      } catch (error) {
        alert(error instanceof Error ? error.message : `讀取「${file.name}」時發生錯誤`)
      }
    }
  }

  function removeUploadedFile(localId: string) {
    setUploadedFiles((prev) => prev.filter((f) => f.localId !== localId))
  }

  function updateCard(localId: string, patch: Partial<CardState>) {
    setCards((prev) => prev.map((c) => (c.localId === localId ? { ...c, ...patch } : c)))
  }

  function removeCard(index: number) {
    if (!confirm(`確定要刪除第 ${index + 1} 題嗎？`)) return
    setCards((prev) => prev.filter((_, i) => i !== index))
    setPreviewIndex((prev) => Math.min(prev, cards.length - 2))
  }

  // 編輯區在模擬器下方，按「預覽」時把畫面捲回模擬器，不用自己往上找。
  function showPreview(index: number) {
    setPreviewIndex(index)
    simulatorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  function handleLoadSample() {
    setInputMethod('text')
    setSourceText(SAMPLE_MARKDOWN)
  }

  function handleClear() {
    setSourceText('')
    setCards([])
    setUploadedFiles([])
    setMessage(null)
  }

  function handleDownloadCsv() {
    if (cards.length === 0) return
    downloadCsv(`ankigen_mcq_${Date.now()}.csv`, buildMcqCsv(cards))
    void ensureSavedToHistory()
  }

  // 不管使用者是按「存入紀錄」、「匯出 CSV」還是「存入 Anki」，都應該順手把這批卡片
  // 存進歷史紀錄，不用另外再點一次。用內容的簽章判斷「這批卡片跟上次存的一不一樣」，
  // 一樣就跳過（避免同一批卡片因為連續按了兩個按鈕而存成兩筆重複的歷史紀錄）。
  function buildHistorySignature() {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    return JSON.stringify({ purpose, cards: cards.map(({ localId, ...rest }) => rest) })
  }

  async function ensureSavedToHistory(): Promise<{ ok: boolean; alreadySaved: boolean; error?: string }> {
    if (!user) return { ok: false, alreadySaved: false, error: '請先登入才能存入歷史紀錄' }
    if (cards.length === 0) return { ok: false, alreadySaved: false, error: '請先至少準備一張卡片' }
    if (cards.some((c) => !c.questionText.trim() || !c.answer.trim())) {
      return { ok: false, alreadySaved: false, error: '每張卡片都要填題目和答案' }
    }

    const signature = buildHistorySignature()
    if (signature === lastSavedSignatureRef.current) {
      return { ok: true, alreadySaved: true }
    }

    try {
      const response = await fetch('/api/history/mcq', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          purpose,
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          cards: cards.map(({ localId, ...rest }) => rest),
        }),
      })
      const data = await response.json()
      if (!response.ok) return { ok: false, alreadySaved: false, error: data.error ?? '存入歷史紀錄失敗' }
      lastSavedSignatureRef.current = signature
      if (fromDrawer) clearDrawer()
      return { ok: true, alreadySaved: false }
    } catch (error) {
      return { ok: false, alreadySaved: false, error: error instanceof Error ? error.message : String(error) }
    }
  }

  async function handleSave() {
    setSaving(true)
    setMessage(null)
    const result = await ensureSavedToHistory()
    setSaving(false)
    if (!result.ok) {
      setMessage({ type: 'error', text: result.error ?? '存入歷史紀錄失敗' })
      return
    }
    setMessage({
      type: 'ok',
      text: result.alreadySaved ? '這份卡組已經存入歷史紀錄囉！' : '已成功存入歷史紀錄！',
    })
  }

  const previewCard = cards[Math.min(previewIndex, cards.length - 1)] ?? SAMPLE_PREVIEW_CARD
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const ankiCards: AnkiCardInput[] = cards.map(({ localId, ...card }) => card)
  // 用來鎖住 accept 屬性與提示文字：已經上傳過 PDF 就只能再選 PDF，反之亦然。
  const uploadedCategory: 'pdf' | 'image' | null =
    uploadedFiles.length > 0 ? (uploadedFiles[0].mimeType === 'application/pdf' ? 'pdf' : 'image') : null

  return (
    <main className="app-container">
      {/* 上排左：輸入區 */}
      <section className="card-panel">
        <div className="panel-header">
          <h2>
            <span className="step-badge">1</span>
            輸入文字內容
          </h2>
          <div className="row-actions">
            <button onClick={handleLoadSample} className="btn btn-secondary btn-sm">
              💡 載入範例
            </button>
            <button onClick={handleClear} className="btn btn-danger-outline btn-sm">
              🗑️ 清除
            </button>
          </div>
        </div>
        <div className="panel-body">
          <p className="instruction-text">
            {inputMethod === 'file'
              ? '上傳你的 PDF 或拍照圖片，AI 會直接讀取檔案內容，自動解析題號、題目、選項、正確答案與解析。'
              : '貼上你的文字內容（例如考卷、筆記），系統會用 AI 自動解析題號、題目、選項、正確答案與解析。'}
          </p>

          <div className="api-key-wrapper">
            <span>🔑</span>
            <input
              type="password"
              placeholder="輸入您的 Gemini API Key"
              value={apiKey}
              onChange={(e) => {
                setApiKey(e.target.value)
                saveGeminiApiKey(e.target.value.trim())
              }}
              className="api-key-input"
            />
            <span className="api-key-divider">|</span>
            <span>🤖</span>
            <select
              value={model}
              onChange={(e) => setModel(e.target.value)}
              className="model-select"
            >
              <option value="gemini-3.6-flash">gemini-3.6-flash（推薦）</option>
              <option value="gemini-3.5-flash">gemini-3.5-flash</option>
              <option value="gemini-3.1-flash-lite">gemini-3.1-flash-lite（極速）</option>
              <option value="gemini-3.1-pro-preview">gemini-3.1-pro-preview（深度解析）</option>
            </select>
            <a
              href="https://aistudio.google.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="whitespace-nowrap text-xs font-semibold text-accent"
            >
              ❓ 獲取 Key
            </a>
          </div>

          <details className="hint-collapsible mb-4">
            <summary>免費 API Key 的使用建議</summary>
            <p className="instruction-text mt-2 mb-0">
              如果你的 API Key 是免費申請的，建議選用 <strong>gemini-3.1-flash-lite</strong>
              （額度限制較寬鬆）；但 lite 版本能處理的資料量較小，單次貼上的內容不要太多，以免生成失敗或跑不出結果，建議分批處理。
            </p>
          </details>

          <div className="input-method-tabs">
            <button
              type="button"
              onClick={() => setInputMethod('text')}
              className={`input-method-tab${inputMethod === 'text' ? ' active' : ''}`}
            >
              📝 貼上文字
            </button>
            <button
              type="button"
              onClick={() => setInputMethod('file')}
              className={`input-method-tab${inputMethod === 'file' ? ' active' : ''}`}
            >
              📎 上傳 PDF / 照片
            </button>
          </div>

          {inputMethod === 'file' ? (
            <>
              <input
                ref={fileInputRef}
                type="file"
                accept={
                  uploadedCategory === 'pdf'
                    ? 'application/pdf'
                    : uploadedCategory === 'image'
                      ? 'image/*'
                      : 'application/pdf,image/*'
                }
                multiple
                hidden
                onChange={(e) => {
                  void handleFilesSelected(e.target.files)
                  e.target.value = '' // 清空，允許重複選取同一檔案
                }}
              />
              <div
                className={`file-upload-wrapper${isDragOver ? ' dragover' : ''}`}
                onDragOver={(e) => {
                  e.preventDefault()
                  setIsDragOver(true)
                }}
                onDragEnter={(e) => {
                  e.preventDefault()
                  setIsDragOver(true)
                }}
                onDragLeave={() => setIsDragOver(false)}
                onDragEnd={() => setIsDragOver(false)}
                onDrop={(e) => {
                  e.preventDefault()
                  setIsDragOver(false)
                  void handleFilesSelected(e.dataTransfer.files)
                }}
              >
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="btn btn-secondary btn-sm"
                >
                  📎 選擇檔案
                </button>
                <span className="file-upload-hint">
                  可多選或拖放；同一次只能上傳 PDF 或照片其中一種，AI 會直接讀取檔案內容，不需先轉成文字
                </span>
                {uploadedFiles.length > 0 && (
                  <div className="file-upload-list">
                    {uploadedFiles.map((f) => (
                      <div key={f.localId} className="file-chip">
                        <span>{f.mimeType === 'application/pdf' ? '📄' : '🖼️'}</span>
                        <span className="file-chip-name" title={f.name}>
                          {f.name}
                        </span>
                        <button
                          type="button"
                          onClick={() => removeUploadedFile(f.localId)}
                          className="file-chip-remove"
                          title="移除此檔案"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          ) : (
            <textarea
              placeholder="貼上文字內容，例如：
1. 關於二尖瓣狹窄的敘述，下列何者錯誤？
A. 最常見的原因是風濕熱
B. 心尖處可聽到舒張期心雜音
C. 常合併心房顫動
D. 第一心音會變弱
答案：D
解析：二尖瓣狹窄時，第一心音通常會變強（Loud S1）..."
              value={sourceText}
              onChange={(e) => setSourceText(e.target.value)}
              rows={10}
              className="field-input mb-4 font-mono"
            />
          )}

          <button onClick={handleParse} disabled={parsing} className="btn btn-primary btn-lg w-full">
            {parsing ? '✨ 解析中...' : '✨ AI 智慧解析'}
          </button>
        </div>
      </section>

      {/* 上排右：卡片預覽。按下題目卡片上的「預覽」會捲回這裡。 */}
      <section ref={simulatorRef} className="simulator-slot">
        <AnkiSimulator key={previewCard === SAMPLE_PREVIEW_CARD ? 'sample' : previewIndex} card={previewCard} />
      </section>

      {message && (
        <p className={`status-message col-span-full ${message.type === 'ok' ? 'status-ok' : 'status-error'}`}>
          {message.text}
        </p>
      )}

      {/* 下排：題目編輯區佔滿整列寬度，題目、選項、解析都有足夠空間閱讀與修改 */}
      {cards.length > 0 && (
        <section className="card-panel col-span-full">
          <div className="panel-header">
            <h2>
              <span className="step-badge">2</span>
              預覽與修改解析結果
              <span className="count-pill">{cards.length} 題</span>
            </h2>
          </div>
          <div className="panel-body">
            {fromDrawer && (
              <div className="notice-box mb-4">
                <div>
                  已經從抽屜載入 {cards.length} 張卡片。如果想幫這份卡組再補充新的題目，可以貼上文字內容重新解析，新解析出來的卡片會加進下面的列表一起處理。
                </div>
              </div>
            )}

            <div className="editor-toolbar">
              <div className="editor-toolbar-field">
                <label className="field-label" htmlFor="mcq-purpose">
                  🏷️ 這批卡片的用途標籤
                </label>
                <input
                  id="mcq-purpose"
                  placeholder="方便日後在歷史紀錄搜尋，也是存入 Anki 時的牌組名稱"
                  value={purpose}
                  onChange={(e) => setPurpose(e.target.value)}
                  className="field-input"
                />
              </div>
              <div className="row-actions">
                <button
                  onClick={handleSave}
                  disabled={saving || (userReady && !user)}
                  title={userReady && !user ? '登入後才能存入歷史紀錄' : undefined}
                  className="btn btn-secondary"
                >
                  {saving ? '存入中...' : userReady && !user ? '🔒 存入紀錄' : '🔖 存入紀錄'}
                </button>
                <button onClick={handleDownloadCsv} className="btn btn-success">
                  📄 匯出 CSV
                </button>
                <SaveToAnkiButton
                  saveCards={async (deckName) => {
                    await ensureAnkiGenModelExists()
                    await ensureDeckExists(deckName)
                    await addCardsToAnki(deckName, ankiCards)
                  }}
                  defaultDeckName={purpose || 'AnkiGen Hub'}
                  size="md"
                  onTrigger={() => void ensureSavedToHistory()}
                />
              </div>
            </div>
            <AnkiOpenHint className="mb-2" />
            {userReady && !user && (
              <p className="mb-2 text-xs text-text-secondary">
                🔒 登入後可以把這份卡組存入歷史紀錄。{' '}
                <Link href="/login" className="font-semibold text-accent">
                  前往登入
                </Link>
              </p>
            )}

            <div className="question-list">
              {cards.map((card, index) => {
                const correctLetters = String(card.answer ?? '').toUpperCase().replace(/[^A-F]/g, '')
                return (
                  <article
                    key={card.localId}
                    className={`question-card${index === previewIndex ? ' active' : ''}`}
                    // 正在編輯哪一題，右上角的模擬器就跟著切到哪一題
                    onFocusCapture={() => setPreviewIndex(index)}
                    onClick={(e) => {
                      const tag = (e.target as HTMLElement).tagName
                      if (['INPUT', 'SELECT', 'BUTTON', 'TEXTAREA'].includes(tag)) return
                      setPreviewIndex(index)
                    }}
                  >
                    <header className="question-card-header">
                      <span className="question-number">第 {index + 1} 題</span>
                      <select
                        className="qc-input qc-select"
                        value={card.isMultiple ? 'y' : ''}
                        onChange={(e) => updateCard(card.localId, { isMultiple: e.target.value === 'y' })}
                        aria-label="題目類型"
                      >
                        <option value="">單選題</option>
                        <option value="y">多選題</option>
                      </select>
                      <label className="question-answer">
                        答案
                        <input
                          className="qc-input question-answer-input"
                          placeholder="A, C"
                          value={card.answer}
                          onChange={(e) => updateCard(card.localId, { answer: e.target.value })}
                        />
                      </label>
                      <div className="question-card-actions">
                        <button
                          onClick={() => showPreview(index)}
                          className="btn btn-secondary btn-xs"
                          title="在模擬器中預覽這一題"
                        >
                          🔍 預覽
                        </button>
                        <button
                          onClick={() => removeCard(index)}
                          className="btn btn-danger-outline btn-xs"
                          title="刪除本題"
                        >
                          🗑️ 刪除
                        </button>
                      </div>
                    </header>

                    <div className="question-card-body">
                      <div className="question-main">
                        <label className="field-label" htmlFor={`${card.localId}-question`}>
                          題目
                        </label>
                        <AutoGrowTextarea
                          id={`${card.localId}-question`}
                          className="qc-input"
                          rows={3}
                          value={card.questionText}
                          onChange={(e) => updateCard(card.localId, { questionText: e.target.value })}
                        />
                        <label className="field-label" htmlFor={`${card.localId}-notes`}>
                          解析（選填）
                        </label>
                        <AutoGrowTextarea
                          id={`${card.localId}-notes`}
                          className="qc-input"
                          rows={3}
                          value={card.notes}
                          onChange={(e) => updateCard(card.localId, { notes: e.target.value })}
                        />
                      </div>

                      <div className="question-options">
                        <span className="field-label">選項（綠色字母為正確答案）</span>
                        {OPTION_KEYS.map((key, i) => {
                          const letter = String.fromCharCode(65 + i)
                          return (
                            <div key={key} className="option-row">
                              <span className={`option-letter${correctLetters.includes(letter) ? ' correct' : ''}`}>
                                {letter}
                              </span>
                              {/* 選項太長時自動換行顯示完整內容；選項本身不該有換行，所以擋掉 Enter */}
                              <AutoGrowTextarea
                                className="qc-input qc-option"
                                rows={1}
                                placeholder={i >= 4 ? '（選填）' : undefined}
                                aria-label={`選項 ${letter}`}
                                value={card[key]}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') e.preventDefault()
                                }}
                                onChange={(e) => updateCard(card.localId, { [key]: e.target.value })}
                              />
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  </article>
                )
              })}
            </div>
          </div>
        </section>
      )}

      {/* 讓模擬器能比照 Anki 內部渲染數學公式，而不是顯示未渲染的原始語法。
          beforeInteractive 只能放在根 layout，這裡改用 afterInteractive——
          同一個 strategy 底下 Script 會依照放置順序依序執行，所以 config 還是會在
          MathJax 主程式庫載入之前先跑。 */}
      <Script id="mathjax-config" strategy="afterInteractive">
        {`window.MathJax = {
          tex: {
            inlineMath: [['\\\\(', '\\\\)']],
            displayMath: [['\\\\[', '\\\\]']],
            processEscapes: true
          },
          options: {
            skipHtmlTags: ['script', 'noscript', 'style', 'textarea', 'pre']
          }
        };`}
      </Script>
      <Script
        id="mathjax-script"
        src="https://cdnjs.cloudflare.com/ajax/libs/mathjax/3.2.2/es5/tex-chtml.js"
        strategy="afterInteractive"
      />
    </main>
  )
}
