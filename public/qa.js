function apiBase() {
  return (window.DOCQA_API_BASE || "").replace(/\/+$/, "");
}

async function apiFetch(path, options = {}) {
  const API = apiBase();
  if (!API) throw new Error("Missing DOCQA_API_BASE");

  return fetch(`${API}${path}`, {
    ...options,
    credentials: "include" // IMPORTANT
  });
}

async function loadMe() {
  const who = document.getElementById("who");

  try {
    const res = await apiFetch("/me");
    const data = await res.json();

    if (!res.ok) throw new Error(data.error || "Unauthorized");

    who.textContent = `Logged in as: ${data.email} (${data.tier})`;
  } catch (e) {
    // Not logged in → back to login
    window.location.href = "login.html?role=customer";
  }
}

async function askQuestion() {
  const q = document.getElementById("question").value.trim();
  const output = document.getElementById("response");

  if (!q) return;

  output.textContent = "Thinking...";

  const form = new FormData();
  form.append("message", q);

  const res = await apiFetch("/chat-api", {
    method: "POST",
    body: form
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    output.textContent = `ERROR: ${data.error || "Request failed"}`;
    return;
  }

  output.textContent = data.answer || "(no answer)";
}

async function uploadFile() {
  const fileInput = document.getElementById("fileInput");
  const status = document.getElementById("uploadStatus");

  if (!fileInput.files.length) {
    status.textContent = "Select a file first.";
    return;
  }

  status.textContent = "Uploading...";

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
}

document.getElementById("askBtn").addEventListener("click", askQuestion);
document.getElementById("uploadBtn").addEventListener("click", uploadFile);

loadMe();
