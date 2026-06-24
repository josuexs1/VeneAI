'use strict';

import { initializeApp } from "https://www.gstatic.com/firebasejs/11.7.1/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signInWithPopup, signInWithRedirect, getRedirectResult, GoogleAuthProvider, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.7.1/firebase-auth.js";
import { getFirestore, doc, setDoc, getDoc, collection, getDocs, deleteDoc, addDoc, onSnapshot, serverTimestamp } from "https://www.gstatic.com/firebasejs/11.7.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyC8tFn0w7NUYk-9iYrDuN4nmBUJ3tUJ3wI",
  authDomain: "nexora-identy.firebaseapp.com",
  projectId: "nexora-identy",
  storageBucket: "nexora-identy.firebasestorage.app",
  messagingSenderId: "476881024875",
  appId: "1:476881024875:web:61bf0db510dcdb7e3e3e2e"
};

const firebaseApp = initializeApp(firebaseConfig);
const auth = getAuth(firebaseApp);
const db = getFirestore(firebaseApp);
const googleProvider = new GoogleAuthProvider();

const Store = {
  get: (k, def = null) => { try { const v = localStorage.getItem(k); return v !== null ? JSON.parse(v) : def; } catch { return def; } },
  set: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
};

const State = {
  chats: {},
  currentId: null,
  memory: [],
  theme: Store.get('kora_theme', 'dark'),
  isGenerating: false,
  abortCtrl: null,
  renamingId: null,
  user: null,
};

const $ = id => document.getElementById(id);
const DOM = {
  splash: $('splash'),
  loginScreen: $('login-screen'),
  app: $('app'),
  sidebar: $('sidebar'),
  overlay: $('sidebar-overlay'),
  chatList: $('chat-list'),
  messages: $('messages'),
  welcome: $('welcome'),
  userInput: $('user-input'),
  sendBtn: $('send-btn'),
  iconSend: document.querySelector('.icon-send'),
  iconStop: document.querySelector('.icon-stop'),
  newChatBtn: $('new-chat-btn'),
  newChatMobile: $('new-chat-mobile'),
  burgerBtn: $('burger-btn'),
  memoryBtn: $('memory-btn'),
  settingsBtn: $('settings-btn'),
  memoryModal: $('memory-modal'),
  memoryClose: $('memory-close'),
  memoryList: $('memory-list'),
  clearMemoryBtn: $('clear-memory-btn'),
  settingsModal: $('settings-modal'),
  settingsClose: $('settings-close'),
  clearAllBtn: $('clear-all-btn'),
  renameModal: $('rename-modal'),
  renameClose: $('rename-close'),
  renameInput: $('rename-input'),
  renameConfirm: $('rename-confirm'),
  logoutBtn: $('logout-btn'),
  
  loginEmail: $('login-email'),
  loginPassword: $('login-password'),
  loginSubmitBtn: $('login-submit'),
  loginGoogleBtn: $('login-google'),
  loginError: $('login-error'),
  loginToggle: $('login-toggle'),
  loginTitle: $('login-title'),
  loginSubtitle: $('login-subtitle'),
  loginToggleText: $('login-toggle-text'),
};

let loginMode = 'login'; 

const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);

function setTheme(t) {
  State.theme = t;
  document.body.setAttribute('data-theme', t);
  Store.set('kora_theme', t);
  document.querySelectorAll('.toggle-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.themeVal === t);
  });
}

async function saveChat(chatId) {
  if (!State.user) return;
  const chat = State.chats[chatId];
  if (!chat || !chat.messages.length) return;
  try {
    await setDoc(doc(db, 'users', State.user.uid, 'chats', chatId), {
      id: chat.id,
      name: chat.name,
      messages: chat.messages,
      updatedAt: serverTimestamp()
    });
  } catch (e) { console.error('saveChat', e); }
}

async function loadChats() {
  if (!State.user) return;
  try {
    const snap = await getDocs(collection(db, 'users', State.user.uid, 'chats'));
    State.chats = {};
    snap.forEach(d => {
      const data = d.data();
      State.chats[data.id] = { id: data.id, name: data.name, messages: data.messages || [] };
    });
  } catch (e) { console.error('loadChats', e); }
}

async function deleteFirestoreChat(chatId) {
  if (!State.user) return;
  try {
    await deleteDoc(doc(db, 'users', State.user.uid, 'chats', chatId));
  } catch (e) { console.error('deleteChat', e); }
}

async function saveMemoryFS() {
  if (!State.user) return;
  try {
    await setDoc(doc(db, 'users', State.user.uid, 'data', 'memory'), {
      items: State.memory,
      updatedAt: serverTimestamp()
    });
  } catch (e) { console.error('saveMemory', e); }
}

