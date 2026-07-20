'use client'

import { useState, type FormEvent } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleLogin(e: FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({ email, password })

    setLoading(false)
    if (error) {
      setError(error.message)
      return
    }

    router.push('/')
    router.refresh()
  }

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center p-6">
      <div className="card-panel p-8">
        <h1 className="mb-4 text-xl font-semibold text-text-primary">登入</h1>
        <form onSubmit={handleLogin} className="flex flex-col gap-3">
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="field-input"
            required
          />
          <input
            type="password"
            placeholder="密碼"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="field-input"
            required
          />
          {error && (
            <div className="text-sm text-danger">
              <p>登入失敗：{error}</p>
              <p className="mt-1 text-text-secondary">
                如果你剛完成註冊，請先到信箱點擊確認連結完成驗證，才能登入（記得檢查垃圾郵件匣）。
              </p>
            </div>
          )}
          <button type="submit" disabled={loading} className="btn btn-primary">
            {loading ? '登入中...' : '登入'}
          </button>
        </form>
        <p className="mt-4 text-center text-sm text-text-secondary">
          還沒有帳號？{' '}
          <Link href="/signup" className="text-primary underline">
            前往註冊
          </Link>
        </p>
      </div>
    </main>
  )
}
