'use client'

import { buildMcqCsv, buildSlidesMcqCsv, buildSlidesOcclusionCsv, downloadCsv } from '@/lib/export-csv'
import type { AnyCard, McqCard, OcclusionCard, SlidesMcqCard } from '@/lib/history-types'

export default function DownloadCsvButton({
  source,
  cards,
}: {
  source: string
  cards: AnyCard[]
}) {
  function handleDownload() {
    let content: string
    if (source === 'mcq') {
      content = buildMcqCsv(cards as McqCard[])
    } else if (source === 'slides-occlusion') {
      content = buildSlidesOcclusionCsv(cards as OcclusionCard[])
    } else {
      content = buildSlidesMcqCsv(cards as SlidesMcqCard[])
    }
    const filename = `ankigen_${source}_${Date.now()}.csv`
    downloadCsv(filename, content)
  }

  return (
    <button onClick={handleDownload} className="btn btn-secondary btn-sm">
      下載 CSV
    </button>
  )
}
