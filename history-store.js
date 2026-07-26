// AnkiGen - 歷史紀錄共用儲存模組
//
// 這份紀錄存在 Supabase（雲端 Postgres + Storage），不是瀏覽器本機，所以登入
// 同一個帳號後，換裝置、換瀏覽器都看得到一樣的歷史紀錄；圖片會同時保留完整
// 畫質的原始檔和縮小過的預覽圖。存取都需要先登入（見 auth-ui.js），沒有
// 登入的存取會被 Supabase 的 Row Level Security 擋下來。
//
// mcq.html / slides.html 呼叫 AnkiGenHistory.saveRecord(...) 把匯出內容存進來，
// history.html 呼叫 getAllRecords() / deleteRecord() 讀取、刪除。
const AnkiGenHistory = (function () {
  const TABLE_NAME = 'history_records';
  const BUCKET_NAME = 'history-media';

  function getClient() {
    if (!window.supabaseClient) {
      throw new Error('Supabase 尚未設定完成，請確認 supabase-config.js 已填入正確的 URL 和 anon key');
    }
    return window.supabaseClient;
  }

  function uuidv4() {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  }

  async function requireSession() {
    const client = getClient();
    const { data: { session }, error } = await client.auth.getSession();
    if (error) throw error;
    if (!session) throw new Error('請先登入才能存取歷史紀錄');
    return session;
  }

  function getFileExtension(file) {
    const name = (file && file.name) || '';
    const dotIndex = name.lastIndexOf('.');
    if (dotIndex !== -1 && dotIndex < name.length - 1) return name.slice(dotIndex + 1);
    if (file && file.type && file.type.includes('/')) return file.type.split('/')[1];
    return 'bin';
  }

  async function uploadCardMedia(client, userId, recordId, cards) {
    const uploadedPaths = [];
    try {
      const preparedCards = [];
      for (let i = 0; i < cards.length; i++) {
        const card = cards[i];
        const { previewBlob, originalBlob, ...rest } = card;
        const prepared = { ...rest };

        if (previewBlob) {
          const previewPath = `${userId}/${recordId}/${i}-preview.jpg`;
          const { error } = await client.storage.from(BUCKET_NAME).upload(previewPath, previewBlob, {
            contentType: 'image/jpeg'
          });
          if (error) throw error;
          uploadedPaths.push(previewPath);
          prepared.previewPath = previewPath;
        }

        if (originalBlob) {
          const ext = getFileExtension(originalBlob);
          const originalPath = `${userId}/${recordId}/${i}-original.${ext}`;
          const { error } = await client.storage.from(BUCKET_NAME).upload(originalPath, originalBlob, {
            contentType: originalBlob.type || 'application/octet-stream'
          });
          if (error) throw error;
          uploadedPaths.push(originalPath);
          prepared.originalPath = originalPath;
        }

        preparedCards.push(prepared);
      }
      return preparedCards;
    } catch (error) {
      if (uploadedPaths.length > 0) {
        await client.storage.from(BUCKET_NAME).remove(uploadedPaths).catch(() => {});
      }
      throw error;
    }
  }

  // record: { source, purpose, cardCount, csvFilename, csvContent, cards?: [{ filename, previewBlob?, originalBlob?, ...其他欄位 }] }
  async function saveRecord(record) {
    const client = getClient();
    const session = await requireSession();
    const userId = session.user.id;
    const recordId = uuidv4();

    const cards = record.cards && record.cards.length > 0
      ? await uploadCardMedia(client, userId, recordId, record.cards)
      : [];

    const { error } = await client.from(TABLE_NAME).insert({
      id: recordId,
      user_id: userId,
      source: record.source,
      purpose: record.purpose || '',
      card_count: record.cardCount || 0,
      csv_filename: record.csvFilename,
      csv_content: record.csvContent,
      cards
    });
    if (error) throw error;

    return recordId;
  }

  function rowToRecord(row) {
    return {
      id: row.id,
      source: row.source,
      purpose: row.purpose,
      cardCount: row.card_count,
      csvFilename: row.csv_filename,
      csvContent: row.csv_content,
      cards: row.cards || [],
      createdAt: row.created_at
    };
  }

  async function getAllRecords() {
    const client = getClient();
    await requireSession();
    const { data, error } = await client
      .from(TABLE_NAME)
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data || []).map(rowToRecord);
  }

  async function deleteRecord(id) {
    const client = getClient();
    await requireSession();

    const { data: row, error: fetchError } = await client
      .from(TABLE_NAME)
      .select('cards')
      .eq('id', id)
      .single();
    if (fetchError) throw fetchError;

    const paths = (row.cards || []).flatMap(card => [card.previewPath, card.originalPath].filter(Boolean));
    if (paths.length > 0) {
      await client.storage.from(BUCKET_NAME).remove(paths).catch(() => {});
    }

    const { error } = await client.from(TABLE_NAME).delete().eq('id', id);
    if (error) throw error;
  }

  async function getSignedUrls(paths) {
    if (!paths || paths.length === 0) return {};
    const client = getClient();
    const { data, error } = await client.storage.from(BUCKET_NAME).createSignedUrls(paths, 3600);
    if (error) throw error;
    const map = {};
    (data || []).forEach((entry, i) => {
      if (entry && entry.signedUrl) map[paths[i]] = entry.signedUrl;
    });
    return map;
  }

  return { saveRecord, getAllRecords, deleteRecord, getSignedUrls };
})();
