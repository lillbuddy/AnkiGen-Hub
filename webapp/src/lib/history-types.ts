// 共用型別：history_records 資料表的卡片內容。
// McqCard：純文字選擇題（source = 'mcq'），沒有圖片。
export interface McqCard {
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
}

// 有圖片的卡片都會有這三個欄位：檔名、原始圖和縮圖各自的 Drive 檔案 ID。
export interface DriveImageFields {
  filename: string
  driveFileId: string
  drivePreviewFileId: string
}

// SlidesMcqCard：圖片選擇題（source = 'slides-mcq'）。
export interface SlidesMcqCard extends McqCard, DriveImageFields {}

// OcclusionCard：Image Occlusion（source = 'slides-occlusion'），只有圖片和備註，
// 沒有題目/選項/答案——實際的遮蓋框線要在 Anki 裡手動畫。
export interface OcclusionCard extends DriveImageFields {
  notes: string
}

// ClozeCard：克漏字卡片（source = 'cloze'），給想背單字的使用者用。sentence 裡
// 用 **文字** 標記要挖空的部分（見 cloze-markup.ts），word 是原始單字（不一定跟
// 句子裡實際出現的詞形一樣，例如單字是 run、句子裡用 running）。
export interface ClozeCard {
  word: string
  sentence: string
  notes: string
}

export type AnyCard = McqCard | SlidesMcqCard | OcclusionCard | ClozeCard

export interface HistoryRecord {
  id: string
  source: string
  purpose: string | null
  card_count: number
  cards: AnyCard[]
  created_at: string
}

export const SOURCE_LABELS: Record<string, string> = {
  mcq: '選擇題卡片',
  'slides-mcq': '圖片選擇題',
  'slides-occlusion': 'Image Occlusion',
  cloze: '克漏字卡片',
}
