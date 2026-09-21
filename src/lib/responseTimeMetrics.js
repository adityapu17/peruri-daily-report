import { isDate, isWithinMtd } from "./excel.js";

// Shared core: sorts rows by session_id then chronologically, and computes
// the shifted response-time value (O) per row — see computeResponseTimeMetrics
// for the full explanation of the algorithm. Returns the sorted rows and
// their aligned O array so callers can group/aggregate however they need
// (MTD average, daily average, etc.) without recomputing the sort+shift.
function computeShiftedResponseTimes(rows) {
  const sorted = [...rows].sort((a, b) => {
    const sidA = a["session_id"] ?? "";
    const sidB = b["session_id"] ?? "";
    if (sidA < sidB) return -1;
    if (sidA > sidB) return 1;
    const dA = a["date_origin"] instanceof Date ? a["date_origin"].getTime() : 0;
    const dB = b["date_origin"] instanceof Date ? b["date_origin"].getTime() : 0;
    return dA - dB;
  });

  const n = sorted.length;
  const N = new Array(n).fill(null);
  for (let i = 1; i < n; i++) {
    const cur = sorted[i];
    const prev = sorted[i - 1];
    if (
      cur["session_id"] === prev["session_id"] &&
      cur["action_type"] === "OUT" &&
      (prev["action_type"] === "IN" || prev["action_type"] === "OUT")
    ) {
      const drCur = cur["date_received"];
      const drPrev = prev["date_received"];
      if (isDate(drCur) && isDate(drPrev)) {
        const delta = (drCur.getTime() - drPrev.getTime()) / 1000;
        N[i] = delta;
      }
    }
  }

  const O = new Array(n).fill(null);
  for (let i = 0; i < n - 1; i++) {
    if (N[i + 1] != null && N[i + 1] > 0) {
      O[i] = N[i + 1];
    }
  }

  return { sorted, O };
}

// Mirrors the master-template logic (Dbase NV columns N/O):
//  1. Sort all rows by session_id, then chronologically (date_origin) within
//     each session.
//  2. For every row that is an OUT action, if the immediately preceding row
//     (same session) is IN or OUT, compute the gap in seconds between this
//     row's date_received and the previous row's date_received. That's N.
//  3. Shift N up by one row (O[i] = N[i+1]) so the response-time value sits
//     on the row whose date is used for the MTD/date grouping.
//  4. Average O per channel, bounded to rows within the Month-to-Date range
//     (based on the row's own date_received).
export function computeResponseTimeMetrics(rows, refDate) {
  const { sorted, O } = computeShiftedResponseTimes(rows);

  const sums = { Email: 0, Whatsapp: 0 };
  const counts = { Email: 0, Whatsapp: 0 };

  for (let i = 0; i < sorted.length; i++) {
    const val = O[i];
    if (val == null) continue;
    const row = sorted[i];
    const channel = row["channel_name"];
    if (channel !== "Email" && channel !== "Whatsapp") continue;
    if (!isWithinMtd(row["date_received"], refDate)) continue;
    sums[channel] += val;
    counts[channel] += 1;
  }

  return {
    email: counts.Email > 0 ? sums.Email / counts.Email : 0,
    wa: counts.Whatsapp > 0 ? sums.Whatsapp / counts.Whatsapp : 0,
    debug: { emailN: counts.Email, waN: counts.Whatsapp },
  };
}

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS_SHORT = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

function dateKey(d) {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

// Same O-value response-time metric as computeResponseTimeMetrics, but
// broken down per calendar day (1st of refDate's month through refDate)
// instead of averaged across the whole MTD window — used for the daily
// Response Time trend line chart (Email vs WhatsApp).
export function computeDailyResponseTimeSeries(rows, refDate) {
  const { sorted, O } = computeShiftedResponseTimes(rows);

  const start = new Date(refDate.getFullYear(), refDate.getMonth(), 1);
  const buckets = new Map();
  for (let d = new Date(start); d <= refDate; d.setDate(d.getDate() + 1)) {
    const day = new Date(d);
    buckets.set(dateKey(day), {
      date: day,
      dayName: DAY_NAMES[day.getDay()],
      dateLabel: `${day.getDate()} ${MONTHS_SHORT[day.getMonth()]}`,
      emailSum: 0,
      emailN: 0,
      waSum: 0,
      waN: 0,
    });
  }

  for (let i = 0; i < sorted.length; i++) {
    const val = O[i];
    if (val == null) continue;
    const row = sorted[i];
    const channel = row["channel_name"];
    if (channel !== "Email" && channel !== "Whatsapp") continue;
    const dr = row["date_received"];
    if (!isDate(dr)) continue;
    const key = dateKey(new Date(dr.getFullYear(), dr.getMonth(), dr.getDate()));
    const bucket = buckets.get(key);
    if (!bucket) continue;
    if (channel === "Email") {
      bucket.emailSum += val;
      bucket.emailN += 1;
    } else {
      bucket.waSum += val;
      bucket.waN += 1;
    }
  }

  return [...buckets.values()].map((b) => ({
    date: b.date,
    dayName: b.dayName,
    dateLabel: b.dateLabel,
    email: b.emailN > 0 ? b.emailSum / b.emailN : null,
    wa: b.waN > 0 ? b.waSum / b.waN : null,
  }));
}
