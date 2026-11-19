const assert = require("node:assert/strict");
const test = require("node:test");
const { app, validateProof, validateRegistration } = require("../server");

function makePdf(name = "proof.pdf") {
  return {
    originalname: name,
    size: 15,
    buffer: Buffer.from("%PDF-1.7\nproof\n%%EOF"),
    mimetype: "application/pdf"
  };
}

function makeJpeg(name = "proof.jpg") {
  return {
    originalname: name,
    size: 5,
    buffer: Buffer.from([0xff, 0xd8, 0xff, 0x00, 0xff, 0xd9]),
    mimetype: "image/jpeg"
  };
}

function registration(overrides = {}) {
  return {
    firstName: "Ada",
    lastName: "Lovelace",
    email: "ada@example.org",
    institution: "Analytical Engines",
    country: "United Kingdom",
    category: "student-paper",
    feePeriod: "early",
    feeAmount: "250",
    paperTitle: "Computing and the future",
    paperId: "MTR-42",
    consent: "yes",
    ...overrides
  };
}

test("accepts proof files whose content and extension match", () => {
  assert.equal(validateProof(makePdf()), null);
  assert.equal(validateProof(makeJpeg()), null);
});

test("rejects mismatched, incomplete, and oversized proof files", () => {
  assert.match(validateProof({ ...makePdf(), originalname: "proof.jpg" }), /contents must match/);
  assert.match(validateProof({ ...makeJpeg(), buffer: Buffer.from("not an image") }), /contents must match/);
  assert.match(validateProof({ ...makePdf(), size: 10 * 1024 * 1024 + 1, buffer: Buffer.alloc(10 * 1024 * 1024 + 1) }), /10 MB/);
  assert.match(validateProof(undefined), /required/);
});

test("requires payment proof and title for student presenting authors", () => {
  const valid = validateRegistration(registration(), makePdf());
  assert.deepEqual(valid.errors, []);
  assert.ok(validateRegistration(registration({ paperTitle: "" }), makePdf()).errors.some((error) => /Paper title is required/.test(error)));
  assert.ok(validateRegistration(registration(), undefined).errors.some((error) => /Proof of payment is required/.test(error)));
});

test("requires the presenting-author answer and paper title for presenting members", () => {
  const fields = registration({ category: "member", feeAmount: "400", presentingAuthor: "yes" });
  assert.ok(validateRegistration({ ...fields, presentingAuthor: "" }, makePdf()).errors.some((error) => /indicate whether/.test(error)));
  assert.ok(validateRegistration({ ...fields, paperTitle: "" }, makePdf()).errors.some((error) => /Paper title is required/.test(error)));
  assert.deepEqual(validateRegistration(fields, makePdf()).errors, []);
});

test("validates category fees and consent server-side", () => {
  const errors = validateRegistration(registration({ feeAmount: "1", consent: "no" }), makePdf()).errors;
  assert.ok(errors.some((error) => /fee does not match/.test(error)));
  assert.ok(errors.some((error) => /Consent/.test(error)));
});

test("serves each conference section as a separate page", async (t) => {
  const server = app.listen(0);
  await new Promise((resolve) => server.once("listening", resolve));
  t.after(() => new Promise((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  }));

  const origin = `http://127.0.0.1:${server.address().port}`;
  for (const [file, pageName] of [
    ["about.html", "About CMBEBIH"],
    ["program.html", "Scientific program"],
    ["authors.html", "For authors"],
    ["registration.html", "Registration"],
    ["venue.html", "Venue &amp; travel"]
  ]) {
    const response = await fetch(`${origin}/${file}`);
    assert.equal(response.status, 200, `${file} should be available`);
    const html = await response.text();
    assert.ok(html.includes(`<h1 id="page-title">${pageName}</h1>`));
    assert.match(html, /class="page-hero /);
    assert.match(html, /aria-current="page"/);
  }
});
