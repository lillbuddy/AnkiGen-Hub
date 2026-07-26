// AnkiGen - 登入狀態小工具 (共用元件)
//
// 負責：建立 Supabase client (window.supabaseClient)、在 header 顯示登入狀態、
// 提供登入/登出面板，以及「忘記密碼」時寄送重設密碼連結。
// 免費版 Supabase 不能自訂 Email Template 內容，所以這裡沒有做「輸入驗證碼」
// 的介面，而是用 Supabase 內建就有的「重設密碼」信件連結：使用者點了信件裡
// 的連結後，會被導到 reset-password.html 設定新密碼（見該檔案）。
// history-store.js 存取資料前都需要先登入，這裡就是讓使用者登入的地方。
(function () {
  // 忘記密碼信件裡的連結，會把使用者導回這個網址設定新密碼。
  // 必須和 Supabase 後台 Authentication -> URL Configuration -> Redirect URLs
  // 白名單裡登記的網址一致，否則 resetPasswordForEmail 會失敗。
  const RESET_PASSWORD_REDIRECT_URL = 'https://anki-gen-hub.vercel.app/reset-password.html';

  function escapeHtml(str) {
    return String(str == null ? '' : str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  if (!window.SUPABASE_URL || !window.SUPABASE_ANON_KEY || window.SUPABASE_URL.includes('your-project-ref')) {
    console.warn('[AnkiGen] supabase-config.js 尚未填入真實的 SUPABASE_URL / SUPABASE_ANON_KEY，歷史紀錄功能暫時無法使用。');
  }
  if (!window.supabase) {
    console.error('[AnkiGen] 找不到 Supabase SDK，請確認 supabase-js 的 <script> 有在 supabase-config.js 之前載入。');
    return;
  }

  const client = window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);
  window.supabaseClient = client;

  const changeListeners = [];
  // undefined = 尚未確定登入狀態；null = 已確定未登入；物件 = 已登入的 session。
  // 之所以要記住這個狀態，是因為 getSession()/onAuthStateChange 是非同步的，
  // 其他頁面（history.js/history-review.js）的 DOMContentLoaded 監聽器不保證
  // 在這裡的第一次狀態確定「之前」就註冊完成，所以新訂閱者要能立刻拿到目前已知的狀態，
  // 不能只靠「之後才會發生的事件」。
  let knownSession;

  function notifyChange(session) {
    knownSession = session;
    changeListeners.forEach(fn => fn(session));
  }

  function renderAuthStatus(session) {
    const el = document.getElementById('auth-status');
    if (!el) return;
    if (session) {
      el.innerHTML = `<span class="auth-status-text"><i class="fa-solid fa-circle-check"></i> ${escapeHtml(session.user.email)}</span> <a href="#" id="auth-logout-link" class="nav-home-link">登出</a>`;
      const logoutLink = document.getElementById('auth-logout-link');
      logoutLink.addEventListener('click', async (e) => {
        e.preventDefault();
        await client.auth.signOut();
      });
    } else {
      el.innerHTML = `<a href="#" id="auth-login-link" class="nav-home-link"><i class="fa-solid fa-right-to-bracket"></i> 登入</a>`;
      document.getElementById('auth-login-link').addEventListener('click', (e) => {
        e.preventDefault();
        showLoginPanel();
      });
    }
  }

  function showLoginPanel() {
    const overlay = document.getElementById('auth-login-overlay');
    if (overlay) overlay.style.display = 'flex';
    showView('login');
  }

  function hideLoginPanel() {
    const overlay = document.getElementById('auth-login-overlay');
    if (overlay) overlay.style.display = 'none';
  }

  // 切換面板內顯示的區塊：login / forgot-request（輸入 email 寄重設密碼連結）
  function showView(name) {
    ['login', 'forgot-request'].forEach((v) => {
      const section = document.getElementById(`auth-view-${v}`);
      if (section) section.style.display = v === name ? 'block' : 'none';
      const errorEl = document.getElementById(`auth-${v}-error`);
      if (errorEl) errorEl.style.display = 'none';
      const infoEl = document.getElementById(`auth-${v}-info`);
      if (infoEl) infoEl.style.display = 'none';
    });
  }

  function showMessage(view, type, text) {
    const el = document.getElementById(`auth-${view}-${type}`);
    if (!el) return;
    el.textContent = text;
    el.style.display = 'block';
  }

  function injectDom() {
    const appDesc = document.querySelector('.app-desc');
    if (appDesc && !document.getElementById('auth-status')) {
      const span = document.createElement('span');
      span.id = 'auth-status';
      span.className = 'auth-status';
      appDesc.insertBefore(span, appDesc.children[1] || null);
    }

    if (!document.getElementById('auth-login-overlay')) {
      const overlay = document.createElement('div');
      overlay.id = 'auth-login-overlay';
      overlay.className = 'auth-login-overlay';
      overlay.innerHTML = `
        <div class="card-panel auth-login-panel">
          <div class="panel-header">
            <h2><i class="fa-solid fa-lock"></i> 登入</h2>
            <button type="button" id="auth-login-close" class="btn btn-secondary btn-sm"><i class="fa-solid fa-xmark"></i></button>
          </div>
          <div class="panel-body">

            <div id="auth-view-login">
              <div class="notice-box">
                <i class="fa-solid fa-circle-info"></i>
                <div>歷史紀錄存在你自己的 Supabase 帳號裡，需要登入才能查看或新增，避免網址外流後被別人看到或動到你的資料。</div>
              </div>
              <div id="auth-login-error" class="auth-login-error" style="display:none;"></div>
              <input type="email" id="auth-login-email" class="cell-input auth-field" placeholder="Email" autocomplete="username">
              <input type="password" id="auth-login-password" class="cell-input auth-field" placeholder="密碼" autocomplete="current-password">
              <button type="button" id="auth-login-submit" class="btn btn-primary auth-login-submit">登入</button>
              <a href="#" id="auth-forgot-link" class="auth-inline-link">忘記密碼？</a>
            </div>

            <div id="auth-view-forgot-request" style="display:none;">
              <div class="notice-box">
                <i class="fa-solid fa-circle-info"></i>
                <div>輸入登入用的 Email，我們會寄出一封「重設密碼」信件，信裡的連結會帶你回來設定新密碼。</div>
              </div>
              <div id="auth-forgot-request-error" class="auth-login-error" style="display:none;"></div>
              <div id="auth-forgot-request-info" class="auth-login-info" style="display:none;"></div>
              <input type="email" id="auth-forgot-email" class="cell-input auth-field" placeholder="Email" autocomplete="username">
              <button type="button" id="auth-forgot-send" class="btn btn-primary auth-login-submit">寄送重設密碼連結</button>
              <a href="#" id="auth-forgot-back-1" class="auth-inline-link">返回登入</a>
            </div>

          </div>
        </div>
      `;
      document.body.appendChild(overlay);

      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) hideLoginPanel();
      });
      document.getElementById('auth-login-close').addEventListener('click', hideLoginPanel);

      // --- 登入 ---
      const submitLogin = async () => {
        const email = document.getElementById('auth-login-email').value.trim();
        const password = document.getElementById('auth-login-password').value;
        if (!email || !password) {
          showMessage('login', 'error', '請輸入 Email 和密碼');
          return;
        }
        const { error } = await client.auth.signInWithPassword({ email, password });
        if (error) {
          showMessage('login', 'error', `登入失敗：${error.message}`);
        }
      };
      document.getElementById('auth-login-submit').addEventListener('click', submitLogin);
      document.getElementById('auth-login-password').addEventListener('keydown', (e) => {
        if (e.key === 'Enter') submitLogin();
      });

      // --- 忘記密碼：寄送重設密碼連結 ---
      document.getElementById('auth-forgot-link').addEventListener('click', (e) => {
        e.preventDefault();
        const prefill = document.getElementById('auth-login-email').value.trim();
        document.getElementById('auth-forgot-email').value = prefill;
        showView('forgot-request');
      });
      document.getElementById('auth-forgot-back-1').addEventListener('click', (e) => {
        e.preventDefault();
        showView('login');
      });

      const sendResetLink = async () => {
        const email = document.getElementById('auth-forgot-email').value.trim();
        if (!email) {
          showMessage('forgot-request', 'error', '請輸入 Email');
          return;
        }
        const sendBtn = document.getElementById('auth-forgot-send');
        sendBtn.disabled = true;
        const { error } = await client.auth.resetPasswordForEmail(email, {
          redirectTo: RESET_PASSWORD_REDIRECT_URL
        });
        sendBtn.disabled = false;
        if (error) {
          showMessage('forgot-request', 'error', `寄送失敗：${error.message}`);
          return;
        }
        showMessage('forgot-request', 'info', `已寄出重設密碼信件到 ${email}，請檢查信箱（含垃圾郵件匣）並點擊信中的連結。`);
      };
      document.getElementById('auth-forgot-send').addEventListener('click', sendResetLink);
      document.getElementById('auth-forgot-email').addEventListener('keydown', (e) => {
        if (e.key === 'Enter') sendResetLink();
      });
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    injectDom();

    client.auth.getSession().then(({ data: { session } }) => {
      renderAuthStatus(session);
      notifyChange(session);
    });

    client.auth.onAuthStateChange((_event, session) => {
      renderAuthStatus(session);
      if (session) hideLoginPanel();
      notifyChange(session);
    });
  });

  window.AnkiGenAuth = {
    getSession: () => client.auth.getSession(),
    onAuthChange: (fn) => {
      changeListeners.push(fn);
      if (knownSession !== undefined) fn(knownSession);
    },
    showLoginPanel
  };
})();
