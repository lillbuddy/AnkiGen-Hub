// AnkiGen - 查看歷史紀錄設計 頁面邏輯

const SOURCE_LABELS = {
  'mcq': '選擇題卡片',
  'slides-mcq': '圖片選擇題',
  'slides-occlusion': 'Image Occlusion'
};

const reviewTitle = document.getElementById('review-title');
const reviewMeta = document.getElementById('review-meta');
const reviewGrid = document.getElementById('review-grid');
const reviewNotFound = document.getElementById('review-not-found');
const reviewLoginRequired = document.getElementById('review-login-required');
const btnReviewDownloadCsv = document.getElementById('btn-review-download-csv');

function escapeHtml(str) {
  return String(str == null ? '' : str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function formatDate(isoString) {
  const d = new Date(isoString);
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}/${pad(d.getMonth() + 1)}/${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function getSlideOptions(card) {
  return [
    { letter: 'A', text: card.optionA },
    { letter: 'B', text: card.optionB },
    { letter: 'C', text: card.optionC },
    { letter: 'D', text: card.optionD },
    { letter: 'E', text: card.optionE },
    { letter: 'F', text: card.optionF }
  ].filter(opt => opt.text);
}

function renderOriginalLink(card) {
  if (!card.originalUrl) return '';
  return `<a class="review-card-original-link" href="${card.originalUrl}" download="${escapeHtml(card.filename)}"><i class="fa-solid fa-download"></i> 下載原始圖片</a>`;
}

function renderMcqCard(card) {
  const correctLetters = (card.answer || '').toUpperCase().replace(/[^A-F]/g, '').split('');
  const thumbSrc = card.previewUrl || '';

  const optionsHtml = getSlideOptions(card).map(opt => {
    const isCorrect = correctLetters.includes(opt.letter);
    return `<div class="review-card-option ${isCorrect ? 'review-option-correct' : ''}">${opt.letter}. ${escapeHtml(opt.text)}</div>`;
  }).join('');

  return `
    <div class="review-card">
      <img class="review-card-thumb" src="${thumbSrc}" alt="${escapeHtml(card.filename)}">
      <div class="review-card-body">
        <div class="review-card-question">${escapeHtml(card.questionText)}</div>
        <div class="review-card-options">${optionsHtml}</div>
        ${card.notes ? `<div class="review-card-notes">${escapeHtml(card.notes)}</div>` : ''}
        ${renderOriginalLink(card)}
      </div>
    </div>
  `;
}

function renderOcclusionCard(card) {
  const thumbSrc = card.previewUrl || '';

  return `
    <div class="review-card">
      <img class="review-card-thumb" src="${thumbSrc}" alt="${escapeHtml(card.filename)}">
      <div class="review-card-body">
        <div class="review-card-question">${escapeHtml(card.filename)}</div>
        ${card.notes ? `<div class="review-card-notes">${escapeHtml(card.notes)}</div>` : '<div class="review-card-notes">（無備註）</div>'}
        ${renderOriginalLink(card)}
      </div>
    </div>
  `;
}

async function attachSignedUrls(cards) {
  const paths = [];
  cards.forEach(card => {
    if (card.previewPath) paths.push(card.previewPath);
    if (card.originalPath) paths.push(card.originalPath);
  });
  const urlMap = await AnkiGenHistory.getSignedUrls(paths);
  cards.forEach(card => {
    card.previewUrl = card.previewPath ? urlMap[card.previewPath] : null;
    card.originalUrl = card.originalPath ? urlMap[card.originalPath] : null;
  });
}

async function renderReview() {
  reviewLoginRequired.style.display = 'none';
  reviewNotFound.style.display = 'none';

  const params = new URLSearchParams(window.location.search);
  const id = params.get('id');

  const records = await AnkiGenHistory.getAllRecords();
  const record = records.find(r => r.id === id);

  if (!record) {
    reviewNotFound.style.display = 'block';
    reviewMeta.style.display = 'none';
    reviewGrid.innerHTML = '';
    btnReviewDownloadCsv.style.display = 'none';
    return;
  }

  reviewMeta.style.display = '';
  btnReviewDownloadCsv.style.display = '';

  const sourceLabel = SOURCE_LABELS[record.source] || record.source;
  reviewTitle.textContent = `查看設計：${sourceLabel}`;
  reviewMeta.innerHTML = `
    <span>${formatDate(record.createdAt)}</span>
    <span>${escapeHtml(record.purpose && record.purpose.trim() ? record.purpose : '（無備註）')}</span>
    <span>${record.cardCount} 張卡片</span>
  `;

  btnReviewDownloadCsv.onclick = () => {
    downloadBlob(new Blob(["\ufeff" + record.csvContent], { type: 'text/csv;charset=utf-8;' }), record.csvFilename);
  };

  const cards = record.cards || [];
  await attachSignedUrls(cards);
  const renderCard = record.source === 'slides-occlusion' ? renderOcclusionCard : renderMcqCard;
  reviewGrid.innerHTML = cards.map(renderCard).join('');
}

function showLoginRequiredState() {
  reviewLoginRequired.style.display = 'flex';
  reviewNotFound.style.display = 'none';
  reviewMeta.style.display = 'none';
  reviewGrid.innerHTML = '';
  btnReviewDownloadCsv.style.display = 'none';
}

document.addEventListener('DOMContentLoaded', () => {
  window.AnkiGenAuth.onAuthChange(session => {
    if (session) {
      renderReview();
    } else {
      showLoginRequiredState();
    }
  });
});
