'use client'

import { buildSlidesMcqCsv, buildSlidesOcclusionCsv, downloadCsv } from '@/lib/export-csv'
import type { SlidesMcqCard } from '@/lib/history-types'

export default function DownloadCsvButton({
  source,
  cards,
}: {
  source: string
  cards: SlidesMcqCard[]
}) {
  function handleDownload() {
    const content =
      source === 'slides-occlusion' ? buildSlidesOcclusionCsv(cards) : buildSlidesMcqCsv(cards)
    const filename = `ankigen_${source}_${Date.now()}.csv`
    downloadCsv(filename, content)
  }

  return (
    <button onClick={handleDownload} className="rounded border border-gray-300 px-3 py-1 text-sm">
      下載 CSV
    </button>
  )
}
