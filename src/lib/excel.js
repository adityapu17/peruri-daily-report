import * as XLSX from "xlsx";
import Papa from "papaparse";

// Matches strings like "2026-08-01 06:06:12", "2026-08-01", "01/08/2026
// 06:06:12" etc — the shapes date/datetime columns take when a raw export
// force-quotes cells as text (leading ') instead of real Excel date cells.
const DATE_ISO_RE =
  /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?$/;
const DATE_SLASH_RE =
  /^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?$/;

function tryParseDateString(s) {
  let m = DATE_ISO_RE.exec(s);
  if (m) {
    const [, y, mo, d, h = "0", mi = "0", se = "0"] = m;
    return new Date(+y, +mo - 1, +d, +h, +mi, +se);
  }
  m = DATE_SLASH_RE.exec(s);
  if (m) {
    // Assume DD/MM/YYYY (Indonesian export convention)
    const [, d, mo, y, h = "0", mi = "0", se = "0"] = m;
    return new Date(+y, +mo - 1, +d, +h, +mi, +se);
  }
  return null;
}

// Strips a leading and/or trailing single-quote wrapper. Two patterns show
// up in PERURI's raw exports: Excel's own "force text" marker (a lone
// leading ' on numeric/date cells), and the source system literally
// wrapping string values in quotes on both sides (e.g. "'252610'",
// "'2026-08-01 04:26:21'") — most visible once data is exported as CSV,
// where there's no cell-type system left to absorb the leading-' convention.
function stripQuoteWrapper(v) {
  if (v.length >= 2 && v.startsWith("'") && v.endsWith("'")) {
    return v.slice(1, -1);
  }
  if (v.startsWith("'")) return v.slice(1);
  return v;
}

// Strips a leading apostrophe (Excel's "force text" marker, common in raw
// exports where numeric/date columns get quoted as text) and, if what's
// left looks like a date/datetime, converts it into a real Date object so
// the rest of the app can treat it the same as a native Excel date cell.
function normalizeQuotedValue(v) {
  if (typeof v !== "string") return v;
  const stripped = stripQuoteWrapper(v);
  const trimmed = stripped.trim();
  const asDate = tryParseDateString(trimmed);
  if (asDate) return asDate;
  if (trimmed !== "" && !isNaN(Number(trimmed)) && /^-?\d+(\.\d+)?$/.test(trimmed)) {
    return Number(trimmed);
  }
  return stripped;
}

// Reads a File object (.xlsx/.xls or .csv) and returns { headers, rows }
// where rows is an array of objects keyed by header name. Dates come back
// as JS Date objects wherever possible.
//
// `stripApostrophe`: for XLSX, strips leading "'" text-markers and converts
// date/number-looking strings back to their real types (needed when a raw
// export force-quotes cells as text). CSV files have no native cell types
// at all, so this same coercion always runs on CSV regardless of the flag.
export async function readWorkbookRows(file, { stripApostrophe = false } = {}) {
  const isCsv = /\.csv$/i.test(file.name);
  if (isCsv) return readCsvRows(file);
  return readXlsxRows(file, stripApostrophe);
}

async function readXlsxRows(file, stripApostrophe) {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array", cellDates: true });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const aoa = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    defval: null,
    raw: true,
  });
  if (aoa.length === 0) return { headers: [], rows: [] };
  const headers = aoa[0].map((h) => (h == null ? "" : String(h).trim()));
  const rows = [];
  for (let i = 1; i < aoa.length; i++) {
    const line = aoa[i];
    if (line.every((v) => v == null || v === "")) continue;
    const obj = {};
    headers.forEach((h, idx) => {
      let val = line[idx] === undefined ? null : line[idx];
      if (stripApostrophe) val = normalizeQuotedValue(val);
      obj[h] = val;
    });
    rows.push(obj);
  }
  return { headers, rows };
}

async function readCsvRows(file) {
  const text = await file.text();
  const parsed = Papa.parse(text, {
    header: true,
    skipEmptyLines: true,
    dynamicTyping: false,
  });
  const headers = (parsed.meta.fields || []).map((h) => (h == null ? "" : String(h).trim()));
  const rows = parsed.data.map((row) => {
    const obj = {};
    headers.forEach((h) => {
      // CSV cells are always raw strings — always coerce (apostrophe strip
      // + date/number detection), no native typing to fall back on.
      obj[h] = normalizeQuotedValue(row[h] ?? null);
    });
    return obj;
  });
  return { headers, rows };
}

// Normalizes a cell value that might be a JS Date, an Excel time-only value,
// or a "HH:MM:SS" string, into total seconds since midnight (for durations
// like talktime) - used for the voice raw's talktime/waittime columns.
export function durationToSeconds(v) {
  if (v == null || v === "") return 0;
  if (v instanceof Date) {
    // Excel time-only values get parsed as a Date on 1899-12-30 by SheetJS.
    return v.getHours() * 3600 + v.getMinutes() * 60 + v.getSeconds();
  }
  if (typeof v === "string") {
    const parts = v.split(":").map(Number);
    if (parts.length === 3) {
      const [h, m, s] = parts;
      return h * 3600 + m * 60 + s;
    }
  }
  if (typeof v === "number") {
    // Excel serial fraction of a day
    return Math.round(v * 86400);
  }
  return 0;
}

export function isDate(v) {
  return v instanceof Date && !isNaN(v.getTime());
}

// True if `d` falls within the month of `refDate` and is on/before refDate
// (inclusive), comparing calendar dates only (ignoring time-of-day).
export function isWithinMtd(d, refDate) {
  if (!isDate(d)) return false;
  const sameMonth =
    d.getFullYear() === refDate.getFullYear() &&
    d.getMonth() === refDate.getMonth();
  if (!sameMonth) return false;
  const dOnly = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const refOnly = new Date(
    refDate.getFullYear(),
    refDate.getMonth(),
    refDate.getDate()
  );
  return dOnly <= refOnly;
}
