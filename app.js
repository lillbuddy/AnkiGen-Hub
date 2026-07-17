// AnkiMed - 核心應用程式邏輯 (JavaScript)

// 全域卡片陣列
let parsedCards = [];
let activePreviewIndex = 0; // 目前在模擬器預覽的卡片索引

// DOM 元素
const mdInput = document.getElementById('markdown-input');
const btnParse = document.getElementById('btn-parse');
const btnParseAi = document.getElementById('btn-parse-ai');
const geminiApiKeyInput = document.getElementById('gemini-api-key');
const geminiModelSelect = document.getElementById('gemini-model-select');
const geminiCustomModel = document.getElementById('gemini-custom-model');
const btnLoadSample = document.getElementById('btn-load-sample');
const btnClear = document.getElementById('btn-clear');
const parsedResultsPanel = document.getElementById('parsed-results-panel');
const parsedCount = document.getElementById('parsed-count');
const cardsTableBody = document.getElementById('cards-table-body');
const btnDownloadCsv = document.getElementById('btn-download-csv');

// 模擬器 DOM 元素
const ankiSimulatorCard = document.getElementById('anki-simulator-card');
const btnSimulateFlip = document.getElementById('btn-simulate-flip');
const simTypeBadge = document.getElementById('sim-type-badge');
const simTypeBadgeBack = document.getElementById('sim-type-badge-back');
const simQuestion = document.getElementById('sim-question');
const simQuestionBack = document.getElementById('sim-question-back');
const simOptionsFront = document.getElementById('sim-options-front');
const simOptionsBack = document.getElementById('sim-options-back');
const simCorrectAns = document.getElementById('sim-correct-ans');
const simExplanationBox = document.getElementById('sim-explanation-box');
const simExplanationContent = document.getElementById('sim-explanation-content');

// 範例資料 (傳統醫學選擇題 Markdown 格式)
const sampleMarkdown = `1. 關於冠狀動脈疾病（CAD）的診斷與評估，下列敘述何者錯誤？
A. 運動心電圖是最常見的初步篩檢工具
B. 心臟電腦斷層血管攝影（CCTA）可用於排除低至中度風險患者的阻塞性病變
C. 核心心臟造影（SPECT）是藉由評估心肌灌流來偵測缺血
D. 冠狀動脈造影（CATH）是診斷的黃金標準，但只有在非侵入性檢查異常時才可進行
答案：D
解析：冠狀動脈造影（導管檢查）是黃金標準，但若患者有急性冠心症（ACS）或不穩定心絞痛且臨床風險極高，可直接進行侵入性導管檢查，不一定要先經過非侵入性檢查。

2. 一位 65 歲男性因呼吸困難入院，聽診在心尖處可聞及舒張期滾動樣雜音（diastolic rumbling murmur），且第一心音變強。下列哪些發現也可能在此患者身上觀察到？（多選）
A. 心房顫動（Atrial Fibrillation）
B. 左心房擴大（Left Atrial Enlargement）
C. 肺動脈高壓（Pulmonary Hypertension）
D. 左心室肥大（Left Ventricular Hypertrophy）
答案：A, B, C
解析：患者聽診特徵為典型的二尖瓣狹窄（Mitral Stenosis）。二尖瓣狹窄會導致左心房壓力增高並擴大，進而引發心房顫動與肺靜脈高壓/肺動脈高壓。然而，因為血液進入左心室受阻，左心室通常不會肥大（左心室肥大常出現在二尖瓣逆流或主動脈瓣病變中）。

3. 關於第一型與第二型糖尿病的比較，下列何者正確？
A. 第一型糖尿病與 HLA-DR3/DR4 有強烈關聯
B. 第二型糖尿病患者體內絕對缺乏胰島素，因此必須一開始就使用胰島素治療
C. 第一型糖尿病常見於肥胖患者，且通常在成年後發病
D. 酮酸中毒（DKA）主要發生在第二型糖尿病患者中
答案：A
解析：第一型糖尿病是自體免疫疾病，與 HLA-DR3/DR4 基因有強烈關聯。第二型糖尿病是相對缺乏胰島素及具胰島素阻抗，常見於肥胖者，且發病通常較晚。酮酸中毒（DKA）主要發生在第一型糖尿病患者身上，而第二型糖尿病患者較常發生高滲透壓高血糖狀態（HHS）。`;

