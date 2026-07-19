// AnkiGen - 圖片標記工具 核心邏輯

// 全域狀態
let slideImages = []; // { id, file, url, filename, notes, included, mcqQuestionText, mcqOptionA..F, mcqAnswer, mcqIsMultiple }
let nextSlideId = 1;
let activeSlideId = null; // 目前在編輯面板 / 模擬器中反白預覽的圖片 id
let currentMode = 'mcq'; // 'mcq' | 'occlusion'
let ssSelectedLetters = []; // 模擬器正面目前被選取的選項字母（僅選擇題模式用）

// DOM 元素 - 步驟一（選圖 / 命名）
const slideFileInput = document.getElementById('slide-file-input');
const btnSelectImages = document.getElementById('btn-select-images');
const slideDropzone = document.getElementById('slide-dropzone');
const btnClearSlides = document.getElementById('btn-clear-slides');
const slideGridPanel = document.getElementById('slide-grid-panel');
const slideGrid = document.getElementById('slide-grid');
const slideCount = document.getElementById('slide-count');
const btnSelectAllSlides = document.getElementById('btn-select-all-slides');
const btnDeselectAllSlides = document.getElementById('btn-deselect-all-slides');
const btnDownloadRenamed = document.getElementById('btn-download-renamed');

// DOM 元素 - 精靈式步驟切換
const stepLabelView = document.getElementById('step-label-view');
const stepExportView = document.getElementById('step-export-view');
const btnGotoExport = document.getElementById('btn-goto-export');
const btnBackToLabel = document.getElementById('btn-back-to-label');

// DOM 元素 - 步驟二（匯出模式）
const modeTabBtns = document.querySelectorAll('.mode-tab-btn');
const modePanelMcq = document.getElementById('mode-panel-mcq');
const modePanelOcclusion = document.getElementById('mode-panel-occlusion');
const tplPanelMcq = document.getElementById('tpl-panel-mcq');
const tplPanelOcclusion = document.getElementById('tpl-panel-occlusion');

const slideSharedPrompt = document.getElementById('slide-shared-prompt');
const btnApplyPrompt = document.getElementById('btn-apply-prompt');
const btnDownloadMcqCsv = document.getElementById('btn-download-mcq-csv');
const mcqEmptyHint = document.getElementById('mcq-empty-hint');
const slideMcqTableBody = document.getElementById('slide-mcq-table-body');

const mcqEditPanel = document.getElementById('mcq-edit-panel');
const mcqEditThumb = document.getElementById('mcq-edit-thumb');
const mcqEditFilename = document.getElementById('mcq-edit-filename');
const mcqEditQuestion = document.getElementById('mcq-edit-question');
const mcqEditType = document.getElementById('mcq-edit-type');
const mcqEditAnswer = document.getElementById('mcq-edit-answer');
const mcqEditOptionA = document.getElementById('mcq-edit-optionA');
const mcqEditOptionB = document.getElementById('mcq-edit-optionB');
const mcqEditOptionC = document.getElementById('mcq-edit-optionC');
const mcqEditOptionD = document.getElementById('mcq-edit-optionD');
const mcqEditOptionE = document.getElementById('mcq-edit-optionE');
const mcqEditOptionF = document.getElementById('mcq-edit-optionF');

const slidesGeminiApiKey = document.getElementById('gemini-api-key');
const geminiModelSelect = document.getElementById('gemini-model-select');
const geminiCustomModel = document.getElementById('gemini-custom-model');
const btnGenerateDistractors = document.getElementById('btn-generate-distractors');
const glossaryFileInput = document.getElementById('glossary-file-input');
const btnUploadGlossary = document.getElementById('btn-upload-glossary');
const glossaryStatus = document.getElementById('glossary-status');

// 使用者上傳的干擾選項詞彙表（從 .md 檔案解析出來的詞彙清單）
let distractorGlossary = [];

const slideOcclusionTableBody = document.getElementById('slide-occlusion-table-body');
const btnDownloadOcclusionCsv = document.getElementById('btn-download-occlusion-csv');

// 模擬器 DOM 元素
const ssSimulatorCard = document.getElementById('ss-simulator-card');
const ssBtnSimulateFlip = document.getElementById('ss-btn-simulate-flip');
const simMcqFrontBlock = document.getElementById('sim-mcq-front-block');
const simMcqBackBlock = document.getElementById('sim-mcq-back-block');
const simOccFrontBlock = document.getElementById('sim-occ-front-block');
const simOccBackBlock = document.getElementById('sim-occ-back-block');

const ssTypeBadge = document.getElementById('ss-type-badge');
const ssTypeBadgeBack = document.getElementById('ss-type-badge-back');
const ssQuestion = document.getElementById('ss-question');
const ssQuestionBack = document.getElementById('ss-question-back');
const ssOptionsFront = document.getElementById('ss-options-front');
const ssOptionsBack = document.getElementById('ss-options-back');
const ssCorrectAns = document.getElementById('ss-correct-ans');
const ssExplanationBox = document.getElementById('ss-explanation-box');
const ssExplanationContent = document.getElementById('ss-explanation-content');

const ssOccFrontImg = document.getElementById('ss-occ-front-img');
const ssOccHeader = document.getElementById('ss-occ-header');
const ssOccBackImg = document.getElementById('ss-occ-back-img');
const ssOccHeaderBack = document.getElementById('ss-occ-header-back');
const ssOccExplanationBox = document.getElementById('ss-occ-explanation-box');
const ssOccExplanationContent = document.getElementById('ss-occ-explanation-content');

