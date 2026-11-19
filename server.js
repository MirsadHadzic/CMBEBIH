const path = require("node:path");
require("dotenv").config();
const express = require("express");
const multer = require("multer");
const nodemailer = require("nodemailer");

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const MAX_FILE_SIZE = 10 * 1024 * 1024;
const RECIPIENT = "cmbebih@gmail.com";
const categories = {
  member: { label: "Member", early: 400, regular: 450 },
  industry: { label: "Industry Professional", early: 550, regular: 650 },
  "student-paper": { label: "Student with Paper Presentation", early: 250, regular: 450 },
  "student-participant": { label: "Student Participant", early: 50, regular: 80 }
};
const requestTimes = new Map();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE, files: 1, fields: 16, fieldSize: 2000, parts: 18 }
});

app.disable("x-powered-by");
app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("X-Frame-Options", "DENY");
  next();
});
app.get("/", (req, res) => res.sendFile(path.join(__dirname, "index.html")));
app.get(
  ["/about.html", "/program.html", "/authors.html", "/registration.html", "/venue.html"],
  (req, res) => res.sendFile(path.join(__dirname, req.path.slice(1)))
);
app.get("/style.css", (req, res) => res.sendFile(path.join(__dirname, "style.css")));
app.get("/script.js", (req, res) => res.sendFile(path.join(__dirname, "script.js")));
app.use("/img", express.static(path.join(__dirname, "img"), { maxAge: "1d" }));

function isNonEmptyString(value, maxLength) {
  return typeof value === "string" && value.trim().length > 0 && value.trim().length <= maxLength;
}

function validateProof(file) {
  if (!file || !Buffer.isBuffer(file.buffer)) return "Proof of payment is required.";
  if (file.size > MAX_FILE_SIZE) return "Proof of payment must not exceed 10 MB.";

  const name = path.basename(file.originalname || "");
  const extension = path.extname(name).toLowerCase();
  const bytes = file.buffer;
  const isPdf = bytes.length >= 10
    && bytes.subarray(0, 5).toString("ascii") === "%PDF-"
    && bytes.subarray(Math.max(0, bytes.length - 1024)).includes(Buffer.from("%%EOF"));
  const isJpeg = bytes.length >= 4
    && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff
    && bytes.subarray(-2).equals(Buffer.from([0xff, 0xd9]));

  if (isPdf && extension === ".pdf") return null;
  if (isJpeg && (extension === ".jpg" || extension === ".jpeg")) return null;
  return "Proof of payment must be a valid PDF, JPG or JPEG file. The file contents must match its extension.";
}

function validateRegistration(fields, file) {
  const errors = [];
  for (const [field, label, maxLength] of [
    ["firstName", "First name", 80],
    ["lastName", "Last name", 80],
    ["email", "Email address", 254],
    ["institution", "Institution / organization", 160],
    ["country", "Country", 80]
  ]) {
    if (!isNonEmptyString(fields[field], maxLength)) errors.push(`${label} is required and must be ${maxLength} characters or fewer.`);
  }

  if (isNonEmptyString(fields.email, 254) && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fields.email.trim())) {
    errors.push("Enter a valid email address.");
  }

  const category = categories[fields.category];
  if (!category) errors.push("Choose a valid registration category.");
  if (!["early", "regular"].includes(fields.feePeriod)) errors.push("Choose a valid payment period.");
  if (category && ["early", "regular"].includes(fields.feePeriod)
    && Number(fields.feeAmount) !== category[fields.feePeriod]) {
    errors.push("The registration fee does not match the selected category and payment period.");
  }
  if (fields.consent !== "yes") errors.push("Consent to personal data processing is required.");
  if (fields.website) errors.push("Invalid registration request.");

  let presentingAuthor = "Not applicable";
  let paperTitle = "";
  let paperId = "";
  if (fields.category === "member" || fields.category === "industry") {
    if (!["yes", "no"].includes(fields.presentingAuthor)) {
      errors.push("Please indicate whether you are registering as a presenting author.");
    } else {
      presentingAuthor = fields.presentingAuthor === "yes" ? "Yes" : "No";
      if (fields.presentingAuthor === "yes") {
        if (!isNonEmptyString(fields.paperTitle, 300)) errors.push("Paper title is required for presenting authors.");
        else paperTitle = fields.paperTitle.trim();
      }
    }
  } else if (fields.category === "student-paper") {
    if (!isNonEmptyString(fields.paperTitle, 300)) errors.push("Paper title is required for student paper presentations.");
    else paperTitle = fields.paperTitle.trim();
    if (fields.paperId && !isNonEmptyString(fields.paperId, 80)) errors.push("Paper ID must be 80 characters or fewer.");
    else paperId = (fields.paperId || "").trim();
  }

  const proofError = validateProof(file);
  if (proofError) errors.push(proofError);

  return {
    errors,
    category,
    presentingAuthor,
    paperTitle,
    paperId,
    fullName: `${(fields.firstName || "").trim()} ${(fields.lastName || "").trim()}`.trim()
  };
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[character]);
}

