# CMBEBIH 2027 website

The website is a single-page English-language conference site. The navigation links to sections on the same page. Its registration form validates the uploaded proof of payment in the browser and again on the server, then emails the registration and attachment to `cmbebih@gmail.com`.

## Run locally

1. Install Node.js 20 or newer.
2. Run `npm install`.
3. Copy `.env.example` to `.env` and set the SMTP host, port, user, password, and verified sender address. Do not commit `.env`.
4. Run `npm start` and open `http://localhost:3000`.

SMTP credentials are required for email delivery. Without them, the website remains viewable, but submissions return a clear configuration error rather than showing a false success.

Uploads are limited to 10 MB and checked by their file contents, not only their name or browser-provided MIME type. Accepted proof formats are PDF and JPEG. Attachments are held in memory only for email delivery and are not saved to disk.

The early-bird cutoff, confirmed committee roster/PDF, official CMBEBIH social link, and three approved conference-gallery photos were not included in the supplied materials. Confirm these before launch. The past-conferences URL supplied in the brief returned HTTP 404 when checked on 4 November 2026; verify the archive URL before publishing.

The supplied web-design guidance includes both local and international bank-transfer details. Verify the account information with the conference organizer before accepting payments.
