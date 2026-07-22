// 這些字串是要透過 AnkiConnect 的 createModel 自動建立「AnkiGen Hub 克漏字」這個
// 自訂筆記類型時使用的 Front/Back Template 和共用 CSS，語法是 Anki 自己的模板語言
// （{{Field}}、{{#Field}}...{{/Field}}、{{FrontSide}}），不是給這個網站自己渲染用的。
//
// 刻意不用 Anki 內建的「Cloze」筆記類型：內建類型只認得自己的 {{c1::...}} 語法，
// 而且畫面完全是 Anki 內建的樣式，沒辦法呈現跟網站模擬器一樣的挖空/答案視覺效果
// （虛線框、底線標色等）。改用自訂筆記類型後，Sentence 欄位直接存放我們自己的
// **word** 標記原文，由這裡的 Front/Back script 自己解析、渲染成跟模擬器一致的
// 樣式，也讓 ** 這個標記在 Anki 裡有實際的視覺意義，而不是單純不會生效的文字。
export const ANKI_CLOZE_MODEL_NAME = 'AnkiGen Hub 克漏字'

export const ANKI_CLOZE_FIELDS = [
  { name: 'Sentence', desc: '例句內容，用 **文字** 標記要挖空的部分' },
  { name: 'Word', desc: '單字原形' },
  { name: 'Explanation', desc: '備註內容（選填）' },
]

// Front 和 Back 各自獨立解析自己那份 {{Sentence}} 隱藏內容，兩邊互不依賴、也不需要
// 像選擇題那樣用「標記元素判斷是否已在背面」的技巧——因為 Front 的 script 就算透過
// {{FrontSide}} 被原封不動再嵌入背面一次、重新執行一遍，也只是把同樣的挖空版例句
// 重新渲染一次，沒有互動狀態需要保護，重複執行完全無害。
export const ANKI_CLOZE_FRONT_TEMPLATE = `<div class="card front-card">
  <div class="badge-container">
    <span class="badge">克漏字</span>
  </div>

  <div class="cloze-original" style="display:none">{{Sentence}}</div>
  <div class="question cloze-sentence"></div>

  <div class="tip-text">提示：想一想被挖空的地方是什麼字，再翻牌看答案</div>
</div>

<script>
  (function() {
    var original = document.querySelector('.cloze-original').textContent;
    var target = document.querySelector('.cloze-sentence');
    var match = original.match(/\\*\\*([\\s\\S]+?)\\*\\*/);

    target.textContent = '';
    if (match) {
      target.appendChild(document.createTextNode(original.slice(0, match.index)));
      var blankSpan = document.createElement('span');
      blankSpan.className = 'cloze-blank';
      blankSpan.textContent = '[...]';
      target.appendChild(blankSpan);
      target.appendChild(document.createTextNode(original.slice(match.index + match[0].length)));
    } else {
      target.textContent = original;
    }
  })();
</script>`

export const ANKI_CLOZE_BACK_TEMPLATE = `{{FrontSide}}

<hr id="answer-split">

<div class="card back-card">
  <div class="cloze-original" style="display:none">{{Sentence}}</div>
  <div class="question cloze-sentence-answer"></div>

  <div class="answer-box">
    單字：<span class="correct-answer">{{Word}}</span>
  </div>

  {{#Explanation}}
    <div class="explanation-box">
      <div class="explanation-title">備註</div>
      <div class="explanation-content">{{Explanation}}</div>
    </div>
  {{/Explanation}}
</div>

<script>
  (function() {
    var original = document.querySelector('.cloze-original').textContent;
    var target = document.querySelector('.cloze-sentence-answer');
    var match = original.match(/\\*\\*([\\s\\S]+?)\\*\\*/);

    target.textContent = '';
    if (match) {
      target.appendChild(document.createTextNode(original.slice(0, match.index)));
      var answerSpan = document.createElement('span');
      answerSpan.className = 'cloze-answer';
      answerSpan.textContent = match[1];
      target.appendChild(answerSpan);
      target.appendChild(document.createTextNode(original.slice(match.index + match[0].length)));
    } else {
      target.textContent = original;
    }
  })();
</script>`

export const ANKI_CLOZE_CSS_TEMPLATE = `.card {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
  font-size: 16px;
  text-align: left;
  color: #333333;
  background-color: #ffffff;
  padding: 22px;
  max-width: 480px;
  margin: 0 auto;
}

#answer-split {
  border: 0;
  height: 1px;
  background-color: #e0e0e0;
  margin: 20px auto;
  max-width: 480px;
}

.badge-container {
  display: flex;
  justify-content: flex-start;
  margin-bottom: 12px;
}

.badge {
  font-size: 11px;
  font-weight: bold;
  padding: 3px 10px;
  border-radius: 20px;
  background-color: #e8f0fe;
  border: 1px solid #c5d7f5;
  color: #4285f4;
}

.question {
  font-size: 18px;
  font-weight: bold;
  margin-bottom: 20px;
  line-height: 1.6;
  color: #222222;
}

.cloze-blank {
  display: inline-block;
  padding: 0 6px;
  border-radius: 4px;
  background-color: #f1f5f9;
  border: 1px dashed #cbd5e1;
  color: #94a3b8;
  font-weight: 700;
}

.cloze-answer {
  font-weight: 700;
  color: #14284A;
  text-decoration: underline;
  text-decoration-color: #3B6FC4;
  text-underline-offset: 3px;
}

.tip-text {
  text-align: center;
  font-size: 11px;
  color: #999999;
  margin-top: 12px;
}

.answer-box {
  background-color: #f8f9fa;
  border: 1px dashed #e0e0e0;
  border-radius: 8px;
  padding: 10px 14px;
  font-size: 14px;
  margin-top: 15px;
  margin-bottom: 12px;
}

.correct-answer {
  font-weight: bold;
  color: #14284A;
}

.explanation-box {
  background-color: #f8f9fa;
  border-left: 3px solid #cccccc;
  border-radius: 0 6px 6px 0;
  padding: 12px;
  margin-top: 15px;
}

.explanation-title {
  font-size: 12px;
  font-weight: bold;
  color: #666666;
  margin-bottom: 4px;
}

.explanation-content {
  font-size: 13px;
  color: #555555;
  line-height: 1.5;
}`
