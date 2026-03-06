function apiBase() {
  return (window.DOCQA_API_BASE || "").replace(/\/+$/, "");
}

async function apiFetch(path, options = {}) {
  const API = apiBase();
  if (!API) throw new Error("Missing DOCQA_API_BASE");

  return fetch(`${API}${path}`, {
    ...options,
    credentials: "include"
  });
}

const state = {
  messages: [],
  isSending: false
};

function escapeHtml(str) {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function formatMessageContent(text) {
  return escapeHtml(text).replace(/\n/g, "<br>");
}

function getChatEl() {
  return document.getElementById("chat");
}

function getQuestionEl() {
  return document.getElementById("question");
}

function getChatStatusEl() {
  return document.getElementById("chatStatus");
}

function scrollChatToBottom() {
  const chat = getChatEl();
  chat.scrollTop = chat.scrollHeight;
}

function renderMessages() {
  const chat = getChatEl();

  if (!state.messages.length) {
    chat.innerHTML = `
      <div class="message system">
        <div class="message-header">Assistant</div>
        Start a conversation by asking a question about ShipERP.
      </div>
    `;
    return;
  }

  chat.innerHTML = state.messages.map((msg) => {
    const roleClass = msg.role === "user" ? "user" : msg.role === "assistant" ? "assistant" : "system";
    const label = msg.role === "user" ? "You" : msg.role === "assistant" ? "ShipERP AI" : "System";

    return `
      <div class="message ${roleClass}">
        <div class="message-header">${label}</div>
        <div class="message-body">${formatMessageContent(msg.content)}</div>
      </div>
    `;
  }).join("");

  scrollChatToBottom();
}

function addMessage(role, content) {
  state.messages.push({ role, content });
  renderMessages();
}

function updateLastAssistantMessage(content) {
  for (let i = state.messages.length - 1; i >= 0; i--) {
    if (state.messages[i].role === "assistant") {
      state.messages[i].content = content;
      break;
    }
  }
  renderMessages();
}

function setChatStatus(text) {
  getChatStatusEl().textContent = text || "";
}

function setSending(isSending) {
  state.isSending = isSending;

  const askBtn = document.getElementById("askBtn");
  const questionEl = getQuestionEl();

  askBtn.disabled = isSending;
  questionEl.disabled = isSending;

  setChatStatus(isSending ? "Thinking..." : "");
}

async function loadMe() {
  const who = document.getElementById("who");

  try {
    const res = await apiFetch("/me");
    const data = await res.json();

    if (!res.ok) throw new Error(data.error || "Unauthorized");

    who.textContent = `Logged in as: ${data.email} (${data.tier})`;
  } catch (e) {
    window.location.href = "login.html?role=customer";
  }
}

async function askQuestion() {
  if (state.isSending) return;

  const questionEl = getQuestionEl();
  const q = questionEl.value.trim();

  if (!q) return;

  addMessage("user", q);
  addMessage("assistant", "Thinking...");

  questionEl.value = "";
  setSending(true);

  try {
    const form = new FormData();
    form.append("message", q);

    const res = await apiFetch("/chat-api", {
      method: "POST",
      body: form
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      updateLastAssistantMessage(`ERROR: ${data.error || "Request failed"}`);
      return;
    }

    updateLastAssistantMessage(data.answer || "(no answer)");
  } catch (err) {
    updateLastAssistantMessage(`ERROR: ${err.message || "Request failed"}`);
  } finally {
    setSending(false);
    questionEl.focus();
  }
}

async function uploadFile() {
  const fileInput = document.getElementById("fileInput");
  const status = document.getElementById("uploadStatus");
  const uploadBtn = document.getElementById("uploadBtn");

  if (!fileInput.files.length) {
    status.textContent = "Select a file first.";
    return;
  }

  status.textContent = "Uploading...";
  uploadBtn.disabled = true;

  try {
    const form = new FormData();
    form.append("file", fileInput.files[0]);

    const res = await apiFetch("/upload", {
      method: "POST",
      body: form
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      status.textContent = `ERROR: ${data.error || "Upload failed"}`;
      return;
    }

    status.textContent = data.message || "Upload complete.";
    fileInput.value = "";
  } catch (err) {
    status.textContent = `ERROR: ${err.message || "Upload failed"}`;
  } finally {
    uploadBtn.disabled = false;
  }
}

function resetConversationView() {
  state.messages = [];
  renderMessages();
  setChatStatus("Conversation cleared on screen. Backend session memory is still active until refreshed/restarted.");
}

function bindEvents() {
  document.getElementById("askBtn").addEventListener("click", askQuestion);
  document.getElementById("uploadBtn").addEventListener("click", uploadFile);
  document.getElementById("newChatBtn").addEventListener("click", resetConversationView);

  getQuestionEl().addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      askQuestion();
    }
  });
}

async function init() {
  bindEvents();
  renderMessages();
  await loadMe();
}

init();
