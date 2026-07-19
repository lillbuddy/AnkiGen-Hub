import { type NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/proxy'

// 注意：這個 Next.js 版本把 middleware.ts 改名叫 proxy.ts 了（16.x 的 breaking change）。
export async function proxy(request: NextRequest) {
  return await updateSession(request)
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
