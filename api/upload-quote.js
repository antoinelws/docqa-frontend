// api/upload-quote.js
// Backend Vercel : reçoit un PDF en base64, l’envoie dans SharePoint (site PMO)
// puis renvoie l’URL de partage au front.

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { fileName, pdfBase64 } = req.body || {};
    if (!fileName || !pdfBase64) {
      return res.status(400).json({ error: "Missing fileName or pdfBase64" });
    }

    // 1) Get Graph access token (client credentials flow)
    const tenantId = process.env.MS_TENANT_ID;
    const clientId = process.env.MS_CLIENT_ID;
    const clientSecret = process.env.MS_CLIENT_SECRET;

    if (!tenantId || !clientId || !clientSecret) {
      console.error("Missing tenant/client env vars");
      return res.status(500).json({ error: "Missing Graph auth configuration" });
    }

    const tokenRes = await fetch(
      `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`,
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          scope: "https://graph.microsoft.com/.default",
          grant_type: "client_credentials",
        }),
      }
    );

    if (!tokenRes.ok) {
      const errText = await tokenRes.text();
      console.error("Token error:", errText);
      return res.status(500).json({ error: "Failed to get Graph token" });
    }

    const { access_token } = await tokenRes.json();

    // 2) Prepare SharePoint info
    const siteId = process.env.MS_SITE_ID;   // ex: "erpintegratedsolutions.sharepoint.com,xxx,yyy"
    const driveId = process.env.MS_DRIVE_ID; // drive "Documents" du site PMO
    const folderPath = process.env.MS_FOLDER_PATH || "AI/netNew Quote";

    if (!siteId || !driveId) {
      console.error("Missing MS_SITE_ID or MS_DRIVE_ID");
      return res.status(500).json({ error: "Missing SharePoint configuration" });
    }

    // pdfBase64 is raw base64 — turn it into binary
    const pdfBuffer = Buffer.from(pdfBase64, "base64");

    // IMPORTANT : on encode chaque segment du chemin séparément
    const safeFolderPath = folderPath
      .split("/")
      .map((part) => encodeURIComponent(part))
      .join("/");

    const safeFileName = encodeURIComponent(fileName);

    const uploadUrl = `https://graph.microsoft.com/v1.0/sites/${siteId}/drives/${driveId}/root:/${safeFolderPath}/${safeFileName}:/content`;

    // 3) Upload PDF to SharePoint
    const uploadRes = await fetch(uploadUrl, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${access_token}`,
        "Content-Type": "application/pdf",
      },
      body: pdfBuffer,
    });

    if (!uploadRes.ok) {
      const errText = await uploadRes.text();
      console.error("Upload error:", errText);
      return res.status(500).json({ error: "Failed to upload file to SharePoint" });
    }

    const item = await uploadRes.json();

    // 4) Create a sharing link (view link, org scope)
    const linkRes = await fetch(
      `https://graph.microsoft.com/v1.0/sites/${siteId}/drives/${driveId}/items/${item.id}/createLink`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          type: "view",
          scope: "organization", // or "anonymous" si ton tenant le permet
        }),
      }
    );

    if (!linkRes.ok) {
      const errText = await linkRes.text();
      console.error("createLink error:", errText);
      return res.status(500).json({ error: "Failed to create sharing link" });
    }

    const linkJson = await linkRes.json();
    const sharepointUrl = linkJson.link?.webUrl;

    return res.status(200).json({ sharepointUrl });
  } catch (err) {
    console.error("Unexpected error:", err);
    return res.status(500).json({ error: "Unexpected server error" });
  }
}
