// yanki-connect 的 autoLaunch 功能（我們沒有用到）依賴 `open` 這個 Node-only 套件，
// 裡面直接 import 了 node:fs/node:child_process，瀏覽器端打包時會直接失敗。
// 用這個空模組取代它（見 next.config.ts 的 turbopack.resolveAlias），因為我們的用法
// 從來不會真的呼叫到 autoLaunch 那段程式碼，這個 stub 只是讓打包時能解析得到模組。
export default function open(): never {
  throw new Error('open() 在瀏覽器端不可用（這是 AnkiConnect 整合刻意排除的 stub）')
}
