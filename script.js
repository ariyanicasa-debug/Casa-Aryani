// Real Google Sheets availability sync setup
// Paste your deployed Google Apps Script Web App URL below.
// Example: const GOOGLE_BOOKINGS_URL = "https://script.google.com/macros/s/XXXXX/exec";
// Leave blank until your Apps Script web app is deployed.
const GOOGLE_BOOKINGS_URL = "";

let bookings = [];
let syncStatus = "Availability will update from confirmed Google Form responses once your Google Sheet link is connected.";
let viewDate = new Date();
viewDate.setDate(1);

const header = document.getElementById("header");
const nav = document.getElementById("nav");
const menuButton = document.getElementById("menuButton");
const calendarGrid = document.getElementById("calendarGrid");
const calendarTitle = document.getElementById("calendarTitle");
const bookedList = document.getElementById("bookedList");
const checkIn = document.getElementById("checkIn");
const checkOut = document.getElementById("checkOut");
const bookingNote = document.getElementById("bookingNote");
const bookingForm = document.getElementById("bookingForm");
const availabilitySyncNote = document.getElementById("availabilitySyncNote");

window.addEventListener("scroll", () => {
  header.classList.toggle("scrolled", window.scrollY > 30);
});

menuButton.addEventListener("click", () => {
  nav.classList.toggle("open");
});

document.querySelectorAll("nav a").forEach(link => {
  link.addEventListener("click", () => nav.classList.remove("open"));
});

const heroVideo = document.getElementById("heroVideo");
if (heroVideo) {
  const attempt = heroVideo.play();
  if (attempt !== undefined) {
    attempt.catch(() => document.querySelector(".hero").classList.add("video-fallback"));
  }
  heroVideo.addEventListener("error", () => document.querySelector(".hero").classList.add("video-fallback"));
}

function toISO(date) {
  const tzOffset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - tzOffset).toISOString().slice(0, 10);
}

function parseDate(value) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function dateRange(start, end) {
  const dates = [];
  const current = parseDate(start);
  const last = parseDate(end);

  while (current < last) {
    dates.push(toISO(current));
    current.setDate(current.getDate() + 1);
  }

  return dates;
}

function bookedSet() {
  const set = new Set();

  bookings.forEach(booking => {
    dateRange(booking.start, booking.end).forEach(date => set.add(date));
  });

  return set;
}

function overlaps(startA, endA, startB, endB) {
  return parseDate(startA) < parseDate(endB) && parseDate(endA) > parseDate(startB);
}

function isAvailable(start, end) {
  return !bookings.some(booking => overlaps(start, end, booking.start, booking.end));
}

function renderCalendar() {
  const bookedDates = bookedSet();
  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const first = new Date(year, month, 1);
  const last = new Date(year, month + 1, 0);

  calendarTitle.textContent = first.toLocaleString("en-US", { month: "long", year: "numeric" });
  calendarGrid.innerHTML = "";

  for (let i = 0; i < first.getDay(); i++) {
    const blank = document.createElement("div");
    blank.className = "day blank";
    calendarGrid.appendChild(blank);
  }

  for (let day = 1; day <= last.getDate(); day++) {
    const iso = toISO(new Date(year, month, day));
    const cell = document.createElement("button");

    cell.type = "button";
    cell.className = "day";
    cell.textContent = day;

    if (bookedDates.has(iso)) {
      cell.classList.add("booked");
    }

    cell.addEventListener("click", () => {
      if (cell.classList.contains("booked")) return;

      if (!checkIn || !checkOut) return;

      if (!checkIn.value || (checkIn.value && checkOut.value)) {
        checkIn.value = iso;
        checkOut.value = "";
      } else if (parseDate(iso) <= parseDate(checkIn.value)) {
        checkIn.value = iso;
      } else {
        checkOut.value = iso;
      }

      highlightRange();
    });

    calendarGrid.appendChild(cell);
  }

  highlightRange();
  renderBookedList();
}

function highlightRange() {
  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();

  document.querySelectorAll(".day").forEach(cell => {
    cell.classList.remove("selected");

    if (!cell.textContent || cell.classList.contains("blank")) return;

    const iso = toISO(new Date(year, month, Number(cell.textContent)));

    if (checkIn && checkOut && checkIn.value && !checkOut.value && iso === checkIn.value) {
      cell.classList.add("selected");
    }

    if (checkIn && checkOut && checkIn.value && checkOut.value && parseDate(iso) >= parseDate(checkIn.value) && parseDate(iso) < parseDate(checkOut.value)) {
      cell.classList.add("selected");
    }
  });
}

