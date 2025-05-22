<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>ShipERP Q&A Bot</title>
  <link rel="stylesheet" href="style.css">
</head>
<body>
  <div class="container">
    <h1>ShipERP Document Q&A Bot</h1>

    <section>
      <h2>Ask a Question</h2>
      <label for="email">Your Email:</label>
      <input type="email" id="email" placeholder="you@company.com">

      <label for="question">Your Question:</label>
      <textarea id="question" rows="4" cols="50" placeholder="Type your question here..."></textarea>

      <button onclick="askQuestion()">Ask</button>
      <p id="response"></p>
    </section>

    <hr>

    <section>
      <h2>Upload a Document</h2>
      <input type="file" id="fileInput" />
      <button onclick="uploadFile()">Upload</button>
      <p id="uploadStatus"></p>
    </section>
  </div>

  <script src="script.js"></script>
</body>
</html>
