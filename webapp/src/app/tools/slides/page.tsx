'use client'

import { useEffect, useState, type ChangeEvent, type DragEvent } from 'react'
import Link from 'next/link'
import Script from 'next/script'
import { createPreviewBlob } from '@/lib/create-preview-blob'
import { clearDrawer, getDrawerCards } from '@/lib/drawer-storage'
import { useCurrentUser } from '@/lib/use-current-user'
import { getSavedGeminiApiKey, saveGeminiApiKey } from '@/lib/gemini-key-storage'
import { callGeminiJson } from '@/lib/gemini-client'
import { buildDistractorPrompt, getGlossaryPoolExcluding, parseGlossaryMarkdown } from '@/lib/glossary'
import { buildSlidesMcqCsv, buildSlidesOcclusionCsv, downloadCsv } from '@/lib/export-csv'
import { computeUniqueFilename, getFileExtension, stripExtension } from '@/lib/slide-filename'
import { fetchImageAsBase64, fileToBase64, type AnkiCardInput } from '@/lib/anki-connect'
import SlideCard from './slide-card'
import McqEditPanel from './mcq-edit-panel'
import SlidesSimulator from './slides-simulator'
import AnkiTemplatePanel from '../mcq/anki-template-panel'
import SaveToAnkiButton from '@/components/save-to-anki-button'

const DISTRACTOR_TARGET_FIELDS = ['optionB', 'optionC', 'optionD'] as const
const DEFAULT_PROMPT = '這張圖片顯示的是什麼？'

interface SlideImage {
  localId: string
  kind: 'new' | 'reused'
  file?: File
  ext: string
  url: string
  filename: string
  notes: string
  included: boolean
  questionText: string
  optionA: string
  optionB: string
  optionC: string
  optionD: string
  optionE: string
  optionF: string
  answer: string
  isMultiple: boolean
  driveFileId?: string
  drivePreviewFileId?: string
}

function makeNewImage(file: File, sharedPrompt: string, existing: SlideImage[]): SlideImage {
  const filename = computeUniqueFilename(
    file.name,
    existing.map((i) => i.filename)
  )
  const ext = getFileExtension(file.name) || 'jpg'
  return {
    localId: crypto.randomUUID(),
    kind: 'new',
    file,
    ext,
    url: URL.createObjectURL(file),
    filename,
    notes: '',
    included: true,
    questionText: sharedPrompt.trim() || DEFAULT_PROMPT,
    optionA: stripExtension(filename),
    optionB: '',
    optionC: '',
    optionD: '',
    optionE: '',
    optionF: '',
    answer: 'A',
    isMultiple: false,
    driveFileId: undefined,
    drivePreviewFileId: undefined,
  }
}

function getDuplicateFilenameSet(imgs: SlideImage[]): Set<string> {
  const counts = new Map<string, number>()
  imgs.forEach((img) => counts.set(img.filename, (counts.get(img.filename) ?? 0) + 1))
  const dupes = new Set<string>()
  counts.forEach((count, fn) => {
    if (fn && count > 1) dupes.add(fn)
  })
  return dupes
}

