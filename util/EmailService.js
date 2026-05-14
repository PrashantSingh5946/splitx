const nodemailer = require("nodemailer");

// ─── Transporter ─────────────────────────────────────────────────────────────

let _transporter = null;

function getTransporter() {
  if (_transporter) return _transporter;

  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_SECURE } = process.env;

  if (!SMTP_USER || !SMTP_PASS) {
    console.warn("[EmailService] SMTP_USER / SMTP_PASS not set — emails will be logged only.");
    return null;
  }

  _transporter = nodemailer.createTransport({
    host: SMTP_HOST || "smtp.gmail.com",
    port: parseInt(SMTP_PORT || "587", 10),
    secure: SMTP_SECURE === "true",   // true for 465, false for 587 STARTTLS
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });

  return _transporter;
}

// ─── Core sender ─────────────────────────────────────────────────────────────

async function sendEmail({ to, subject, html }) {
  const from = process.env.SMTP_FROM || "SplitX <noreply@splitx.app>";

  const transporter = getTransporter();
  if (!transporter) {
    console.log(`[EmailService] Would send email → ${to} | ${subject}`);
    return;
  }

  try {
    const info = await transporter.sendMail({ from, to, subject, html });
    console.log(`[EmailService] Sent to ${to} (${info.messageId})`);
  } catch (err) {
    console.error(`[EmailService] Failed to send to ${to}:`, err.message);
  }
}

// ─── Shared styles ────────────────────────────────────────────────────────────

const PRIMARY = "#6366F1";
const DARK    = "#0F172A";
const MUTED   = "#64748B";

