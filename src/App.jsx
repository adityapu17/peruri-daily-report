import { useState, useCallback } from "react";
import { readWorkbookRows } from "./lib/excel";
import { computeTicketMetrics } from "./lib/ticketMetrics";
import { computeVoiceMetrics } from "./lib/voiceMetrics";
import { computeResponseTimeMetrics, computeDailyResponseTimeSeries } from "./lib/responseTimeMetrics";
import { formatReport } from "./lib/formatReport";
import { computeDailySeries } from "./lib/dailyMetrics";
import DailyChart from "./components/DailyChart";
import ResponseTimeChart from "./components/ResponseTimeChart";
import "./App.css";

const FILES = [
  {
    key: "ticket",
    label: "Raw Report Ticket",
    hint: "report_ticket_*.xlsx / .csv — sumber COF/ACD/AHT Email & WhatsApp + Top KIP",
  },
  {
    key: "voice",
    label: "Raw Detail Interaction Voice",
    hint: "report_detail_interaction_voice_*.xlsx / .csv — sumber metrik Voice",
  },
  {
    key: "detail",
    label: "Raw Detail Interaction (Email & WhatsApp)",
    hint: "report_detail_interaction_*.xlsx / .csv — sumber Response Time Email & WhatsApp",
  },
];

function todayISO() {
  const d = new Date();
  const off = d.getTimezoneOffset();
  const local = new Date(d.getTime() - off * 60000);
  return local.toISOString().slice(0, 10);
}

