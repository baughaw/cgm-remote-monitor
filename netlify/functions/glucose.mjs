const APPLICATION_ID = "d89443d2-327c-4a6f-89e5-496bbb0317db";
const TREND_DISPLAY = {
  DoubleUp: ["⇈", "rising very quickly"],
  SingleUp: ["↑", "rising quickly"],
  FortyFiveUp: ["↗", "rising"],
  Flat: ["→", "steady"],
  FortyFiveDown: ["↘", "falling"],
  SingleDown: ["↓", "falling quickly"],
  DoubleDown: ["⇊", "falling very quickly"],
  NotComputable: ["?", "trend unavailable"],
  RateOutOfRange: ["?", "trend unavailable"]
};

let cache = null;

function apiBase(region) {
  return region?.toUpperCase() === "OUS"
    ? "https://shareous1.dexcom.com/ShareWebServices/Services"
    : "https://share2.dexcom.com/ShareWebServices/Services";
}

async function postJson(url, body) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  if (!response.ok) throw new Error(`Dexcom returned HTTP ${response.status}`);
  return response.json();
}

export function parseDexcomTimestamp(value) {
  const match = String(value).match(/Date\((\d+)/);
  const timestamp = match ? Number(match[1]) : Date.parse(value);
  if (!Number.isFinite(timestamp)) throw new Error("Dexcom returned an invalid timestamp");
  return timestamp;
}

export function normalizeReading(reading) {
  const [arrow, trend] = TREND_DISPLAY[reading.Trend] || ["?", "trend unavailable"];
  return {
    value: Number(reading.Value),
    arrow,
    trend,
    direction: reading.Trend,
    timestamp: parseDexcomTimestamp(reading.WT || reading.ST || reading.DT)
  };
}

async function fetchLatestReading(username, password, region) {
  const base = apiBase(region);
  const accountId = await postJson(`${base}/General/AuthenticatePublisherAccount`, {
    accountName: username,
    password,
    applicationId: APPLICATION_ID
  });
  const sessionId = await postJson(`${base}/General/LoginPublisherAccountById`, {
    accountId,
    password,
    applicationId: APPLICATION_ID
  });
  const response = await fetch(
    `${base}/Publisher/ReadPublisherLatestGlucoseValues?sessionID=${encodeURIComponent(sessionId)}&minutes=1440&maxCount=1`,
    { headers: { Accept: "application/json" } }
  );
  if (!response.ok) throw new Error(`Dexcom returned HTTP ${response.status}`);
  const readings = await response.json();
  if (!Array.isArray(readings) || !readings.length) throw new Error("Dexcom returned no readings");
  return normalizeReading(readings[0]);
}

export default async function handler(request) {
  if (request.method !== "GET") {
    return Response.json({ error: "Method not allowed" }, { status: 405 });
  }

  const username = Netlify.env.get("DEXCOM_USERNAME");
  const password = Netlify.env.get("DEXCOM_PASSWORD");
  const region = Netlify.env.get("DEXCOM_REGION") || "US";
  if (!username || !password) {
    return Response.json(
      { error: "Dexcom credentials have not been configured" },
      { status: 503, headers: { "Cache-Control": "no-store" } }
    );
  }

  try {
    if (!cache || Date.now() - cache.cachedAt > 30000) {
      cache = { ...(await fetchLatestReading(username, password, region)), cachedAt: Date.now() };
    }
    const { cachedAt, ...reading } = cache;
    return Response.json(reading, {
      headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" }
    });
  } catch (error) {
    console.error("Dexcom request failed:", error.message);
    return Response.json(
      { error: "Unable to retrieve the latest Dexcom reading" },
      { status: 502, headers: { "Cache-Control": "no-store" } }
    );
  }
}

export const config = { path: "/api/glucose" };

