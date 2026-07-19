import Link from 'next/link'

export default function SiteHeader() {
  return (
    <header className="border-b border-panel-border bg-panel">
      <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-4">
        <Link href="/" className="flex items-center gap-2 text-lg font-bold text-text-primary">
          <span>💡</span>
          <span>
            AnkiGen <span className="text-primary">Hub</span>
          </span>
        </Link>
        <span className="hidden text-xs italic text-text-secondary sm:inline">
          The central hub for instant Anki creation
        </span>
      </div>
    </header>
  )
}