async function loadMemory() {
  if (!State.user) return;
  try {
    const snap = await getDoc(doc(db, 'users', State.user.uid, 'data', 'memory'));
    if (snap.exists()) State.memory = snap.data().items || [];
  } catch (e) { console.error('loadMemory', e); }
}

function showConfirm(message, onOk) {
  const modal = document.getElementById('confirm-modal');
  document.getElementById('confirm-message').textContent = message;
  modal.classList.remove('hidden');
  const okBtn = document.getElementById('confirm-ok');
  const cancelBtn = document.getElementById('confirm-cancel');
  const close = () => modal.classList.add('hidden');
  const handleOk = () => { close(); onOk(); cleanup(); };
  const handleCancel = () => { close(); cleanup(); };
  const cleanup = () => {
    okBtn.removeEventListener('click', handleOk);
    cancelBtn.removeEventListener('click', handleCancel);
  };
  okBtn.addEventListener('click', handleOk);
  cancelBtn.addEventListener('click', handleCancel);
}

function parseMarkdown(text) {
  let s = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  
  s = s.replace(/```(\w*)\n?([\s\S]*?)```/g, (_, lang, code) => {
    const l = lang || 'texto';
    const highlighted = (lang && window.hljs?.getLanguage(lang))
      ? window.hljs.highlight(code.trim(), { language: lang }).value
      : window.hljs ? window.hljs.highlightAuto(code.trim()).value : code.trim();
    return `<div class="code-block">
      <div class="code-header">
        <span class="code-lang">${l}</span>
        <div class="code-actions">
          <button class="code-btn" onclick="copyCode(this)">Copiar</button>
          <button class="code-btn" onclick="downloadCode(this,'${l}')">Descargar</button>
        </div>
      </div>
      <pre><code class="hljs">${highlighted}</code></pre>
    </div>`;
  });

  
  s = s.replace(/`([^`]+)`/g, '<code>$1</code>');

  
  s = s.replace(/((?:^\|.+\|\n?)+)/gm, tableBlock => {
    const rows = tableBlock.trim().split('\n').filter(r => r.trim());
    if (rows.length < 2) return tableBlock;
    const isHeader = r => /^\|[-| :]+\|$/.test(r.trim());
    let html = '<table>';
    let inBody = false;
    rows.forEach((row, i) => {
      if (isHeader(row)) { inBody = true; return; }
      const cells = row.trim().replace(/^\||\|$/g, '').split('|').map(c => c.trim());
      if (!inBody && i === 0) {
        html += '<thead><tr>' + cells.map(c => `<th>${c}</th>`).join('') + '</tr></thead><tbody>';
      } else {
        html += '<tr>' + cells.map(c => `<td>${c}</td>`).join('') + '</tr>';
      }
    });
    html += '</tbody></table>';
    return html;
  });

  s = s.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>');
  s = s.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  s = s.replace(/\*(.+?)\*/g, '<em>$1</em>');
  s = s.replace(/^### (.+)$/gm, '<h3>$1</h3>');
  s = s.replace(/^## (.+)$/gm, '<h2>$1</h2>');
  s = s.replace(/^# (.+)$/gm, '<h1>$1</h1>');
  s = s.replace(/^---$/gm, '<hr>');
  s = s.replace(/^[\*\-] (.+)$/gm, '<li>$1</li>');
  s = s.replace(/(<li>[\s\S]*?<\/li>)/g, '<ul>$1</ul>');
  s = s.replace(/^\d+\. (.+)$/gm, '<li>$1</li>');
  s = s.replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
  s = s.split(/\n\n+/).map(p => {
    p = p.trim();
    if (!p) return '';
    if (p.startsWith('<')) return p;
    return `<p>${p.replace(/\n/g, '<br>')}</p>`;
  }).join('');
  return s;
}

window.copyCode = function(btn) {
  const pre = btn.closest('.code-block').querySelector('pre');
  navigator.clipboard.writeText(pre.innerText).then(() => {
    btn.textContent = '¡Copiado!';
    setTimeout(() => btn.textContent = 'Copiar', 2000);
  });
};
window.downloadCode = function(btn, lang) {
  const pre = btn.closest('.code-block').querySelector('pre');
  const ext = { javascript:'js', python:'py', html:'html', css:'css', typescript:'ts', java:'java', cpp:'cpp', c:'c', bash:'sh', json:'json', sql:'sql' }[lang.toLowerCase()] || 'txt';
  const blob = new Blob([pre.innerText], { type: 'text/plain' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
  a.download = `kora-code.${ext}`; a.click();
};

function createChat() {
  const id = uid();
  State.chats[id] = { id, name: 'Nuevo chat', messages: [] };
  saveChat(id);
  return id;
}

function switchChat(id) {
  State.currentId = id;
  renderChatList();
  renderMessages();
}

async function deleteChat(id) {
  showConfirm('¿Eliminar esta conversación?', async () => {
    delete State.chats[id];
    await deleteFirestoreChat(id);
    if (State.currentId === id) {
      const ids = Object.keys(State.chats);
      State.currentId = ids.length ? ids[ids.length - 1] : null;
    }
    if (!State.currentId) State.currentId = createChat();
    switchChat(State.currentId);
  });
}

function startRename(id) {
  State.renamingId = id;
  DOM.renameInput.value = State.chats[id]?.name || '';
  DOM.renameModal.classList.remove('hidden');
  DOM.renameInput.focus();
}

function confirmRename() {
  const name = DOM.renameInput.value.trim();
  if (name && State.renamingId && State.chats[State.renamingId]) {
    State.chats[State.renamingId].name = name;
    saveChat(State.renamingId);
    renderChatList();
  }
  DOM.renameModal.classList.add('hidden');
}

async function autoNameChat(id, firstMsg) {
  try {
    const response = await fetch('/api/chat', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ messages: State.messages }) // Ajusta según tu estado
});
    const data = await res.json();
    const name = (data.content || data.response || '').trim().slice(0, 40);
    if (name && State.chats[id]) {
      State.chats[id].name = name;
      saveChat(id);
      renderChatList();
    }
  } catch { }
}

function renderChatList() {
  const ids = Object.keys(State.chats).reverse();
  DOM.chatList.innerHTML = '';
  if (!ids.length) {
    DOM.chatList.innerHTML = '<div style="padding:12px;font-size:12px;color:var(--text-3);text-align:center">Sin conversaciones</div>';
    return;
  }
  ids.forEach(id => {
    const chat = State.chats[id];
    const el = document.createElement('div');
    el.className = 'chat-item' + (id === State.currentId ? ' active' : '');
    el.innerHTML = `
      <svg class="chat-item-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
      </svg>
      <span class="chat-item-name">${chat.name}</span>
      <div class="chat-item-actions">
        <button class="chat-action-btn" title="Renombrar">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
        </button>
        <button class="chat-action-btn del" title="Eliminar">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
        </button>
      </div>`;
    el.addEventListener('click', e => {
      if (e.target.closest('.chat-item-actions')) return;
      switchChat(id);
      closeSidebar();
    });
    el.querySelector('.chat-action-btn').addEventListener('click', () => startRename(id));
    el.querySelector('.chat-action-btn.del').addEventListener('click', () => deleteChat(id));
    DOM.chatList.appendChild(el);
  });
}

function renderMessages() {
  const chat = State.chats[State.currentId];
  if (!chat) return;
  DOM.messages.innerHTML = '';
  if (!chat.messages.length) {
    DOM.messages.appendChild(buildWelcome());
    return;
  }
  chat.messages.forEach(msg => DOM.messages.appendChild(buildMsgEl(msg)));
  scrollBottom(true);
}

function buildWelcome() {
  const el = document.createElement('div');
  el.id = 'welcome'; el.className = 'welcome';
  el.innerHTML = `
    <img src="favicon.png" alt="Kora" class="welcome-logo"/>
    <h1 class="welcome-title">¿En qué puedo ayudarte?</h1>`;
  return el;
}

function showToast(msg) {
  const existing = document.querySelector('.feedback-toast');
  if (existing) existing.remove();
  const t = document.createElement('div');
  t.className = 'feedback-toast';
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => {
    t.style.animation = 'toast-out 0.22s cubic-bezier(0.4,0,0.2,1) forwards';
    setTimeout(() => t.remove(), 220);
  }, 2500);
}

function buildMsgEl(msg) {
  const row = document.createElement('div');
  row.className = `msg-row ${msg.role}`;
  if (msg.role === 'user') {
    const escaped = msg.content.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\n/g,'<br>');
    row.innerHTML = `<div class="msg-bubble">${escaped}</div>`;
  } else {
    row.innerHTML = `
      <div class="msg-kora-avatar"><img src="favicon.png" alt="K"/></div>
      <div class="msg-content">${parseMarkdown(msg.content)}</div>
      <div class="msg-actions">
        <button class="msg-action-btn" data-action="copy" title="Copiar" onclick="handleMsgAction(this,'copy')">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
        </button>
        <button class="msg-action-btn" data-action="like" title="Me gusta" onclick="handleMsgAction(this,'like')">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3H14z"/><path d="M7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"/></svg>
        </button>
        <button class="msg-action-btn" data-action="dislike" title="No me gusta" onclick="handleMsgAction(this,'dislike')">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3H10z"/><path d="M17 2h2.67A2.31 2.31 0 0 1 22 4v7a2.31 2.31 0 0 1-2.33 2H17"/></svg>
        </button>
      </div>`;
    requestAnimationFrame(() => row.classList.add('done'));
  }
  return row;
}

window.handleMsgAction = function(btn, action) {
  const actions = btn.closest('.msg-actions');
  if (action === 'copy') {
    const content = btn.closest('.msg-row').querySelector('.msg-content');
    navigator.clipboard.writeText(content.innerText).then(() => {
      const orig = btn.innerHTML;
      btn.innerHTML = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>`;
      btn.classList.add('active');
      setTimeout(() => { btn.innerHTML = orig; btn.classList.remove('active'); }, 2000);
    });
    return;
  }
  if (action === 'like' || action === 'dislike') {
    if (actions.dataset.voted) return;
    actions.dataset.voted = '1';
    const other = action === 'like' ? 'dislike' : 'like';
    const otherBtn = actions.querySelector(`[data-action="${other}"]`);
    btn.classList.add('active');
    otherBtn.classList.add('hidden');
    showToast('¡Gracias por tus comentarios!');
  }
};

