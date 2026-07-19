import type { OcclusionCard } from '@/lib/history-types'

export default function OcclusionCardItem({ card }: { card: OcclusionCard }) {
  return (
    <div className="flex gap-4 card-panel p-3">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={`/api/google-drive/image/${card.drivePreviewFileId}`}
        alt={card.filename}
        className="h-24 w-24 flex-shrink-0 rounded object-cover"
      />
      <div className="flex flex-1 flex-col gap-1">
        <div className="text-sm font-medium">{card.filename}</div>
        <div className="text-xs text-text-secondary">{card.notes || '（無備註）'}</div>
        <a
          href={`/api/google-drive/image/${card.driveFileId}`}
          download={card.filename}
          className="mt-1 self-start text-xs text-primary underline"
        >
          下載原始圖片
        </a>
      </div>
    </div>
  )
}