// Anki 模板程式碼 DOM 元素（選擇題模式；跟「選擇題卡片生成器」用同一個筆記類型）
const tplCodeFront = document.getElementById('tpl-code-front');
const tplCodeBack = document.getElementById('tpl-code-back');
const tplCodeCss = document.getElementById('tpl-code-css');

document.addEventListener('DOMContentLoaded', () => {
  btnSelectImages.addEventListener('click', () => slideFileInput.click());
  slideFileInput.addEventListener('change', (e) => handleFilesAdded(e.target.files));

  slideDropzone.addEventListener('click', (e) => {
    if (e.target === btnSelectImages || btnSelectImages.contains(e.target)) return;
    slideFileInput.click();
  });
  slideDropzone.addEventListener('dragover', (e) => {
    e.preventDefault();
    slideDropzone.classList.add('drag-over');
  });
  slideDropzone.addEventListener('dragleave', () => {
    slideDropzone.classList.remove('drag-over');
  });
  slideDropzone.addEventListener('drop', (e) => {
    e.preventDefault();
    slideDropzone.classList.remove('drag-over');
    handleFilesAdded(e.dataTransfer.files);
  });

  btnClearSlides.addEventListener('click', clearAllSlides);
  btnSelectAllSlides.addEventListener('click', () => setAllIncluded(true));
  btnDeselectAllSlides.addEventListener('click', () => setAllIncluded(false));
  btnDownloadRenamed.addEventListener('click', downloadRenamedImages);

  btnGotoExport.addEventListener('click', goToExportStep);
  btnBackToLabel.addEventListener('click', goToLabelStep);

  modeTabBtns.forEach(btn => {
    btn.addEventListener('click', () => switchMode(btn.getAttribute('data-mode')));
  });

  btnApplyPrompt.addEventListener('click', applyPromptToAll);
  btnDownloadMcqCsv.addEventListener('click', downloadMcqCsv);
  btnDownloadOcclusionCsv.addEventListener('click', downloadOcclusionCsv);
  btnGenerateDistractors.addEventListener('click', generateDistractorsForActiveCard);
  btnUploadGlossary.addEventListener('click', () => glossaryFileInput.click());
  glossaryFileInput.addEventListener('change', handleGlossaryFileSelected);

  geminiModelSelect.addEventListener('change', () => {
    if (geminiModelSelect.value === 'custom') {
      geminiCustomModel.style.display = 'inline-block';
      geminiCustomModel.focus();
    } else {
      geminiCustomModel.style.display = 'none';
    }
  });

  populateMcqEditTypeOptions();
  bindMcqEditPanelEvents();

  ssBtnSimulateFlip.addEventListener('click', toggleSsFlip);
  ssSimulatorCard.addEventListener('click', (e) => {
    if (e.target.closest('.sim-option-btn')) return;
    toggleSsFlip();
  });

  window.addEventListener('keydown', (e) => {
    if (e.code === 'Space' && document.activeElement.tagName !== 'TEXTAREA' && document.activeElement.tagName !== 'INPUT') {
      e.preventDefault();
      toggleSsFlip();
    }
  });

  loadTemplateCode();
  initTemplateTabs();

  renderAll();
});

// ------- 文字逃逸小工具 -------