function renderBookedList() {
  if (availabilitySyncNote) availabilitySyncNote.textContent = syncStatus;
  if (!bookedList) return;
  bookedList.innerHTML = "";

  bookings.slice().sort((a, b) => a.start.localeCompare(b.start)).forEach(booking => {
    const li = document.createElement("li");
    li.textContent = `${booking.start} to ${booking.end} - ${booking.name || "Booked"}`;
    bookedList.appendChild(li);
  });
}

function normalizeBookingData(data) {
  if (!Array.isArray(data)) throw new Error("Booking data must be an array");

  bookings = data
    .filter(item => item && item.start && item.end)
    .map(item => ({
      start: String(item.start).slice(0, 10),
      end: String(item.end).slice(0, 10),
      name: item.name || item.package || "Booked"
    }));

  syncStatus = "Booked dates are synced from Casa Ariyani Google Form responses.";
  
}

function loadBookingsWithJsonp(url) {
  return new Promise((resolve, reject) => {
    const callbackName = "casaAriyaniBookings_" + Date.now();
    const separator = url.includes("?") ? "&" : "?";
    const script = document.createElement("script");

    const cleanup = () => {
      delete window[callbackName];
      script.remove();
    };

    window[callbackName] = data => {
      cleanup();
      resolve(data);
    };

    script.onerror = () => {
      cleanup();
      reject(new Error("Unable to load booking data from Google Sheets"));
    };

    script.src = `${url}${separator}callback=${callbackName}&t=${Date.now()}`;
    document.body.appendChild(script);
  });
}

async function loadBookingsFromGoogleSheet() {
  if (!GOOGLE_BOOKINGS_URL) {
    syncStatus = "Google Sheets sync is ready. Paste your Apps Script Web App URL in script.js to activate auto-blocking.";
    
    return;
  }

  try {
    syncStatus = "Syncing booked dates from Google Form responses...";
    renderBookedList();

    const data = await loadBookingsWithJsonp(GOOGLE_BOOKINGS_URL);
    normalizeBookingData(data);
  } catch (error) {
    syncStatus = "Booking sync could not load. Please check your Apps Script Web App URL and deployment access.";
    console.warn(error);
    
  }
}

document.getElementById("prevMonth").addEventListener("click", () => {
  viewDate.setMonth(viewDate.getMonth() - 1);
  
});

document.getElementById("nextMonth").addEventListener("click", () => {
  viewDate.setMonth(viewDate.getMonth() + 1);
  
});

if (checkIn) checkIn.addEventListener("change", highlightRange);
if (checkOut) checkOut.addEventListener("change", highlightRange);

loadBookingsFromGoogleSheet();


// Premium scroll reveal transitions
const revealItems = document.querySelectorAll(
  ".highlight-grid article, .amenity-cards article, .calendar-card, .booking-copy, form, .booked-box, .contact-cards, .video-frame, .intro > div, .intro > p"
);

const revealObserver = new IntersectionObserver((entries) => {
  entries.forEach((entry, index) => {
    if (entry.isIntersecting) {
      setTimeout(() => {
        entry.target.classList.add("revealed");
      }, index * 55);
      revealObserver.unobserve(entry.target);
    }
  });
}, {
  threshold: 0.16,
  rootMargin: "0px 0px -40px 0px"
});

revealItems.forEach(item => revealObserver.observe(item));



// Photo slideshow
const slides = Array.from(document.querySelectorAll(".photo-slider .slide"));
const dotsContainer = document.getElementById("sliderDots");
let currentSlide = 0;
let slideTimer;

function showSlide(index) {
  if (!slides.length) return;

  currentSlide = (index + slides.length) % slides.length;

  slides.forEach((slide, slideIndex) => {
    slide.classList.toggle("active", slideIndex === currentSlide);
  });

  document.querySelectorAll(".slider-dots button").forEach((dot, dotIndex) => {
    dot.classList.toggle("active", dotIndex === currentSlide);
  });
}

function startSlideTimer() {
  clearInterval(slideTimer);
  slideTimer = setInterval(() => showSlide(currentSlide + 1), 4500);
}

if (slides.length && dotsContainer) {
  slides.forEach((_, index) => {
    const dot = document.createElement("button");
    dot.type = "button";
    dot.setAttribute("aria-label", `Go to photo ${index + 1}`);
    dot.addEventListener("click", () => {
      showSlide(index);
      startSlideTimer();
    });
    dotsContainer.appendChild(dot);
  });

  document.getElementById("prevSlide").addEventListener("click", () => {
    showSlide(currentSlide - 1);
    startSlideTimer();
  });

  document.getElementById("nextSlide").addEventListener("click", () => {
    showSlide(currentSlide + 1);
    startSlideTimer();
  });

  showSlide(0);
  startSlideTimer();
}



// Responsive welcome loading screen
document.body.classList.add("loading-active");

window.addEventListener("load", () => {
  const loader = document.getElementById("welcomeLoader");

  if (!loader) {
    document.body.classList.remove("loading-active");
    return;
  }

  setTimeout(() => {
    loader.classList.add("hidden");
    document.body.classList.remove("loading-active");
  }, 1600);
});

