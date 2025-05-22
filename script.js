// script.js

function askQuestion() {
  const email = document.getElementById("email").value;
  const question = document.getElementById("question").value;

  const formData = new FormData();
  formData.append("user_email", email);
  formData.append("question", question);

  fetch("https://docqa-api.onrender.com/ask", {
    method: "POST",
    body: formData
  })
  .then(res => res.json())
  .then(data => {
    console.log("Ask response:", data);
    document.getElementById("response").textContent = data.answer || data.error || "No response";
  })
  .catch(err => {
    console.error("Ask error:", err);
    document.getElementById("response").textContent = "Error: " + err.message;
  });
}

function uploadFile() {
  const fileInput = document.getElementById('fileInput');
  const file = fileInput.files[0];
  if (!file) {
    alert("Please select a file.");
    return;
  }

  const formData = new FormData();
  formData.append('file', file);

  fetch('https://docqa-api.onrender.com/upload', {
    method: 'POST',
    body: formData
  })
  .then(response => response.json())
  .then(result => {
    console.log("Upload response:", result);
    document.getElementById('uploadStatus').innerText = result.message || result.error || "Upload complete.";
  })
  .catch(error => {
    console.error('Upload error:', error);
    document.getElementById('uploadStatus').innerText = "Upload failed.";
  });
}