function escapeHtml(str) {
  return String(str == null ? '' : str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function escapeAttr(str) {
  return escapeHtml(str).replace(/"/g, '&quot;');
}

// ------- 精靈式步驟切換 -------

function goToExportStep() {
  if (slideImages.filter(img => img.included).length === 0) {
    alert('請先選取至少一張圖片，並確認「納入匯出」有勾選！');
    return;
  }
  stepLabelView.classList.remove('active');
  stepExportView.classList.add('active');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function goToLabelStep() {
  stepExportView.classList.remove('active');
  stepLabelView.classList.add('active');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ------- 圖片加入 / 管理 -------

function stripExtension(filename) {
  const idx = filename.lastIndexOf('.');
  return idx > 0 ? filename.substring(0, idx) : filename;
}

function getFileExtension(filename) {
  const idx = filename.lastIndexOf('.');
  return idx > 0 ? filename.substring(idx + 1) : '';
}

// 使用者重新命名時很容易忘記加副檔名（.jpg / .png...），但 <img src="..."> 一定要跟實際檔名（含副檔名）
// 完全一致，Anki 才讀得到圖片。這裡自動幫使用者補回原始檔案的副檔名，除非他自己已經有輸入看起來像副檔名的結尾。
function ensureFileExtension(name, ext) {
  const trimmed = name.trim();
  if (!trimmed || !ext) return trimmed;
  if (/\.[a-zA-Z0-9]{1,6}$/.test(trimmed)) {
    return trimmed;
  }
  return `${trimmed}.${ext}`;
}

// 若使用者選取的多張圖片來自不同資料夾但檔名相同，加入時自動加上 _2 _3 等後綴，作為一開始的預設值
// （之後使用者仍可以在步驟二自由重新命名；若改完又跟別的檔案重複，畫面上會即時顯示警告，而不是強制改掉使用者的輸入）
function computeUniqueFilename(filename, existingImages) {
  const collisions = existingImages.filter(img => img.filename === filename).length;
  if (collisions === 0) return filename;
  const n = collisions + 1;
  const dotIdx = filename.lastIndexOf('.');
  return dotIdx > 0
    ? `${filename.substring(0, dotIdx)}_${n}${filename.substring(dotIdx)}`
    : `${filename}_${n}`;
}

function getDuplicateFilenameSet() {
  const counts = {};
  slideImages.forEach(img => {
    counts[img.filename] = (counts[img.filename] || 0) + 1;
  });
  const dupes = new Set();
  Object.keys(counts).forEach(fn => {
    if (fn && counts[fn] > 1) dupes.add(fn);
  });
  return dupes;
}

function handleFilesAdded(fileList) {
  const files = Array.from(fileList || []).filter(f => f.type.startsWith('image/'));
  if (files.length === 0) return;

  files.forEach(file => {
    const filename = computeUniqueFilename(file.name, slideImages);
    const ext = getFileExtension(file.name) || 'jpg';
    const img = {
      id: nextSlideId++,
      file,
      url: URL.createObjectURL(file),
      filename,
      ext, // 原始副檔名（不含點），重新命名時如果使用者忘記加副檔名，會自動補回這個
      notes: '',
      included: true,
      mcqQuestionText: slideSharedPrompt.value.trim() || '這張圖片顯示的是什麼？',
      mcqOptionA: stripExtension(filename),
      mcqOptionB: '',
      mcqOptionC: '',
      mcqOptionD: '',
      mcqOptionE: '',
      mcqOptionF: '',
      mcqAnswer: 'A',
      mcqIsMultiple: ''
    };
    slideImages.push(img);
  });

  if (activeSlideId === null && slideImages.length > 0) {
    activeSlideId = slideImages[0].id;
  }

  slideFileInput.value = ''; // 允許重複選取同一個檔案
  renderAll();
}

function findSlideById(id) {
  return slideImages.find(img => img.id === id);
}

window.updateSlideField = function (id, field, value) {
  const img = findSlideById(id);
  if (!img) return;

  if (field === 'filename') {
    value = ensureFileExtension(value, img.ext);
  }

  img[field] = value;

  renderSlideGrid();
  renderMcqTable();
  renderOcclusionTable();
  if (activeSlideId === id) {
    refreshMcqEditPanel();
    refreshSimulatorFromActive();
  }
};

window.removeSlideImage = function (id) {
  const img = findSlideById(id);
  if (!img) return;
  if (!confirm(`確定要移除「${img.filename}」嗎？`)) return;

  URL.revokeObjectURL(img.url);
  slideImages = slideImages.filter(i => i.id !== id);

  if (activeSlideId === id) {
    activeSlideId = slideImages.length > 0 ? slideImages[0].id : null;
  }

  renderAll();
};

window.setActiveSlidePreview = function (id) {
  activeSlideId = id;
  ssSimulatorCard.classList.remove('flipped');
  renderSlideGrid();
  renderMcqTable();
  refreshMcqEditPanel();
  refreshSimulatorFromActive();
};

function setAllIncluded(included) {
  slideImages.forEach(img => { img.included = included; });
  renderAll();
}

function clearAllSlides() {
  if (slideImages.length === 0) return;
  if (!confirm('確定要清除所有已選取的圖片嗎？')) return;
  slideImages.forEach(img => URL.revokeObjectURL(img.url));
  slideImages = [];
  activeSlideId = null;
  renderAll();
}

function applyPromptToAll() {
  if (slideImages.length === 0) return;
  const prompt = slideSharedPrompt.value.trim() || '這張圖片顯示的是什麼？';
  slideImages.forEach(img => {
    img.mcqQuestionText = prompt;
  });
  renderMcqTable();
  refreshMcqEditPanel();
  if (activeSlideId !== null) refreshSimulatorFromActive();
}

// 下載重新命名後的圖片副本（內容跟原始檔案一模一樣，只有檔名改成步驟二設定好的名稱）
function downloadRenamedImages() {
  const rows = slideImages.filter(img => img.included);
  if (rows.length === 0) {
    alert('請先選取並勾選至少一張圖片！');
    return;
  }

  rows.forEach((img, idx) => {
    setTimeout(() => {
      const link = document.createElement('a');
      link.href = img.url;
      link.download = img.filename;
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }, idx * 250); // 錯開下載時間，避免瀏覽器把連續多檔下載擋下來
  });
}

// ------- 匯出模式切換 -------

function switchMode(mode) {
  currentMode = mode;
  modeTabBtns.forEach(btn => btn.classList.toggle('active', btn.getAttribute('data-mode') === mode));
  modePanelMcq.classList.toggle('active', mode === 'mcq');
  modePanelOcclusion.classList.toggle('active', mode === 'occlusion');

  simMcqFrontBlock.style.display = mode === 'mcq' ? 'block' : 'none';
  simMcqBackBlock.style.display = mode === 'mcq' ? 'block' : 'none';
  simOccFrontBlock.style.display = mode === 'occlusion' ? 'block' : 'none';
  simOccBackBlock.style.display = mode === 'occlusion' ? 'block' : 'none';

  tplPanelMcq.style.display = mode === 'mcq' ? 'block' : 'none';
  tplPanelOcclusion.style.display = mode === 'occlusion' ? 'block' : 'none';

  refreshSimulatorFromActive();
}

// ------- 渲染 -------

function renderAll() {
  renderSlideGrid();
  renderMcqTable();
  renderOcclusionTable();
  refreshMcqEditPanel();
  refreshSimulatorFromActive();
}

function renderSlideGrid() {
  slideCount.textContent = slideImages.length;
  slideGridPanel.style.display = slideImages.length > 0 ? 'block' : 'none';

  const dupes = getDuplicateFilenameSet();

  slideGrid.innerHTML = slideImages.map(img => {
    const isDupe = dupes.has(img.filename);
    return `
    <div class="slide-card ${img.included ? '' : 'slide-card-excluded'} ${img.id === activeSlideId ? 'slide-card-active' : ''}">
      <div class="slide-thumb-wrap"><img class="slide-thumb" src="${img.url}" alt=""></div>
      <div class="slide-fields">
        <label class="slide-field-label">檔案名稱</label>
        <input type="text" class="cell-input slide-filename-input ${isDupe ? 'slide-filename-input-error' : ''}" value="${escapeAttr(img.filename)}" onchange="updateSlideField(${img.id}, 'filename', this.value)">
        ${isDupe ? '<span class="slide-filename-warning"><i class="fa-solid fa-triangle-exclamation"></i> 檔名重複，會互相覆蓋</span>' : ''}
        <label class="slide-field-label">備註</label>
        <textarea class="cell-input" rows="2" placeholder="備註 (選填)" onchange="updateSlideField(${img.id}, 'notes', this.value)">${escapeHtml(img.notes)}</textarea>
      </div>
      <div class="slide-card-actions">
        <label class="slide-include-toggle">
          <input type="checkbox" ${img.included ? 'checked' : ''} onchange="updateSlideField(${img.id}, 'included', this.checked)">
          納入匯出
        </label>
        <div class="row-actions">
          <button class="btn btn-secondary btn-xs" onclick="setActiveSlidePreview(${img.id})" title="即時模擬預覽"><i class="fa-solid fa-eye"></i></button>
          <button class="btn btn-danger-outline btn-xs" onclick="removeSlideImage(${img.id})" title="移除"><i class="fa-solid fa-trash"></i></button>
        </div>
      </div>
    </div>
  `;
  }).join('');
}

// ------- 選擇題模式：大編輯面板 -------

function populateMcqEditTypeOptions() {
  mcqEditType.innerHTML = `
    <option value="">單選題</option>
    <option value="y">多選題</option>
  `;
}

function bindMcqEditPanelEvents() {
  mcqEditQuestion.addEventListener('change', () => updateActiveMcqField('mcqQuestionText', mcqEditQuestion.value));
  mcqEditType.addEventListener('change', () => updateActiveMcqField('mcqIsMultiple', mcqEditType.value));
  mcqEditAnswer.addEventListener('change', () => updateActiveMcqField('mcqAnswer', mcqEditAnswer.value));
  mcqEditOptionA.addEventListener('change', () => updateActiveMcqField('mcqOptionA', mcqEditOptionA.value));
  mcqEditOptionB.addEventListener('change', () => updateActiveMcqField('mcqOptionB', mcqEditOptionB.value));
  mcqEditOptionC.addEventListener('change', () => updateActiveMcqField('mcqOptionC', mcqEditOptionC.value));
  mcqEditOptionD.addEventListener('change', () => updateActiveMcqField('mcqOptionD', mcqEditOptionD.value));
  mcqEditOptionE.addEventListener('change', () => updateActiveMcqField('mcqOptionE', mcqEditOptionE.value));
  mcqEditOptionF.addEventListener('change', () => updateActiveMcqField('mcqOptionF', mcqEditOptionF.value));
}

function updateActiveMcqField(field, value) {
  const img = activeSlideId !== null ? findSlideById(activeSlideId) : null;
  if (!img) return;

  if (field === 'mcqAnswer') {
    value = value.toUpperCase().replace(/[^A-F]/g, '').split('').join(', ');
  }

  img[field] = value;

  if (field === 'mcqAnswer' || field === 'mcqIsMultiple') {
    refreshMcqEditPanel(); // 讓輸入框顯示標準化後的值
  }

  renderMcqTable();
  refreshSimulatorFromActive();
}

function refreshMcqEditPanel() {
  const img = activeSlideId !== null ? findSlideById(activeSlideId) : null;

  if (!img) {
    mcqEditPanel.style.display = 'none';
    return;
  }

  mcqEditPanel.style.display = 'block';
  mcqEditThumb.src = img.url;
  mcqEditFilename.textContent = img.filename;
  mcqEditQuestion.value = img.mcqQuestionText;
  mcqEditType.value = img.mcqIsMultiple;
  mcqEditAnswer.value = img.mcqAnswer;
  mcqEditOptionA.value = img.mcqOptionA;
  mcqEditOptionB.value = img.mcqOptionB;
  mcqEditOptionC.value = img.mcqOptionC;
  mcqEditOptionD.value = img.mcqOptionD;
  mcqEditOptionE.value = img.mcqOptionE;
  mcqEditOptionF.value = img.mcqOptionF;
}

// ------- AI 產生干擾選項（一次只處理目前正在編輯的一張卡片，避免同時打太多次 API 卡住） -------

// 只鎖定 B/C/D 這三個「標準四選一」的欄位，且只補目前空白的，已經有內容的不會被覆蓋
const DISTRACTOR_TARGET_FIELDS = ['mcqOptionB', 'mcqOptionC', 'mcqOptionD'];

// 把使用者上傳的 .md 詞彙表解析成一個個詞彙：
// - 跳過純標題行（# 開頭），那通常只是分類標籤，不是實際詞彙
// - 去掉常見的清單前綴符號（- * + 或數字編號）
// - 同一行如果用逗號、頓號分隔多個詞彙，也會分開
// - 去除重複（不分大小寫）
function parseGlossaryMarkdown(text) {
  const lines = text.split(/\r?\n/);
  const seen = new Set();
  const terms = [];

  lines.forEach(rawLine => {
    let line = rawLine.trim();
    if (!line) return;
    if (/^#{1,6}\s/.test(line)) return; // 跳過標題行

    line = line.replace(/^[-*+]\s+/, '').replace(/^\d+[.、)]\s+/, '');

    // 如果這行是「類別：詞彙、詞彙」這種格式，冒號前視為分類標籤、不當作詞彙，只保留冒號後面的內容
    const colonIdx = line.search(/[:：]/);
    if (colonIdx !== -1) {
      line = line.slice(colonIdx + 1);
    }

    line.split(/[,，、]/).forEach(part => {
      const term = part.trim();
      if (!term) return;
      const key = term.toLowerCase();
      if (seen.has(key)) return;
      seen.add(key);
      terms.push(term);
    });
  });

  return terms;
}

async function handleGlossaryFileSelected(e) {
  const file = e.target.files[0];
  glossaryFileInput.value = ''; // 允許重複選取同一個檔案
  if (!file) return;

  try {
    const text = await file.text();
    distractorGlossary = parseGlossaryMarkdown(text);
    glossaryStatus.textContent = distractorGlossary.length > 0
      ? `已載入 ${distractorGlossary.length} 個詞彙（${file.name}）`
      : `「${file.name}」裡沒有解析到任何詞彙，請確認格式（一行一個詞彙，或用逗號、頓號分隔）`;
  } catch (err) {
    console.error(err);
    glossaryStatus.textContent = '讀取檔案失敗，請確認檔案格式是否正確。';
  }
}

// 從使用者上傳的詞彙表中，排除掉跟目前這張卡片正確答案重複的詞，作為干擾選項的候選清單
function getGlossaryPoolExcluding(currentImg) {
  const currentAnswer = currentImg.mcqOptionA.trim().toLowerCase();
  return distractorGlossary.filter(term => term.trim().toLowerCase() !== currentAnswer);
}

function buildDistractorPrompt(img, count, candidatePool) {
  const poolSection = candidatePool.length > 0
    ? `\n這是使用者提供的相關詞彙表（優先從裡面挑選同類別、容易混淆的項目，誘答效果通常比憑空生成更好）：\n${candidatePool.map(t => `- ${t}`).join('\n')}\n`
    : '';

  return `你是一個專業的測驗設計師。請根據以下選擇題資訊，產生 ${count} 個「錯誤但看起來合理」的干擾選項。

題目：${img.mcqQuestionText}
正確答案：${img.mcqOptionA}
${poolSection}
要求：
- 請優先從上面提供的清單中，挑選跟正確答案同類別、容易讓人混淆的項目當作干擾選項；清單中沒有足夠適合的項目時（數量不夠，或類別不符），才自己額外生成貼切的干擾選項來補足到剛好 ${count} 個。
- 干擾選項必須和正確答案屬於同一類別（例如正確答案是器官名稱，干擾選項也要是其他器官名稱；正確答案是疾病名稱，干擾選項也要是其他疾病名稱），不能是明顯無關、一看就知道是錯的內容。
- ${count} 個干擾選項彼此之間不能重複，也不能和正確答案重複或意思相同。
- 只需要簡短的名詞或詞組，不要加上 A. B. 等編號前綴，也不要附加任何說明文字。
- 輸出格式必須是純 JSON 陣列，裡面剛好包含 ${count} 個字串，不要包裹在 \`\`\`json 內，不要有其他文字。`;
}

async function callGeminiForDistractors(apiKey, model, promptText) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: promptText }] }],
      generationConfig: { responseMimeType: 'application/json' }
    })
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(errData.error?.message || `HTTP 錯誤：${response.status}`);
  }

  const data = await response.json();
  const resultText = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!resultText) {
    throw new Error('Gemini 回傳了空內容。');
  }

  const distractors = JSON.parse(resultText.trim());
  if (!Array.isArray(distractors)) {
    throw new Error('Gemini 回傳的格式不是 JSON 陣列。');
  }
  return distractors;
}