// Guest account modal





function showAccountModal() {
  if (!accountModal) return;
  accountModal.classList.add("active");
  accountModal.setAttribute("aria-hidden", "false");
  nav.classList.remove("open");
}

function hideAccountModal() {
  if (!accountModal) return;
  accountModal.classList.remove("active");
  accountModal.setAttribute("aria-hidden", "true");
}



/* ==========================================================
   Casa Ariyani Availability Calendar - Google Sheet Sync
   Source Sheet:
   https://docs.google.com/spreadsheets/d/1ypyJg6SxXsWtBkiE7-Aht16MzPaoKzqYbj8Wxty0EAw/edit?gid=1509933581

   Behavior:
   - Green = available
   - Yellow = selected by visitor
   - Red = unavailable/booked from Google Sheet
   - If a row is deleted from Google Sheet, it becomes available again after refresh
   ========================================================== */

const CASA_SHEET_ID = "1ypyJg6SxXsWtBkiE7-Aht16MzPaoKzqYbj8Wxty0EAw";
const CASA_SHEET_GID = "1509933581";
const CASA_SHEET_GVIZ_URL = `https://docs.google.com/spreadsheets/d/${CASA_SHEET_ID}/gviz/tq?gid=${CASA_SHEET_GID}`;

let casaCalendarViewDate = new Date();
casaCalendarViewDate.setDate(1);

let casaBookedDates = new Set();
let casaSelectedDates = new Set();

const casaCalendarGrid = document.getElementById("calendarGrid");
const casaCalendarTitle = document.getElementById("calendarTitle");
const casaSyncNote = document.getElementById("availabilitySyncNote");

function casaUpdateNote(message) {
  if (casaSyncNote) casaSyncNote.textContent = message;
}

function casaFormatISO(date) {
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 10);
}

function casaParseDate(value) {
  if (!value) return null;

  if (Object.prototype.toString.call(value) === "[object Date]" && !Number.isNaN(value.getTime())) {
    return new Date(value.getFullYear(), value.getMonth(), value.getDate());
  }

  const text = String(value).trim();
  if (!text) return null;

  // Google Visualization date format: Date(2026,5,13)
  const gviz = text.match(/Date\((\d+),(\d+),(\d+)\)/);
  if (gviz) {
    return new Date(Number(gviz[1]), Number(gviz[2]), Number(gviz[3]));
  }

  // YYYY-MM-DD
  const iso = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (iso) {
    return new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
  }

  // MM/DD/YYYY or M/D/YYYY
  const slash = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (slash) {
    return new Date(Number(slash[3]), Number(slash[1]) - 1, Number(slash[2]));
  }

  const parsed = new Date(text);
  if (!Number.isNaN(parsed.getTime())) {
    return new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
  }

  return null;
}

function casaNormalizeISO(value) {
  const parsed = casaParseDate(value);
  return parsed ? casaFormatISO(parsed) : null;
}

function casaAddDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function casaExpandDateRange(startISO, endISO) {
  const dates = [];
  const startDate = casaParseDate(startISO);
  const endDate = casaParseDate(endISO || startISO);

  if (!startDate) return dates;

  if (!endDate || casaFormatISO(startDate) === casaFormatISO(endDate)) {
    dates.push(casaFormatISO(startDate));
    return dates;
  }

  let current = new Date(startDate);

  // Treat checkout/end date as exclusive for overnight stays
  while (current < endDate) {
    dates.push(casaFormatISO(current));
    current = casaAddDays(current, 1);
  }

  return dates;
}

function casaFindDateColumns(headers) {
  const normalized = headers.map(h => String(h || "").toLowerCase());

  const startKeywords = [
    "check-in", "check in", "preferred date", "booking date", "reservation date",
    "date of booking", "date", "arrival"
  ];

  const endKeywords = [
    "check-out", "check out", "end date", "departure"
  ];

  let startIndex = -1;
  let endIndex = -1;

  for (let i = 0; i < normalized.length; i++) {
    const header = normalized[i];

    if (startIndex === -1 && startKeywords.some(key => header.includes(key))) {
      startIndex = i;
    }

    if (endIndex === -1 && endKeywords.some(key => header.includes(key))) {
      endIndex = i;
    }
  }

  return { startIndex, endIndex };
}

function casaExtractCellValue(cell) {
  if (!cell) return "";
  if (cell.f !== undefined && cell.f !== null) return cell.f;
  if (cell.v !== undefined && cell.v !== null) return cell.v;
  return "";
}

