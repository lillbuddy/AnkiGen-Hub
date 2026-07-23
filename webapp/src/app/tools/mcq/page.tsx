'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import Script from 'next/script'
import { buildMcqCsv, downloadCsv } from '@/lib/export-csv'
import { clearDrawer, getDrawerCards, syncDrawerOwner } from '@/lib/drawer-storage'
import { useCurrentUser } from '@/lib/use-current-user'
import { getSavedGeminiApiKey, saveGeminiApiKey } from '@/lib/gemini-key-storage'
import { callGeminiJson } from '@/lib/gemini-client'
import { decodeText } from '@/lib/text-obfuscation'
import type { McqCard } from '@/lib/history-types'
import { addCardsToAnki, ensureAnkiGenModelExists, ensureDeckExists, type AnkiCardInput } from '@/lib/anki-connect'
import SaveToAnkiButton from '@/components/save-to-anki-button'
import AnkiSimulator from './anki-simulator'
import AnkiConnectSetupPanel from './anki-connect-setup-panel'

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
// 避免打包後的 JS 檔案裡可以直接搜尋到完整內容。要修改內容時，先把 base64 還原成明文
// 修改（留意 %%SOURCE_TEXT%% 這個佔位字串要保留在正確位置），改完再重新編碼回去。
const PROMPT_TEMPLATE_B64 =
  '5L2g5piv5LiA5YCL5bmr5b+Z5oqK5paH5a2X5YWn5a656L2J5o+b5oiQIEFua2kg6YG45pOH6aGM5Y2h54mH55qE5Yqp5omL44CC6KuL6Zax6K6A5Lul5LiL5paH5a2X5YWn5a6577yM55uh6YeP5oq95Y+W5oiW5pS55a+r5oiQ5aSa5by16YG45pOH6aGM77yM55SoIEpTT04g6Zmj5YiX5qC85byP5Zue5YKz77yM5LiN6KaB5pyJ5YW25LuW5paH5a2X5oiW6Kqq5piO44CCCgrmr4/lgIvlhYPntKDnmoTmoLzlvI/vvJoKewogICJxdWVzdGlvblRleHQiOiAi6aGM55uu5YWn5a65IiwKICAib3B0aW9uQSI6ICLpgbjpoIVBIiwgIm9wdGlvbkIiOiAi6YG46aCFQiIsICJvcHRpb25DIjogIumBuOmghUMiLCAib3B0aW9uRCI6ICLpgbjpoIVEIiwgIm9wdGlvbkUiOiAi6YG46aCFRSIsICJvcHRpb25GIjogIumBuOmghUYiLAogICJhbnN3ZXIiOiAi5q2j56K6562U5qGI55qE5a2X5q+N77yM5L6L5aaC44CMQeOAje+8m+WmguaenOaYr+WkmumBuOmhjOWwseeUqOWkmuWAi+Wtl+avje+8jOS+i+WmguOAjEFD44CNIiwKICAiaXNNdWx0aXBsZSI6IHRydWUg5oiWIGZhbHNl77yI5piv5ZCm54K65aSa6YG46aGM77yJLAogICJub3RlcyI6ICLnsKHnn63nmoTop6Pph4vmiJboo5zlhYXoqqrmmI7vvIjpgbjloavvvIzmspLmnInlsLHnlZnnqbrlrZfkuLLvvIkiCn0KCuimj+WJh++8mgotIOiHs+WwkeimgeaciSBvcHRpb25BIOWSjCBvcHRpb25C77yM55So5LiN5Yiw55qE6YG46aCF55WZ56m65a2X5LiyICIiCi0g5aaC5p6c5YWn5a655pys6Lqr5YyF5ZCr5pW45a245YWs5byP77yM57at5oyB5Y6f5pys55qE5a+r5rOV77yI5L6L5aaCICR4XjIkIOaIliBcKHheMlwp77yJ77yM5LiN6KaB6Ieq5bex5pS55a+rCgrmloflrZflhaflrrnvvJoKIiIiCiUlU09VUkNFX1RFWFQlJQoiIiI='