async function generateDistractorsForActiveCard() {
  const img = activeSlideId !== null ? findSlideById(activeSlideId) : null;
  if (!img) {
    alert('請先選取一張卡片！');
    return;
  }

  const apiKey = slidesGeminiApiKey.value.trim();
  if (!apiKey) {
    alert('請先輸入您的 Gemini API Key！您可以點擊輸入框右側的「獲取 Key」前往 Google AI Studio 免費申請。');
    slidesGeminiApiKey.focus();
    return;
  }

  let model = geminiModelSelect.value;
  if (model === 'custom') {
    model = geminiCustomModel.value.trim();
    if (!model) {
      alert('請輸入自訂的模型名稱！');
      geminiCustomModel.focus();
      return;
    }
  }

  if (!img.mcqOptionA.trim()) {
    alert('請先在選項 A 填入正確答案，AI 才知道要根據什麼產生干擾選項。');
    return;
  }

  const emptyFields = DISTRACTOR_TARGET_FIELDS.filter(field => !img[field].trim());
  if (emptyFields.length === 0) {
    alert('選項 B、C、D 都已經有內容了。如果想讓 AI 重新產生，請先清空想要覆蓋的欄位。');
    return;
  }

  btnGenerateDistractors.disabled = true;
  btnGenerateDistractors.classList.add('btn-loading');
  const originalHtml = btnGenerateDistractors.innerHTML;
  btnGenerateDistractors.innerHTML = '';

  try {
    const candidatePool = getGlossaryPoolExcluding(img);
    const prompt = buildDistractorPrompt(img, emptyFields.length, candidatePool);
    const distractors = await callGeminiForDistractors(apiKey, model, prompt);

    emptyFields.forEach((field, idx) => {
      if (distractors[idx]) {
        img[field] = String(distractors[idx]).trim();
      }
    });

    renderMcqTable();
    refreshMcqEditPanel();
    refreshSimulatorFromActive();
  } catch (error) {
    console.error(error);
    alert(`AI 產生干擾選項失敗：\n${error.message}\n\n請確認您的 API Key 是否正確。`);
  } finally {
    btnGenerateDistractors.disabled = false;
    btnGenerateDistractors.classList.remove('btn-loading');
    btnGenerateDistractors.innerHTML = originalHtml;
  }
}

