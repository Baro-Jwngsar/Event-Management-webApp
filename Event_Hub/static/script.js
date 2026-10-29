document.addEventListener("DOMContentLoaded", () => {
  let allEvents = [];
  let currentFilter = "All";
  let stackInterval = null;
  let currentCardIndex = 0;

  fetch("/api/events")
    .then(res => res.json())
    .then(events => {
      allEvents = events;
      renderFilters();
      renderEvents(allEvents);
      if (events.length > 0) {
        initHeroCardStack(events);
        populateDropdown(events);
      } else {
        document.getElementById("eventList").innerHTML = '<p class="empty">No upcoming events right now.</p>';
        const stackContainer = document.getElementById("nextTicket");
        if (stackContainer) {
          stackContainer.innerHTML = '<p class="empty" style="color:#fff; padding:20px;">No featured events.</p>';
        }
      }
    })
    .catch(err => {
      console.error(err);
      document.getElementById("eventList").innerHTML = '<p class="empty">Error loading events.</p>';
    });

  function renderFilters() {
    const filtersEl = document.getElementById("filters");
    if (!filtersEl) return;
    const audiencesSet = new Set();
    allEvents.forEach(e => {
      if (e.audience) {
        e.audience.split(",").forEach(a => audiencesSet.add(a.trim()));
      }
    });
    let html = `<button class="pill active" data-filter="All">All</button>`;
    audiencesSet.forEach(aud => {
      html += `<button class="pill" data-filter="${aud}">${aud}</button>`;
    });
    filtersEl.innerHTML = html;

    filtersEl.querySelectorAll(".pill").forEach(btn => {
      btn.addEventListener("click", () => {
        filtersEl.querySelectorAll(".pill").forEach(p => p.classList.remove("active"));
        btn.classList.add("active");
        currentFilter = btn.getAttribute("data-filter");
        const filtered = currentFilter === "All" ? allEvents : allEvents.filter(e => e.audience && e.audience.includes(currentFilter));
        renderEvents(filtered);
      });
    });
  }

  function renderEvents(events) {
    const listEl = document.getElementById("eventList");
    if (!listEl) return;
    if (events.length === 0) {
      listEl.innerHTML = '<p class="empty">No events found for this category.</p>';
      return;
    }

    let html = "";
    events.forEach(e => {
      const imgStyle = e.image
        ? `background-image: linear-gradient(rgba(14, 22, 38, 0.75), rgba(14, 22, 38, 0.90)), url('${e.image}'); background-size: cover; background-position: center;`
        : `background: var(--surface);`;

      html += `
        <div class="event-card-item" style="${imgStyle} min-width: 360px; max-width: 380px; height: 460px; flex: 0 0 auto; scroll-snap-align: start; border-radius: 16px; border: 1px solid var(--line); padding: 28px; display: flex; flex-direction: column; justify-content: space-between; color: #FFFFFF; box-shadow: 0 12px 32px rgba(0,0,0,0.4);">
          <div>
            <div style="display: flex; justify-content: flex-end; margin-bottom: 12px;">
              ${e.audience ? `<span style="background: var(--accent); color: var(--on-accent); font-weight: 700; font-size: 12px; padding: 4px 12px; border-radius: 20px; text-transform: uppercase;">${e.audience.split(',')[0]}</span>` : ''}
            </div>
            <h3 style="font-family: var(--font-display); font-size: 24px; font-weight: 800; margin-bottom: 10px; color: #fff;">${e.title}</h3>
            <p style="font-size: 14px; opacity: 0.95; margin-bottom: 12px;">📅 ${e.date} &nbsp;|&nbsp; ⏰ ${e.time}<br>📍 ${e.venue || 'Venue to be announced'}</p>
            <p style="font-size: 14.5px; opacity: 0.9; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden;">${e.info}</p>
          </div>
          <div style="display: flex; justify-content: space-between; align-items: center; border-top: 1px solid rgba(255,255,255,0.2); padding-top: 14px;">
            <span style="font-size: 13.5px; font-weight: 600;">Seats: ${e.taken}${e.capacity ? ' / ' + e.capacity : ''}</span>
            <a href="#register" class="btn" onclick="selectEventForReg(${e.id})">Register</a>
          </div>
        </div>
      `;
    });
    listEl.innerHTML = html;
  }

  // --- Hero Section Animated Card Stack Logic ---
  function initHeroCardStack(events) {
    const stackContainer = document.getElementById("nextTicket");
    if (!stackContainer) return;

    const featuredEvents = events.slice(0, 4);

    stackContainer.innerHTML = featuredEvents.map((ev, index) => {
      const bgImg = ev.image ? ev.image : 'https://images.unsplash.com/photo-1540575467063-178a50c2df87';
      let className = "";
      if (index === 0) className = "active";
      else if (index === 1) className = "next";

      return `
        <div class="hero-card ${className}" style="background-image: url('${bgImg}');">
          <div class="event-title">${ev.title}</div>
          <div class="event-meta">📅 ${ev.date} at ${ev.time} | 📍 ${ev.venue || 'Venue TBA'}</div>
          <a href="#register" class="btn-register" onclick="selectEventForReg(${ev.id})">Register now</a>
        </div>
      `;
    }).join('');

    const cards = stackContainer.querySelectorAll('.hero-card');
    if (cards.length <= 1) return;

    if (stackInterval) clearInterval(stackInterval);

    stackInterval = setInterval(() => {
      cards.forEach(card => {
        card.classList.remove('active', 'next', 'prev');
      });

      cards[currentCardIndex].classList.add('prev');

      currentCardIndex = (currentCardIndex + 1) % cards.length;
      let nextIndex = (currentCardIndex + 1) % cards.length;

      cards[currentCardIndex].classList.add('active');
      cards[nextIndex].classList.add('next');
    }, 4000);
  }

  function populateDropdown(events) {
    const select = document.getElementById("f-event");
    if (!select) return;
    select.innerHTML = "";
    events.forEach(e => {
      const opt = document.createElement("option");
      opt.value = e.id;
      opt.textContent = `${e.title} (${e.date})`;
      select.appendChild(opt);
    });
  }

  window.selectEventForReg = function (id) {
    const select = document.getElementById("f-event");
    if (select) select.value = id;
  };

  // --- Unified Form Submit & Validation Handler ---
  // --- Unified Form Submit & Strict Validation Handler ---
  const regForm = document.getElementById("regForm");
  if (regForm) {
    regForm.addEventListener("submit", async function (e) {
      e.preventDefault();
      const statusEl = document.getElementById("status");
      const submitBtn = document.getElementById("submitBtn");

      // Honeypot spam check
      const website = document.getElementById("f-website") ? document.getElementById("f-website").value : "";
      if (website) return;

      // Check Terms checkbox
      const terms = document.getElementById("f-terms");
      if (terms && !terms.checked) {
        statusEl.innerText = "Please accept the terms and conditions.";
        statusEl.style.color = "#ff6b6b";
        terms.focus();
        return;
      }

      // Strict 10-Digit Phone Check
      const phoneInput = document.getElementById("f-phone");
      const phoneRegex = /^[0-9]{10}$/;
      if (!phoneRegex.test(phoneInput.value.trim())) {
        statusEl.innerText = "Please enter a valid 10-digit mobile number.";
        statusEl.style.color = "#ff6b6b";
        phoneInput.focus();
        return;
      }

      // Strict Email Validation Check
      const emailInput = document.getElementById("f-email");
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(emailInput.value.trim())) {
        statusEl.innerText = "Please enter a valid email address.";
        statusEl.style.color = "#ff6b6b";
        emailInput.focus();
        return;
      }

      // Check Standard HTML5 Form Validity
      if (!regForm.checkValidity()) {
        regForm.reportValidity();
        return;
      }

      const payload = {
        event_id: document.getElementById("f-event").value,
        name: document.getElementById("f-name").value,
        phone: phoneInput.value.trim(),
        email: emailInput.value.trim(),
        role: document.getElementById("f-role").value,
        seats: document.getElementById("f-seats").value,
        message: document.getElementById("f-msg") ? document.getElementById("f-msg").value : ""
      };

      if (submitBtn) submitBtn.disabled = true;
      statusEl.innerText = "Submitting registration...";
      statusEl.style.color = "var(--accent, #F2B705)";

      try {
        const response = await fetch("/api/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });

        const resData = await response.json().catch(() => ({}));

        if (response.ok && (resData.success === true || resData.success === "success")) {
          statusEl.innerText = resData.message || "Registration successful!";
          statusEl.style.color = "var(--ok, #34D399)";
          regForm.reset();
        } else {
          statusEl.innerText = resData.error || resData.message || "Registration failed. Please try again.";
          statusEl.style.color = "#ff6b6b";
        }
      } catch (err) {
        statusEl.innerText = "Network error. Please check your connection.";
        statusEl.style.color = "#ff6b6b";
      } finally {
        if (submitBtn) submitBtn.disabled = false;
      }
    });
  }
  // QR Code Generator
  const qrContainer = document.getElementById("qr");
  if (qrContainer && typeof qrcode !== "undefined") {
    qrContainer.innerHTML = "";
    try {
      const qr = qrcode(0, 'H');
      qr.addData(window.location.href);
      qr.make();
      qrContainer.innerHTML = qr.createImgTag(4, 4);
    } catch (e) {
      console.error("QR Code generation error:", e);
    }
  }

  // Horizontal Queue Scroll Buttons Logic
  const scrollLeftBtn = document.getElementById("scrollLeftBtn");
  const scrollRightBtn = document.getElementById("scrollRightBtn");
  const eventListContainer = document.getElementById("eventList");

  if (scrollLeftBtn && scrollRightBtn && eventListContainer) {
    scrollLeftBtn.addEventListener("click", () => {
      eventListContainer.scrollBy({ left: -400, behavior: "smooth" });
    });

    scrollRightBtn.addEventListener("click", () => {
      eventListContainer.scrollBy({ left: 400, behavior: "smooth" });
    });
  }

  // Toggle Horizontal Floating Contact Dock
  const contactNavLinks = document.querySelectorAll('nav a[href="#contact"]');
  const floatingDock = document.getElementById("floatingDock");

  contactNavLinks.forEach(link => {
    link.addEventListener("click", (e) => {
      e.preventDefault();
      if (floatingDock) {
        floatingDock.classList.toggle("show");
      }
    });
  });

  // SVG Animated Background Grid Generator
  const chart = document.getElementById("chart");
  if (chart) {
    const cols = 30;
    const rows = 13;
    const w = 1200 / cols;
    const h = 520 / rows;
    let svgContent = "";

    for (let i = 0; i < cols; i++) {
      for (let j = 0; j < rows; j++) {
        if (Math.random() < 0.22) {
          const dur = (3 + Math.random() * 4).toFixed(1) + 's';
          const delay = (Math.random() * 6).toFixed(1) + 's';
          svgContent += `<rect class="cell" x="${i * w + 1}" y="${j * h + 1}" width="${w - 2}" height="${h - 2}" style="--dur: ${dur}; --delay: ${delay};" />`;
        }
      }
    }
    chart.innerHTML = svgContent;
  }
});

window.copyText = function (btn, text) {
  if (navigator.clipboard) {
    navigator.clipboard.writeText(text).then(() => {
      const originalText = btn.textContent;
      btn.textContent = "Copied! ✓";

      setTimeout(() => {
        btn.textContent = originalText;
      }, 2000);
    }).catch(err => {
      console.error("Clipboard write failed:", err);
    });
  } else {
    alert("Clipboard not supported in this browser.");
  }
};