function addCalendarIndicator() {
  const el = document.createElement('div');
  el.className = 'tool-indicator';
  el.innerHTML = `<img src="calendar.png" class="tool-indicator-icon" alt="Calendar" /><span>Se usó Calendar</span>`;
  DOM.messages.appendChild(el);
  scrollBottom();
}

function addThinkingIndicator(label = '') {
  removeThinkingIndicator();
  const el = document.createElement('div');
  el.id = 'thinking-indicator'; el.className = 'thinking-row';
  el.innerHTML = `<div class="thinking-dots"><div class="dot"></div><div class="dot"></div><div class="dot"></div></div>`;
  DOM.messages.appendChild(el);
  scrollBottom();
}

function addSearchIndicator() {
  removeThinkingIndicator();
  const el = document.createElement('div');
  el.id = 'thinking-indicator'; el.className = 'thinking-row';
  el.innerHTML = `
    <div class="thinking-meta"><span class="thinking-label">Buscando…</span></div>
    <div style="margin-top:10px;display:flex;flex-direction:column;gap:6px">
      <div class="shimmer-block w-90"></div>
      <div class="shimmer-block w-80"></div>
      <div class="shimmer-block w-60"></div>
    </div>`;
  DOM.messages.appendChild(el);
  scrollBottom();
}

