import { isDate, isWithinMtd } from "./excel.js";

const EXCLUDED_SOURCE = "EOS Monitoring";

function avgSeconds(rows, startKey, endKey) {
  let sum = 0;
  let n = 0;
  for (const r of rows) {
    const s = r[startKey];
    const e = r[endKey];
    if (isDate(s) && isDate(e)) {
      const diff = (e.getTime() - s.getTime()) / 1000;
      if (diff >= 0) {
        sum += diff;
        n += 1;
      }
    }
  }
  return n > 0 ? sum / n : 0;
}

// rows: array of ticket raw row objects (report_ticket_*.xlsx)
// refDate: JS Date - the report date (MTD = 1st of that month .. refDate)
export function computeTicketMetrics(rows, refDate) {
  // Exclude EOS Monitoring globally, then bound to Month-to-Date range
  const inScope = rows.filter(
    (r) =>
      r["source_name"] !== EXCLUDED_SOURCE &&
      isWithinMtd(r["date_origin_interaction"], refDate)
  );

  const emailRows = inScope.filter((r) => r["channel_name"] === "Email");
  const waRows = inScope.filter((r) => r["channel_name"] === "Whatsapp");
  const manualRows = inScope.filter((r) => r["channel_name"] === "Manual");
  const voiceTixRows = inScope.filter((r) => r["channel_name"] === "Voice");

  const email = {
    cof: emailRows.length,
    acd: emailRows.length,
    aht: avgSeconds(
      emailRows,
      "date_start_interaction",
      "date_end_interaction"
    ),
  };

  // WhatsApp COF is merged with Manual channel tickets (per established
  // convention), but AHT is computed from the WhatsApp channel only.
  const wa = {
    cof: waRows.length + manualRows.length,
    acd: waRows.length + manualRows.length,
    aht: avgSeconds(waRows, "date_start_interaction", "date_end_interaction"),
  };

  // Top KIP All Channel: mainCategory - subCategory - detailSubCategory,
  // across every channel in scope (Email, WhatsApp, Manual, Voice tickets),
  // already excluding EOS Monitoring source and bounded to MTD.
  const kipCounts = new Map();
  for (const r of inScope) {
    const key = `${r["mainCategory"] ?? "-"} - ${r["subCategory"] ?? "-"} - ${
      r["detailSubCategory"] ?? "-"
    }`;
    kipCounts.set(key, (kipCounts.get(key) || 0) + 1);
  }
  const totalForKip = inScope.length;
  const topKip = [...kipCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([label, count]) => ({
      label,
      count,
      pct: totalForKip > 0 ? (count / totalForKip) * 100 : 0,
    }));

  return {
    email,
    wa,
    topKip,
    debug: {
      emailCount: emailRows.length,
      waCount: waRows.length,
      manualCount: manualRows.length,
      voiceTicketCount: voiceTixRows.length,
      totalForKip,
    },
  };
}
