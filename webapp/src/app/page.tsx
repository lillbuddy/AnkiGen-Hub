import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import SignOutButton from './sign-out-button'

export default async function Home() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col items-center justify-center gap-4 p-6 text-center">
      <h1 className="text-xl font-semibold">AnkiGen Hub</h1>
      {user ? (
        <>
          <p>
            已登入：<span className="font-mono">{user.email}</span>
          </p>
          <SignOutButton />
        </>
      ) : (
        <>
          <p>尚未登入</p>
          <Link href="/login" className="rounded bg-blue-600 px-3 py-2 text-white">
            前往登入
          </Link>
        </>
      )}
    </main>
  )
}
