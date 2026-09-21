const MONTHS_ID = [
  "Januari",
  "Februari",
  "Maret",
  "April",
  "Mei",
  "Juni",
  "Juli",
  "Agustus",
  "September",
  "Oktober",
  "November",
  "Desember",
];

function fmtDateId(d) {
  return `${d.getDate()} ${MONTHS_ID[d.getMonth()]} ${d.getFullYear()}`;
}

// Rounds to at most 2 decimals, trimming trailing zeros the way the
// established report standard expects (e.g. 100 -> "100.00" for percentages,
// but plain integers stay integers for counts).
function fmtNum(n, decimals = 2) {
  return Number(n).toFixed(decimals);
}

function fmtPct(n) {
  return `${fmtNum(n)}%`;
}

function fmtSec(n) {
  return `${Math.round(n)} sec`;
}

export function formatReport({ refDate, voice, email, wa, topKip, sdm }) {
  const lines = [];
  lines.push("*Daily Traffic Layanan PERURI Digital Contact Center*");
  lines.push(`${fmtDateId(refDate)} | Pukul 00:00 - 23:59 WIB`);
  lines.push("");
  lines.push("*Month to Date Achievement*");
  lines.push("");

  lines.push("*Voice*");
  lines.push(`COF: ${voice.cof}`);
  lines.push(`ACD: ${voice.acd}`);
  lines.push(`AHT: ${fmtSec(voice.aht)}`);
  lines.push(`Performance SCR: ${fmtPct(voice.scr)}`);
  lines.push(`Target SCR: 90.00%`);
  lines.push("");

  lines.push("*Email*");
  lines.push(`COF: ${email.cof}`);
  lines.push(`ACD: ${email.acd}`);
  lines.push(`AHT: ${fmtSec(email.aht)}`);
  lines.push(`Performance Response Time: ${fmtSec(email.rt)}`);
  lines.push(`Target Response Time: 900 sec`);
  lines.push("");

  lines.push("*WhatsApp*");
  lines.push(`COF: ${wa.cof}`);
  lines.push(`ACD: ${wa.acd}`);
  lines.push(`AHT: ${fmtSec(wa.aht)}`);
  lines.push(`Performance Response Time: ${fmtSec(wa.rt)}`);
  lines.push(`Target Response Time: 900 sec`);
  lines.push("");

  lines.push("*TOP 5 MtD KIP All Channel*");
  topKip.forEach((k, i) => {
    lines.push(`${i + 1}. ${k.label}: ${fmtPct(k.pct)}`);
  });
  lines.push("");

  lines.push("*Kehadiran SDM Layanan*");
  lines.push(`Total SDM: ${sdm.totalSdm}`);
  lines.push(`Total SDM Terjadwal: ${sdm.totalTerjadwal}`);
  lines.push(`Total SDM Tidak Hadir: ${sdm.totalTidakHadir}`);
  lines.push(`Total SDM Terlambat Hadir: ${sdm.totalTerlambat}`);

  const lateness =
    sdm.totalTerjadwal > 0
      ? (sdm.totalTerlambat / sdm.totalTerjadwal) * 100
      : 0;
  const adherence = 100 - lateness;
  lines.push(`Lateness: ${fmtPct(lateness)}`);
  lines.push(`Adherence: ${fmtPct(adherence)}`);
  lines.push(`Attendance: ${fmtPct(sdm.attendance)}`);

  return lines.join("\n");
}
