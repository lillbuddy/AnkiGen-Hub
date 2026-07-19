// 最小限度的 Google Drive API v3 呼叫，只用來驗證 drive.file scope 真的能讀寫檔案。
// 之後真正的圖片上傳/下載邏輯會再擴充這個檔案。

const DRIVE_FILES_URL = 'https://www.googleapis.com/drive/v3/files'
const DRIVE_UPLOAD_URL = 'https://www.googleapis.com/upload/drive/v3/files'

interface DriveFile {
  id: string
  name: string
  webViewLink?: string
  createdTime?: string
}

// 建一個空檔案的 metadata，再把內容 PATCH 進去——比手刻 multipart 請求簡單。
export async function uploadFile(
  accessToken: string,
  name: string,
  contentType: string,
  body: BodyInit
) {
  const createResponse = await fetch(DRIVE_FILES_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ name }),
  })

  if (!createResponse.ok) {
    throw new Error(`建立檔案失敗（${createResponse.status}）：${await createResponse.text()}`)
  }

  const created = (await createResponse.json()) as DriveFile

  const uploadResponse = await fetch(`${DRIVE_UPLOAD_URL}/${created.id}?uploadType=media`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': contentType,
    },
    body,
  })

  if (!uploadResponse.ok) {
    throw new Error(`上傳檔案內容失敗（${uploadResponse.status}）：${await uploadResponse.text()}`)
  }

  const detailResponse = await fetch(
    `${DRIVE_FILES_URL}/${created.id}?fields=id,name,webViewLink,createdTime`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  )

  return (await detailResponse.json()) as DriveFile
}

export async function createTestFile(accessToken: string, content: string) {
  return uploadFile(accessToken, `ankigen-test-${Date.now()}.txt`, 'text/plain', content)
}

// 一張 1x1 的紅色 PNG（寫死的最小合法 PNG 二進位內容，親自產生並解碼驗證過確實是純紅色），
// 純粹用來驗證圖片上傳/顯示流程。
const TEST_PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR42mP4z8AAAAMBAQD3A0FDAAAAAElFTkSuQmCC'

export async function createTestImage(accessToken: string) {
  const bytes = Buffer.from(TEST_PNG_BASE64, 'base64')
  return uploadFile(accessToken, `ankigen-test-image-${Date.now()}.png`, 'image/png', bytes)
}

// drive.file scope 底下，這個 API 只會列出「這個 App 建立過或使用者透過選擇器授權過」的檔案。
export async function listAppFiles(accessToken: string) {
  const params = new URLSearchParams({
    fields: 'files(id,name,createdTime,webViewLink)',
    orderBy: 'createdTime desc',
    pageSize: '10',
  })

  const response = await fetch(`${DRIVE_FILES_URL}?${params.toString()}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })

  if (!response.ok) {
    throw new Error(`列出檔案失敗（${response.status}）：${await response.text()}`)
  }

  const data = (await response.json()) as { files: DriveFile[] }
  return data.files
}