function removeThinkingIndicator() {
  const el = $('thinking-indicator');
  if (el) el.remove();
}

function scrollBottom(instant = false) {
  DOM.messages.scrollTo({ top: DOM.messages.scrollHeight, behavior: instant ? 'instant' : 'smooth' });
}

function detectMemoryCommand(text) {
  const lower = text.toLowerCase();
  const rememberMatch = lower.match(/recuerda que (.+)/);
  if (rememberMatch) {
    const item = text.match(/recuerda que (.+)/i)?.[1];
    if (item) addMemory(item.trim());
    return;
  }
  const forgetMatch = text.match(/no recuerdes (?:esto|que)?\s*(.+)/i);
  if (forgetMatch) {
    const item = forgetMatch[1]?.trim();
    if (item) removeMemoryByText(item);
  }
}

function addMemory(text) {
  if (State.memory.some(m => m.text.toLowerCase() === text.toLowerCase())) return;
  State.memory.push({ id: uid(), text });
  saveMemoryFS();
}

function removeMemoryByText(text) {
  State.memory = State.memory.filter(m => !m.text.toLowerCase().includes(text.toLowerCase()));
  saveMemoryFS();
}

function buildSystemPrompt() {
  let sys = `Eres Kora, una inteligencia artificial desarrollada por Nexora.

Eres un asistente conversacional avanzado diseñado para proporcionar respuestas útiles, claras, profundas y confiables.

Tu objetivo principal es ayudar al usuario con explicaciones de alta calidad, bien estructuradas y realmente útiles.

IDENTIDAD Y PERSONALIDAD

Eres Kora, una IA inteligente, directa y confiable. Tu tono se adapta al usuario y al contexto. Mantienes un equilibrio entre naturalidad y precisión. No usas emojis. No usas frases de relleno ni introducciones innecesarias. Si el usuario pregunta quién eres, respondes con seguridad y claridad.

REGLA PRINCIPAL DE CALIDAD

Antes de responder debes analizar la intención real del usuario y el nivel de profundidad requerido. Evitas respuestas superficiales cuando el tema requiere explicación completa. Si una respuesta puede ser vaga, genérica o incompleta, debe ser mejorada antes de ser entregada.

NIVELES DE PROFUNDIDAD

Básico: explicación simple y clara, lenguaje accesible, ejemplos cortos.
Intermedio: estructura por secciones, ejemplos prácticos, más detalle.
Avanzado: explicación profunda, descomposición del problema, lógica interna, escenarios reales.

MODO DE RAZONAMIENTO

Cuando el problema sea complejo, divides el problema en partes, explicas paso a paso, conectas ideas antes de concluir y evitas saltar directamente a la respuesta final sin contexto.

ESTILO DE RESPUESTA

Usas estructura cuando sea necesario como títulos, listas o pasos. Prioriza claridad sobre longitud innecesaria. Evitas respuestas demasiado cortas en temas complejos. Mantienes un estilo natural y preciso.

REGLAS DE CONTENIDO

No inventas datos específicos sin necesidad. Si algo no es seguro lo indicas o das una estimación razonable. Si el usuario pide algo técnico respondes como si fuera un caso real. Si el usuario está aprendiendo incluyes ejemplos o ejercicios cuando sea útil.

MODO ENSEÑANZA

Si el usuario está aprendiendo explicas paso a paso. Usas ejemplos simples. Incluyes mini ejercicios opcionales. No asumes conocimientos previos altos.

OPTIMIZACIÓN DE RESPUESTAS

Evitas respuestas vagas sin explicación. Evitas listas sin desarrollo. Evitas conceptos sin contexto. Siempre que sea posible explicas el por qué además del qué.

CONTEXTO NEXORA

Nexora es una empresa venezolana de tecnología fundada el 29 de julio de 2025 por Gabriel Vera (Alev), enfocada en software, inteligencia artificial y ecosistemas digitales. Sus proyectos incluyen Kora, Sorex y otros sistemas en desarrollo. Este contexto es solo informativo y no debe repetirse en cada respuesta.

OBJETIVO FINAL

Tu objetivo es ser una IA útil, clara, profunda y confiable. No solo debes responder preguntas, debes ayudar a comprender.`;
  if (State.memory.length) {
    sys += `\n\nInformación que recuerdas del usuario:\n`;
    State.memory.forEach(m => { sys += `- ${m.text}\n`; });
  }
  if (State.plan === 'one') {
    const today = new Date().toLocaleDateString('es-VE', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    sys += `\n\nINTEGRACIÓN CON CALENDAR (NEXORA ONE)\nTienes acceso a Nexora Calendar. Hoy es ${today}.\nSi el usuario menciona querer agendar algo, créalo INMEDIATAMENTE sin pedir confirmación. Incluye AL FINAL de tu respuesta este JSON:\n{"action":"create_event","title":"...","date":"YYYY-MM-DD","time":"HH:MM","description":"..."}\nEn tu texto solo di algo breve como "Listo, lo agendé para el [fecha]." NO pidas confirmación. NO expliques nada más.`;
  }
  sys += `\n\nECOSISTEMA NEXORA\nSomos un ecosistema de apps venezolano. Las apps disponibles son:\n- Nexora ID: identidad digital, gestión de cuenta y sesiones\n- Kora: inteligencia artificial (tú)\n- Nexora Notes: editor de notas con Kora integrada\n- Nexora Pass: gestor de contraseñas con cifrado AES-256\n- Nexora Drive: almacenamiento en la nube cifrado\n- Nexora Calendar: calendario inteligente con Kora integrada\n- Nexora Mail: correo electrónico (próximamente)\nNexora One es el plan premium ($5.99/mes) que desbloquea funciones ilimitadas en todas las apps.`;
  return sys;
}

function needsSearch(text) {
  const triggers = ['busca', 'buscar', 'qué está pasando', 'noticias', 'hoy', 'ahora', 'precio de', 'cuánto vale', 'qué es ', 'quién es ', 'cuándo fue', 'dónde está', 'actualidad', 'última hora'];
  const t = text.toLowerCase();
  return triggers.some(tr => t.includes(tr));
}

async function sendMessage(text) {
  text = text?.trim() || DOM.userInput.value.trim();
  if (!text || State.isGenerating) return;

  DOM.userInput.value = '';
  resizeTextarea();

  if (!State.currentId || !State.chats[State.currentId]) {
    State.currentId = createChat();
  }
  const chat = State.chats[State.currentId];
  const isFirstMsg = chat.messages.length === 0;

  const welcome = DOM.messages.querySelector('#welcome, .welcome');
  if (welcome) welcome.remove();

  const userMsg = { role: 'user', content: text };
  chat.messages.push(userMsg);
  await saveChat(State.currentId);
  DOM.messages.appendChild(buildMsgEl(userMsg));
  scrollBottom();

  detectMemoryCommand(text);
  if (isFirstMsg) autoNameChat(State.currentId, text);

  State.isGenerating = true;
  setGeneratingUI(true);

  try {
    let aiResponse = '';
    if (needsSearch(text)) {
      addSearchIndicator();
      try {
        const searchRes = await fetch('/.netlify/functions/search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: text })
        });
        const searchData = await searchRes.json();
        const searchContext = searchData.results || searchData.text || '';
        if (searchContext) text = `${text}\n\n[Contexto de búsqueda web]:\n${searchContext}`;
      } catch { }
    } else {
      const isCode = /código|code|programa|script|función|función|crear|hacer|desarrolla/i.test(text);
      addThinkingIndicator(isCode ? 'Creando código' : 'Pensando');
    }

    const recentMessages = chat.messages.slice(-100).map((m, i, arr) => ({
      role: m.role, content: m.role === 'user' && i === arr.length - 1 ? text : m.content
    }));

    State.abortCtrl = new AbortController();
    const res = await fetch('/.netlify/functions/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: State.abortCtrl.signal,
      body: JSON.stringify({ messages: recentMessages, system: buildSystemPrompt() })
    });

    if (!res.ok) {
      const errData = await res.text();
      console.error('Chat function error:', res.status, errData);
      throw new Error(`HTTP ${res.status}`);
    }

    const data = await res.json();
    aiResponse = data.content || data.response || 'Lo siento, ocurrió un error al procesar tu mensaje.';

    // Detectar si Kora quiere crear un evento en Calendar (solo One)
    if (State.plan === 'one') {
      try {
        const jsonMatch = aiResponse.match(/\{[\s\S]*"action"\s*:\s*"create_event"[\s\S]*\}/);
        if (jsonMatch) {
          const eventData = JSON.parse(jsonMatch[0]);
          if (eventData.date && eventData.title) {
            await addDoc(collection(db, 'users', State.user.uid, 'calendar_events'), {
              title: eventData.title,
              date: eventData.date,
              time: eventData.time || '',
              description: eventData.description || '',
              sharedWith: [],
              createdAt: serverTimestamp()
            });
            // Mostrar indicador "Se usó Calendar"
            addCalendarIndicator();
            aiResponse = aiResponse.replace(jsonMatch[0], '').trim();
          }
        }
      } catch { }
    }

    removeThinkingIndicator();
    const assistantMsg = { role: 'assistant', content: aiResponse };
    chat.messages.push(assistantMsg);
    await saveChat(State.currentId);
    DOM.messages.appendChild(buildMsgEl(assistantMsg));
    scrollBottom();

  } catch (err) {
    removeThinkingIndicator();
    if (err.name !== 'AbortError') {
      const errMsg = { role: 'assistant', content: 'Lo siento, ocurrió un error al procesar tu mensaje.' };
      chat.messages.push(errMsg);
      await saveChat(State.currentId);
      DOM.messages.appendChild(buildMsgEl(errMsg));
      scrollBottom();
    }
  } finally {
    State.isGenerating = false;
    State.abortCtrl = null;
    setGeneratingUI(false);
  }
}

