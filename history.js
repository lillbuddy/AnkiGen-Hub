// AnkiGen - 歷史紀錄頁面邏輯

const SOURCE_LABELS = {
  'mcq': { label: '選擇題卡片', badgeClass: '' },
  'slides-mcq': { label: '圖片選擇題', badgeClass: '' },
  'slides-occlusion': { label: 'Image Occlusion', badgeClass: 'source-occlusion' }
};

const historyList = document.getElementById('history-list');
const historyCount = document.getElementById('history-count');
const historyEmptyState = document.getElementById('history-empty-state');
const historyLoginRequired = document.getElementById('history-login-required');
const btnClearAllHistory = document.getElementById('btn-clear-all-history');

document.addEventListener('DOMContentLoaded', () => {
  btnClearAllHistory.addEventListener('click', clearAllHistory);
  window.AnkiGenAuth.onAuthChange(session => {
    if (session) {
      loadAndRenderHistory();
    } else {
      showLoginRequiredState();
    }
  });
});

function escapeHtml(str) {
  return String(str == null ? '' : str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function formatDate(isoString) {
  const d = new Date(isoString);
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}/${pad(d.getMonth() + 1)}/${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function showLoginRequiredState() {
  historyLoginRequired.style.display = 'flex';
  historyEmptyState.style.display = 'none';
  historyList.innerHTML = '';
  historyCount.textContent = '0';
}

async function loadAndRenderHistory() {
  historyLoginRequired.style.display = 'none';
  const records = await AnkiGenHistory.getAllRecords();
  historyCount.textContent = records.length;
  historyEmptyState.style.display = records.length === 0 ? 'flex' : 'none';
  historyList.innerHTML = records.map(renderHistoryItem).join('');
}

function renderHistoryItem(record) {
  const sourceInfo = SOURCE_LABELS[record.source] || { label: record.source, badgeClass: '' };
  // 新版紀錄用 cards（含縮圖預覽 + 逐張卡片設計）；沒有 cards 的是純文字紀錄或沒有圖片的選擇題卡片
  const hasCards = (record.cards || []).length > 0;
  const hasPurpose = !!(record.purpose && record.purpose.trim());
  const purposeText = hasPurpose ? escapeHtml(record.purpose) : '（無備註）';
  const purposeClass = hasPurpose ? 'history-purpose' : 'history-purpose history-purpose-empty';

  return `
    <div class="history-item" data-id="${record.id}">
      <div class="history-item-main">
        <div class="history-item-top">
          <span class="history-source-badge ${sourceInfo.badgeClass}">${sourceInfo.label}</span>
          <span class="history-date">${formatDate(record.createdAt)}</span>
        </div>
        <div class="${purposeClass}">${purposeText}</div>
        <div class="history-meta">${record.cardCount} 張卡片</div>
      </div>
      <div class="history-item-actions">
        ${hasCards ? `<a class="btn btn-secondary btn-sm" href="history-review.html?id=${record.id}"><i class="fa-solid fa-eye"></i> 查看設計</a>` : ''}
        <button class="btn btn-secondary btn-sm" onclick="downloadHistoryCsv('${record.id}')">
          <i class="fa-solid fa-file-csv"></i> 下載 CSV
        </button>
        <button class="btn btn-danger-outline btn-sm" onclick="deleteHistoryRecord('${record.id}')" title="刪除">
          <i class="fa-solid fa-trash"></i>
        </button>
      </div>
    </div>
  `;
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

// 下載 CSV 文字內容。有圖片的紀錄要下載原始畫質圖片，請進「查看設計」頁面。
window.downloadHistoryCsv = async function (id) {
  const records = await AnkiGenHistory.getAllRecords();
  const record = records.find(r => r.id === id);
  if (!record) return;
  downloadBlob(new Blob(["\ufeff" + record.csvContent], { type: 'text/csv;charset=utf-8;' }), record.csvFilename);
};

window.deleteHistoryRecord = async function (id) {
  if (!confirm('確定要刪除這筆歷史紀錄嗎？刪除後無法復原。')) return;
  await AnkiGenHistory.deleteRecord(id);
  loadAndRenderHistory();
};

async function clearAllHistory() {
  const records = await AnkiGenHistory.getAllRecords();
  if (records.length === 0) return;
  if (!confirm(`確定要清除全部 ${records.length} 筆歷史紀錄嗎？刪除後無法復原。`)) return;
  await Promise.all(records.map(r => AnkiGenHistory.deleteRecord(r.id)));
  loadAndRenderHistory();
}