function allowSubmission(req, res, next) {
  const now = Date.now();
  const ip = req.ip;
  const prior = (requestTimes.get(ip) || []).filter((time) => now - time < 10 * 60 * 1000);
  if (prior.length >= 8) return res.status(429).json({ error: "Too many attempts. Please wait a few minutes and try again." });
  prior.push(now);
  requestTimes.set(ip, prior);
  return next();
}

app.post("/api/register", allowSubmission, (req, res, next) => {
  upload.single("proofOfPayment")(req, res, (error) => {
    if (error) {
      if (error instanceof multer.MulterError && error.code === "LIMIT_FILE_SIZE") {
        return res.status(400).json({ error: "Proof of payment must not exceed 10 MB." });
      }
      if (error instanceof multer.MulterError) {
        return res.status(400).json({ error: "The uploaded form is invalid. Check the file and required fields." });
      }
      return next(error);
    }

    const registration = validateRegistration(req.body, req.file);
    if (registration.errors.length) return res.status(400).json({ error: registration.errors.join(" ") });

    const smtpHost = process.env.SMTP_HOST;
    const smtpUser = process.env.SMTP_USER;
    const smtpPass = process.env.SMTP_PASS;
    const from = process.env.MAIL_FROM || smtpUser;
    const smtpPort = Number(process.env.SMTP_PORT) || 587;
    if (!smtpHost || !smtpUser || !smtpPass || !from) {
      return res.status(503).json({ error: "Registration email is not configured yet. Please email cmbebih@gmail.com directly." });
    }

    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpPort === 465,
      requireTLS: smtpPort !== 465,
      auth: { user: smtpUser, pass: smtpPass }
    });
    const periodLabel = req.body.feePeriod === "early" ? "Early Bird" : "Regular";
    const paperId = registration.paperId || "Not provided";
    const paperTitle = registration.paperTitle || "Not applicable";
    const text = [
      "CMBEBIH 2027 — New Registration",
      "",
      `Full name: ${registration.fullName}`,
      `Email address: ${req.body.email.trim()}`,
      `Institution / organization: ${req.body.institution.trim()}`,
      `Country: ${req.body.country.trim()}`,
      `Registration category: ${registration.category.label}`,
      `Payment period: ${periodLabel}`,
      `Registration fee: EUR ${registration.category[req.body.feePeriod]}`,
      `Presenting author: ${registration.presentingAuthor}`,
      `Paper title: ${paperTitle}`,
      `Paper ID (Meteor Submission ID): ${paperId}`,
      "Consent to personal data processing: Yes",
      "",
      `Proof of payment attached: ${path.basename(req.file.originalname)}`
    ].join("\n");
    const html = `<h2>CMBEBIH 2027 — New Registration</h2><table>${[
      ["Full name", registration.fullName],
      ["Email address", req.body.email.trim()],
      ["Institution / organization", req.body.institution.trim()],
      ["Country", req.body.country.trim()],
      ["Registration category", registration.category.label],
      ["Payment period", periodLabel],
      ["Registration fee", `EUR ${registration.category[req.body.feePeriod]}`],
      ["Presenting author", registration.presentingAuthor],
      ["Paper title", paperTitle],
      ["Paper ID (Meteor Submission ID)", paperId],
      ["Consent to personal data processing", "Yes"]
    ].map(([label, value]) => `<tr><th align="left">${escapeHtml(label)}</th><td>${escapeHtml(value)}</td></tr>`).join("")}</table><p>Proof of payment is attached.</p>`;
    const safeName = registration.fullName.replace(/[\r\n"]/g, " ").slice(0, 160);
    const safeCategory = registration.category.label.replace(/[\r\n"]/g, " ");

    transporter.sendMail({
      from,
      to: RECIPIENT,
      replyTo: req.body.email.trim(),
      subject: `CMBEBIH 2027 | New Registration – ${safeName} – ${safeCategory}`,
      text,
      html,
      attachments: [{
        filename: `proof-of-payment${path.extname(req.file.originalname).toLowerCase()}`,
        content: req.file.buffer,
        contentType: req.file.mimetype
      }]
    }).then(() => {
      res.status(201).json({ message: "Registration sent." });
    }).catch((error) => {
      console.error("Registration email delivery failed:", error.message);
      res.status(502).json({ error: "We could not deliver your registration email. Please try again or email cmbebih@gmail.com." });
    });
  });
});

app.use((error, req, res, next) => {
  console.error("Request failed:", error.message);
  res.status(500).json({ error: "An unexpected server error occurred. Please try again or email cmbebih@gmail.com." });
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`CMBEBIH 2027 is available at http://localhost:${PORT}`);
  });
}

module.exports = { app, validateProof, validateRegistration };