function renderMcqTable() {
  const rows = slideImages.filter(img => img.included);
  mcqEmptyHint.style.display = rows.length > 0 ? 'none' : 'inline';

  slideMcqTableBody.innerHTML = rows.map(img => `
    <tr class="${img.id === activeSlideId ? 'table-row-active' : ''}">
      <td><img class="mcq-table-thumb" src="${img.url}" alt="" title="${escapeAttr(img.filename)}"></td>
      <td><div class="compact-question-preview">${escapeHtml(img.mcqQuestionText)}</div></td>
      <td>${img.mcqIsMultiple === 'y' ? '多選題' : '單選題'}</td>
      <td>${escapeHtml(img.mcqAnswer)}</td>
      <td>
        <div class="row-actions">
          <button class="btn btn-secondary btn-xs" onclick="setActiveSlidePreview(${img.id})" title="編輯這張卡片"><i class="fa-solid fa-pen"></i> 編輯</button>
          <button class="btn btn-danger-outline btn-xs" onclick="removeSlideImage(${img.id})" title="移除"><i class="fa-solid fa-trash"></i></button>
        </div>
      </td>
    </tr>
  `).join('');
}

function renderOcclusionTable() {
  const rows = slideImages.filter(img => img.included);
  slideOcclusionTableBody.innerHTML = rows.map(img => `
    <tr>
      <td><img class="mcq-table-thumb" src="${img.url}" alt=""></td>
      <td>${escapeHtml(img.filename)}</td>
      <td><textarea class="cell-input" rows="2" onchange="updateSlideField(${img.id}, 'notes', this.value)">${escapeHtml(img.notes)}</textarea></td>
    </tr>
  `).join('');
}

