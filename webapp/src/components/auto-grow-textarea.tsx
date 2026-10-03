'use client'

import { useLayoutEffect, useRef, type TextareaHTMLAttributes } from 'react'

// 題目、選項的長度差很多，固定高度不是把長選項截斷，就是讓短內容留一大片空白。
// 這個 textarea 會跟著內容（以及欄寬改變造成的換行）自動調整高度，rows 當作最少行數。
export default function AutoGrowTextarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const ref = useRef<HTMLTextAreaElement>(null)

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return

    function fit() {
      if (!el) return
      el.style.height = 'auto'
      // scrollHeight 不含邊框，補上上下邊框才不會多出捲軸
      el.style.height = `${el.scrollHeight + el.offsetHeight - el.clientHeight}px`
    }

    fit()

    // 只在寬度改變時重新計算：fit() 本身會改高度，如果高度變動也觸發就會無限循環。
    let lastWidth = el.offsetWidth
    const observer = new ResizeObserver(() => {
      if (el.offsetWidth === lastWidth) return
      lastWidth = el.offsetWidth
      fit()
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [props.value])

  return <textarea ref={ref} {...props} />
}
