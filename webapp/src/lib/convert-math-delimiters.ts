// 把常見的數學公式寫法統一轉成 Anki 看得懂的 MathJax 分隔符號：
// 行內 [$]...[/$]，展示用（獨立一行的大公式）[$$]...[/$$]。
//
// 一定要用「一次 replace、一個合併的 regex」處理完全部四種寫法，不能分成好幾次
// 依序 .replace()——因為轉換後的 [$$]/[/$$] 本身含有 $ 字元，如果後面還有一次
// 針對單一 $ 的 replace，會把前一步驟轉換出來的結果誤判成新的數學公式，越轉越亂。
export function convertMathDelimiters(text: string): string {
  if (!text) return text

  return text.replace(
    /\\\[([\s\S]+?)\\\]|\$\$([\s\S]+?)\$\$|\\\(([\s\S]+?)\\\)|\$([^$\n]+?)\$/g,
    (match, display1, display2, inline1, inline2) => {
      if (display1 !== undefined) return `[$$]${display1}[/$$]`
      if (display2 !== undefined) return `[$$]${display2}[/$$]`
      if (inline1 !== undefined) return `[$]${inline1}[/$]`
      if (inline2 !== undefined) return `[$]${inline2}[/$]`
      return match
    }
  )
}