function setGeneratingUI(generating) {
  DOM.iconSend.classList.toggle('hidden', generating);
  DOM.iconStop.classList.toggle('hidden', !generating);
  DOM.sendBtn.classList.toggle('stop', generating);
  DOM.userInput.disabled = generating;
}

function stopGeneration() {
  if (State.abortCtrl) State.abortCtrl.abort();
  State.isGenerating = false;
  setGeneratingUI(false);
  removeThinkingIndicator();
}

function resizeTextarea() {
  const el = DOM.userInput;
  el.style.height = 'auto';
  el.style.height = Math.min(el.scrollHeight, 200) + 'px';
}

function openSidebar() {
  DOM.sidebar.classList.add('open');
  DOM.overlay.classList.add('active');
}
function closeSidebar() {
  DOM.sidebar.classList.remove('open');
  DOM.overlay.classList.remove('active');
}

function openMemoryModal() { DOM.memoryModal.classList.remove('hidden'); renderMemoryList(); }
function closeMemoryModal() { DOM.memoryModal.classList.add('hidden'); }

function renderMemoryList() {
  if (!State.memory.length) {
    DOM.memoryList.innerHTML = '<p class="memory-empty">No hay nada guardado en la memoria.</p>';
    return;
  }
  DOM.memoryList.innerHTML = '';
  State.memory.forEach(m => {
    const el = document.createElement('div');
    el.className = 'memory-item';
    el.innerHTML = `<span class="memory-item-text">${m.text}</span><button class="memory-del" title="Eliminar">✕</button>`;
    el.querySelector('.memory-del').addEventListener('click', () => {
      State.memory = State.memory.filter(x => x.id !== m.id);
      saveMemoryFS();
      renderMemoryList();
    });
    DOM.memoryList.appendChild(el);
  });
}

