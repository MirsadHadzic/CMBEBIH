# CMBEBIH 2027 website

The website is an English-language, multi-page conference site: Home (`/`), About (`/about.html`), Scientific Program (`/program.html`), For Authors (`/authors.html`), Registration (`/registration.html`), and Venue & Travel (`/venue.html`). Each page has its own compact hero and shared navigation. The registration form validates the uploaded proof of payment in the browser and again on the server, then emails the registration and attachment to `cmbebih@gmail.com`.

## Run locally

1. Install Node.js 20 or newer.
2. Run `npm install`.
3. Copy `.env.example` to `.env` and set the SMTP host, port, user, password, and verified sender address. Do not commit `.env`.
4. Run `npm start` and open `http://localhost:3000`.

SMTP credentials are required for email delivery. Without them, the website remains viewable, but submissions return a clear configuration error rather than showing a false success.

Uploads are limited to 10 MB and checked by their file contents, not only their name or browser-provided MIME type. Accepted proof formats are PDF and JPEG. Attachments are held in memory only for email delivery and are not saved to disk.

## Changes made - 19 November 2026

- Split the site into Home, About, Scientific Program, For Authors, Registration, and Venue & Travel pages, with shared navigation and direct server routes.
- Added compact, page-specific hero sections and distinct page titles and descriptions. The homepage retains its animated canvas hero.
- Added a 36-second orbit animation to the numbered hero graphic on each subpage; the number stays upright.
- Moved the existing conference content to the matching pages and added the Sarajevo Card travel and accommodation partner information to Venue & Travel.
- Kept the registration form and its client/server validation working across the new page structure.
- Checked internal page and anchor links, mobile navigation, page loading, and registration conditional fields. `npm test` passes (6 tests).

## Remaining before launch

- Build a local Past Conferences archive with full historical content and a separate 2025 edition page. The current external archive URL returned HTTP 404 in the latest check.
- Obtain and add approved conference photos, the official CMBEBIH social link, and the confirmed committee roster and PDF.
- Confirm early-bird dates, bank details, and the requested project/partner information with the organizers.
- Replace or verify the Springer Nature AI-policy URL, which returned HTTP 404. IFMBE and Canva returned HTTP 403, so their links could not be confirmed.
- Set up backups and system updates with the hosting provider.
