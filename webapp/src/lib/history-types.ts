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

// SlidesMcqCard：圖片選擇題（source = 'slides-mcq'），比 McqCard 多兩個 Drive 檔案 ID。
export interface SlidesMcqCard extends McqCard {
  filename: string
  driveFileId: string
  drivePreviewFileId: string
}

export interface HistoryRecord {
  id: string
  source: string
  purpose: string | null
  card_count: number
  cards: (McqCard | SlidesMcqCard)[]
  created_at: string
}

export const SOURCE_LABELS: Record<string, string> = {
  mcq: '選擇題卡片',
  'slides-mcq': '圖片選擇題',
  'slides-occlusion': 'Image Occlusion',
}
