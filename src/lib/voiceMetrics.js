import { durationToSeconds, isWithinMtd } from "./excel.js";

const ABANDON_VALUES = new Set(["ABANDON", "ABANDONED"]);

export function computeVoiceMetrics(rows, refDate) {
  const inScope = rows.filter((r) => isWithinMtd(r["datetime"], refDate));

  const cof = inScope.length;
  const acdRows = inScope.filter((r) => {
    const ev = r["event"];
    return ev != null && ev !== "" && !ABANDON_VALUES.has(String(ev).toUpperCase());
  });
  const acd = acdRows.length;

  let sum = 0;
  for (const r of acdRows) {
    sum += durationToSeconds(r["talktime"]);
  }
  const aht = acd > 0 ? sum / acd : 0;
  const scr = cof > 0 ? (acd / cof) * 100 : 100;

  return { cof, acd, aht, scr };
}
