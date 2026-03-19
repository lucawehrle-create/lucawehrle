// --- State ---
let ws = null;
let autoScroll = true;
let currentChatId = null;

// --- DOM ---
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

// --- WebSocket ---
function connectWS() {
  const proto = location.protocol === 'https:' ? 'wss' : 'ws';
  ws = new WebSocket(`${proto}://${location.host}`);

  ws.onopen = () => pollStatus();

  ws.onmessage = (event) => {
    const data = JSON.parse(event.data);
    if (data.type === 'init') {
      data.logs.forEach(addLogEntry);
    } else if (data.type === 'log') {
      addLogEntry(data.entry);
    } else if (data.type === 'clear') {
      $('#log-feed').innerHTML = '<div class="empty-state">Logs gel\u00f6scht</div>';
    }
  };

  ws.onclose = () => {
    setTimeout(connectWS, 3000);
  };
}

// --- Media Rendering ---
function renderMedia(mediaType, mediaPath) {
  if (!mediaType || !mediaPath) return '';

  // Pfad zu URL konvertieren (data/media/... -> /media/...)
  const url = '/' + mediaPath.replace(/^data\//, '');

  if (mediaType === 'image' || mediaType === 'sticker') {
    return `<div class="media-preview"><img src="${url}" alt="Bild" loading="lazy" onclick="window.open('${url}','_blank')"></div>`;
  }
  if (mediaType === 'video') {
    return `<div class="media-preview"><video src="${url}" controls preload="metadata"></video></div>`;
  }
  if (mediaType === 'audio') {
    return `<div class="media-preview"><audio src="${url}" controls preload="metadata"></audio></div>`;
  }
  return '';
}

function mediaIcon(mediaType) {
  const icons = { image: '\u{1F5BC}\uFE0F', video: '\u{1F3AC}', audio: '\u{1F3A4}', sticker: '\u{1F3AD}' };
  return icons[mediaType] || '';
}

// --- Log Feed ---
function addLogEntry(entry) {
  const feed = $('#log-feed');
  const empty = feed.querySelector('.empty-state');
  if (empty) empty.remove();

  const div = document.createElement('div');
  div.className = `log-entry ${entry.type}`;

  const time = new Date(entry.timestamp).toLocaleTimeString('de-DE');
  const icons = { incoming: '\u{1F4E8}', outgoing: '\u{1F4E4}', system: '\u{2699}\uFE0F', error: '\u{274C}' };

  let meta = '';
  if (entry.chatName || entry.senderName) {
    const who = entry.senderName || entry.chatName;
    const mediaTag = entry.mediaType ? ` ${mediaIcon(entry.mediaType)}` : '';
    meta = `<div class="log-meta">
      <span><span class="log-sender">${icons[entry.type] || ''} ${escapeHtml(who)}${mediaTag}</span>${entry.chatName && entry.senderName ? ` in ${escapeHtml(entry.chatName)}` : ''}</span>
      <span>${time}</span>
    </div>`;
  } else {
    meta = `<div class="log-meta"><span>${icons[entry.type] || ''}</span><span>${time}</span></div>`;
  }

  const mediaHtml = renderMedia(entry.mediaType, entry.mediaPath);
  div.innerHTML = `${meta}${mediaHtml}<div class="log-text">${escapeHtml(entry.text)}</div>`;
  feed.appendChild(div);

  if (autoScroll) {
    feed.scrollTop = feed.scrollHeight;
  }
}

// --- Status Polling ---
async function pollStatus() {
  try {
    const res = await fetch('/api/status');
    const status = await res.json();
    const el = $('#status');
    const text = $('#status-text');

    if (status.connected) {
      el.className = 'status online';
      text.textContent = `Verbunden als ${status.name || 'Unbekannt'}`;
    } else {
      el.className = 'status offline';
      text.textContent = 'Nicht verbunden';
    }
  } catch { /* ignore */ }
  setTimeout(pollStatus, 5000);
}

// --- Settings ---
async function loadSettings() {
  const res = await fetch('/api/config');
  const config = await res.json();

  $('#systemPrompt').value = config.systemPrompt || '';
  $('#claudeModel').value = config.claudeModel || 'claude-sonnet-4-20250514';
  $('#maxHistory').value = config.maxHistory || 20;
  $('#autoReplyEnabled').checked = config.autoReplyEnabled ?? true;
  $('#replyDelaySeconds').value = config.replyDelaySeconds ?? 3;
  $('#groupsOnlyWhenMentioned').checked = config.groupsOnlyWhenMentioned ?? true;
  $('#allowedChats').value = (config.allowedChats || []).join(', ');
  $('#blockedChats').value = (config.blockedChats || []).join(', ');
}

async function saveSettings(e) {
  e.preventDefault();

  const parseList = (val) => val.split(',').map(s => s.trim()).filter(Boolean);

  const config = {
    systemPrompt: $('#systemPrompt').value,
    claudeModel: $('#claudeModel').value,
    maxHistory: parseInt($('#maxHistory').value, 10),
    autoReplyEnabled: $('#autoReplyEnabled').checked,
    replyDelaySeconds: parseInt($('#replyDelaySeconds').value, 10),
    groupsOnlyWhenMentioned: $('#groupsOnlyWhenMentioned').checked,
    allowedChats: parseList($('#allowedChats').value),
    blockedChats: parseList($('#blockedChats').value),
  };

  await fetch('/api/config', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(config),
  });

  const status = $('#save-status');
  status.textContent = 'Gespeichert!';
  status.classList.add('visible');
  setTimeout(() => status.classList.remove('visible'), 2000);
}