// 預載 Anki 模板代碼
const templates = {
  front: `<div class="card front-card">
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
  <div class="tip-text">提示：可在正面點選選項進行標記</div>
</div>

<script>
  (function() {
    var options = document.querySelectorAll('.option-btn');
    options.forEach(function(opt) {
      opt.addEventListener('click', function(e) {
        e.stopPropagation(); // 防止觸發 Anki 點擊翻牌
        opt.classList.toggle('selected');
      });
    });
  })();
</script>`,

  back: `{{FrontSide}}

<hr id="answer-split">

<div class="card back-card">
  <div class="answer-box">
    正確答案：<span class="correct-answer">{{Answer}}</span>
  </div>

  {{#Explanation}}
    <div class="explanation-box">
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
    
    options.forEach(function(opt) {
      var letter = opt.getAttribute('data-option');
      var isCorrect = correctLetters.indexOf(letter) !== -1;
      var isSelected = opt.classList.contains('selected');
      
      if (isCorrect) {
        // 正確答案永遠標綠
        opt.classList.add('correct');
      } else if (isSelected && !isCorrect) {
        // 使用者選了但答錯 → 標紅
        opt.classList.add('wrong');
      } else {
        // 未選也不是正確答案 → 淡化
        opt.classList.add('unselected');
      }
    });
  })();
</script>`,

  css: `.card {
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
  background-color: #f0f7f1;
  border-left: 3px solid #34a853;
  border-radius: 0 6px 6px 0;
  padding: 12px;
  margin-top: 15px;
}

.explanation-title {
  font-size: 12px;
  font-weight: bold;
  color: #34a853;
  margin-bottom: 4px;
}

.explanation-content {
  font-size: 13px;
  color: #555555;
  line-height: 1.5;
}`
};

// 初始化設定
document.addEventListener('DOMContentLoaded', () => {
  // 將 templates 寫入 textarea 唯讀區
  document.getElementById('code-front').value = templates.front;
  document.getElementById('code-back').value = templates.back;
  document.getElementById('code-css').value = templates.css;

  // 綁定事件監聽器
  btnParse.addEventListener('click', parseInput);
  btnParseAi.addEventListener('click', parseInputWithGemini);
  btnLoadSample.addEventListener('click', loadSample);
  btnClear.addEventListener('click', clearInput);
  btnDownloadCsv.addEventListener('click', downloadCSVFile);
  btnSimulateFlip.addEventListener('click', toggleFlipCard);
  
  // 點選卡片本身也可以翻牌（排除選項點擊與解析區塊，避免影響點選和滾動）
  ankiSimulatorCard.addEventListener('click', (e) => {
    if (e.target.closest('.sim-option-btn') || e.target.closest('#sim-explanation-box')) {
      return;
    }
    toggleFlipCard();
  });

  // 初始化 Tabs 切換邏輯
  initTabs();

  // 監聽模型選單切換，若是選擇自訂，則顯示自訂輸入框
  geminiModelSelect.addEventListener('change', () => {
    if (geminiModelSelect.value === 'custom') {
      geminiCustomModel.style.display = 'inline-block';
      geminiCustomModel.focus();
    } else {
      geminiCustomModel.style.display = 'none';
    }
  });

  // 空格鍵翻牌快捷鍵（但要排除在輸入框內按空格）
  window.addEventListener('keydown', (e) => {
    if (e.code === 'Space' && document.activeElement.tagName !== 'TEXTAREA' && document.activeElement.tagName !== 'INPUT') {
      e.preventDefault();
      toggleFlipCard();
    }
  });

  // 載入預設卡片模擬
  updateSimulator({
    question: "關於心肌梗塞，下列哪項血中心肌酵素最快上升？",
    optionA: "Myoglobin (肌紅蛋白)",
    optionB: "Troponin I (心肌肌鈣蛋白 I)",
    optionC: "CK-MB (肌酸激酶同工酶 MB)",
    optionD: "LDH (乳酸脫氫酶)",
    optionE: "",
    optionF: "",
    answer: "A",
    isMultiple: "",
    explanation: "Myoglobin 在心肌受損後 1-3 小時內最快釋放到血中，但因為它也存在於骨骼肌，特異性較低。Troponin I 則在 3-4 小時後上升，但特異性極高。"
  });
});

