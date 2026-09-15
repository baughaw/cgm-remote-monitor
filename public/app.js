const valueEl = document.querySelector("#value");
const arrowEl = document.querySelector("#arrow");
const glucoseEl = document.querySelector("#glucose");
const clockEl = document.querySelector("#clock");
const readingTimeEl = document.querySelector("#reading-time");
const wakeLockButton = document.querySelector("#wake-lock");
const displayEl = document.querySelector("#display");
const dimDownButton = document.querySelector("#dim-down");
const dimUpButton = document.querySelector("#dim-up");

let lastReading = null;
let wakeLock = null;
let keepAwakeRequested = false;
let refreshTimer = null;
const brightnessLevels = [0.08, 0.14, 0.22, 0.32, 0.45, 0.65, 1];
let brightnessIndex = Number(localStorage.getItem("brightnessLevel"));
if (!Number.isInteger(brightnessIndex) || brightnessIndex < 0 || brightnessIndex >= brightnessLevels.length) {
  brightnessIndex = 3;
}

function applyBrightness() {
  displayEl.style.opacity = brightnessLevels[brightnessIndex];
  localStorage.setItem("brightnessLevel", brightnessIndex);
  dimDownButton.disabled = brightnessIndex === 0;
  dimUpButton.disabled = brightnessIndex === brightnessLevels.length - 1;
}

dimDownButton.addEventListener("click", () => {
  brightnessIndex = Math.max(0, brightnessIndex - 1);
  applyBrightness();
});

dimUpButton.addEventListener("click", () => {
  brightnessIndex = Math.min(brightnessLevels.length - 1, brightnessIndex + 1);
  applyBrightness();
});

const clockFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/New_York",
  hour: "numeric",
  minute: "2-digit"
});

function updateClock() {
  clockEl.textContent = clockFormatter.format(new Date());
  updateReadingAge();
}

function updateReadingAge() {
  if (!lastReading) return;
  const ageMinutes = Math.max(0, Math.floor((Date.now() - lastReading.timestamp) / 60000));
  const stale = ageMinutes >= 15;
  readingTimeEl.textContent = ageMinutes < 1
    ? "Reading just now"
    : `Reading ${ageMinutes} minute${ageMinutes === 1 ? "" : "s"} ago`;
  readingTimeEl.classList.toggle("stale", stale);
  if (stale) readingTimeEl.textContent += " · Dexcom data is stale";
}

function showReading(reading) {
  lastReading = reading;
  valueEl.textContent = reading.value;
  arrowEl.textContent = reading.arrow;
  arrowEl.setAttribute("aria-label", reading.trend);
  glucoseEl.className = "glucose";
  if (reading.value < 70) glucoseEl.classList.add("low");
  else if (reading.value > 180) glucoseEl.classList.add("high");
  glucoseEl.setAttribute(
    "aria-label",
    `Blood sugar ${reading.value} milligrams per deciliter, ${reading.trend}`
  );
  readingTimeEl.classList.remove("error");
  updateReadingAge();
}

function scheduleNextRefresh(readingTimestamp) {
  clearTimeout(refreshTimer);
  const readingInterval = 5 * 60 * 1000;
  const uploadBuffer = 20_000;
  const elapsed = Math.max(0, Date.now() - readingTimestamp - uploadBuffer);
  const intervalsAhead = Math.floor(elapsed / readingInterval) + 1;
  const expectedNextReading = readingTimestamp + (intervalsAhead * readingInterval) + uploadBuffer;
  const delay = Math.max(30_000, expectedNextReading - Date.now());
  refreshTimer = setTimeout(refreshGlucose, delay);
}

async function refreshGlucose() {
  try {
    const response = await fetch("/api/glucose", { cache: "no-store" });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error || "Dexcom request failed");
    showReading(body);
    scheduleNextRefresh(body.timestamp);
  } catch (error) {
    readingTimeEl.textContent = lastReading
      ? "Unable to refresh · showing the last reading"
      : "Unable to load Dexcom reading";
    readingTimeEl.className = "reading-time error";
    console.error(error);
    clearTimeout(refreshTimer);
    refreshTimer = setTimeout(refreshGlucose, 60_000);
  }
}

async function keepScreenOn() {
  if (!("wakeLock" in navigator)) {
    wakeLockButton.textContent = "Screen Wake Not Supported";
    return;
  }
  try {
    keepAwakeRequested = true;
    wakeLock = await navigator.wakeLock.request("screen");
    wakeLockButton.textContent = "Screen Will Stay On";
    wakeLockButton.classList.add("active");
    wakeLock.addEventListener("release", () => {
      wakeLockButton.textContent = "Keep Screen On";
      wakeLockButton.classList.remove("active");
    }, { once: true });
  } catch (error) {
    wakeLockButton.textContent = "Tap Again to Keep Screen On";
    console.error(error);
  }
}

wakeLockButton.addEventListener("click", keepScreenOn);

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible" && keepAwakeRequested && wakeLock?.released) {
    keepScreenOn();
  }
  if (
    document.visibilityState === "visible" &&
    (!lastReading || Date.now() - lastReading.timestamp > 5 * 60 * 1000)
  ) {
    clearTimeout(refreshTimer);
    refreshGlucose();
  }
});

updateClock();
applyBrightness();
refreshGlucose();
setInterval(updateClock, 1000);
