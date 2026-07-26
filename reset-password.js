// AnkiGen - 重設密碼頁面
//
// 使用者從「忘記密碼」信件裡點連結會被導到這一頁。Supabase 的重設密碼信件
// 連結本身就帶有一組臨時的登入憑證（recovery session），supabase-js 載入時
// 會自動從網址解析出來並建立 session，我們只需要等這個 session 出現，
// 再讓使用者輸入新密碼呼叫 updateUser() 就完成了。
(function () {
  if (!window.supabase) {
    console.error('[AnkiGen] 找不到 Supabase SDK。');
    return;
  }

  const client = window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);

  function showView(name) {
    ['loading', 'invalid', 'form', 'success'].forEach((v) => {
      const el = document.getElementById(`reset-view-${v}`);
      if (el) el.style.display = v === name ? 'block' : 'none';
    });
  }

  function showError(text) {
    const el = document.getElementById('reset-form-error');
    el.textContent = text;
    el.style.display = 'block';
  }

  let recoveryHandled = false;

  function onRecoverySessionReady() {
    if (recoveryHandled) return;
    recoveryHandled = true;
    showView('form');
  }

  function onRecoverySessionMissing() {
    if (recoveryHandled) return;
    recoveryHandled = true;
    const el = document.getElementById('reset-invalid-error');
    el.textContent = '這個重設密碼連結無效或已過期。';
    showView('invalid');
  }

  client.auth.onAuthStateChange((event, session) => {
    if (session && (event === 'PASSWORD_RECOVERY' || event === 'SIGNED_IN')) {
      onRecoverySessionReady();
    }
  });

  // 保險機制：如果 3 秒內都沒有收到上面的事件（例如連結本身就是壞的），
  // 直接查一次目前的 session 狀態來判斷，並顯示對應畫面。
  setTimeout(async () => {
    if (recoveryHandled) return;
    const { data: { session } } = await client.auth.getSession();
    if (session) {
      onRecoverySessionReady();
    } else {
      onRecoverySessionMissing();
    }
  }, 3000);

  const submit = async () => {
    const newPassword = document.getElementById('reset-password').value;
    const confirmPassword = document.getElementById('reset-password-confirm').value;
    if (!newPassword || newPassword.length < 6) {
      showError('新密碼至少需要 6 碼');
      return;
    }
    if (newPassword !== confirmPassword) {
      showError('兩次輸入的新密碼不一致');
      return;
    }
    const submitBtn = document.getElementById('reset-submit');
    submitBtn.disabled = true;
    const { error } = await client.auth.updateUser({ password: newPassword });
    submitBtn.disabled = false;
    if (error) {
      showError(`密碼更新失敗：${error.message}`);
      return;
    }
    showView('success');
  };

  document.getElementById('reset-submit').addEventListener('click', submit);
  document.getElementById('reset-password-confirm').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') submit();
  });
})();