// --- Chats ---
async function loadChats() {
  const res = await fetch('/api/chats');
  const chats = await res.json();
  const list = $('#chat-list');

  if (chats.length === 0) {
    list.innerHTML = '<div class="empty-state">Noch keine Chats</div>';
    return;
  }

  // Chat-Settings für alle laden
  const settingsMap = {};
  await Promise.all(chats.map(async (chat) => {
    try {
      const r = await fetch(`/api/chats/${encodeURIComponent(chat.chatId)}/settings`);
      settingsMap[chat.chatId] = await r.json();
    } catch { /* ignore */ }
  }));

  const modeLabels = {
    enabled: 'An',
    disabled: 'Aus',
    proactive: 'Proaktiv',
  };

  const modeClasses = {
    enabled: 'mode-enabled',
    disabled: 'mode-disabled',
    proactive: 'mode-proactive',
  };

  list.innerHTML = chats.map(chat => {
    const lastMsg = chat.lastMessage;
    let preview = 'Keine Nachrichten';
    if (lastMsg) {
      if (lastMsg.mediaType && !lastMsg.content) {
        preview = `${mediaIcon(lastMsg.mediaType)} ${lastMsg.mediaType}`;
      } else {
        preview = lastMsg.content || 'Keine Nachrichten';
      }
    }
    const time = lastMsg
      ? new Date(lastMsg.timestamp).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
      : '';

    const settings = settingsMap[chat.chatId];
    const mode = settings?.replyMode || 'default';
    const modeBadge = mode !== 'default'
      ? `<span class="chat-mode-badge ${modeClasses[mode] || ''}">${modeLabels[mode] || mode}</span>`
      : '';

    return `
      <div class="chat-item" data-chat-id="${escapeHtml(chat.chatId)}">
        <div class="chat-item-left">
          <span class="chat-item-name">${chat.isGroup ? '\u{1F465}' : '\u{1F464}'} ${escapeHtml(chat.chatName)} ${modeBadge}</span>
          <span class="chat-item-preview">${escapeHtml(preview)}</span>
        </div>
        <div class="chat-item-meta">
          <span>${time}</span>
          <span class="chat-badge">${chat.messageCount}</span>
        </div>
      </div>`;
  }).join('');

  list.querySelectorAll('.chat-item').forEach(item => {
    item.addEventListener('click', () => openChat(item.dataset.chatId));
  });
}

