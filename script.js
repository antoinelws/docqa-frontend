const backendURL = "https://docqa-api.onrender.com";

function uploadFile() {
  const fileInput = document.getElementById("fileInput");
  const file = fileInput.files[0];

  if (!file) {
    alert("Please select a file.");
    return;
  }

  const formData = new FormData();
  formData.append("file", file);

  fetch(`${backendURL}/upload`, {
    method: "POST",
    body: formData
  })
    .then(res => res.json())
    .then(data => {
      document.getElementById("uploadStatus").innerText =
        data.message || data.error || "Upload complete.";
    })
    .catch(err => {
      document.getElementById("uploadStatus").innerText = "Upload failed.";
      console.error(err);
    });
}

function askQuestion() {
  const question = document.getElementById("questionInput").value;
  const answerBox = document.getElementById("answerBox");

  if (!question) {
    alert("Please enter a question.");
    return;
  }

  const formData = new URLSearchParams();
  formData.append("question", question);

  fetch(`${backendURL}/ask`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: formData
  })
    .then(res => res.json())
    .then(data => {
      answerBox.innerText = data.answer || data.error || "No response.";
    })
    .catch(err => {
      answerBox.innerText = "Error getting answer.";
      console.error(err);
    });
}
