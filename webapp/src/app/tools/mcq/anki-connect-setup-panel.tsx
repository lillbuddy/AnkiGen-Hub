'use client'

import { useState } from 'react'

// AnkiConnect 預設的網址白名單只信任 http://localhost，這個網站部署後的網域
// 不在裡面，第一次使用「存入 Anki」時瀏覽器端的請求會被擋下來，所以直接把
// 「改成 *」的設定內容準備好讓使用者複製，比只用文字描述更不容易出錯。
const CORS_CONFIG_SNIPPET = `"webCorsOriginList": [
    "*"
]`

export default function AnkiConnectSetupPanel() {
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    await navigator.clipboard.writeText(CORS_CONFIG_SNIPPET)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div className="card-panel mt-6">
      <div className="panel-header">
        <h2>📥 存入 Anki 前置準備</h2>
      </div>
      <div className="panel-body">
        <p className="instruction-text">使用「存入 Anki」一鍵功能前，請先確認以下設定：</p>

        <div className="flex flex-col gap-2 mb-3">
          <p className="instruction-text">
            <strong>1.</strong> 電腦上的 <strong>Anki 要先開啟</strong>，「存入 Anki」才會成功。
          </p>
          <p className="instruction-text">
            <strong>2.</strong> 確認已安裝並啟用 <strong>AnkiConnect</strong> 這個附加元件：Anki 選單「工具 &gt;
            附加元件 &gt; 瀏覽並安裝」，代碼輸入 <code>2055492159</code>。
          </p>
          <p className="instruction-text">
            <strong>3.</strong> 打開 AnkiConnect 的設定（Config），把 <code>webCorsOriginList</code>{' '}
            改成允許這個網站存取，最簡單的方式是改成下面這樣：
          </p>
        </div>

        <div className="code-header">
          <span>AnkiConnect Config</span>
          <button onClick={handleCopy} className="btn btn-secondary btn-xs">
            {copied ? '已複製！' : '複製'}
          </button>
        </div>
        <textarea readOnly value={CORS_CONFIG_SNIPPET} className="code-area" />

        <p className="instruction-text mt-2">存檔後記得完全關閉並重新開啟 Anki，設定才會生效。</p>
      </div>
    </div>
  )
}