function casaHandleGoogleSheetResponse(response) {
  try {
    const table = response.table;
    const headers = table.cols.map(col => col.label || col.id || "");
    const { startIndex, endIndex } = casaFindDateColumns(headers);

    const booked = new Set();

    if (startIndex === -1) {
      casaUpdateNote("Could not find a date column in the Google Sheet. Please name your date field Preferred Date or Check-in Date.");
      casaBookedDates = booked;
      casaRenderCalendar();
      return;
    }

    table.rows.forEach(row => {
      const cells = row.c || [];
      const startValue = casaExtractCellValue(cells[startIndex]);
      const endValue = endIndex >= 0 ? casaExtractCellValue(cells[endIndex]) : startValue;

      const startISO = casaNormalizeISO(startValue);
      const endISO = casaNormalizeISO(endValue);

      if (!startISO) return;

      casaExpandDateRange(startISO, endISO || startISO).forEach(date => booked.add(date));
    });

    casaBookedDates = booked;
    casaSelectedDates.forEach(date => {
      if (casaBookedDates.has(date)) casaSelectedDates.delete(date);
    });

    if (booked.size) {
      casaUpdateNote("Availability is synced with your Google Sheet. Booked dates are red. Deleted rows become available again after refresh.");
    } else {
      casaUpdateNote("No booked dates found in the Google Sheet. All dates are currently available.");
    }

    casaRenderCalendar();
  } catch (error) {
    console.error("Casa Ariyani sheet sync error:", error);
    casaUpdateNote("Google Sheet sync could not load. Check sharing settings or publish access.");
    casaRenderCalendar();
  }
}

function casaLoadBookingsFromGoogleSheet() {
  return new Promise(resolve => {
    const callbackName = "casaSheetCallback_" + Date.now();

    window[callbackName] = response => {
      casaHandleGoogleSheetResponse(response);
      delete window[callbackName];
      script.remove();
      resolve();
    };

    const script = document.createElement("script");
    script.src = `${CASA_SHEET_GVIZ_URL}&tqx=responseHandler:${callbackName}`;
    script.onerror = () => {
      delete window[callbackName];
      script.remove();
      casaUpdateNote("Google Sheet sync could not load. Make sure the sheet is shared or published.");
      casaRenderCalendar();
      resolve();
    };

    document.body.appendChild(script);
  });
}

function casaRenderCalendar() {
  if (!casaCalendarGrid || !casaCalendarTitle) return;

  const year = casaCalendarViewDate.getFullYear();
  const month = casaCalendarViewDate.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);

  casaCalendarTitle.textContent = firstDay.toLocaleString("en-US", {
    month: "long",
    year: "numeric"
  });

  casaCalendarGrid.innerHTML = "";

  for (let i = 0; i < firstDay.getDay(); i++) {
    const blank = document.createElement("div");
    blank.className = "day blank";
    casaCalendarGrid.appendChild(blank);
  }

  for (let day = 1; day <= lastDay.getDate(); day++) {
    const date = new Date(year, month, day);
    const iso = casaFormatISO(date);

    const cell = document.createElement("button");
    cell.type = "button";
    cell.className = "day available-day";
    cell.dataset.date = iso;
    cell.textContent = day;

    if (casaBookedDates.has(iso)) {
      cell.classList.remove("available-day");
      cell.classList.add("booked");
      cell.disabled = true;
      cell.title = "Not available";
    } else {
      cell.title = "Available";
      cell.addEventListener("click", () => {
        if (casaSelectedDates.has(iso)) {
          casaSelectedDates.delete(iso);
        } else {
          casaSelectedDates.add(iso);
        }

        if (casaSelectedDates.size) {
          casaUpdateNote("Selected available dates are highlighted yellow. Click Book Now to submit your request.");
        } else {
          casaUpdateNote("Green dates are available. Booked dates from your Google Sheet are red.");
        }

        casaRenderCalendar();
      });
    }

    if (casaSelectedDates.has(iso)) {
      cell.classList.add("selected");
    }

    casaCalendarGrid.appendChild(cell);
  }
}

function casaSetupCalendarNavigation() {
  const prev = document.getElementById("prevMonth");
  const next = document.getElementById("nextMonth");

  if (prev) {
    prev.onclick = () => {
      casaCalendarViewDate.setMonth(casaCalendarViewDate.getMonth() - 1);
      casaRenderCalendar();
    };
  }

  if (next) {
    next.onclick = () => {
      casaCalendarViewDate.setMonth(casaCalendarViewDate.getMonth() + 1);
      casaRenderCalendar();
    };
  }
}

casaSetupCalendarNavigation();
casaRenderCalendar();
casaLoadBookingsFromGoogleSheet();

// Refresh availability every 60 seconds while the page is open
setInterval(casaLoadBookingsFromGoogleSheet, 60000);


// Create Account removed cleanup
document.querySelectorAll("#openAccount, #openAccountHero, #accountModal, .account-nav-btn, .hero-account-btn").forEach(el => el.remove());
