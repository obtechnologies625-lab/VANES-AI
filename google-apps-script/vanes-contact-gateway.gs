/**
 * VANES AI — Google Apps Script mail gateway
 * Deploy as a Web app:
 *   Execute as: Me
 *   Who has access: Anyone
 *
 * The script sends VANES contact/opportunity submissions to the
 * destination configured below. Do not put this code in the VANES frontend.
 */
const DESTINATION_EMAIL = "obtechnologies625@gmail.com";

function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents || "{}");
    const to = DESTINATION_EMAIL;
    const subject = String(body.subject || "VANES AI submission").slice(0, 200);
    const text = String(body.text || "").slice(0, 10000);

    if (!text) {
      return output({ ok: false, error: "Empty submission." });
    }

    MailApp.sendEmail({
      to: to,
      subject: subject,
      body: text + "\n\nSource: " + String(body.source || "VANES AI")
    });

    return output({ ok: true, message: "Email sent." });
  } catch (err) {
    return output({ ok: false, error: String(err && err.message || err) });
  }
}

function doGet() {
  return output({ ok: true, service: "VANES AI Google Apps Script gateway" });
}

function output(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