// ------- 模擬器 -------

function getSlideOptions(img) {
  return [
    { letter: 'A', text: img.mcqOptionA },
    { letter: 'B', text: img.mcqOptionB },
    { letter: 'C', text: img.mcqOptionC },
    { letter: 'D', text: img.mcqOptionD },
    { letter: 'E', text: img.mcqOptionE },
    { letter: 'F', text: img.mcqOptionF }
  ].filter(opt => opt.text);
}

// 匯出用的題目 HTML：<img> 一律參照步驟二設定好的「檔案名稱」，這是之後匯入 Anki media 資料夾要對應的檔名
function buildQuestionHtmlForExport(img) {
  return `<img src="${escapeAttr(img.filename)}"><br>${escapeHtml(img.mcqQuestionText)}`;
}

// 網頁預覽用的題目 HTML：直接用瀏覽器暫存的圖片網址，這樣才看得到縮圖（不影響匯出內容，匯出永遠用檔名）
function buildQuestionHtmlForPreview(img) {
  return `<img src="${escapeAttr(img.url)}"><br>${escapeHtml(img.mcqQuestionText)}`;
}

function refreshSimulatorFromActive() {
  const img = activeSlideId !== null ? findSlideById(activeSlideId) : null;

  if (currentMode === 'mcq') {
    refreshMcqSimulator(img);
  } else {
    refreshOcclusionSimulator(img);
  }
}

function refreshMcqSimulator(img) {
  ssSelectedLetters = [];

  if (!img) {
    ssQuestion.innerHTML = '請先選取並標記圖片';
    ssQuestionBack.innerHTML = '請先選取並標記圖片';
    ssOptionsFront.innerHTML = '';
    ssOptionsBack.innerHTML = '';
    ssCorrectAns.textContent = '-';
    ssExplanationBox.style.display = 'none';
    ssExplanationBox.classList.remove('sim-exp-correct', 'sim-exp-wrong');
    return;
  }

  const isMulti = img.mcqIsMultiple === 'y';
  const badgeText = isMulti ? '多選題' : '單選題';
  ssTypeBadge.textContent = badgeText;
  ssTypeBadgeBack.textContent = badgeText;
  ssTypeBadge.classList.toggle('multiple', isMulti);
  ssTypeBadgeBack.classList.toggle('multiple', isMulti);

  const previewQuestionHTML = buildQuestionHtmlForPreview(img);
  ssQuestion.innerHTML = previewQuestionHTML;
  ssQuestionBack.innerHTML = previewQuestionHTML;

  renderSsFrontOptions(img);
  ssCorrectAns.textContent = img.mcqAnswer;
  renderSsBackOptions(img);

  if (img.notes) {
    ssExplanationBox.style.display = 'block';
    ssExplanationContent.textContent = img.notes;
  } else {
    ssExplanationBox.style.display = 'none';
  }
  updateSsExplanationColor(img);
}