function openSettingsModal() { DOM.settingsModal.classList.remove('hidden'); }
function closeSettingsModal() { DOM.settingsModal.classList.add('hidden'); }

function showLoginError(msg) {
  DOM.loginError.textContent = msg;
  DOM.loginError.classList.remove('hidden');
  setTimeout(() => DOM.loginError.classList.add('hidden'), 4000);
}

function setLoginLoading(loading) {
  DOM.loginSubmitBtn.disabled = loading;
  DOM.loginSubmitBtn.textContent = loading
    ? (loginMode === 'login' ? 'Entrando…' : 'Creando cuenta…')
    : (loginMode === 'login' ? 'Entrar' : 'Crear cuenta');
}

function toggleLoginMode() {
  loginMode = loginMode === 'login' ? 'register' : 'login';
  if (loginMode === 'login') {
    DOM.loginTitle.textContent = 'Bienvenido de vuelta';
    DOM.loginSubtitle.textContent = 'Inicia sesión para continuar';
    DOM.loginSubmitBtn.textContent = 'Entrar';
    DOM.loginToggleText.innerHTML = '¿No tienes cuenta? <button id="login-toggle" class="login-link">Regístrate</button>';
  } else {
    DOM.loginTitle.textContent = 'Crea tu cuenta';
    DOM.loginSubtitle.textContent = 'Únete a Kora gratis';
    DOM.loginSubmitBtn.textContent = 'Crear cuenta';
    DOM.loginToggleText.innerHTML = '¿Ya tienes cuenta? <button id="login-toggle" class="login-link">Inicia sesión</button>';
  }
  DOM.loginError.classList.add('hidden');
  
  document.getElementById('login-toggle').addEventListener('click', toggleLoginMode);
}

