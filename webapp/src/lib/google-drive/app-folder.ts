import type { createClient } from '@/lib/supabase/server'
import { createFolder } from '@/lib/google-drive/drive-client'

const APP_FOLDER_NAME = 'AnkiGen Hub'

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>

// 拿到「AnkiGen Hub」這個專屬資料夾的 ID，沒有的話就建立一個並存進
// google_drive_connections.folder_id，之後同一個使用者上傳都重複用這個 ID。
export async function getOrCreateAppFolderId(
  supabase: SupabaseServerClient,
  userId: string,
  accessToken: string,
  existingFolderId: string | null
) {
  if (existingFolderId) return existingFolderId

  const folder = await createFolder(accessToken, APP_FOLDER_NAME)

  const { error } = await supabase
    .from('google_drive_connections')
    .update({ folder_id: folder.id })
    .eq('user_id', userId)

  if (error) {
    console.error('[google-drive app-folder] 存 folder_id 失敗', error)
  }

  return folder.id
}