export default function App() {
  const [files, setFiles] = useState({ ticket: null, voice: null, detail: null });
  const [fileNames, setFileNames] = useState({ ticket: "", voice: "", detail: "" });
  const [refDateStr, setRefDateStr] = useState(todayISO());
  const [sdm, setSdm] = useState({
    totalSdm: "",
    totalTerjadwal: "",
    totalTidakHadir: "",
    totalTerlambat: "",
    attendance: "",
  });
  const [stripApostrophe, setStripApostrophe] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [reportText, setReportText] = useState("");
  const [copied, setCopied] = useState(false);
  const [debugInfo, setDebugInfo] = useState(null);
  const [dailySeries, setDailySeries] = useState(null);
  const [rtSeries, setRtSeries] = useState(null);

  const onFileChange = useCallback((key) => (e) => {
    const f = e.target.files?.[0] || null;
    setFiles((prev) => ({ ...prev, [key]: f }));
    setFileNames((prev) => ({ ...prev, [key]: f ? f.name : "" }));
    setReportText("");
  }, []);

  const onSdmChange = (key) => (e) => {
    setSdm((prev) => ({ ...prev, [key]: e.target.value }));
  };

  const canGenerate = files.ticket && files.voice && files.detail && refDateStr;

  async function handleGenerate() {
    setError("");
    setReportText("");
    setDebugInfo(null);
    if (!canGenerate) {
      setError("Upload ketiga file raw dan pilih tanggal dulu ya.");
      return;
    }
    try {
      const readOpts = { stripApostrophe };
      setStatus("Membaca file ticket...");
      const ticketData = await readWorkbookRows(files.ticket, readOpts);
      setStatus("Membaca file voice...");
      const voiceData = await readWorkbookRows(files.voice, readOpts);
      setStatus("Membaca file detail interaction...");
      const detailData = await readWorkbookRows(files.detail, readOpts);

      setStatus("Menghitung metrik...");
      const [y, m, d] = refDateStr.split("-").map(Number);
      const refDate = new Date(y, m - 1, d);

      const ticketMetrics = computeTicketMetrics(ticketData.rows, refDate);
      const voiceMetrics = computeVoiceMetrics(voiceData.rows, refDate);
      const rt = computeResponseTimeMetrics(detailData.rows, refDate);

      const email = {
        cof: ticketMetrics.email.cof,
        acd: ticketMetrics.email.acd,
        aht: ticketMetrics.email.aht,
        rt: rt.email,
      };
      const wa = {
        cof: ticketMetrics.wa.cof,
        acd: ticketMetrics.wa.acd,
        aht: ticketMetrics.wa.aht,
        rt: rt.wa,
      };

      const sdmParsed = {
        totalSdm: Number(sdm.totalSdm) || 0,
        totalTerjadwal: Number(sdm.totalTerjadwal) || 0,
        totalTidakHadir: Number(sdm.totalTidakHadir) || 0,
        totalTerlambat: Number(sdm.totalTerlambat) || 0,
        attendance: Number(sdm.attendance) || 0,
      };

      const text = formatReport({
        refDate,
        voice: voiceMetrics,
        email,
        wa,
        topKip: ticketMetrics.topKip,
        sdm: sdmParsed,
      });

      const daily = computeDailySeries(ticketData.rows, voiceData.rows, refDate);
      const rtDaily = computeDailyResponseTimeSeries(detailData.rows, refDate);

      setReportText(text);
      setDebugInfo(ticketMetrics.debug);
      setDailySeries(daily);
      setRtSeries(rtDaily);
      setStatus("");
    } catch (err) {
      console.error(err);
      setError(`Gagal generate report: ${err.message}`);
      setStatus("");
    }
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(reportText);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setError("Gagal copy ke clipboard, silakan select manual.");
    }
  }

  return (
    <div className="page">
      <header className="page-header">
        <div className="eyebrow">PERURI Digital Contact Center</div>
        <h1>Daily Traffic Report Generator</h1>
        <p className="subtitle">
          Upload 3 raw report, pilih tanggal, generate format siap copas ke WA.
        </p>
      </header>

      <section className="panel">
        <h2>1. Upload Raw Report</h2>
        <div className="file-grid">
          {FILES.map((f) => (
            <label key={f.key} className="file-drop">
              <span className="file-label">{f.label}</span>
              <span className="file-hint">{f.hint}</span>
              <input
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={onFileChange(f.key)}
              />
              <span className={"file-name" + (fileNames[f.key] ? " has-file" : "")}>
                {fileNames[f.key] || "Belum ada file"}
              </span>
            </label>
          ))}
        </div>
        <label className="checkbox-row">
          <input
            type="checkbox"
            checked={stripApostrophe}
            onChange={(e) => setStripApostrophe(e.target.checked)}
          />
          <span>
            Raw pakai format tanda kutip (<code>'</code>) — centang kalau
            kolom angka/tanggal di file .xlsx keimpor sebagai teks berawalan
            kutip satu (misal dari export Omnix/monitoring tiket). File .csv
            otomatis dicek tanpa perlu centang ini.
          </span>
        </label>
      </section>

      <section className="panel">
        <h2>2. Tanggal Report</h2>
        <p className="panel-note">
          Metrik dihitung Month-to-Date: dari tanggal 1 bulan yang sama sampai
          tanggal ini.
        </p>
        <input
          type="date"
          value={refDateStr}
          onChange={(e) => setRefDateStr(e.target.value)}
          className="date-input"
        />
      </section>

      <section className="panel">
        <h2>3. Kehadiran SDM Layanan (input manual)</h2>
        <div className="sdm-grid">
          <label>
            Total SDM
            <input
              type="number"
              value={sdm.totalSdm}
              onChange={onSdmChange("totalSdm")}
              min="0"
            />
          </label>
          <label>
            Total SDM Terjadwal
            <input
              type="number"
              value={sdm.totalTerjadwal}
              onChange={onSdmChange("totalTerjadwal")}
              min="0"
            />
          </label>
          <label>
            Total SDM Tidak Hadir
            <input
              type="number"
              value={sdm.totalTidakHadir}
              onChange={onSdmChange("totalTidakHadir")}
              min="0"
            />
          </label>
          <label>
            Total SDM Terlambat Hadir
            <input
              type="number"
              value={sdm.totalTerlambat}
              onChange={onSdmChange("totalTerlambat")}
              min="0"
            />
          </label>
          <label>
            Attendance (%)
            <input
              type="number"
              value={sdm.attendance}
              onChange={onSdmChange("attendance")}
              min="0"
              max="100"
              step="0.01"
            />
          </label>
        </div>
        <p className="panel-note small">
          Lateness &amp; Adherence dihitung otomatis dari Terlambat Hadir /
          Terjadwal.
        </p>
      </section>

      <div className="action-row">
        <button
          className="generate-btn"
          onClick={handleGenerate}
          disabled={!canGenerate}
        >
          Generate Report
        </button>
        {status && <span className="status-text">{status}</span>}
      </div>

      {error && <div className="error-box">{error}</div>}

      {reportText && (
        <section className="panel">
          <div className="output-header">
            <h2>Hasil</h2>
            <button className="copy-btn" onClick={handleCopy}>
              {copied ? "Tersalin!" : "Copy"}
            </button>
          </div>
          <pre className="output-block">{reportText}</pre>
          {debugInfo && (
            <details className="debug-details">
              <summary>Detail perhitungan (debug)</summary>
              <ul>
                <li>Email tickets (MTD, excl EOS Monitoring): {debugInfo.emailCount}</li>
                <li>WhatsApp tickets: {debugInfo.waCount}</li>
                <li>Manual tickets digabung ke WA COF: {debugInfo.manualCount}</li>
                <li>Voice tickets (ikut Top KIP saja): {debugInfo.voiceTicketCount}</li>
                <li>Total tiket dasar Top KIP: {debugInfo.totalForKip}</li>
              </ul>
            </details>
          )}
        </section>
      )}

      {dailySeries && (
        <section className="panel">
          <h2>Grafik Harian</h2>
          <DailyChart
            series={dailySeries}
            title="Akumulasi Daily Traffic Interaksi All Channel"
          />
        </section>
      )}

      {rtSeries && (
        <section className="panel">
          <h2>Grafik Response Time Harian</h2>
          <ResponseTimeChart
            series={rtSeries}
            title="Pergerakan Response Time Harian Email vs WhatsApp"
          />
        </section>
      )}

      <footer className="app-footer">Gabel-2026</footer>
    </div>
  );
}
