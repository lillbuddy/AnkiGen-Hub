// 「存入 Anki」是直接呼叫使用者本機 Anki 的 AnkiConnect，Anki 沒開就一定會失敗。
// 第一次存入時 Anki 會自己跳出視窗詢問是否允許這個網站存取，所以不需要另外
// 手動改 AnkiConnect 設定，這裡只提醒最常被忘記的一件事：先把 Anki 打開。
export default function AnkiOpenHint({ className = '' }: { className?: string }) {
  return (
    <p className={`anki-open-hint ${className}`}>
      <span aria-hidden>💻</span>
      <span>
        使用「存入 Anki」前，請先<strong>開啟電腦上的 Anki 應用程式</strong>，再按下按鈕。
      </span>
    </p>
  )
}
