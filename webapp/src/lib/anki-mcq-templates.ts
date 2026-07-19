// 這些字串是要讓使用者直接複製貼進 Anki「新增卡片類型」的 Front/Back Template 和共用 CSS，
// 語法是 Anki 自己的模板語言（{{Field}}、{{#Field}}...{{/Field}}、{{FrontSide}}），
// 不是給這個網站自己渲染用的，所以照舊版 app.js 的內容原封不動搬過來，不要因為在寫 React
// 就順手「改良」這些字串——改了 Anki 就看不懂了。

export const ANKI_FIELDS = [
  { name: 'Question', desc: '存放題目內容' },
  { name: 'OptionA', desc: '選項 A 內容' },
  { name: 'OptionB', desc: '選項 B 內容' },
  { name: 'OptionC', desc: '選項 C 內容' },
  { name: 'OptionD', desc: '選項 D 內容' },
  { name: 'OptionE', desc: '選項 E 內容（選填，無則留空）' },
  { name: 'OptionF', desc: '選項 F 內容（選填，無則留空）' },
  { name: 'Answer', desc: '答案英文字母，如 A 或 A, C' },
  { name: 'IsMultiple', desc: '若是多選題，隨便填入任何字（如 y），單選則留空' },
  { name: 'Explanation', desc: '卡片解析內容（選填）' },
]

export const ANKI_FRONT_TEMPLATE = `<div class="card front-card">
  <div class="badge-container">
    {{#IsMultiple}}
      <span class="badge multiple">多選題 (Select all)</span>
    {{/IsMultiple}}
    {{^IsMultiple}}
      <span class="badge single">單選題 (Single Choice)</span>
    {{/IsMultiple}}
  </div>

  <div class="question">{{Question}}</div>

  <div class="options-list">
    <div class="option-btn" data-option="A"><span class="prefix">A</span>{{OptionA}}</div>
    <div class="option-btn" data-option="B"><span class="prefix">B</span>{{OptionB}}</div>
    {{#OptionC}}
      <div class="option-btn" data-option="C"><span class="prefix">C</span>{{OptionC}}</div>
    {{/OptionC}}
    {{#OptionD}}
      <div class="option-btn" data-option="D"><span class="prefix">D</span>{{OptionD}}</div>
    {{/OptionD}}
    {{#OptionE}}
      <div class="option-btn" data-option="E"><span class="prefix">E</span>{{OptionE}}</div>
    {{/OptionE}}
    {{#OptionF}}
      <div class="option-btn" data-option="F"><span class="prefix">F</span>{{OptionF}}</div>
    {{/OptionF}}
  </div>
  <div class="tip-text">{{#IsMultiple}}提示：可複選任意數量的選項{{/IsMultiple}}{{^IsMultiple}}提示：點選一個選項進行標記，改選其他選項會自動取代原本的選擇{{/IsMultiple}}</div>
</div>

<script>
  (function() {
    // {{FrontSide}} 會把這段 script 原封不動地嵌入背面模板一次。
    // 用背面才有的標記元素判斷「現在是不是已經翻到背面了」，
    // 如果是，就直接跳過，避免重新綁定點擊事件、洗掉使用者原本在正面的作答紀錄。
    if (document.getElementById('ankigen-answer-marker')) {
      return;
    }

    var isMultiple = {{#IsMultiple}}true{{/IsMultiple}}{{^IsMultiple}}false{{/IsMultiple}};
    var options = Array.prototype.slice.call(document.querySelectorAll('.option-btn'));

    // 每次正面重新顯示（新題目、或按了 Again 重來），都要重置這一題的作答紀錄
    window.AnkiGenSelected = [];

    function syncSelectedState() {
      window.AnkiGenSelected = options
        .filter(function(o) { return o.classList.contains('selected'); })
        .map(function(o) { return o.getAttribute('data-option'); });
    }

    options.forEach(function(opt) {
      opt.addEventListener('click', function(e) {
        e.stopPropagation(); // 防止觸發 Anki 點擊翻牌

        if (isMultiple) {
          // 多選題：每個選項獨立切換，沒有數量限制
          opt.classList.toggle('selected');
        } else {
          // 單選題：藍底同時只能停留在一個選項上，改按其他選項會自動換選
          var wasSelected = opt.classList.contains('selected');
          options.forEach(function(o) { o.classList.remove('selected'); });
          if (!wasSelected) {
            opt.classList.add('selected');
          }
        }

        syncSelectedState();
      });
    });
  })();
</script>`

