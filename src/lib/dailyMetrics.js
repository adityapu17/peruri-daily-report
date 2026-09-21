import { isDate } from "./excel.js";

const EXCLUDED_SOURCE = "EOS Monitoring";
const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS_SHORT = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

function dateKey(d) {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

// Builds one bucket per calendar day from the 1st of refDate's month through
// refDate (inclusive), counting daily interactions per channel — same COF
// definitions used for the MTD report (WhatsApp = whatsapp + manual
// tickets, both raw sources excluding EOS Monitoring).
export function computeDailySeries(ticketRows, voiceRows, refDate) {
  const start = new Date(refDate.getFullYear(), refDate.getMonth(), 1);
  const buckets = new Map();
  for (let d = new Date(start); d <= refDate; d.setDate(d.getDate() + 1)) {
    const day = new Date(d);
    buckets.set(dateKey(day), {
      date: day,
      dayName: DAY_NAMES[day.getDay()],
      dateLabel: `${day.getDate()} ${MONTHS_SHORT[day.getMonth()]}`,
      voice: 0,
      email: 0,
      whatsapp: 0,
    });
  }

  for (const r of ticketRows) {
    if (r["source_name"] === EXCLUDED_SOURCE) continue;
    const origin = r["date_origin_interaction"];
    if (!isDate(origin)) continue;
    const key = dateKey(new Date(origin.getFullYear(), origin.getMonth(), origin.getDate()));
    const bucket = buckets.get(key);
    if (!bucket) continue;
    const chan = r["channel_name"];
    if (chan === "Email") bucket.email += 1;
    else if (chan === "Whatsapp" || chan === "Manual") bucket.whatsapp += 1;
  }

  for (const r of voiceRows) {
    const dt = r["datetime"];
    if (!isDate(dt)) continue;
    const key = dateKey(new Date(dt.getFullYear(), dt.getMonth(), dt.getDate()));
    const bucket = buckets.get(key);
    if (!bucket) continue;
    bucket.voice += 1;
  }

  return [...buckets.values()];
}
