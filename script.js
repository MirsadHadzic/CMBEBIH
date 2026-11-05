(() => {
  const menuToggle = document.querySelector(".menu-toggle");
  const navigation = document.querySelector(".primary-nav");
  const categorySelect = document.querySelector("#registration-category");
  const periodSelect = document.querySelector("#fee-period");
  const feeSummary = document.querySelector("#fee-summary");
  const presentingField = document.querySelector("#presenting-author-field");
  const paperTitleField = document.querySelector("#paper-title-field");
  const paperIdField = document.querySelector("#paper-id-field");
  const paperTitleInput = document.querySelector("#paper-title");
  const proofInput = document.querySelector("#proof-of-payment");
  const uploadZone = document.querySelector("#upload-zone");
  const fileStatus = document.querySelector("#file-status");
  const form = document.querySelector("#registration-form");
  const formMessage = document.querySelector("#form-message");
  const fees = {
    member: { early: 400, regular: 450 },
    industry: { early: 550, regular: 650 },
    "student-paper": { early: 250, regular: 450 },
    "student-participant": { early: 50, regular: 80 }
  };
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function setMenuOpen(open) {
    menuToggle.setAttribute("aria-expanded", String(open));
    menuToggle.setAttribute("aria-label", open ? "Close navigation" : "Open navigation");
    navigation.classList.toggle("is-open", open);
    document.body.classList.toggle("menu-open", open);
  }

  menuToggle.addEventListener("click", () => {
    setMenuOpen(menuToggle.getAttribute("aria-expanded") !== "true");
  });

  navigation.addEventListener("click", (event) => {
    if (event.target.closest("a")) setMenuOpen(false);
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && menuToggle.getAttribute("aria-expanded") === "true") {
      setMenuOpen(false);
      menuToggle.focus();
    }
  });

  const paymentTabs = [...document.querySelectorAll("[data-payment-tab]")];
  const paymentPanels = [...document.querySelectorAll("[data-payment-panel]")];

  function activatePaymentTab(name, moveFocus = false) {
    paymentTabs.forEach((tab) => {
      const selected = tab.dataset.paymentTab === name;
      tab.classList.toggle("is-active", selected);
      tab.setAttribute("aria-selected", String(selected));
      tab.tabIndex = selected ? 0 : -1;
      if (selected && moveFocus) tab.focus();
    });
    paymentPanels.forEach((panel) => {
      panel.hidden = panel.dataset.paymentPanel !== name;
    });
  }

  paymentTabs.forEach((tab) => {
    tab.addEventListener("click", () => activatePaymentTab(tab.dataset.paymentTab));
    tab.addEventListener("keydown", (event) => {
      const currentIndex = paymentTabs.indexOf(tab);
      let nextIndex;
      if (event.key === "ArrowRight") nextIndex = (currentIndex + 1) % paymentTabs.length;
      if (event.key === "ArrowLeft") nextIndex = (currentIndex - 1 + paymentTabs.length) % paymentTabs.length;
      if (event.key === "Home") nextIndex = 0;
      if (event.key === "End") nextIndex = paymentTabs.length - 1;
      if (nextIndex !== undefined) {
        event.preventDefault();
        activatePaymentTab(paymentTabs[nextIndex].dataset.paymentTab, true);
      }
    });
  });

  document.querySelectorAll(".copy-detail").forEach((button) => {
    button.addEventListener("click", async () => {
      const originalLabel = button.textContent;
      try {
        if (navigator.clipboard?.writeText) {
          await navigator.clipboard.writeText(button.dataset.copy);
        } else {
          const temporaryInput = document.createElement("textarea");
          temporaryInput.value = button.dataset.copy;
          temporaryInput.setAttribute("readonly", "");
          temporaryInput.style.position = "fixed";
          temporaryInput.style.opacity = "0";
          document.body.append(temporaryInput);
          temporaryInput.select();
          const copied = document.execCommand("copy");
          temporaryInput.remove();
          if (!copied) throw new Error("Copy command was not available.");
        }
        button.textContent = "Copied";
      } catch {
        button.textContent = "Copy failed";
      }
      window.setTimeout(() => {
        button.textContent = originalLabel;
      }, 1800);
    });
  });

  function updateConditionalFields() {
    const category = categorySelect.value;
    const showPresenting = category === "member" || category === "industry";
    const showStudentPaper = category === "student-paper";
    presentingField.hidden = !showPresenting;
    paperIdField.hidden = !showStudentPaper;

    const selectedPresenting = form.querySelector('input[name="presentingAuthor"]:checked');
    const showAuthorTitle = showStudentPaper || (showPresenting && selectedPresenting?.value === "yes");
    paperTitleField.hidden = !showAuthorTitle;
    paperTitleInput.required = showAuthorTitle;

    if (!showPresenting) {
      form.querySelectorAll('input[name="presentingAuthor"]').forEach((input) => {
        input.checked = false;
        input.required = false;
      });
    } else {
      form.querySelectorAll('input[name="presentingAuthor"]').forEach((input) => {
        input.required = true;
      });
    }

    if (!showAuthorTitle) paperTitleInput.value = "";
    if (!showStudentPaper) form.elements.paperId.value = "";
    updateFeeSummary();
  }

  function updateFeeSummary() {
    const category = categorySelect.value;
    const period = periodSelect.value;
    if (!category || !period) {
      feeSummary.textContent = category ? "Select a payment period to see your fee." : "Choose a category and payment period to see your fee.";
      return;
    }
    const periodName = period === "early" ? "Early Bird" : "Regular";
    feeSummary.textContent = `${periodName} registration fee: €${fees[category][period]}. Early-bird dates will be announced.`;
  }

  categorySelect.addEventListener("change", updateConditionalFields);
  periodSelect.addEventListener("change", updateFeeSummary);
  form.querySelectorAll('input[name="presentingAuthor"]').forEach((input) => {
    input.addEventListener("change", updateConditionalFields);
  });

  async function getActualFileType(file) {
    const bytes = new Uint8Array(await file.slice(0, 8).arrayBuffer());
    const isPdf = bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46 && bytes[4] === 0x2d;
    const isJpeg = bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
    return isPdf ? "pdf" : isJpeg ? "jpeg" : null;
  }

  async function validateProof(file) {
    if (!file) return "Please attach proof of payment.";
    if (file.size > 10 * 1024 * 1024) return "The selected file exceeds the 10 MB limit.";
    const fileType = await getActualFileType(file);
    if (!fileType) return "The file must be a valid PDF or JPEG image.";
    const extension = file.name.split(".").pop().toLowerCase();
    if ((fileType === "pdf" && extension !== "pdf") || (fileType === "jpeg" && !["jpg", "jpeg"].includes(extension))) {
      return "The file extension does not match its actual format.";
    }
    return "";
  }

  async function showSelectedFile(file) {
    const error = await validateProof(file);
    if (error) {
      proofInput.setCustomValidity(error);
      fileStatus.textContent = error;
      fileStatus.classList.add("is-invalid");
      return false;
    }
    proofInput.setCustomValidity("");
    fileStatus.classList.remove("is-invalid");
    fileStatus.textContent = `${file.name} · ${(file.size / 1024 / 1024).toFixed(2)} MB`;
    return true;
  }

  proofInput.addEventListener("change", () => {
    fileStatus.textContent = "";
    if (proofInput.files[0]) showSelectedFile(proofInput.files[0]);
    else proofInput.setCustomValidity("");
  });

  ["dragenter", "dragover"].forEach((eventName) => {
    uploadZone.addEventListener(eventName, (event) => {
      event.preventDefault();
      uploadZone.classList.add("is-dragging");
    });
  });
  ["dragleave", "drop"].forEach((eventName) => {
    uploadZone.addEventListener(eventName, (event) => {
      event.preventDefault();
      uploadZone.classList.remove("is-dragging");
    });
  });
  uploadZone.addEventListener("drop", async (event) => {
    const file = event.dataTransfer.files[0];
    if (!file) return;
    const transfer = new DataTransfer();
    transfer.items.add(file);
    proofInput.files = transfer.files;
    await showSelectedFile(file);
  });

  function showMessage(message, isError = false) {
    formMessage.textContent = message;
    formMessage.hidden = false;
    formMessage.classList.toggle("is-error", isError);
    formMessage.scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth", block: "nearest" });
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    formMessage.hidden = true;
    const proof = proofInput.files[0];
    const proofError = await validateProof(proof);
    proofInput.setCustomValidity(proofError);
    if (!form.reportValidity()) return;

    const submitButton = form.querySelector(".submit-button");
    submitButton.disabled = true;
    submitButton.querySelector("span:first-child").textContent = "Sending registration…";

    const requestData = new FormData(form);
    requestData.set("feeAmount", String(fees[categorySelect.value][periodSelect.value]));
    try {
      const response = await fetch("/api/register", { method: "POST", body: requestData });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "Your registration could not be sent. Please try again or email cmbebih@gmail.com.");
      form.reset();
      fileStatus.textContent = "";
      updateConditionalFields();
      showMessage("Thank you — your CMBEBIH 2027 registration and proof of payment have been sent to the organizers.");
    } catch (error) {
      showMessage(error.message, true);
    } finally {
      submitButton.disabled = false;
      submitButton.querySelector("span:first-child").textContent = "Submit registration";
    }
  });

  function startCountdown() {
    const target = new Date("2027-10-14T09:00:00+02:00").getTime();
    const update = () => {
      const remaining = Math.max(0, target - Date.now());
      const values = {
        days: Math.floor(remaining / 86400000),
        hours: Math.floor((remaining % 86400000) / 3600000),
        minutes: Math.floor((remaining % 3600000) / 60000)
      };
      Object.entries(values).forEach(([unit, value]) => {
        document.querySelector(`[data-countdown="${unit}"]`).textContent = String(value).padStart(2, "0");
      });
    };
    update();
    window.setInterval(update, 60000);
  }

  function startHeroVisual() {
    const canvas = document.querySelector(".hero-canvas");
    const context = canvas.getContext("2d");
    const points = [];
    let width = 0;
    let height = 0;
    let frame;
    let resizeObserver;
    const maxDistance = 145;

    function resize() {
      const rect = canvas.getBoundingClientRect();
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      width = rect.width;
      height = rect.height;
      canvas.width = width * ratio;
      canvas.height = height * ratio;
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      const count = Math.min(115, Math.max(36, Math.floor(width * height / 8500)));
      points.length = 0;
      for (let i = 0; i < count; i += 1) {
        points.push({
          x: Math.random() * width,
          y: Math.random() * height,
          dx: (Math.random() - .5) * .28,
          dy: (Math.random() - .5) * .28,
          radius: Math.random() * 1.6 + .6
        });
      }
    }

    function draw() {
      context.clearRect(0, 0, width, height);
      points.forEach((point, index) => {
        point.x += point.dx;
        point.y += point.dy;
        if (point.x < 0 || point.x > width) point.dx *= -1;
        if (point.y < 0 || point.y > height) point.dy *= -1;
        for (let otherIndex = index + 1; otherIndex < points.length; otherIndex += 1) {
          const other = points[otherIndex];
          const distance = Math.hypot(point.x - other.x, point.y - other.y);
          if (distance < maxDistance) {
            context.beginPath();
            context.strokeStyle = `rgba(130, 219, 201, ${(1 - distance / maxDistance) * .16})`;
            context.lineWidth = .7;
            context.moveTo(point.x, point.y);
            context.lineTo(other.x, other.y);
            context.stroke();
          }
        }
        context.beginPath();
        context.fillStyle = point.radius > 1.8 ? "rgba(211,243,107,.7)" : "rgba(164,224,214,.55)";
        context.arc(point.x, point.y, point.radius, 0, Math.PI * 2);
        context.fill();
      });
        if (!reducedMotion) frame = window.requestAnimationFrame(draw);
    }

    resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(canvas);
    resize();
    if (!reducedMotion) frame = window.requestAnimationFrame(draw);
    else draw();
    document.addEventListener("visibilitychange", () => {
      if (document.hidden && frame) window.cancelAnimationFrame(frame);
      else if (!document.hidden && !reducedMotion) frame = window.requestAnimationFrame(draw);
    });
  }

  startCountdown();
  startHeroVisual();
})();
