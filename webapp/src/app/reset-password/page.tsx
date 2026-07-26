'use client'

import { Suspense, useEffect, useState, type FormEvent } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

// 使用者從忘記密碼信件的連結進來這裡之前，會先經過 /auth/callback 把 code
// 換成 session（存在 cookie 裡），所以這裡不用像純前端 SPA 那樣自己解析網址
// hash，直接用 getUser() 確認目前是不是真的有一個合法的 session 就好。
// /auth/callback 換 session 失敗時會帶 ?error=link_failed 導過來，直接顯示
// 連結失效，不用再多打一次 API。
function ResetPasswordForm() {
  const searchParams = useSearchParams()
  const linkFailed = searchParams.get('error') === 'link_failed'

  const [checking, setChecking] = useState(() => !linkFailed)
  const [hasSession, setHasSession] = useState(false)
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (linkFailed) return
    const supabase = createClient()
    supabase.auth.getUser().then(({ data }) => {
      setHasSession(!!data.user)
      setChecking(false)
    })
  }, [linkFailed])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)

    if (password.length < 6) {
      setError('新密碼至少需要 6 個字元')
      return
    }
    if (password !== confirmPassword) {
      setError('兩次輸入的新密碼不一致')
      return
    }

    setLoading(true)
    const supabase = createClient()
    const { error } = await supabase.auth.updateUser({ password })
    setLoading(false)

    if (error) {
      setError(error.message)
      return
    }

    setSuccess(true)
  }

  if (success) {
    return (
      <div className="flex flex-col gap-3">
        <div className="notice-box">
          <div>密碼已更新，你現在可以繼續使用了。</div>
        </div>
        <Link href="/" className="btn btn-primary">
          回首頁
        </Link>
      </div>
    )
  }

  if (checking) {
    return <p className="text-sm text-text-secondary">正在確認重設密碼連結...</p>
  }

  if (linkFailed || !hasSession) {
    return (
      <div>
        <p className="text-sm text-danger">這個重設密碼連結無效或已過期。</p>
        <p className="mt-2 text-sm text-text-secondary">
          請回到{' '}
          <Link href="/forgot-password" className="text-primary underline">
            忘記密碼
          </Link>{' '}
          重新申請一次。
        </p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <input
        type="password"
        placeholder="新密碼（至少 6 個字元）"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        className="field-input"
        required
      />
      <input
        type="password"
        placeholder="再輸入一次新密碼"
        value={confirmPassword}
        onChange={(e) => setConfirmPassword(e.target.value)}
        className="field-input"
        required
      />
      {error && <p className="text-sm text-danger">{error}</p>}
      <button type="submit" disabled={loading} className="btn btn-primary">
        {loading ? '更新中...' : '設定新密碼'}
      </button>
    </form>
  )
}

export default function ResetPasswordPage() {
  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center p-6">
      <div className="card-panel p-8">
        <h1 className="mb-4 text-xl font-semibold text-text-primary">重設密碼</h1>
        <Suspense fallback={<p className="text-sm text-text-secondary">載入中...</p>}>
          <ResetPasswordForm />
        </Suspense>
      </div>
    </main>
  )
}
