'use client'

import { useState, type FormEvent } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function SignupPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleSignup(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setMessage(null)

    if (password !== confirmPassword) {
      setError('兩次輸入的密碼不一致')
      return
    }
    if (password.length < 6) {
      setError('密碼至少需要 6 個字元')
      return
    }

    setLoading(true)
    const supabase = createClient()
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      // 一定要帶這個，確認信裡的連結才會導回使用者實際註冊的網域（本機開發是
      // localhost、正式站是 Vercel 網域），而不是 Supabase 專案設定裡固定的
      // Site URL——不然本機測試時設定的 localhost 會被寄進所有使用者的信裡。
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    })
    setLoading(false)

    if (error) {
      setError(error.message)
      return
    }

    // 專案如果開啟了「註冊需驗證 email」，signUp 回來不會直接帶 session，
    // 要請使用者去收信點確認連結；如果沒開，會直接拿到 session，可以馬上進站。
    if (!data.session) {
      setMessage(
        '註冊成功！我們已經寄出一封確認信到你的信箱，請點擊信裡的確認連結完成驗證，才能登入。沒看到信的話記得檢查垃圾郵件匣。'
      )
      return
    }

    router.push('/')
    router.refresh()
  }

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center p-6">
      <div className="card-panel p-8">
        <h1 className="mb-4 text-xl font-semibold text-text-primary">註冊</h1>
        <form onSubmit={handleSignup} className="flex flex-col gap-3">
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
            placeholder="密碼（至少 6 個字元）"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="field-input"
            required
          />
          <input
            type="password"
            placeholder="再輸入一次密碼"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="field-input"
            required
          />
          {error && <p className="text-sm text-danger">{error}</p>}
          {message && (
            <div className="notice-box">
              <div>{message}</div>
            </div>
          )}
          <button type="submit" disabled={loading} className="btn btn-primary">
            {loading ? '註冊中...' : '註冊'}
          </button>
        </form>
        <p className="mt-4 text-center text-sm text-text-secondary">
          已經有帳號了？{' '}
          <Link href="/login" className="text-primary underline">
            前往登入
          </Link>
        </p>
      </div>
    </main>
  )
}