async function loadChatSettings(chatId) {
  const res = await fetch(`/api/chats/${encodeURIComponent(chatId)}/settings`);
  const settings = await res.json();

  $('#chatReplyMode').value = settings.replyMode || 'default';
  $('#chatCustomPrompt').value = settings.customPrompt || '';
  $('#chatReplyDelay').value = settings.replyDelaySeconds ?? '';
}

async function saveChatSettings() {
  if (!currentChatId) return;

  const delayVal = $('#chatReplyDelay').value;

  const settings = {
    replyMode: $('#chatReplyMode').value,
    customPrompt: $('#chatCustomPrompt').value || null,
    replyDelaySeconds: delayVal !== '' ? parseInt(delayVal, 10) : null,
  };

  await fetch(`/api/chats/${encodeURIComponent(currentChatId)}/settings`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(settings),
  });

  const status = $('#chat-settings-status');
  status.textContent = 'Gespeichert!';
  status.classList.add('visible');
  setTimeout(() => status.classList.remove('visible'), 2000);
}

async function openChat(chatId) {
  currentChatId = chatId;
  const res = await fetch(`/api/chats/${encodeURIComponent(chatId)}`);
  const chat = await res.json();

  $('#chat-list').style.display = 'none';
  $('#chat-detail').classList.remove('hidden');
  $('#chat-settings-panel').classList.add('hidden');
  $('#chat-detail-name').textContent = `${chat.isGroup ? '\u{1F465}' : '\u{1F464}'} ${chat.chatName}`;

  loadChatSettings(chatId);

  const container = $('#chat-messages');
  container.innerHTML = chat.messages.map(msg => {
    const time = new Date(msg.timestamp).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
    const media = renderMedia(msg.mediaType, msg.mediaPath);
    return `
      <div class="chat-msg ${msg.role}">
        ${msg.senderName ? `<div class="chat-msg-sender">${escapeHtml(msg.senderName)}</div>` : ''}
        ${media}
        <div>${escapeHtml(msg.content || (msg.mediaType ? `[${msg.mediaType}]` : ''))}</div>
        <div class="chat-msg-time">${time}</div>
      </div>`;
  }).join('');

  container.scrollTop = container.scrollHeight;
}

// --- Tab Navigation ---
function setupTabs() {
  $$('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      $$('.nav-btn').forEach(b => b.classList.remove('active'));
      $$('.tab').forEach(t => t.classList.remove('active'));
      btn.classList.add('active');
      $(`#tab-${btn.dataset.tab}`).classList.add('active');

      if (btn.dataset.tab === 'settings') loadSettings();
      if (btn.dataset.tab === 'chats') loadChats();
    });
  });
}

// --- Utils ---
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// --- Init ---
document.addEventListener('DOMContentLoaded', () => {
  setupTabs();
  connectWS();

  $('#auto-scroll').addEventListener('change', (e) => {
    autoScroll = e.target.checked;
  });

  $('#clear-logs').addEventListener('click', async () => {
    await fetch('/api/logs', { method: 'DELETE' });
  });

  $('#settings-form').addEventListener('submit', saveSettings);

  $('#back-to-chats').addEventListener('click', () => {
    currentChatId = null;
    $('#chat-list').style.display = '';
    $('#chat-detail').classList.add('hidden');
    $('#chat-settings-panel').classList.add('hidden');
  });

  $('#toggle-chat-settings').addEventListener('click', () => {
    $('#chat-settings-panel').classList.toggle('hidden');
  });

  $('#save-chat-settings').addEventListener('click', saveChatSettings);

  $('#refresh-chats').addEventListener('click', loadChats);
});
