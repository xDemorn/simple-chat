(() => {
  // ── DOM refs ──────────────────────────────────────────────────────────────
  const joinScreen    = document.getElementById('join-screen');
  const chatScreen    = document.getElementById('chat-screen');
  const usernameInput = document.getElementById('username-input');
  const joinBtn       = document.getElementById('join-btn');
  const messagesEl    = document.getElementById('messages');
  const messageForm   = document.getElementById('message-form');
  const messageInput  = document.getElementById('message-input');
  const userList      = document.getElementById('user-list');
  const statusDot     = document.getElementById('status-dot');

  let ws       = null;
  let username = '';

  // ── Join ──────────────────────────────────────────────────────────────────
  function join() {
    const name = usernameInput.value.trim();
    if (!name) { usernameInput.focus(); return; }
    username = name;

    joinScreen.classList.add('hidden');
    chatScreen.classList.remove('hidden');
    messageInput.focus();

    connect();
  }

  joinBtn.addEventListener('click', join);
  usernameInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') join();
  });

  // ── WebSocket ─────────────────────────────────────────────────────────────
  function connect() {
    const protocol = location.protocol === 'https:' ? 'wss' : 'ws';
    ws = new WebSocket(`${protocol}://${location.host}`);

    ws.addEventListener('open', () => {
      setStatus('connected');
      send({ type: 'join', username });
    });

    ws.addEventListener('message', ({ data }) => {
      let msg;
      try { msg = JSON.parse(data); } catch { return; }
      handleMessage(msg);
    });

    ws.addEventListener('close', () => {
      setStatus('disconnected');
      appendSystem('Disconnected from server. Reconnecting in 3 s…');
      setTimeout(connect, 3000);
    });

    ws.addEventListener('error', () => ws.close());
  }

  function send(obj) {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(obj));
    }
  }

  // ── Message handling ──────────────────────────────────────────────────────
  function handleMessage(msg) {
    switch (msg.type) {
      case 'message':
        appendMessage(msg);
        break;
      case 'system':
        appendSystem(msg.text);
        break;
      case 'users':
        renderUsers(msg.users);
        break;
    }
  }

  function appendMessage({ username: sender, text, timestamp }) {
    const isOwn = sender === username;
    const time  = timestamp ? new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';

    const div = document.createElement('div');
    div.className = `msg ${isOwn ? 'own' : 'other'}`;
    div.innerHTML = `
      <span class="meta">${isOwn ? '' : escHtml(sender) + ' · '}${time}</span>
      <span class="bubble">${escHtml(text)}</span>
    `;
    messagesEl.appendChild(div);
    scrollToBottom();
  }

  function appendSystem(text) {
    const div = document.createElement('div');
    div.className = 'msg system';
    div.innerHTML = `<span class="bubble">${escHtml(text)}</span>`;
    messagesEl.appendChild(div);
    scrollToBottom();
  }

  function renderUsers(users) {
    userList.innerHTML = '';
    users.forEach((name) => {
      const li = document.createElement('li');
      li.textContent = name;
      userList.appendChild(li);
    });
  }

  // ── Send message ──────────────────────────────────────────────────────────
  messageForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const text = messageInput.value.trim();
    if (!text) return;
    send({ type: 'message', text });
    messageInput.value = '';
    messageInput.focus();
  });

  // ── Helpers ───────────────────────────────────────────────────────────────
  function setStatus(state) {
    statusDot.className = '';
    statusDot.classList.add(state);
    statusDot.title = state.charAt(0).toUpperCase() + state.slice(1);
  }

  function scrollToBottom() {
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  function escHtml(str) {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
})();