const PROMPT_TEMPLATE = (sourceText: string) => decodeText(PROMPT_TEMPLATE_B64).split('%%SOURCE_TEXT%%').join(sourceText)

async function callGemini(apiKey: string, model: string, sourceText: string): Promise<McqCard[]> {
  const parsed = await callGeminiJson(apiKey, model, PROMPT_TEMPLATE(sourceText))
  if (!Array.isArray(parsed)) throw new Error('Gemini 回傳的格式不是陣列')
  return parsed as McqCard[]
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
  const [model, setModel] = useState('gemini-3.5-flash')
  const [sourceText, setSourceText] = useState('')
  const [cards, setCards] = useState<CardState[]>([])
  const [purpose, setPurpose] = useState('')
  const [parsing, setParsing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: 'ok' | 'error'; text: string } | null>(null)
  const [previewIndex, setPreviewIndex] = useState(0)
  const [fromDrawer, setFromDrawer] = useState(false)
  const lastSavedSignatureRef = useRef<string | null>(null)
  const hasLoadedFromDrawerRef = useRef(false)

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
    if (!sourceText.trim()) {
      setMessage({ type: 'error', text: '請先貼上要解析的文字內容' })
      return
    }

    setParsing(true)
    setMessage(null)
    try {
      const parsed = await callGemini(apiKey.trim(), model, sourceText)
      setCards((prev) => [...prev, ...parsed.map((c) => makeCardState(c))])
      setMessage({ type: 'ok', text: `解析出 ${parsed.length} 張卡片` })
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : String(error) })
    } finally {
      setParsing(false)
    }
  }

  function updateCard(localId: string, patch: Partial<CardState>) {
    setCards((prev) => prev.map((c) => (c.localId === localId ? { ...c, ...patch } : c)))
  }

  function removeCard(index: number) {
    if (!confirm(`確定要刪除第 ${index + 1} 題嗎？`)) return
    setCards((prev) => prev.filter((_, i) => i !== index))
    setPreviewIndex((prev) => Math.min(prev, cards.length - 2))
  }

  function handleLoadSample() {
    setSourceText(SAMPLE_MARKDOWN)
  }

  function handleClear() {
    setSourceText('')
    setCards([])
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

  return (
    <main className="app-container">
      {/* 左欄：輸入與編輯區 */}
      <section className="flex flex-col gap-6">
        <div className="card-panel">
          <div className="panel-header">
            <h2>📥 1. 輸入文字內容</h2>
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
              貼上你的文字內容（例如考卷、筆記），系統會用 AI 自動解析題號、題目、選項、正確答案與解析。
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
                <option value="gemini-3.5-flash">gemini-3.5-flash（推薦）</option>
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
            <p className="instruction-text mb-4">
              💡 如果你的 API Key 是免費申請的，建議選用 <strong>gemini-3.1-flash-lite</strong>
              （額度限制較寬鬆）；但 lite 版本能處理的資料量較小，單次貼上的內容不要太多，以免生成失敗或跑不出結果，建議分批處理。
            </p>

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

            <button onClick={handleParse} disabled={parsing} className="btn btn-primary w-full">
              {parsing ? '✨ 解析中...' : '✨ AI 智慧解析'}
            </button>
          </div>
        </div>

        {cards.length > 0 && (
          <div className="card-panel">
            <div className="panel-header">
              <h2>
                ✅ 2. 預覽與修改解析結果 ({cards.length} 題)
              </h2>
            </div>
            <div className="panel-body">
              {fromDrawer && (
                <div className="notice-box mb-3">
                  <div>
                    已經從抽屜載入 {cards.length} 張卡片。如果想幫這份卡組再補充新的題目，可以貼上文字內容重新解析，新解析出來的卡片會加進下面的列表一起處理。
                  </div>
                </div>
              )}
              <label className="field-label">
                🏷️ 這批卡片的用途標籤
              </label>
              <input
                placeholder="方便日後在歷史紀錄搜尋，也是存入 Anki 時的牌組名稱"
                value={purpose}
                onChange={(e) => setPurpose(e.target.value)}
                className="field-input mb-3"
              />
              <div className="row-actions mb-3">
                <button
                  onClick={handleSave}
                  disabled={saving || (userReady && !user)}
                  title={userReady && !user ? '登入後才能存入歷史紀錄' : undefined}
                  className="btn btn-secondary btn-sm"
                >
                  {saving ? '存入中...' : userReady && !user ? '🔒 存入紀錄' : '🔖 存入紀錄'}
                </button>
                <button onClick={handleDownloadCsv} className="btn btn-success btn-sm">
                  📄 匯出 CSV
                </button>
                <SaveToAnkiButton
                  saveCards={async (deckName) => {
                    await ensureAnkiGenModelExists()
                    await ensureDeckExists(deckName)
                    await addCardsToAnki(deckName, ankiCards)
                  }}
                  defaultDeckName={purpose || 'AnkiGen Hub'}
                  onTrigger={() => void ensureSavedToHistory()}
                />
              </div>
              {userReady && !user && (
                <p className="mb-3 text-xs text-text-secondary">
                  🔒 登入後可以把這份卡組存入歷史紀錄。{' '}
                  <Link href="/login" className="font-semibold text-accent">
                    前往登入
                  </Link>
                </p>
              )}
              <div className="table-container">
                <table className="editable-table">
                  <thead>
                    <tr>
                      <th style={{ width: '5%' }}>題號</th>
                      <th style={{ width: '32%' }}>題目</th>
                      <th style={{ width: '10%' }}>類型</th>
                      <th style={{ width: '33%' }}>選項 (A-F)</th>
                      <th style={{ width: '8%' }}>答案</th>
                      <th style={{ width: '12%' }}>操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cards.map((card, index) => (
                      <tr
                        key={card.localId}
                        className={index === previewIndex ? 'table-row-active' : ''}
                        onClick={(e) => {
                          const tag = (e.target as HTMLElement).tagName
                          if (['INPUT', 'SELECT', 'BUTTON', 'TEXTAREA'].includes(tag)) return
                          setPreviewIndex(index)
                        }}
                      >
                        <td>{index + 1}</td>
                        <td>
                          <textarea
                            className="cell-input"
                            rows={5}
                            value={card.questionText}
                            onChange={(e) =>
                              updateCard(card.localId, { questionText: e.target.value })
                            }
                          />
                        </td>
                        <td>
                          <select
                            className="cell-select"
                            value={card.isMultiple ? 'y' : ''}
                            onChange={(e) =>
                              updateCard(card.localId, { isMultiple: e.target.value === 'y' })
                            }
                          >
                            <option value="">單選題</option>
                            <option value="y">多選題</option>
                          </select>
                        </td>
                        <td>
                          <div className="cell-option-grid">
                            {OPTION_KEYS.map((key, i) => (
                              <div key={key} className="cell-opt-wrap">
                                <span className="cell-opt-lbl">{String.fromCharCode(65 + i)}</span>
                                <input
                                  className="cell-input"
                                  value={card[key]}
                                  onChange={(e) => updateCard(card.localId, { [key]: e.target.value })}
                                />
                              </div>
                            ))}
                          </div>
                        </td>
                        <td>
                          <input
                            className="cell-input text-center"
                            placeholder="A, C"
                            value={card.answer}
                            onChange={(e) => updateCard(card.localId, { answer: e.target.value })}
                          />
                        </td>
                        <td>
                          <div className="row-actions">
                            <button
                              onClick={() => setPreviewIndex(index)}
                              className="btn btn-secondary btn-xs"
                              title="即時模擬預覽"
                            >
                              🔍
                            </button>
                            <button
                              onClick={() => removeCard(index)}
                              className="btn btn-danger-outline btn-xs"
                              title="刪除本題"
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
            </div>
          </div>
        )}

        {message && (
          <p className={`text-sm ${message.type === 'ok' ? 'text-success' : 'text-danger'}`}>
            {message.text}
          </p>
        )}
      </section>

      {/* 右欄：卡片預覽與 Anki 模板設定 */}
      <section className="flex flex-col gap-6">
        <AnkiSimulator key={previewCard === SAMPLE_PREVIEW_CARD ? 'sample' : previewIndex} card={previewCard} />
        <AnkiConnectSetupPanel />
      </section>

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
