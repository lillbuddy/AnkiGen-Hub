'use client'

import { useState, type FormEvent } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setMessage(null)
    setLoading(true)

    const supabase = createClient()
    // 跟 signup 的 emailRedirectTo 同一招：導回使用者實際所在的網域（本機開發
    // 是 localhost、正式站是 Vercel 網域）。這裡故意用專屬的 /auth/reset-callback、
    // 不帶任何查詢參數 —— Supabase 的 Redirect URLs 白名單是精確字串比對，帶
    // 參數會對不上白名單，被靜默改導去 Site URL（見 route.ts 裡的說明）。
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/reset-callback`,
    })

    setLoading(false)
    if (error) {
      setError(error.message)
      return
    }

    setMessage('已寄出重設密碼信件，請檢查信箱（含垃圾郵件匣）並點擊信中的連結設定新密碼。')
  }

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center p-6">
      <div className="card-panel p-8">
        <h1 className="mb-4 text-xl font-semibold text-text-primary">忘記密碼</h1>
        <p className="mb-4 text-sm text-text-secondary">
          輸入登入用的 Email，我們會寄出一封重設密碼信件，信裡的連結會帶你回來設定新密碼。
        </p>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="field-input"
            required
          />
          {error && <p className="text-sm text-danger">寄送失敗：{error}</p>}
          {message && (
            <div className="notice-box">
              <div>{message}</div>
            </div>
          )}
          <button type="submit" disabled={loading} className="btn btn-primary">
            {loading ? '寄送中...' : '寄送重設密碼連結'}
          </button>
        </form>
        <p className="mt-4 text-center text-sm text-text-secondary">
          想起密碼了？{' '}
          <Link href="/login" className="text-primary underline">
            前往登入
          </Link>
        </p>
      </div>
    </main>
  )
}