// Tab 切換控制
function initTabs() {
  const tabBtns = document.querySelectorAll('.tab-btn');
  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      // 移除所有 active 狀態
      const tabGroup = btn.parentElement;
      tabGroup.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      const container = tabGroup.parentElement;
      container.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));

      // 加入目前點選的 active 狀態
      btn.classList.add('active');
      const targetId = btn.getAttribute('data-tab');
      document.getElementById(targetId).classList.add('active');
    });
  });

  // 複製按鈕
  const copyBtns = document.querySelectorAll('.btn-copy');
  copyBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const targetId = btn.getAttribute('data-target');
      const textarea = document.getElementById(targetId);
      textarea.select();
      document.execCommand('copy');
      
      const originalText = btn.innerHTML;
      btn.innerHTML = `<i class="fa-solid fa-check"></i> 已複製`;
      btn.classList.remove('btn-secondary');
      btn.classList.add('btn-success');
      
      setTimeout(() => {
        btn.innerHTML = originalText;
        btn.classList.remove('btn-success');
        btn.classList.add('btn-secondary');
      }, 1500);
    });
  });
}

// 載入範例資料
function loadSample() {
  mdInput.value = sampleMarkdown;
  parseInput();
}

// 清除輸入
function clearInput() {
  mdInput.value = '';
  parsedCards = [];
  parsedResultsPanel.style.display = 'none';
  parsedCount.textContent = '0';
}