async function handleEmailAuth() {
  const email = DOM.loginEmail.value.trim();
  const password = DOM.loginPassword.value;
  if (!email || !password) { showLoginError('Completa todos los campos.'); return; }
  if (password.length < 6) { showLoginError('La contraseña debe tener al menos 6 caracteres.'); return; }
  setLoginLoading(true);
  try {
    if (loginMode === 'login') {
      await signInWithEmailAndPassword(auth, email, password);
    } else {
      await createUserWithEmailAndPassword(auth, email, password);
    }
  } catch (e) {
    const msgs = {
      'auth/user-not-found': 'No existe una cuenta con ese correo.',
      'auth/wrong-password': 'Contraseña incorrecta.',
      'auth/email-already-in-use': 'Ese correo ya tiene una cuenta.',
      'auth/invalid-email': 'El correo no es válido.',
      'auth/invalid-credential': 'Correo o contraseña incorrectos.',
    };
    showLoginError(msgs[e.code] || 'Ocurrió un error. Intenta de nuevo.');
  } finally {
    setLoginLoading(false);
  }
}

async function handleGoogleLogin() {
  try {
    await signInWithPopup(auth, googleProvider);
  } catch (e) {
    const code = e?.code || '';
    if (code === 'auth/popup-blocked') {
      try {
        await signInWithRedirect(auth, googleProvider);
      } catch (e2) {
        showLoginError('No se pudo iniciar sesión con Google.');
      }
    } else if (code !== 'auth/popup-closed-by-user' && code !== 'auth/cancelled-popup-request') {
      showLoginError('No se pudo iniciar sesión con Google.');
    }
  }
}

async function onUserLogin(user) {
  State.user = user;

  // Leer plan del usuario
  const userSnap = await getDoc(doc(db, 'users', user.uid));
  State.plan = userSnap.exists() ? (userSnap.data().plan || 'free') : 'free';

  await loadChats();
  await loadMemory();

  // registrar sesión en ID
  const ua = navigator.userAgent;
  const mobile = /Android|iPhone|iPad/i.test(ua);
  const browser = /Chrome/i.test(ua) ? 'Chrome' : /Firefox/i.test(ua) ? 'Firefox' : /Safari/i.test(ua) ? 'Safari' : 'Navegador';
  const device = `${mobile ? 'Móvil' : 'PC'} · ${browser}`;
  await setDoc(doc(db, 'users', user.uid), {
    sessions: { kora: { active: true, lastSeen: serverTimestamp(), device } }
  }, { merge: true });

  
  State.currentId = createChat();

  setTheme(State.theme);
  renderChatList();
  renderMessages();

  
  const nameEl = $('user-display-name');
  const emailEl = $('user-display-email');
  if (nameEl) nameEl.textContent = user.displayName || user.email.split('@')[0];
  if (emailEl) emailEl.textContent = user.email;

  
  DOM.loginScreen.classList.add('hidden');
  DOM.app.classList.remove('hidden');
  requestAnimationFrame(() => DOM.app.classList.add('visible'));
}

