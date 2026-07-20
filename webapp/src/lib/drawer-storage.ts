// 「抽屜」：讓使用者可以在不同的歷史紀錄裡逛、挑選想沿用的卡片，暫存起來，
// 之後一次拿去編輯、彙整成一份新的紀錄。純前端 localStorage，本來就是暫時性的資料，
// 換瀏覽器或清瀏覽器資料就會消失，不影響任何正式存進 Supabase/Drive 的紀錄。
import type { SlidesMcqCard } from '@/lib/history-types'

const STORAGE_KEY = 'ankigen_drawer_v1'

export interface DrawerCard extends SlidesMcqCard {
  key: string // `${sourceRecordId}:${cardIndex}`，用來判斷是否已經加入過
  sourceRecordId: string
}

function readAll(): DrawerCard[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as DrawerCard[]) : []
  } catch {
    return []
  }
}

function writeAll(cards: DrawerCard[]) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(cards))
  window.dispatchEvent(new Event('ankigen-drawer-changed'))
}

export function getDrawerCards(): DrawerCard[] {
  return readAll()
}

export function isInDrawer(key: string): boolean {
  return readAll().some((c) => c.key === key)
}

export function addToDrawer(card: DrawerCard) {
  const all = readAll()
  if (all.some((c) => c.key === card.key)) return
  writeAll([...all, card])
}

export function removeFromDrawer(key: string) {
  writeAll(readAll().filter((c) => c.key !== key))
}

// 直接在抽屜頁面修改卡片內容（題目、選項等），只影響暫存在抽屜裡的這份副本，
// 不會動到原本歷史紀錄裡的資料。
export function updateDrawerCard(key: string, patch: Partial<DrawerCard>) {
  writeAll(readAll().map((c) => (c.key === key ? { ...c, ...patch } : c)))
}

export function clearDrawer() {
  writeAll([])
}
