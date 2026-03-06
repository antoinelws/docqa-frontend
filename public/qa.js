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

function chatEl() {
  return document.getElementById("chat");
}

function questionEl() {
  return document.getElementById("question");
}

function chatStatusEl() {
  return document.getElementById("chatStatus");
}

function scrollChatToBottom() {
  const el = chatEl();
  el.scrollTop = el.scrollHeight;
}

function renderMessages() {
  const el = chatEl();

  if (!state.messages.length) {
    el.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-title">Start a conversation</div>
        <div class="empty-state-text">
          Ask a question about ShipERP, ECC, EWM, carriers, labels, break bulk, output, or uploaded documents.
        </div>
      </div>
    `;
    return;
  }

  el.innerHTML = state.messages.map((msg) => {
    const roleClass = msg.role === "user" ? "user" : "assistant";
    const label = msg.role === "user" ? "You" : "ShipERP AI";

    return `
      <div class="msg-row ${roleClass}">
        <div class="msg-bubble ${roleClass}">
          <div class="msg-label">${label}</div>
          <div class="msg-content">${formatMessageContent(msg.content)}</div>
        </div>
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
  chatStatusEl().textContent = text || "";
}

function setSending(isSending) {
  state.isSending = isSending;
  document.getElementById("askBtn").disabled = isSending;
  questionEl().disabled = isSending;
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

  const q = questionEl().value.trim();
  if (!q) return;

  addMessage("user", q);
  addMessage("assistant", "Thinking...");

  questionEl().value = "";
  autoResizeTextarea();
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
    questionEl().focus();
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

function autoResizeTextarea() {
  const el = questionEl();
  el.style.height = "auto";
  el.style.height = Math.min(el.scrollHeight, 180) + "px";
}

function resetConversationView() {
  state.messages = [];
  renderMessages();
  setChatStatus("Conversation cleared on screen. Backend memory is still active.");
}

function bindEvents() {
  document.getElementById("askBtn").addEventListener("click", askQuestion);
  document.getElementById("uploadBtn").addEventListener("click", uploadFile);
  document.getElementById("newChatBtn").addEventListener("click", resetConversationView);

  questionEl().addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      askQuestion();
    }
  });

  questionEl().addEventListener("input", autoResizeTextarea);
}

async function init() {
  bindEvents();
  renderMessages();
  autoResizeTextarea();
  await loadMe();
}

init();
