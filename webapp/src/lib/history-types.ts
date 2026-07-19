// 共用型別：history_records 資料表的卡片內容（目前只有 slides-mcq 這種有圖片的選擇題卡片
// 有完整欄位；之後如果要支援 Image Occlusion 或純文字卡片，可以在這裡擴充）。
export interface SlidesMcqCard {
  filename: string
  driveFileId: string
  drivePreviewFileId: string
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

export interface HistoryRecord {
  id: string
  source: string
  purpose: string | null
  card_count: number
  cards: SlidesMcqCard[]
  created_at: string
}

export const SOURCE_LABELS: Record<string, string> = {
  mcq: '選擇題卡片',
  'slides-mcq': '圖片選擇題',
  'slides-occlusion': 'Image Occlusion',
}