// 智慧 Markdown 解析核心
function parseInput() {
  const text = mdInput.value.trim();
  if (!text) {
    alert("請先輸入考卷 Markdown 文字！");
    return;
  }

  // 1. 標準化換行符
  const normalizedText = text.replace(/\r\n/g, '\n').trim();
  
  // 2. 依題號拆分題目區塊
  // 支援更富彈性的行首格式，匹配前面包含 -、*、#、** 等 markdown 標記的題號，並支援 Q1. 或 q2) 等格式
  const questionBlocks = normalizedText.split(/(?=\n\s*(?:[-*#\s]|\*\*)*(?:Q|q)?\d+(?:[\.、\)]|\.\*\*|\*\*[\.、\)]|\*\*))/i);
  
  parsedCards = [];
  let indexCounter = 1;

  questionBlocks.forEach((block) => {
    const lines = block.trim().split('\n');
    if (lines.length < 2) return; // 忽略過短的無效區塊
    
    let questionText = "";
    let options = { A: "", B: "", C: "", D: "", E: "", F: "" };
    let answer = "";
    let explanation = "";
    let isMultiple = false;
    
    let currentMode = "question"; // 狀態機模式
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      
      // 偵測是否為答案行 (答案：A, B, C 或 Ans: A 等)
      const ansMatch = line.match(/^(?:答案|Ans|Answer|Key)[：:\s]*(.*)/i);
      if (ansMatch) {
        answer = ansMatch[1].trim().toUpperCase().replace(/[^A-F,，\s\+]/g, ''); // 保留大寫與分隔符
        currentMode = "explanation";
        continue;
      }
      
      // 偵測是否為解析行
      const expMatch = line.match(/^(?:解析|Explanation|Expl|Note)[：:\s]*(.*)/i);
      if (expMatch) {
        explanation = expMatch[1].trim();
        currentMode = "explanation";
        continue;
      }
      
      // 偵測是否為選項行 (A. 選項一)
      const optMatch = line.match(/^([A-F])[\.、\)]\s*(.*)/i);
      if (optMatch) {
        currentMode = "options";
        const letter = optMatch[1].toUpperCase();
        options[letter] = optMatch[2].trim();
        continue;
      }
      
      // 依狀態累積內容
      if (currentMode === "question") {
        if (questionText) questionText += "\n";
        // 智慧去除題目的前導題號與 markdown 標記 (如 "- 1. ", "**1.**", "### Q1) ")
        if (questionText === "") {
          questionText = line.replace(/^\s*(?:[-*#\s]|\*\*)*(?:Q|q)?\d+(?:[\.、\)]|\.\*\*|\*\*[\.、\)]|\*\*)\s*/i, "");
        } else {
          questionText += line;
        }
      } else if (currentMode === "explanation") {
        if (explanation) explanation += "\n";
        explanation += line;
      }
    }
    
    // 清理答案格式：轉換為大寫且去除雜質，並只保留 A-F，最後轉為 comma 拼接格式
    let rawAnswer = answer.toUpperCase().replace(/[^A-F]/g, '');
    let formattedAnswer = rawAnswer.split('').join(', ');

    // 檢查是否為多選題：
    // 1. 答案有多個字母，如 "AC"
    // 2. 題目文字包含 "多選"、"複選"、"Select all"、"multiple" 等字詞
    if (rawAnswer.length > 1 || questionText.includes("多選") || questionText.includes("複選")) {
      isMultiple = true;
    }

    if (questionText && (options.A || options.B)) {
      parsedCards.push({
        id: indexCounter++,
        question: questionText,
        optionA: options.A,
        optionB: options.B,
        optionC: options.C,
        optionD: options.D,
        optionE: options.E,
        optionF: options.F,
        answer: formattedAnswer,
        isMultiple: isMultiple ? "y" : "",
        explanation: explanation
      });
    }
  });

  if (parsedCards.length === 0) {
    alert("解析失敗，請確認你的考卷格式是否符合「題號 + A. B. C. D. + 答案：」的結構！");
    return;
  }

  // 顯示結果面板
  parsedCount.textContent = parsedCards.length;
  parsedResultsPanel.style.display = 'block';
  
  // 渲染表格
  renderCardsTable();

  // 將第一題載入模擬器預覽
  activePreviewIndex = 0;
  updateSimulator(parsedCards[0]);
  
  // 滾動到預覽表格
  parsedResultsPanel.scrollIntoView({ behavior: 'smooth' });
}

// 渲染可編輯表格
function renderCardsTable() {
  cardsTableBody.innerHTML = '';
  
  parsedCards.forEach((card, index) => {
    const tr = document.createElement('tr');
    tr.id = `row-${index}`;
    if (index === activePreviewIndex) {
      tr.classList.add('table-row-active');
    }

    // 點擊整行可直接載入模擬器
    tr.addEventListener('click', (e) => {
      // 如果點擊的是輸入控制項或按鈕，不觸發整行載入，避免衝突
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'BUTTON' || e.target.closest('button')) {
        return;
      }
      setActivePreview(index);
    });

    tr.innerHTML = `
      <td>
        <input type="number" class="cell-input text-center" value="${card.id}" onchange="updateCardField(${index}, 'id', this.value)">
      </td>
      <td>
        <textarea class="cell-input" rows="2" onchange="updateCardField(${index}, 'question', this.value)">${card.question}</textarea>
      </td>
      <td>
        <select class="cell-select" onchange="updateCardField(${index}, 'isMultiple', this.value)">
          <option value="" ${card.isMultiple === '' ? 'selected' : ''}>單選題</option>
          <option value="y" ${card.isMultiple === 'y' ? 'selected' : ''}>多選題</option>
        </select>
      </td>
      <td>
        <div class="cell-option-grid">
          <div class="cell-opt-wrap"><span class="cell-opt-lbl">A</span><input type="text" class="cell-input" value="${card.optionA}" onchange="updateCardField(${index}, 'optionA', this.value)"></div>
          <div class="cell-opt-wrap"><span class="cell-opt-lbl">B</span><input type="text" class="cell-input" value="${card.optionB}" onchange="updateCardField(${index}, 'optionB', this.value)"></div>
          <div class="cell-opt-wrap"><span class="cell-opt-lbl">C</span><input type="text" class="cell-input" value="${card.optionC}" onchange="updateCardField(${index}, 'optionC', this.value)"></div>
          <div class="cell-opt-wrap"><span class="cell-opt-lbl">D</span><input type="text" class="cell-input" value="${card.optionD}" onchange="updateCardField(${index}, 'optionD', this.value)"></div>
          <div class="cell-opt-wrap"><span class="cell-opt-lbl">E</span><input type="text" class="cell-input" value="${card.optionE}" onchange="updateCardField(${index}, 'optionE', this.value)" placeholder="(無)"></div>
          <div class="cell-opt-wrap"><span class="cell-opt-lbl">F</span><input type="text" class="cell-input" value="${card.optionF}" onchange="updateCardField(${index}, 'optionF', this.value)" placeholder="(無)"></div>
        </div>
      </td>
      <td>
        <input type="text" class="cell-input text-center" value="${card.answer}" onchange="updateCardField(${index}, 'answer', this.value)" placeholder="A, C">
      </td>
      <td>
        <div class="row-actions">
          <button class="btn btn-secondary btn-xs" onclick="setActivePreview(${index})" title="即時模擬預覽"><i class="fa-solid fa-eye"></i></button>
          <button class="btn btn-danger-outline btn-xs" onclick="deleteCardRow(${index})" title="刪除本題"><i class="fa-solid fa-trash"></i></button>
        </div>
      </td>
    `;
    
    cardsTableBody.appendChild(tr);
  });
}

// 變更欄位並同步到全域變數與預覽
window.updateCardField = function(index, field, value) {
  // 對於 isMultiple，如果是單選傳入 ""，多選傳入 "y"
  // 對於 answer，將其標準化（例如使用者輸入小寫，或用空格隔開，我們在失去焦點後整理它）
  if (field === 'answer') {
    value = value.toUpperCase().replace(/[^A-F]/g, '').split('').join(', ');
  }
  
  parsedCards[index][field] = value;
  
  // 如果更動的是答案長度，且原本是單選，自動建議改多選
  if (field === 'answer') {
    const rawLetters = value.replace(/[^A-F]/g, '');
    if (rawLetters.length > 1 && parsedCards[index].isMultiple === '') {
      parsedCards[index].isMultiple = 'y';
      renderCardsTable(); // 重整表格來更新 dropdown
    }
  }

  // 如果目前更動的剛好是正在預覽的卡片，同步更新模擬器
  if (index === activePreviewIndex) {
    updateSimulator(parsedCards[index]);
  }
};

// 設定目前預覽的卡片
window.setActivePreview = function(index) {
  // 移除舊的 active row 樣式
  document.querySelectorAll('#cards-table-body tr').forEach((tr, i) => {
    if (i === index) {
      tr.classList.add('table-row-active');
    } else {
      tr.classList.remove('table-row-active');
    }
  });

  activePreviewIndex = index;
  // 將模擬器重設回正面（避免載入新題目卻在背面）
  ankiSimulatorCard.classList.remove('flipped');
  updateSimulator(parsedCards[index]);
};

// 刪除某列卡片
window.deleteCardRow = function(index) {
  if (confirm(`確定要刪除第 ${index + 1} 題嗎？`)) {
    parsedCards.splice(index, 1);
    
    // 重設 id
    parsedCards.forEach((c, idx) => c.id = idx + 1);
    
    if (parsedCards.length === 0) {
      clearInput();
      return;
    }

    parsedCount.textContent = parsedCards.length;
    
    // 修正 active index
    if (activePreviewIndex >= parsedCards.length) {
      activePreviewIndex = parsedCards.length - 1;
    }
    
    renderCardsTable();
    setActivePreview(activePreviewIndex);
  }
};

// 更新卡片模擬器畫面
function updateSimulator(card) {
  // 處理題型標籤
  const isMulti = card.isMultiple === 'y';
  const badgeText = isMulti ? '多選題' : '單選題';
  
  simTypeBadge.textContent = badgeText;
  simTypeBadgeBack.textContent = badgeText;
  
  if (isMulti) {
    simTypeBadge.classList.add('multiple');
    simTypeBadgeBack.classList.add('multiple');
  } else {
    simTypeBadge.classList.remove('multiple');
    simTypeBadgeBack.classList.remove('multiple');
  }

  // 題目
  simQuestion.textContent = card.question;
  simQuestionBack.textContent = card.question;

  // 渲染正面與背面的選項 HTML
  let optionsHTMLFront = '';
  let optionsHTMLBack = '';
  
  const optionsArr = [
    { letter: 'A', text: card.optionA },
    { letter: 'B', text: card.optionB },
    { letter: 'C', text: card.optionC },
    { letter: 'D', text: card.optionD },
    { letter: 'E', text: card.optionE },
    { letter: 'F', text: card.optionF }
  ];

  // 取得答案字母列表，用於背面高亮
  const rawAnswerLetters = card.answer.toUpperCase().replace(/[^A-F]/g, '').split('');

  optionsArr.forEach(opt => {
    if (!opt.text) return; // 空欄位自動隱藏（這是我們設計的重點！）

    // 1. 正面：可點選互動
    optionsHTMLFront += `
      <button class="sim-option-btn" data-letter="${opt.letter}" onclick="toggleOptionSelect(this, event)">
        <span class="sim-option-prefix">${opt.letter}</span>
        <span class="sim-option-text">${opt.text}</span>
      </button>
    `;

    // 2. 背面：顯示答案高亮
    const isCorrect = rawAnswerLetters.includes(opt.letter);
    const resultClass = isCorrect ? 'correct' : 'wrong';
    
    optionsHTMLBack += `
      <div class="sim-option-btn ${resultClass}" data-letter="${opt.letter}">
        <span class="sim-option-prefix">${opt.letter}</span>
        <span class="sim-option-text">${opt.text}</span>
      </div>
    `;
  });

  simOptionsFront.innerHTML = optionsHTMLFront;
  simOptionsBack.innerHTML = optionsHTMLBack;

  // 正確答案純文字欄位
  simCorrectAns.textContent = card.answer;

  // 解析欄位
  if (card.explanation) {
    simExplanationBox.style.display = 'block';
    simExplanationContent.textContent = card.explanation;
  } else {
    simExplanationBox.style.display = 'none';
  }
}

// 正面選項點選互動 (模擬 Anki 面板功能)
window.toggleOptionSelect = function(element, event) {
  event.stopPropagation(); // 阻止事件向上傳遞，避免卡片翻轉
  element.classList.toggle('selected');
};

// 翻轉卡片模擬
function toggleFlipCard() {
  // 如果此時模擬卡片正面有被選取的狀態，當翻面時，我們可以在背面做一個趣味對比
  // 為了簡化只做 basic flip
  ankiSimulatorCard.classList.toggle('flipped');
}

// 匯出 CSV (TSV - Tab 鍵分隔) 檔案供 Anki 匯入
function downloadCSVFile() {
  if (parsedCards.length === 0) return;
  
  const headers = ["Question", "OptionA", "OptionB", "OptionC", "OptionD", "OptionE", "OptionF", "Answer", "IsMultiple", "Explanation"];
  
  let csvContent = "";
  
  // 雙引號與 Tab 鍵逃逸處理函數
  function escapeField(val) {
    if (val === undefined || val === null) return '""';
    let str = String(val).trim();
    // 雙引號跳脫：Anki 標準為把 double quotes 改成兩個 double quotes
    str = str.replace(/"/g, '""');
    // 將多行換行符轉換成 HTML <br> 標籤，這樣 Anki 才能在一格中顯示換行
    str = str.replace(/\n/g, '<br>');
    return `"${str}"`;
  }

  // 不寫入標題列 (Header Row)，因為 Anki 匯入時會把標題當成一筆卡片
  // 匯入 Anki 時請依照欄位順序手動對應：Question, OptionA~F, Answer, IsMultiple, Explanation
  
  // 寫入內容資料
  parsedCards.forEach(card => {
    const row = [
      card.question,
      card.optionA,
      card.optionB,
      card.optionC,
      card.optionD,
      card.optionE,
      card.optionF,
      card.answer,
      card.isMultiple,
      card.explanation
    ];
    csvContent += row.map(escapeField).join('\t') + '\n';
  });

  // 以 UTF-8 格式下載（加上 BOM 確保 Excel 或 Anki 都能正常讀取中文）
  const blob = new Blob(["\ufeff" + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  
  link.setAttribute("href", url);
  link.setAttribute("download", `ankimed_export_${getFormattedDate()}.csv`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// 取得目前時間戳記 (YYYYMMDD_HHMM)
function getFormattedDate() {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hours = String(d.getHours()).padStart(2, '0');
  const mins = String(d.getMinutes()).padStart(2, '0');
  return `${year}${month}${day}_${hours}${mins}`;
}

// AI 智慧解析 (呼叫 Gemini API)
async function parseInputWithGemini() {
  const text = mdInput.value.trim();
  if (!text) {
    alert("請先輸入考卷 Markdown 文字！");
    return;
  }

  const apiKey = geminiApiKeyInput.value.trim();
  if (!apiKey) {
    alert("請先輸入您的 Gemini API Key！您可以點擊輸入框右側的「獲取 Key」前往 Google AI Studio 免費申請。");
    geminiApiKeyInput.focus();
    return;
  }

  // 取得選擇的模型名稱
  let model = geminiModelSelect.value;
  if (model === 'custom') {
    model = geminiCustomModel.value.trim();
    if (!model) {
      alert("請輸入自訂的模型名稱！");
      geminiCustomModel.focus();
      return;
    }
  }

  // 設定載入中狀態
  btnParseAi.disabled = true;
  btnParseAi.classList.add('btn-loading');
  const originalHtml = btnParseAi.innerHTML;
  btnParseAi.innerHTML = ""; // 顯示 CSS spinner

  try {
    const prompt = `你是一個專業的考卷解析器。請將以下考卷文字解析為結構化的 JSON 陣列。
每一題必須包含以下欄位（注意大小寫）：
- id: 題號 (整數)
- question: 題目文字 (去除前導題號與 Markdown 格式，保留乾淨的題目，若有換行或多行公式則以 <br> 換行)
- optionA: 選項 A 內容 (去除 A. 或 A) 等前導符號)
- optionB: 選項 B 內容
- optionC: 選項 C 內容 (若無則留空)
- optionD: 選項 D 內容 (若無則留空)
- optionE: 選項 E 內容 (若無則留空)
- optionF: 選項 F 內容 (若無則留空)
- answer: 正確答案英文字母，必須用逗號加空格隔開 (例如: "A" 或 "A, C")
- isMultiple: 若為多選題填入 "y"，單選題填入 ""
- explanation: 題目解析內容 (若無則留空)

輸出格式必須是純 JSON 陣列，不要包裹在 \`\`\`json ... \`\`\` 內，必須直接輸出合法的 JSON。

以下是待解析的考卷內容：
${text}`;

    // 使用選擇的 Gemini 模型
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: prompt
          }]
        }],
        generationConfig: {
          responseMimeType: "application/json"
        }
      })
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.error?.message || `HTTP 錯誤！狀態碼: ${response.status}`);
    }

    const data = await response.json();
    const resultText = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!resultText) {
      throw new Error("Gemini 回傳了空內容，請確認您的輸入是否有題目。");
    }

    const cards = JSON.parse(resultText.trim());
    if (!Array.isArray(cards)) {
      throw new Error("Gemini 回傳的格式不是有效的 JSON 陣列。");
    }

    // 將回傳的欄位映射至 parsedCards
    parsedCards = cards.map((card, idx) => {
      return {
        id: card.id || (idx + 1),
        question: card.question || "",
        optionA: card.optionA || card.optiona || "",
        optionB: card.optionB || card.optionb || "",
        optionC: card.optionC || card.optionc || "",
        optionD: card.optionD || card.optiond || "",
        optionE: card.optionE || card.optione || "",
        optionF: card.optionF || card.optionf || "",
        answer: card.answer || "",
        isMultiple: card.isMultiple || card.ismultiple || "",
        explanation: card.explanation || ""
      };
    });

    if (parsedCards.length === 0) {
      throw new Error("未能解析出任何題目，請檢查您的考卷內容格式。");
    }

    // 顯示結果面板
    parsedCount.textContent = parsedCards.length;
    parsedResultsPanel.style.display = 'block';
    renderCardsTable();

    // 載入第一題預覽
    activePreviewIndex = 0;
    updateSimulator(parsedCards[0]);
    
    // 平滑滾動到結果面板
    parsedResultsPanel.scrollIntoView({ behavior: 'smooth' });

  } catch (error) {
    console.error(error);
    alert(`AI 解析失敗：\n${error.message}\n\n請確認您的 API Key 是否正確，或嘗試使用「本地快速解析」。`);
  } finally {
    // 恢復按鈕
    btnParseAi.disabled = false;
    btnParseAi.classList.remove('btn-loading');
    btnParseAi.innerHTML = originalHtml;
  }
}