export default function SlidesWizardPage() {
  const { user, ready: userReady } = useCurrentUser()
  const [step, setStep] = useState<'label' | 'export'>('label')
  const [mode, setMode] = useState<'mcq' | 'occlusion'>('mcq')
  const [images, setImages] = useState<SlideImage[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const [sharedPrompt, setSharedPrompt] = useState(DEFAULT_PROMPT)
  const [fromDrawer, setFromDrawer] = useState(false)

  const [purpose, setPurpose] = useState('')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: 'ok' | 'error'; text: string } | null>(null)

  const [apiKey, setApiKey] = useState('')
  const [model, setModel] = useState('gemini-3.5-flash')
  const [glossary, setGlossary] = useState<string[]>([])
  const [glossaryStatus, setGlossaryStatus] = useState('尚未上傳，AI 會憑空生成干擾選項')
  const [generatingFor, setGeneratingFor] = useState<string | null>(null)

  useEffect(() => {
    // localStorage 只在瀏覽器端讀得到，故意等 mount 後才讀，讓使用者用過一次的
    // key 之後打開頁面就自動帶出來，不用每次都重打。
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setApiKey(getSavedGeminiApiKey())
  }, [])

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('from') !== 'drawer') return

    // 抽屜同一時間只會裝一種類型的卡片，這裡只認圖片選擇題（slides-mcq），
    // 防呆用：理論上抽屜不會混到文字選擇題卡片，但還是明確篩選一次比較保險。
    const drawerCards = getDrawerCards().filter((c) => c.cardType === 'slides-mcq')
    if (drawerCards.length === 0) return

    // 同上：window.location 和抽屜的 localStorage 都只在瀏覽器端讀得到，故意等 mount 後才讀。
    // 故意停在步驟一（而不是直接跳到匯出設定），讓使用者檢視完抽屜裡沿用的卡片後，
    // 還可以在同一個地方直接補選新的照片，一起納入這次的匯出批次。
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setFromDrawer(true)
    setImages(
      drawerCards.map((c) => ({
        localId: crypto.randomUUID(),
        kind: 'reused' as const,
        ext: '',
        url: `/api/google-drive/image/${c.drivePreviewFileId}`,
        filename: c.filename,
        notes: c.notes,
        included: true,
        questionText: c.questionText,
        optionA: c.optionA,
        optionB: c.optionB,
        optionC: c.optionC,
        optionD: c.optionD,
        optionE: c.optionE,
        optionF: c.optionF,
        answer: c.answer,
        isMultiple: c.isMultiple,
        driveFileId: c.driveFileId,
        drivePreviewFileId: c.drivePreviewFileId,
      }))
    )
  }, [])

  const effectiveActiveId = activeId ?? images[0]?.localId ?? null
  const activeImage = images.find((img) => img.localId === effectiveActiveId) ?? null
  const dupes = getDuplicateFilenameSet(images)
  const includedImages = images.filter((img) => img.included)

  // 從抽屜沿用的卡片，img.url 平常指向縮圖用的壓縮預覽圖（給步驟一的小格子、表格縮圖用，
  // 載入快就好）；但放進模擬器裡顯示時看得比較明顯，改用原始檔案，畫質才不會比新選的
  // 圖片明顯差一截。新選的圖片本來就還沒壓縮，url 已經是原始檔案，不用特別處理。
  // fallbackUrl 保留原本的縮圖網址：萬一原始檔案讀不到（例如很久以前的舊資料），
  // 模擬器裡的 <img> 會自動改用這個保底網址，不會直接顯示破圖。
  const simulatorCard =
    activeImage && activeImage.kind === 'reused' && activeImage.driveFileId
      ? {
          ...activeImage,
          url: `/api/google-drive/image/${activeImage.driveFileId}`,
          fallbackUrl: activeImage.url,
        }
      : activeImage

  // 給「存入 Anki」按鈕用：新選的圖片直接用瀏覽器裡的 File（還沒壓縮，本來就是原始畫質）；
  // 從抽屜沿用的圖片已經在 Google Drive 上，透過同源 proxy route 抓原始檔案的 bytes。
  async function getAnkiCardsForSlides(): Promise<AnkiCardInput[]> {
    return Promise.all(
      includedImages.map(async (img) => ({
        questionText: img.questionText,
        optionA: img.optionA,
        optionB: img.optionB,
        optionC: img.optionC,
        optionD: img.optionD,
        optionE: img.optionE,
        optionF: img.optionF,
        answer: img.answer,
        isMultiple: img.isMultiple,
        notes: img.notes,
        image: {
          filename: img.filename,
          base64:
            img.kind === 'new' && img.file
              ? await fileToBase64(img.file)
              : await fetchImageAsBase64(`/api/google-drive/image/${img.driveFileId}`),
        },
      }))
    )
  }

  function updateImage(localId: string, patch: Partial<SlideImage>) {
    setImages((prev) => prev.map((img) => (img.localId === localId ? { ...img, ...patch } : img)))
  }

  function removeImage(localId: string) {
    setImages((prev) => {
      const img = prev.find((i) => i.localId === localId)
      if (img?.kind === 'new') URL.revokeObjectURL(img.url)
      return prev.filter((i) => i.localId !== localId)
    })
    if (activeId === localId) setActiveId(null)
  }

  function handleFilesAdded(fileList: FileList | null) {
    const files = Array.from(fileList ?? []).filter((f) => f.type.startsWith('image/'))
    if (files.length === 0) return

    setImages((prev) => {
      let running = [...prev]
      files.forEach((file) => {
        running = [...running, makeNewImage(file, sharedPrompt, running)]
      })
      return running
    })
  }

  function handleFileInputChange(e: ChangeEvent<HTMLInputElement>) {
    handleFilesAdded(e.target.files)
    e.target.value = ''
  }

  function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault()
    setDragOver(false)
    handleFilesAdded(e.dataTransfer.files)
  }

  function clearAllSlides() {
    if (images.length === 0) return
    images.forEach((img) => {
      if (img.kind === 'new') URL.revokeObjectURL(img.url)
    })
    setImages([])
    setActiveId(null)
  }

  function setAllIncluded(included: boolean) {
    setImages((prev) => prev.map((img) => ({ ...img, included })))
  }

  function applyPromptToAll() {
    if (images.length === 0) return
    const prompt = sharedPrompt.trim() || DEFAULT_PROMPT
    setImages((prev) => prev.map((img) => ({ ...img, questionText: prompt })))
  }

  // 下載重新命名後的圖片副本（內容跟原始檔案一模一樣，只有檔名改成步驟二設定好的名稱）；
  // 沿用的舊卡片圖片已經在 Drive 上、檔名也已經確認過，不需要重新下載。
  function downloadRenamedImages() {
    const rows = images.filter((img) => img.included && img.kind === 'new')
    if (rows.length === 0) return

    rows.forEach((img, idx) => {
      setTimeout(() => {
        const link = document.createElement('a')
        link.href = img.url
        link.download = img.filename
        link.style.visibility = 'hidden'
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
      }, idx * 250)
    })
  }

  function goToExportStep() {
    if (images.filter((img) => img.included).length === 0) {
      setMessage({ type: 'error', text: '請先選取至少一張圖片，並確認「納入匯出」有勾選！' })
      return
    }
    setMessage(null)
    setStep('export')
  }

  async function handleGlossaryFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return

    try {
      const text = await file.text()
      const terms = parseGlossaryMarkdown(text)
      setGlossary(terms)
      setGlossaryStatus(
        terms.length > 0
          ? `已載入 ${terms.length} 個詞彙（${file.name}）`
          : `「${file.name}」裡沒有解析到任何詞彙，請確認格式（一行一個詞彙，或用逗號、頓號分隔）`
      )
    } catch {
      setGlossaryStatus('讀取檔案失敗，請確認檔案格式是否正確。')
    }
  }

  async function handleGenerateDistractors() {
    const img = activeImage
    if (!img) return

    if (!apiKey.trim()) {
      setMessage({ type: 'error', text: '請先輸入 Gemini API Key' })
      return
    }
    if (!img.optionA.trim()) {
      setMessage({ type: 'error', text: '請先在選項 A 填入正確答案，AI 才知道要根據什麼產生干擾選項' })
      return
    }
    const emptyFields = DISTRACTOR_TARGET_FIELDS.filter((field) => !img[field].trim())
    if (emptyFields.length === 0) {
      setMessage({
        type: 'error',
        text: '選項 B、C、D 都已經有內容了。如果想讓 AI 重新產生，請先清空想要覆蓋的欄位',
      })
      return
    }

    setGeneratingFor(img.localId)
    setMessage(null)
    try {
      const pool = getGlossaryPoolExcluding(glossary, img.optionA)
      const prompt = buildDistractorPrompt(img.questionText, img.optionA, emptyFields.length, pool)
      const distractors = await callGeminiJson(apiKey.trim(), model, prompt)
      if (!Array.isArray(distractors)) throw new Error('Gemini 回傳的格式不是陣列')

      const patch: Partial<SlideImage> = {}
      emptyFields.forEach((field, idx) => {
        if (distractors[idx]) patch[field] = String(distractors[idx]).trim()
      })
      updateImage(img.localId, patch)
    } catch (error) {
      setMessage({
        type: 'error',
        text: `AI 產生干擾選項失敗：${error instanceof Error ? error.message : String(error)}`,
      })
    } finally {
      setGeneratingFor(null)
    }
  }

  async function handleSaveMcq() {
    const rows = includedImages
    if (rows.length === 0) {
      setMessage({ type: 'error', text: '請先選取並勾選至少一張圖片' })
      return
    }
    if (rows.some((c) => !c.questionText.trim() || !c.answer.trim())) {
      setMessage({ type: 'error', text: '每張卡片都要填提問文字和答案' })
      return
    }

    setSaving(true)
    setMessage(null)
    try {
      const formData = new FormData()
      formData.append('purpose', purpose)
      formData.append(
        'meta',
        JSON.stringify(
          rows.map((c) => ({
            filename: c.filename,
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
            ...(c.kind === 'reused'
              ? { driveFileId: c.driveFileId, drivePreviewFileId: c.drivePreviewFileId }
              : {}),
          }))
        )
      )
      await Promise.all(
        rows.map(async (c, i) => {
          if (c.kind === 'new' && c.file) {
            formData.append(`original_${i}`, c.file, c.file.name)
            formData.append(`preview_${i}`, await createPreviewBlob(c.file), 'preview.jpg')
          }
        })
      )

      const response = await fetch('/api/history/slides-mcq', { method: 'POST', body: formData })
      const data = await response.json()
      if (!response.ok) {
        setMessage({ type: 'error', text: data.error ?? '存入歷史紀錄失敗' })
        return
      }

      if (fromDrawer) clearDrawer()
      setMessage({ type: 'ok', text: '已成功存入歷史紀錄！' })
      images.forEach((img) => {
        if (img.kind === 'new') URL.revokeObjectURL(img.url)
      })
      setImages([])
      setActiveId(null)
      setPurpose('')
      setFromDrawer(false)
      setStep('label')
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : String(error) })
    } finally {
      setSaving(false)
    }
  }

  async function handleSaveOcclusion() {
    const rows = includedImages
    if (rows.length === 0) {
      setMessage({ type: 'error', text: '請先選取並勾選至少一張圖片' })
      return
    }

    setSaving(true)
    setMessage(null)
    try {
      const formData = new FormData()
      formData.append('purpose', purpose)
      formData.append(
        'meta',
        JSON.stringify(
          rows.map((c) => ({
            filename: c.filename,
            notes: c.notes,
            ...(c.kind === 'reused'
              ? { driveFileId: c.driveFileId, drivePreviewFileId: c.drivePreviewFileId }
              : {}),
          }))
        )
      )
      await Promise.all(
        rows.map(async (c, i) => {
          if (c.kind === 'new' && c.file) {
            formData.append(`original_${i}`, c.file, c.file.name)
            formData.append(`preview_${i}`, await createPreviewBlob(c.file), 'preview.jpg')
          }
        })
      )

      const response = await fetch('/api/history/slides-occlusion', { method: 'POST', body: formData })
      const data = await response.json()
      if (!response.ok) {
        setMessage({ type: 'error', text: data.error ?? '存入歷史紀錄失敗' })
        return
      }

      setMessage({ type: 'ok', text: '已成功存入歷史紀錄！' })
      images.forEach((img) => {
        if (img.kind === 'new') URL.revokeObjectURL(img.url)
      })
      setImages([])
      setActiveId(null)
      setPurpose('')
      setStep('label')
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : String(error) })
    } finally {
      setSaving(false)
    }
  }

  function handleDownloadMcqCsv() {
    if (includedImages.length === 0) {
      setMessage({ type: 'error', text: '請先選取並勾選至少一張圖片' })
      return
    }
    downloadCsv(
      `ankigen_slides_mcq_${formattedDate()}.csv`,
      buildSlidesMcqCsv(
        includedImages.map((c) => ({
          ...c,
          driveFileId: c.driveFileId ?? '',
          drivePreviewFileId: c.drivePreviewFileId ?? '',
        }))
      )
    )
  }

  function handleDownloadOcclusionCsv() {
    if (includedImages.length === 0) {
      setMessage({ type: 'error', text: '請先選取並勾選至少一張圖片' })
      return
    }
    downloadCsv(
      `ankigen_slides_image_occlusion_${formattedDate()}.csv`,
      buildSlidesOcclusionCsv(includedImages)
    )
  }

  return (
    <>
      <Script id="mathjax-config" strategy="afterInteractive">
        {`window.MathJax = { tex: { inlineMath: [['\\\\(', '\\\\)']], displayMath: [['\\\\[', '\\\\]']] }, svg: { fontCache: 'global' } };`}
      </Script>
      <Script
        src="https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-svg.js"
        strategy="afterInteractive"
      />

      {step === 'label' && (
        <div className="wizard-single-col">
          <div className="card-panel">
            <div className="panel-header">
              <h2>🖼️ 1. 選取圖片</h2>
              <button onClick={clearAllSlides} className="btn btn-danger-outline btn-sm">
                🗑️ 全部清除
              </button>
            </div>
            <div className="panel-body">
              <p className="instruction-text">
                選取本機的圖片檔案（可一次選取多張）。所有圖片只會留在你的瀏覽器分頁內處理。
              </p>
              {fromDrawer && (
                <div className="notice-box">
                  <div>
                    已經從抽屜載入 {images.length} 張卡片。如果檢視完之後想幫這份卡組再補充新的照片，直接在下面選取新圖片即可，會跟抽屜裡的卡片一起納入這次的匯出。
                  </div>
                </div>
              )}
              <div
                className={`slide-dropzone ${dragOver ? 'drag-over' : ''}`}
                onClick={(e) => {
                  if ((e.target as HTMLElement).closest('button')) return
                  document.getElementById('slide-file-input')?.click()
                }}
                onDragOver={(e) => {
                  e.preventDefault()
                  setDragOver(true)
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
              >
                <input
                  type="file"
                  id="slide-file-input"
                  accept="image/*"
                  multiple
                  hidden
                  onChange={handleFileInputChange}
                />
                <p>拖曳圖片到這裡，或</p>
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={() => document.getElementById('slide-file-input')?.click()}
                >
                  選擇圖片
                </button>
              </div>
            </div>
          </div>

          {images.length > 0 && (
            <div className="card-panel mt-4">
              <div className="panel-header">
                <h2>🏷️ 2. 重新命名檔案與選取（{images.length} 張）</h2>
                <div className="row-actions">
                  <button onClick={() => setAllIncluded(true)} className="btn btn-secondary btn-sm">
                    全選
                  </button>
                  <button onClick={() => setAllIncluded(false)} className="btn btn-secondary btn-sm">
                    取消全選
                  </button>
                  <button onClick={downloadRenamedImages} className="btn btn-secondary btn-sm">
                    ⬇️ 下載重新命名的圖片
                  </button>
                </div>
              </div>
              <div className="panel-body">
                <p className="instruction-text">
                  「檔案名稱」預設取自原始檔名，可以直接改成這張圖片的正式名稱（例如：封面.jpg）。就算你沒有加副檔名，系統也會自動幫你補上原始的圖片格式，確保匯入
                  Anki 後圖片一定讀得到。改好之後，請按右上角「下載重新命名的圖片」，把下載下來的檔案複製進 Anki
                  媒體庫即可。
                </p>
                <div className="slide-grid">
                  {images.map((img) => (
                    <SlideCard
                      key={img.localId}
                      card={img}
                      isDuplicate={dupes.has(img.filename)}
                      onUpdate={(patch) => updateImage(img.localId, patch)}
                      onRemove={() => removeImage(img.localId)}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}

          {message && (
            <p className={`mt-3 text-sm ${message.type === 'ok' ? 'text-success' : 'text-danger'}`}>
              {message.text}
            </p>
          )}

          <div className="wizard-nav flex justify-end mt-4">
            <button onClick={goToExportStep} className="btn btn-primary btn-lg">
              下一步：設定匯出內容 →
            </button>
          </div>
        </div>
      )}

      {step === 'export' && (
        <>
          <button
            onClick={() => setStep('label')}
            className="btn btn-secondary btn-xs fixed right-8 top-[60px] z-40 shadow-md"
          >
            ← 上一步：繼續標記圖片
          </button>

          <div className="app-container">
            <section className="panel-left">
              <div className="card-panel">
                <div className="panel-header">
                  <h2>📤 3. 匯出模式</h2>
                </div>
                <div className="panel-body">
                  <div className="mode-tabs">
                    <button
                      className={`mode-tab-btn ${mode === 'mcq' ? 'active' : ''}`}
                      onClick={() => setMode('mcq')}
                    >
                      ✅ 選擇題模式
                    </button>
                    <button
                      className={`mode-tab-btn ${mode === 'occlusion' ? 'active' : ''}`}
                      onClick={() => setMode('occlusion')}
                    >
                      🗂️ Image Occlusion 模式
                    </button>
                  </div>

                  {mode === 'mcq' && (
                    <div>
                      <div className="api-key-wrapper mb-3">
                        <span title="Gemini API Key">🔑</span>
                        <input
                          type="password"
                          className="api-key-input"
                          placeholder="輸入您的 Gemini API Key（用於 AI 產生干擾選項）"
                          value={apiKey}
                          onChange={(e) => {
                            setApiKey(e.target.value)
                            saveGeminiApiKey(e.target.value.trim())
                          }}
                        />
                        <span className="api-key-divider">|</span>
                        <span title="選擇 AI 模型">🤖</span>
                        <select
                          className="model-select"
                          value={model}
                          onChange={(e) => setModel(e.target.value)}
                        >
                          <option value="gemini-3.5-flash">gemini-3.5-flash（推薦）</option>
                          <option value="gemini-3.1-flash-lite">gemini-3.1-flash-lite（極速）</option>
                          <option value="gemini-3.1-pro-preview">gemini-3.1-pro-preview（深度解析）</option>
                        </select>
                        <a
                          href="https://aistudio.google.com/"
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs text-primary underline whitespace-nowrap"
                        >
                          ❓ 獲取 Key
                        </a>
                      </div>

                      <div className="field-row">
                        <label>干擾選項詞彙表 (.md，選填)</label>
                        <div className="field-row-inline">
                          <label className="btn btn-secondary btn-sm cursor-pointer">
                            ⬆️ 上傳詞彙表 (.md)
                            <input
                              type="file"
                              accept=".md,.markdown,text/markdown,text/plain"
                              hidden
                              onChange={handleGlossaryFile}
                            />
                          </label>
                          <span className="field-hint">{glossaryStatus}</span>
                        </div>
                        <p className="field-hint">
                          上傳一份 .md 文字檔，條列這份牌組相關的詞彙。產生干擾選項時會優先從清單裡挑選同類別、容易混淆的項目。
                        </p>
                      </div>

                      <div className="field-row">
                        <label>套用到每張圖片的提問文字</label>
                        <div className="field-row-inline">
                          <input
                            type="text"
                            className="cell-input"
                            value={sharedPrompt}
                            onChange={(e) => setSharedPrompt(e.target.value)}
                          />
                          <button onClick={applyPromptToAll} className="btn btn-secondary btn-sm" type="button">
                            🔄 套用到全部題目
                          </button>
                        </div>
                      </div>

                      {activeImage && (
                        <McqEditPanel
                          card={activeImage}
                          onUpdate={(patch) => updateImage(activeImage.localId, patch)}
                          onGenerateDistractors={handleGenerateDistractors}
                          generating={generatingFor === activeImage.localId}
                        />
                      )}

                      <div className="table-container mt-3">
                        <table className="editable-table">
                          <thead>
                            <tr>
                              <th style={{ width: '12%' }}>圖片</th>
                              <th style={{ width: '43%' }}>提問文字</th>
                              <th style={{ width: '13%' }}>類型</th>
                              <th style={{ width: '12%' }}>答案</th>
                              <th style={{ width: '20%' }}>操作</th>
                            </tr>
                          </thead>
                          <tbody>
                            {includedImages.map((img) => (
                              <tr
                                key={img.localId}
                                className={img.localId === effectiveActiveId ? 'table-row-active' : ''}
                              >
                                <td>
                                  {/* eslint-disable-next-line @next/next/no-img-element */}
                                  <img className="mcq-table-thumb" src={img.url} alt="" title={img.filename} />
                                </td>
                                <td>
                                  <div className="compact-question-preview">{img.questionText}</div>
                                </td>
                                <td>{img.isMultiple ? '多選題' : '單選題'}</td>
                                <td>{img.answer}</td>
                                <td>
                                  <div className="row-actions">
                                    <button
                                      onClick={() => setActiveId(img.localId)}
                                      className="btn btn-secondary btn-xs"
                                    >
                                      編輯
                                    </button>
                                    <button
                                      onClick={() => removeImage(img.localId)}
                                      className="btn btn-danger-outline btn-xs"
                                    >
                                      🗑️
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      <div className="mt-3">
                        <label className="field-label">🏷️ 這批卡片的用途標籤</label>
                        <input
                          placeholder="方便日後在歷史紀錄搜尋，也是存入 Anki 時的牌組名稱"
                          value={purpose}
                          onChange={(e) => setPurpose(e.target.value)}
                          className="field-input mb-3"
                        />
                      </div>

                      <div className="flex items-center justify-between flex-wrap gap-3">
                        <span className="instruction-text">
                          {includedImages.length === 0
                            ? '先選取圖片並勾選納入匯出，這裡就會自動整理成選擇題。'
                            : ''}
                        </span>
                        <div className="row-actions">
                          <button
                            onClick={handleSaveMcq}
                            disabled={saving || (userReady && !user)}
                            title={userReady && !user ? '登入後才能存入歷史紀錄' : undefined}
                            className="btn btn-secondary"
                          >
                            {userReady && !user ? '🔒' : '🔖'} {saving ? '存入中...' : '存入紀錄'}
                          </button>
                          <button onClick={handleDownloadMcqCsv} className="btn btn-success">
                            📄 匯出 Anki 匯入檔 (CSV)
                          </button>
                          <SaveToAnkiButton
                            getCards={getAnkiCardsForSlides}
                            defaultDeckName={purpose || 'AnkiGen Hub'}
                            size="md"
                          />
                        </div>
                      </div>
                      {userReady && !user && (
                        <p className="mt-2 text-xs text-text-secondary">
                          🔒 登入後可以把這份卡組存入歷史紀錄。{' '}
                          <Link href="/login" className="font-semibold text-accent">
                            前往登入
                          </Link>
                        </p>
                      )}
                    </div>
                  )}

                  {mode === 'occlusion' && (
                    <div>
                      <div className="notice-box mb-3">
                        <div>
                          這裡匯出的欄位順序對應 Anki 內建的 Image Occlusion 筆記類型：Occlusion、Image、Header、Back
                          Extra、Comments。匯入時請把「筆記類型」選成 Image Occlusion，並確認欄位對應順序一致。匯入後每一張筆記都還沒有卡片，需要在
                          Anki 打開這張筆記、用內建的遮罩編輯器畫出實際的遮蓋範圍。
                        </div>
                      </div>
                      <div className="table-container">
                        <table className="editable-table">
                          <thead>
                            <tr>
                              <th style={{ width: '20%' }}>縮圖</th>
                              <th style={{ width: '35%' }}>檔名 (Header / Image)</th>
                              <th style={{ width: '45%' }}>備註 (Back Extra)</th>
                            </tr>
                          </thead>
                          <tbody>
                            {includedImages.map((img) => (
                              <tr key={img.localId}>
                                <td>
                                  {/* eslint-disable-next-line @next/next/no-img-element */}
                                  <img className="mcq-table-thumb" src={img.url} alt="" />
                                </td>
                                <td>{img.filename}</td>
                                <td>
                                  <textarea
                                    className="cell-input"
                                    rows={2}
                                    value={img.notes}
                                    onChange={(e) => updateImage(img.localId, { notes: e.target.value })}
                                  />
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      <div className="mt-3">
                        <label className="field-label">🏷️ 這批卡片的用途標籤</label>
                        <input
                          placeholder="方便日後在歷史紀錄搜尋"
                          value={purpose}
                          onChange={(e) => setPurpose(e.target.value)}
                          className="field-input mb-3"
                        />
                      </div>

                      <div className="flex items-center justify-between flex-wrap gap-3">
                        <span className="instruction-text">
                          {includedImages.length === 0 ? '先選取圖片並勾選納入匯出，這裡就會自動整理。' : ''}
                        </span>
                        <div className="row-actions">
                          <button
                            onClick={handleSaveOcclusion}
                            disabled={saving || (userReady && !user)}
                            title={userReady && !user ? '登入後才能存入歷史紀錄' : undefined}
                            className="btn btn-secondary"
                          >
                            {userReady && !user ? '🔒' : '🔖'} {saving ? '存入中...' : '存入紀錄'}
                          </button>
                          <button onClick={handleDownloadOcclusionCsv} className="btn btn-success">
                            📄 匯出 Image Occlusion 匯入檔 (CSV)
                          </button>
                        </div>
                      </div>
                      {userReady && !user && (
                        <p className="mt-2 text-xs text-text-secondary">
                          🔒 登入後可以把這份卡組存入歷史紀錄。{' '}
                          <Link href="/login" className="font-semibold text-accent">
                            前往登入
                          </Link>
                        </p>
                      )}
                      <p className="mt-2 text-xs text-text-secondary">
                        Image Occlusion 需要在 Anki 裡手動畫遮蓋範圍，暫不支援直接存入 Anki，請用上面的 CSV +
                        圖片。
                      </p>
                    </div>
                  )}

                  {message && (
                    <p className={`mt-3 text-sm ${message.type === 'ok' ? 'text-success' : 'text-danger'}`}>
                      {message.text}
                    </p>
                  )}
                </div>
              </div>
            </section>

            <section className="panel-right">
              <SlidesSimulator key={`${effectiveActiveId}-${mode}`} mode={mode} card={simulatorCard} />

              {mode === 'mcq' ? (
                <div className="mt-4">
                  <AnkiTemplatePanel />
                </div>
              ) : (
                <div className="card-panel mt-4">
                  <div className="panel-header">
                    <h2>ℹ️ 匯入設定提醒</h2>
                  </div>
                  <div className="panel-body">
                    <p className="instruction-text">
                      Image Occlusion 模式用的是 Anki 內建的 Image Occlusion 筆記類型，不需要自己建立模板。匯入 CSV
                      時，請在 Anki 的匯入畫面把「筆記類型」選成 Image Occlusion，並確認欄位對應順序如下：
                    </p>
                    <div className="fields-list">
                      <div className="field-item">
                        <code>1. Occlusion</code>
                        <span className="field-desc">已帶入「尚未框選：檔名」佔位文字（不能留空）</span>
                      </div>
                      <div className="field-item">
                        <code>2. Image</code>
                        <span className="field-desc">已自動帶入 &lt;img src=&quot;檔名&quot;&gt;</span>
                      </div>
                      <div className="field-item">
                        <code>3. Header</code>
                        <span className="field-desc">留空</span>
                      </div>
                      <div className="field-item">
                        <code>4. Back Extra</code>
                        <span className="field-desc">已自動帶入你填的備註</span>
                      </div>
                      <div className="field-item">
                        <code>5. Comments</code>
                        <span className="field-desc">留空</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </section>
          </div>
        </>
      )}
    </>
  )
}

function formattedDate() {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}`
}
