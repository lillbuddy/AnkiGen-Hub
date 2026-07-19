'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

export default function DeleteHistoryButton({ recordId }: { recordId: string }) {
  const [deleting, setDeleting] = useState(false)
  const router = useRouter()

  async function handleDelete() {
    if (!confirm('確定要刪除這筆歷史紀錄嗎？連同 Google Drive 上的圖片一起刪除，無法復原。')) return

    setDeleting(true)
    const response = await fetch(`/api/history/${recordId}`, { method: 'DELETE' })
    setDeleting(false)

    if (!response.ok) {
      const data = await response.json().catch(() => ({}))
      alert(data.error ?? '刪除失敗')
      return
    }

    router.refresh()
  }

  return (
    <button
      onClick={handleDelete}
      disabled={deleting}
      className="btn btn-danger-outline btn-sm"
    >
      {deleting ? '刪除中...' : '刪除'}
    </button>
  )
}