function renderSsFrontOptions(img) {
  ssOptionsFront.innerHTML = getSlideOptions(img).map(opt => `
    <button class="sim-option-btn" data-letter="${opt.letter}" onclick="toggleSsOptionSelect(this, event)">
      <span class="sim-option-prefix">${opt.letter}</span>
      <span class="sim-option-text">${escapeHtml(opt.text)}</span>
    </button>
  `).join('');
}

function renderSsBackOptions(img) {
  const correctLetters = img.mcqAnswer.toUpperCase().replace(/[^A-F]/g, '').split('');
  ssOptionsBack.innerHTML = getSlideOptions(img).map(opt => {
    const isCorrect = correctLetters.includes(opt.letter);
    const isSelected = ssSelectedLetters.includes(opt.letter);
    let cls = 'unselected';
    if (isCorrect) cls = 'correct';
    else if (isSelected) cls = 'wrong';
    return `
      <div class="sim-option-btn ${cls}" data-letter="${opt.letter}">
        <span class="sim-option-prefix">${opt.letter}</span>
        <span class="sim-option-text">${escapeHtml(opt.text)}</span>
      </div>
    `;
  }).join('');
}

function updateSsExplanationColor(img) {
  ssExplanationBox.classList.remove('sim-exp-correct', 'sim-exp-wrong');
  if (!img.notes) return;

  const correctLetters = img.mcqAnswer.toUpperCase().replace(/[^A-F]/g, '').split('');
  const isFullyCorrect = ssSelectedLetters.length === correctLetters.length &&
    correctLetters.every(l => ssSelectedLetters.includes(l));

  ssExplanationBox.classList.add(isFullyCorrect ? 'sim-exp-correct' : 'sim-exp-wrong');
}

// 正面選項點選互動：單選題換選、多選題各自獨立切換（與選擇題工具的模擬器邏輯一致）
window.toggleSsOptionSelect = function (element, event) {
  event.stopPropagation();
  const img = activeSlideId !== null ? findSlideById(activeSlideId) : null;
  if (!img) return;

  const isMulti = img.mcqIsMultiple === 'y';
  const frontOptions = Array.prototype.slice.call(ssOptionsFront.querySelectorAll('.sim-option-btn'));

  if (isMulti) {
    element.classList.toggle('selected');
  } else {
    const wasSelected = element.classList.contains('selected');
    frontOptions.forEach(o => o.classList.remove('selected'));
    if (!wasSelected) element.classList.add('selected');
  }

  ssSelectedLetters = frontOptions
    .filter(o => o.classList.contains('selected'))
    .map(o => o.getAttribute('data-letter'));

  renderSsBackOptions(img);
  updateSsExplanationColor(img);
};

// Image Occlusion 模式的模擬器預覽：只確認圖片與標題/備註文字顯示正確，遮蓋範圍需要在 Anki 裡手動設定
function refreshOcclusionSimulator(img) {
  if (!img) {
    ssOccFrontImg.removeAttribute('src');
    ssOccBackImg.removeAttribute('src');
    ssOccHeader.textContent = '請先選取圖片';
    ssOccHeaderBack.textContent = '請先選取圖片';
    ssOccExplanationBox.style.display = 'none';
    return;
  }

  ssOccFrontImg.src = img.url;
  ssOccBackImg.src = img.url;
  const header = stripExtension(img.filename);
  ssOccHeader.textContent = header;
  ssOccHeaderBack.textContent = header;

  if (img.notes) {
    ssOccExplanationBox.style.display = 'block';
    ssOccExplanationContent.textContent = img.notes;
  } else {
    ssOccExplanationBox.style.display = 'none';
  }
}

function toggleSsFlip() {
  ssSimulatorCard.classList.toggle('flipped');
}

// ------- Anki 模板程式碼（選擇題模式，跟「選擇題卡片生成器」用同一個筆記類型） -------

