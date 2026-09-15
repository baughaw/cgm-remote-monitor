const valueEl = document.querySelector("#value");
const arrowEl = document.querySelector("#arrow");
const glucoseEl = document.querySelector("#glucose");
const clockEl = document.querySelector("#clock");
const readingTimeEl = document.querySelector("#reading-time");
const wakeLockButton = document.querySelector("#wake-lock");

let lastReading = null;
let wakeLock = null;
let keepAwakeRequested = false;

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

async function refreshGlucose() {
  try {
    const response = await fetch("/api/glucose", { cache: "no-store" });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error || "Dexcom request failed");
    showReading(body);
  } catch (error) {
    readingTimeEl.textContent = lastReading
      ? "Unable to refresh · showing the last reading"
      : "Unable to load Dexcom reading";
    readingTimeEl.className = "reading-time error";
    console.error(error);
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
});

updateClock();
refreshGlucose();
setInterval(updateClock, 1000);
setInterval(refreshGlucose, 60000);
