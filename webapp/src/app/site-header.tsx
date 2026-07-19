import Link from 'next/link'

export default function SiteHeader() {
  return (
    <header className="sticky top-0 z-50 border-b border-panel-border bg-white/85 py-3 backdrop-blur-md">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-6">
        <Link
          href="/"
          className="flex items-center gap-3 font-display text-2xl font-extrabold tracking-tight text-text-primary"
        >
          <span className="text-primary">💡</span>
          <span>
            AnkiGen <span className="text-primary">Hub</span>
          </span>
        </Link>
        <span className="hidden text-sm italic text-text-secondary sm:inline">
          The central hub for instant Anki creation
        </span>
      </div>
    </header>
  )
}