const mcqAnkiTemplates = {
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
  <div class="tip-text">{{#IsMultiple}}提示：可複選任意數量的選項{{/IsMultiple}}{{^IsMultiple}}提示：點選一個選項進行標記，改選其他選項會自動取代原本的選擇{{/IsMultiple}}</div>
</div>

<script>
  (function() {
    if (document.getElementById('ankigen-answer-marker')) {
      return;
    }

    var isMultiple = {{#IsMultiple}}true{{/IsMultiple}}{{^IsMultiple}}false{{/IsMultiple}};
    var options = Array.prototype.slice.call(document.querySelectorAll('.option-btn'));

    window.AnkiGenSelected = [];

    function syncSelectedState() {
      window.AnkiGenSelected = options
        .filter(function(o) { return o.classList.contains('selected'); })
        .map(function(o) { return o.getAttribute('data-option'); });
    }

    options.forEach(function(opt) {
      opt.addEventListener('click', function(e) {
        e.stopPropagation();

        if (isMultiple) {
          opt.classList.toggle('selected');
        } else {
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
</script>`,

  back: `{{FrontSide}}

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

    var correctLetters = [];
    for (var i = 0; i < answerStr.length; i++) {
      var char = answerStr.charAt(i);
      if (char >= 'A' && char <= 'F') {
        correctLetters.push(char);
      }
    }

    var selectedLetters = window.AnkiGenSelected || [];

    var isFullyCorrect = selectedLetters.length === correctLetters.length &&
      correctLetters.every(function(l) { return selectedLetters.indexOf(l) !== -1; });

    options.forEach(function(opt) {
      var letter = opt.getAttribute('data-option');
      var isCorrect = correctLetters.indexOf(letter) !== -1;
      var isSelected = selectedLetters.indexOf(letter) !== -1;

      if (isCorrect) {
        opt.classList.add('correct');
      } else if (isSelected) {
        opt.classList.add('wrong');
      } else {
        opt.classList.add('unselected');
      }
    });

    var explanationBox = document.getElementById('explanation-box');
    if (explanationBox) {
      explanationBox.classList.add(isFullyCorrect ? 'exp-correct' : 'exp-wrong');
    }
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

.question img {
  max-width: 100%;
  border-radius: 8px;
  margin-bottom: 10px;
  display: block;
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

.option-btn:hover {
  background-color: #f0f0f0;
  border-color: #cccccc;
}

.option-btn.selected {
  background-color: #e3eaf6;
  border-color: #4285f4;
}

.option-btn.selected .prefix {
  background-color: #4285f4;
  border-color: #4285f4;
  color: #ffffff;
}

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
};

function loadTemplateCode() {
  tplCodeFront.value = mcqAnkiTemplates.front;
  tplCodeBack.value = mcqAnkiTemplates.back;
  tplCodeCss.value = mcqAnkiTemplates.css;
}

function initTemplateTabs() {
  const tabBtns = tplPanelMcq.querySelectorAll('.tab-btn');
  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const tabGroup = btn.parentElement;
      tabGroup.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      const container = tabGroup.parentElement;
      container.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));

      btn.classList.add('active');
      const targetId = btn.getAttribute('data-tab');
      document.getElementById(targetId).classList.add('active');
    });
  });

  const copyBtns = tplPanelMcq.querySelectorAll('.btn-copy');
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

// ------- CSV 匯出 -------
// 統一使用逗號分隔（貨真價實的 .csv），並把每個欄位都加上雙引號escape。
// 先前用 Tab 分隔但副檔名是 .csv，Anki 匯入時可能誤判分隔符號，導致欄位對不齊、內容跑位，
// 這裡改成跟副檔名一致的逗號分隔，並確保欄位都有加上引號，讓 Anki 能穩定辨識分隔符號。

function escapeCsvField(val) {
  if (val === undefined || val === null) return '""';
  let str = String(val).trim();
  str = str.replace(/"/g, '""');
  str = str.replace(/\n/g, '<br>');
  return `"${str}"`;
}

function downloadTextAsFile(text, filename) {
  const blob = new Blob(["\ufeff" + text], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

function getFormattedDate() {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hours = String(d.getHours()).padStart(2, '0');
  const mins = String(d.getMinutes()).padStart(2, '0');
  return `${year}${month}${day}_${hours}${mins}`;
}

// 選擇題模式：欄位順序與「選擇題卡片生成器」的 Anki 筆記類型完全相同
// (Question, OptionA-F, Answer, IsMultiple, Explanation)，可以匯入同一個 Anki 筆記類型
function downloadMcqCsv() {
  const rows = slideImages.filter(img => img.included);
  if (rows.length === 0) {
    alert('請先選取並勾選至少一張圖片！');
    return;
  }

  let csvContent = '';
  rows.forEach(img => {
    const cols = [
      buildQuestionHtmlForExport(img),
      img.mcqOptionA,
      img.mcqOptionB,
      img.mcqOptionC,
      img.mcqOptionD,
      img.mcqOptionE,
      img.mcqOptionF,
      img.mcqAnswer,
      img.mcqIsMultiple,
      img.notes
    ];
    csvContent += cols.map(escapeCsvField).join(',') + '\n';
  });

  downloadTextAsFile(csvContent, `ankimed_slides_mcq_${getFormattedDate()}.csv`);
}

// Image Occlusion 模式：直接對應 Anki 內建 Image Occlusion 筆記類型的 5 個欄位
// (Occlusion, Image, Header, Back Extra, Comments)。
//
// Occlusion 是這個筆記類型的「第一欄位」，而 Anki 匯入時會用第一欄位判斷筆記是否重複／是否為空—
// 第一欄位若是空的，Anki 會直接把該列當成空白筆記整列跳過、不會匯入。所以這裡不能把 Occlusion 留空，
// 而是放一個「尚未框選」的提示文字（每一列都帶入不同的檔名，確保每列的第一欄位都不一樣，
// 避免 Anki 誤判成彼此重複而只留下第一筆）。這個欄位在正面/背面模板裡是 display:none，不會顯示在卡片上，
// 匯入後這張筆記還沒有遮蓋範圍、也還不會產生卡片，需要你在 Anki 打開這張筆記、用 Image Occlusion
// 的遮罩編輯器畫出真正的遮蓋範圍，Anki 才會把這個佔位文字換成實際的遮蓋資料並產生卡片。
function downloadOcclusionCsv() {
  const rows = slideImages.filter(img => img.included);
  if (rows.length === 0) {
    alert('請先選取並勾選至少一張圖片！');
    return;
  }

  let csvContent = '';
  rows.forEach(img => {
    const cols = [
      `尚未框選：${img.filename}`, // 1. Occlusion - 佔位文字，確保第一欄位非空且每列不重複，匯入後請在 Anki 手動框選遮蓋範圍
      `<img src="${escapeAttr(img.filename)}">`, // 2. Image
      stripExtension(img.filename), // 3. Header
      img.notes, // 4. Back Extra
      '' // 5. Comments
    ];
    csvContent += cols.map(escapeCsvField).join(',') + '\n';
  });

  downloadTextAsFile(csvContent, `ankimed_slides_image_occlusion_${getFormattedDate()}.csv`);
}