export const ANKI_BACK_TEMPLATE = `{{FrontSide}}

<div id="ankigen-answer-marker" style="display:none"></div>

<hr id="answer-split">

<div class="card back-card">
  <div class="answer-box">
    正確答案：<span class="correct-answer">{{Answer}}</span>
  </div>

  {{#Explanation}}
    <div class="explanation-box" id="explanation-box">
      <div class="explanation-title">解析</div>
      <div class="explanation-content">{{Explanation}}</div>
    </div>
  {{/Explanation}}
</div>

<script>
  (function() {
    var answerStr = "{{Answer}}".trim().toUpperCase();
    var options = document.querySelectorAll('.option-btn');

    // 解析正確選項列表，例如 "A, B, C" -> ["A", "B", "C"]
    var correctLetters = [];
    for (var i = 0; i < answerStr.length; i++) {
      var char = answerStr.charAt(i);
      if (char >= 'A' && char <= 'F') {
        correctLetters.push(char);
      }
    }

    // 取得正面階段記錄下來的作答；若使用者完全沒作答就直接翻牌，視為空作答
    var selectedLetters = window.AnkiGenSelected || [];

    // 完全正確：使用者選的選項和正確答案必須一模一樣（數量與內容都相同）
    var isFullyCorrect = selectedLetters.length === correctLetters.length &&
      correctLetters.every(function(l) { return selectedLetters.indexOf(l) !== -1; });

    options.forEach(function(opt) {
      var letter = opt.getAttribute('data-option');
      var isCorrect = correctLetters.indexOf(letter) !== -1;
      var isSelected = selectedLetters.indexOf(letter) !== -1;

      if (isCorrect) {
        // 正確答案永遠標綠，不論使用者是否有選到
        opt.classList.add('correct');
      } else if (isSelected) {
        // 使用者選了但不是正確答案 → 標紅
        opt.classList.add('wrong');
      } else {
        // 未選也不是正確答案 → 淡化
        opt.classList.add('unselected');
      }
    });

    // 解析框依作答結果整體標色：完全正確為綠色，只要有選錯就整體標紅
    var explanationBox = document.getElementById('explanation-box');
    if (explanationBox) {
      explanationBox.classList.add(isFullyCorrect ? 'exp-correct' : 'exp-wrong');
    }
  })();
</script>`

export const ANKI_CSS_TEMPLATE = `.card {
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

.badge.multiple {
  background-color: #fef3e0;
  border-color: #f5d9a0;
  color: #e8a317;
}

.question {
  font-size: 18px;
  font-weight: bold;
  margin-bottom: 20px;
  line-height: 1.5;
  color: #222222;
}

.options-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.option-btn {
  display: flex;
  align-items: center;
  padding: 12px 16px;
  border-radius: 8px;
  background-color: #f8f9fa;
  border: 1px solid #e0e0e0;
  color: #333333;
  cursor: pointer;
  transition: all 0.2s ease;
}

.prefix {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background-color: #eeeeee;
  border: 1px solid #dddddd;
  font-size: 11px;
  font-weight: bold;
  color: #666666;
  margin-right: 10px;
  flex-shrink: 0;
  transition: all 0.2s ease;
}

/* 正面：懸停效果 */
.option-btn:hover {
  background-color: #f0f0f0;
  border-color: #cccccc;
}

/* 正面：使用者點選標記 */
.option-btn.selected {
  background-color: #e3eaf6;
  border-color: #4285f4;
}

.option-btn.selected .prefix {
  background-color: #4285f4;
  border-color: #4285f4;
  color: #ffffff;
}

/* 背面：正確答案 — 綠色 */
.option-btn.correct {
  background-color: #e6f4ea !important;
  border-color: #34a853 !important;
  color: #1e7e34;
  font-weight: 500;
}

.option-btn.correct .prefix {
  background-color: #34a853 !important;
  border-color: #34a853 !important;
  color: #ffffff;
}

/* 背面：使用者選錯 — 紅色 */
.option-btn.wrong {
  background-color: #fce8e6 !important;
  border-color: #ea4335 !important;
  color: #c5221f;
}

.option-btn.wrong .prefix {
  background-color: #ea4335 !important;
  border-color: #ea4335 !important;
  color: #ffffff;
}

/* 背面：未選且非正確答案 — 淡化 */
.option-btn.unselected {
  opacity: 0.45;
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
  margin-bottom: 12px;
}

.correct-answer {
  font-weight: bold;
  color: #34a853;
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
}

/* 解析框依作答結果標色：完全正確 → 綠色；有選錯 → 紅色（由背面 script 動態加上對應 class） */
.explanation-box.exp-correct {
  background-color: #e6f4ea;
  border-left-color: #34a853;
}

.explanation-box.exp-correct .explanation-title {
  color: #1e7e34;
}

.explanation-box.exp-wrong {
  background-color: #fce8e6;
  border-left-color: #ea4335;
}

.explanation-box.exp-wrong .explanation-title {
  color: #c5221f;
}`