function baseLayout(bodyContent) {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>SplitX</title>
</head>
<body style="margin:0;padding:0;background:#F1F5F9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F1F5F9;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;">

          <!-- Logo / wordmark -->
          <tr>
            <td align="center" style="padding:0 0 24px 0;">
              <table cellpadding="0" cellspacing="0">
                <tr>
                  <td style="
                    background:linear-gradient(135deg,${PRIMARY} 0%,#4F46E5 100%);
                    border-radius:14px;width:44px;height:44px;
                    text-align:center;vertical-align:middle;
                    font-size:22px;line-height:44px;
                  ">✂️</td>
                  <td style="padding-left:10px;font-size:22px;font-weight:700;color:${DARK};letter-spacing:-0.5px;vertical-align:middle;">
                    SplitX
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Card -->
          <tr>
            <td style="background:#ffffff;border-radius:16px;padding:36px 40px;box-shadow:0 4px 24px rgba(15,23,42,0.07);">
              ${bodyContent}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td align="center" style="padding:24px 0 0 0;font-size:12px;color:${MUTED};line-height:1.6;">
              SplitX — split bills, stay friends.<br/>
              You're receiving this because of activity on your account.
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function primaryButton(href, label) {
  return `
  <table cellpadding="0" cellspacing="0" style="margin-top:28px;">
    <tr>
      <td style="
        background:linear-gradient(135deg,${PRIMARY} 0%,#4F46E5 100%);
        border-radius:10px;
      ">
        <a href="${href}" style="
          display:inline-block;padding:14px 28px;
          color:#ffffff;font-size:15px;font-weight:600;
          text-decoration:none;letter-spacing:-0.2px;
        ">${label}</a>
      </td>
    </tr>
  </table>`;
}

function divider() {
  return `<hr style="border:none;border-top:1px solid #E2E8F0;margin:24px 0;"/>`;
}

// ─── Email templates ──────────────────────────────────────────────────────────

/**
 * 1. Welcome email sent right after a new account is created.
 */
async function sendWelcomeEmail({ to, firstName, username }) {
  const subject = `Welcome to SplitX, ${firstName}! 🎉`;
  const html = baseLayout(`
    <h1 style="margin:0 0 8px;font-size:26px;font-weight:700;color:${DARK};letter-spacing:-0.5px;">
      Hey ${firstName}, welcome! 👋
    </h1>
    <p style="margin:0 0 20px;font-size:15px;color:${MUTED};line-height:1.6;">
      Your SplitX account is all set. You're <strong style="color:${DARK};">@${username}</strong> — share that with friends so they can find you.
    </p>

    ${divider()}

    <p style="margin:0 0 10px;font-size:14px;font-weight:600;color:${DARK};">Here's what you can do with SplitX:</p>
    <table cellpadding="0" cellspacing="0" style="width:100%;">
      ${["🏠  Create groups for trips, flatmates, or brunches",
         "💸  Add expenses and split them any way you like",
         "📊  See exactly who owes what — no spreadsheets",
         "✅  Settle up with one tap when you're done"
        ].map(item => `
        <tr>
          <td style="padding:6px 0;font-size:14px;color:${MUTED};line-height:1.5;">${item}</td>
        </tr>`).join("")}
    </table>

    ${primaryButton("splitx://home", "Open SplitX")}

    ${divider()}
    <p style="margin:0;font-size:13px;color:${MUTED};">
      If you didn't create this account, you can safely ignore this email.
    </p>
  `);
  await sendEmail({ to, subject, html });
}

/**
 * 2. Invite email sent to someone who has NO account yet.
 *    Contains a deep-link / web URL they can tap to sign up.
 */
async function sendGroupInviteEmail({ to, inviterName, groupName, groupEmoji }) {
  const subject = `${inviterName} invited you to "${groupEmoji} ${groupName}" on SplitX`;
  const signupUrl = `${process.env.APP_URL || "https://splitx.app"}/join?email=${encodeURIComponent(to)}`;

  const html = baseLayout(`
    <h1 style="margin:0 0 8px;font-size:26px;font-weight:700;color:${DARK};letter-spacing:-0.5px;">
      You've been invited! 🎉
    </h1>
    <p style="margin:0 0 20px;font-size:15px;color:${MUTED};line-height:1.6;">
      <strong style="color:${DARK};">${inviterName}</strong> has added you to
      <strong style="color:${DARK};">${groupEmoji} ${groupName}</strong> on SplitX
      — the easiest way to split bills with friends.
    </p>

    <table cellpadding="0" cellspacing="0" style="
      width:100%;background:#F8FAFC;border:1px solid #E2E8F0;
      border-radius:10px;padding:16px 20px;
    ">
      <tr>
        <td style="font-size:24px;width:44px;vertical-align:middle;">${groupEmoji}</td>
        <td style="padding-left:12px;vertical-align:middle;">
          <div style="font-size:15px;font-weight:600;color:${DARK};">${groupName}</div>
          <div style="font-size:13px;color:${MUTED};margin-top:2px;">Invited by ${inviterName}</div>
        </td>
      </tr>
    </table>

    ${primaryButton(signupUrl, "Accept invite & join SplitX")}

    ${divider()}
    <p style="margin:0;font-size:13px;color:${MUTED};line-height:1.6;">
      Once you sign up with this email address (<strong>${to}</strong>),
      you'll be automatically added to <strong>${groupName}</strong>.<br/><br/>
      If you weren't expecting this invite, you can safely ignore it.
    </p>
  `);
  await sendEmail({ to, subject, html });
}

/**
 * 3. Notification email sent to an EXISTING user who was added to a group.
 */
async function sendAddedToGroupEmail({ to, firstName, adderName, groupName, groupEmoji, memberCount }) {
  const subject = `You've been added to "${groupEmoji} ${groupName}"`;
  const html = baseLayout(`
    <h1 style="margin:0 0 8px;font-size:26px;font-weight:700;color:${DARK};letter-spacing:-0.5px;">
      You're in a new group 🥳
    </h1>
    <p style="margin:0 0 20px;font-size:15px;color:${MUTED};line-height:1.6;">
      Hey <strong style="color:${DARK};">${firstName}</strong>!
      <strong style="color:${DARK};">${adderName}</strong> just added you to a group on SplitX.
    </p>

    <table cellpadding="0" cellspacing="0" style="
      width:100%;background:#F8FAFC;border:1px solid #E2E8F0;
      border-radius:10px;padding:16px 20px;
    ">
      <tr>
        <td style="font-size:24px;width:44px;vertical-align:middle;">${groupEmoji}</td>
        <td style="padding-left:12px;vertical-align:middle;">
          <div style="font-size:15px;font-weight:600;color:${DARK};">${groupName}</div>
          <div style="font-size:13px;color:${MUTED};margin-top:2px;">${memberCount} member${memberCount !== 1 ? "s" : ""} · Added by ${adderName}</div>
        </td>
      </tr>
    </table>

    ${primaryButton("splitx://home", "View group in SplitX")}

    ${divider()}
    <p style="margin:0;font-size:13px;color:${MUTED};">
      Open SplitX and go to the Groups tab to see all expenses in <strong>${groupName}</strong>.
    </p>
  `);
  await sendEmail({ to, subject, html });
}

module.exports = {
  sendWelcomeEmail,
  sendGroupInviteEmail,
  sendAddedToGroupEmail,
};
