// 「抽屜」：讓使用者可以在不同的歷史紀錄裡逛、挑選想沿用的卡片，暫存起來，
// 之後一次拿去編輯、彙整成一份新的紀錄。純前端 localStorage，本來就是暫時性的資料，
// 換瀏覽器或清瀏覽器資料就會消失，不影響任何正式存進 Supabase/Drive 的紀錄。
//
// 圖片選擇題（slides-mcq）和文字選擇題（mcq）的卡片欄位完全不同（前者有圖片檔案，
// 後者沒有），不能放進同一個抽屜一起整理，所以抽屜同一時間只能裝其中一種類型。
import type { McqCard, SlidesMcqCard } from '@/lib/history-types'

const STORAGE_KEY = 'ankigen_drawer_v1'

export type DrawerCardType = 'slides-mcq' | 'mcq'

export interface ImageDrawerCard extends SlidesMcqCard {
  key: string // `${sourceRecordId}:${cardIndex}`，用來判斷是否已經加入過
  sourceRecordId: string
  cardType: 'slides-mcq'
}

export interface TextDrawerCard extends McqCard {
  key: string
  sourceRecordId: string
  cardType: 'mcq'
}

export type AnyDrawerCard = ImageDrawerCard | TextDrawerCard

// 保留舊名稱給圖片卡片用，減少既有程式碼（tools/slides 等）的改動幅度。
export type DrawerCard = ImageDrawerCard

const CARD_TYPE_LABELS: Record<DrawerCardType, string> = {
  'slides-mcq': '圖片選擇題',
  mcq: '文字選擇題',
}

function readAll(): AnyDrawerCard[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as AnyDrawerCard[]) : []
  } catch {
    return []
  }
}

function writeAll(cards: AnyDrawerCard[]) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(cards))
  window.dispatchEvent(new Event('ankigen-drawer-changed'))
}

export function getDrawerCards(): AnyDrawerCard[] {
  return readAll()
}

// 抽屜目前裝的是哪一種卡片；抽屜是空的就回傳 null（代表兩種都還可以放）。
export function getDrawerCardType(): DrawerCardType | null {
  return readAll()[0]?.cardType ?? null
}

export function isInDrawer(key: string): boolean {
  return readAll().some((c) => c.key === key)
}

// 回傳 { ok: false, reason } 時，呼叫端要把 reason 顯示給使用者看，說明為什麼加不進去。
export function addToDrawer(card: AnyDrawerCard): { ok: boolean; reason?: string } {
  const all = readAll()
  if (all.some((c) => c.key === card.key)) return { ok: true }

  const existingType = all[0]?.cardType
  if (existingType && existingType !== card.cardType) {
    return {
      ok: false,
      reason: `抽屜目前放的是「${CARD_TYPE_LABELS[existingType]}」卡片，沒辦法同時放入「${CARD_TYPE_LABELS[card.cardType]}」卡片。請先到抽屜頁面把現有卡片整理完（清空或開始整理）之後，再加入這種類型。`,
    }
  }

  writeAll([...all, card])
  return { ok: true }
}

export function removeFromDrawer(key: string) {
  writeAll(readAll().filter((c) => c.key !== key))
}

// 直接在抽屜頁面修改卡片內容（題目、選項等），只影響暫存在抽屜裡的這份副本，
// 不會動到原本歷史紀錄裡的資料。
export function updateDrawerCard(key: string, patch: Partial<ImageDrawerCard> | Partial<TextDrawerCard>) {
  writeAll(readAll().map((c) => (c.key === key ? ({ ...c, ...patch } as AnyDrawerCard) : c)))
}

export function clearDrawer() {
  writeAll([])
}