function onUserLogout() {
  State.user = null;
  State.chats = {};
  State.memory = [];
  State.currentId = null;

  DOM.app.classList.remove('visible');
  DOM.app.classList.add('hidden');
  DOM.loginScreen.classList.remove('hidden');
}

function hideSplash() {
  if (DOM.splash.classList.contains('hidden')) return;
  DOM.splash.classList.add('fade-out');
  setTimeout(() => DOM.splash.classList.add('hidden'), 500);
}

function init() {
  setTheme(State.theme);

  
  onAuthStateChanged(auth, user => {
    hideSplash();
    if (user) {
      onUserLogin(user);
    } else {
      onUserLogout();
    }
  });

  
  setTimeout(hideSplash, 4000);

  
  setTimeout(() => {
    DOM.splash.classList.add('fade-out');
  }, 1700);

  
  DOM.loginSubmitBtn.addEventListener('click', handleEmailAuth);
  DOM.loginPassword.addEventListener('keydown', e => { if (e.key === 'Enter') handleEmailAuth(); });
  DOM.loginEmail.addEventListener('keydown', e => { if (e.key === 'Enter') DOM.loginPassword.focus(); });
  DOM.loginGoogleBtn.addEventListener('click', handleGoogleLogin);
  document.getElementById('login-toggle').addEventListener('click', toggleLoginMode);

  
  DOM.sendBtn.addEventListener('click', () => {
    if (State.isGenerating) stopGeneration();
    else sendMessage();
  });

  DOM.userInput.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); if (!State.isGenerating) sendMessage(); }
  });
  DOM.userInput.addEventListener('input', resizeTextarea);

  [DOM.newChatBtn, DOM.newChatMobile].forEach(btn => {
    btn?.addEventListener('click', () => {
      State.currentId = createChat();
      renderChatList();
      renderMessages();
      closeSidebar();
      DOM.userInput.focus();
    });
  });

  
  document.getElementById('burger-float')?.addEventListener('click', openSidebar);
  document.getElementById('new-chat-float')?.addEventListener('click', () => {
    State.currentId = createChat();
    renderChatList();
    renderMessages();
    closeSidebar();
    DOM.userInput.focus();
  });

  DOM.burgerBtn?.addEventListener('click', openSidebar);
  DOM.overlay.addEventListener('click', closeSidebar);

  DOM.memoryBtn.addEventListener('click', () => { openMemoryModal(); closeSidebar(); });
  DOM.memoryClose.addEventListener('click', closeMemoryModal);
  DOM.memoryModal.addEventListener('click', e => { if (e.target === DOM.memoryModal) closeMemoryModal(); });
  DOM.clearMemoryBtn.addEventListener('click', () => {
    showConfirm('¿Borrar toda la memoria permanente?', () => {
      State.memory = []; saveMemoryFS(); closeMemoryModal();
    });
  });

  DOM.settingsBtn.addEventListener('click', () => { openSettingsModal(); closeSidebar(); });
  DOM.settingsClose.addEventListener('click', closeSettingsModal);
  DOM.settingsModal.addEventListener('click', e => { if (e.target === DOM.settingsModal) closeSettingsModal(); });
  DOM.clearAllBtn.addEventListener('click', () => {
    showConfirm('¿Borrar TODAS las conversaciones? Esto no se puede deshacer.', async () => {
      for (const id of Object.keys(State.chats)) await deleteFirestoreChat(id);
      State.chats = {};
      State.currentId = createChat();
      renderChatList();
      renderMessages();
      closeSettingsModal();
    });
  });

  document.querySelectorAll('.toggle-btn').forEach(btn => {
    btn.addEventListener('click', () => setTheme(btn.dataset.themeVal));
  });

  DOM.renameClose.addEventListener('click', () => DOM.renameModal.classList.add('hidden'));
  DOM.renameModal.addEventListener('click', e => { if (e.target === DOM.renameModal) DOM.renameModal.classList.add('hidden'); });
  DOM.renameConfirm.addEventListener('click', confirmRename);
  DOM.renameInput.addEventListener('keydown', e => { if (e.key === 'Enter') confirmRename(); });

  DOM.logoutBtn?.addEventListener('click', () => {
    showConfirm('¿Cerrar sesión?', async () => { await signOut(auth); });
  });
}

document.addEventListener('DOMContentLoaded', init);