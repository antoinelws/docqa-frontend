// This script handles the common behavior for all customer forms
// including sending the result via EmailJS with optional attachment.

document.addEventListener("DOMContentLoaded", () => {
  window.submitCustomerForm = async function (formType) {
    const formFields = collectFormFields(formType);
    const resultBox = document.getElementById("resultBox");
    const fileInput = document.getElementById("specFile");

    // Compute estimate locally or extract from hidden field (depending on formType)
    const estimate = document.getElementById("calculatedEffort")?.textContent || "N/A";

    // Build message HTML
    const messageHtml = Object.entries(formFields)
      .map(([key, val]) => `<p><strong>${key}:</strong> ${val}</p>`) // human readable
      .join("");

    const formData = new FormData();
    formData.append("service_id", "service_x8qqp19");
    formData.append("template_id", "template_j3fkvg4");
    formData.append("user_id", "PuZpMq1o_LbVO4IMJ");
    formData.append("template_params[subject]", `New ${formType} request`);
    formData.append("template_params[message]", messageHtml + `<p><strong>Estimate:</strong> ${estimate}</p>`);

    // Attach file if present
    if (fileInput && fileInput.files.length > 0) {
      const file = fileInput.files[0];
      if (file.size > 10 * 1024 * 1024) {
        alert("The file exceeds the 10MB limit.");
        return;
      }
      formData.append("attachments", file, file.name);
    }

    try {
      const response = await fetch("https://api.emailjs.com/api/v1.0/email/send-form", {
        method: "POST",
        body: formData,
      });
      if (response.ok) {
        alert("Your request has been sent to ShipERP!");
      } else {
        const err = await response.text();
        alert("Error sending email: " + err);
      }
    } catch (error) {
      alert("Failed to send email: " + error.message);
    }
  };

  function collectFormFields(formType) {
    const inputs = document.querySelectorAll("input, select, textarea");
    const formFields = {};
    inputs.forEach(input => {
      if (!input.id || input.type === "button" || input.type === "submit") return;
      const label = document.querySelector(`label[for='${input.id}']`)?.textContent || input.id;
      if (input.type === "checkbox") {
        if (!formFields[label]) formFields[label] = [];
        if (input.checked) formFields[label].push(input.value);
      } else if (input.multiple) {
        formFields[label] = Array.from(input.selectedOptions).map(o => o.value).join(", ");
      } else {
        formFields[label] = input.value;
      }
    });
    return formFields;
  }
});
