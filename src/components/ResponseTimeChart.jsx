import { useEffect, useRef, useState } from "react";
import {
  Chart,
  LineController,
  LineElement,
  PointElement,
  CategoryScale,
  LinearScale,
  Tooltip,
  Legend,
  Filler,
} from "chart.js";

Chart.register(
  LineController,
  LineElement,
  PointElement,
  CategoryScale,
  LinearScale,
  Tooltip,
  Legend,
  Filler
);

const COLORS = {
  email: "#f5a35c",
  whatsapp: "#34d399",
};

const EXPORT_PER_DAY = 46;
const EXPORT_MIN_WIDTH = 900;
const EXPORT_HEIGHT = 560;

function toMinutes(sec) {
  return sec == null ? null : sec / 60;
}

function fmtMinTick(v) {
  return `${v.toFixed(2)}m`;
}

function buildConfig({ series, title, forExport }) {
  const labels = series.map((d) => [d.dayName, d.dateLabel]);
  const axisFontSize = forExport ? 13 : Math.max(9, Math.min(11, 900 / series.length / 4));
  const titleFontSize = forExport ? 17 : 14;

  return {
    type: "line",
    data: {
      labels,
      datasets: [
        {
          label: "Email",
          data: series.map((d) => toMinutes(d.email)),
          borderColor: COLORS.email,
          backgroundColor: "rgba(245, 163, 92, 0.12)",
          pointBackgroundColor: COLORS.email,
          pointBorderColor: "#0b0f0d",
          pointRadius: forExport ? 3.5 : 2.5,
          pointHoverRadius: 5,
          borderWidth: forExport ? 2.5 : 2,
          tension: 0.3,
          spanGaps: true,
          fill: false,
        },
        {
          label: "WhatsApp",
          data: series.map((d) => toMinutes(d.wa)),
          borderColor: COLORS.whatsapp,
          backgroundColor: "rgba(52, 211, 153, 0.12)",
          pointBackgroundColor: COLORS.whatsapp,
          pointBorderColor: "#0b0f0d",
          pointRadius: forExport ? 3.5 : 2.5,
          pointHoverRadius: 5,
          borderWidth: forExport ? 2.5 : 2,
          tension: 0.3,
          spanGaps: true,
          fill: false,
        },
      ],
    },
    options: {
      responsive: !forExport,
      maintainAspectRatio: false,
      devicePixelRatio: forExport ? 2 : undefined,
      animation: forExport ? false : undefined,
      layout: { padding: { top: 8, right: 16, bottom: 4, left: 4 } },
      interaction: { mode: "index", intersect: false },
      plugins: {
        title: {
          display: true,
          text: title,
          color: "#e6efe9",
          font: {
            family: "'JetBrains Mono', monospace",
            size: titleFontSize,
            weight: "600",
          },
          padding: { bottom: 18 },
        },
        legend: {
          position: "bottom",
          labels: {
            color: "#8ba396",
            usePointStyle: true,
            pointStyle: "circle",
            boxWidth: 7,
            boxHeight: 7,
            padding: 18,
            font: {
              family: "'IBM Plex Sans', sans-serif",
              size: forExport ? 13 : 12,
            },
          },
        },
        tooltip: {
          enabled: !forExport,
          backgroundColor: "#0b0f0d",
          borderColor: "#22302a",
          borderWidth: 1,
          titleColor: "#e6efe9",
          bodyColor: "#c7d6cd",
          padding: 10,
          titleFont: { family: "'JetBrains Mono', monospace", size: 11 },
          bodyFont: { family: "'IBM Plex Sans', sans-serif", size: 12 },
          callbacks: {
            label: (ctx) =>
              `${ctx.dataset.label}: ${ctx.parsed.y == null ? "-" : ctx.parsed.y.toFixed(2) + " min"}`,
          },
        },
        // Explicitly disabled: chartjs-plugin-datalabels gets registered
        // globally by DailyChart, so without this override its default
        // (raw, unrounded value on every point) would bleed into this
        // chart too and clutter a 17-31 point line with overlapping text.
        datalabels: {
          display: false,
        },
      },
      scales: {
        x: {
          grid: { display: false },
          border: { color: "#22302a" },
          ticks: {
            color: "#8ba396",
            maxRotation: 0,
            minRotation: 0,
            autoSkip: !forExport,
            font: {
              family: "'IBM Plex Sans', sans-serif",
              size: axisFontSize,
              lineHeight: 1.4,
            },
          },
        },
        y: {
          beginAtZero: true,
          grid: { color: "#1a2420" },
          border: { display: false },
          ticks: {
            color: "#617369",
            font: {
              family: "'JetBrains Mono', monospace",
              size: forExport ? 12 : 10.5,
            },
            callback: fmtMinTick,
          },
        },
      },
    },
  };
}

export default function ResponseTimeChart({ series, title }) {
  const canvasRef = useRef(null);
  const chartRef = useRef(null);
  const exportCanvasRef = useRef(null);
  const exportChartRef = useRef(null);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    if (!canvasRef.current || series.length === 0) return;
    if (chartRef.current) chartRef.current.destroy();
    chartRef.current = new Chart(
      canvasRef.current,
      buildConfig({ series, title, forExport: false })
    );
    return () => {
      if (chartRef.current) {
        chartRef.current.destroy();
        chartRef.current = null;
      }
    };
  }, [series, title]);

  function downloadPng() {
    if (series.length === 0) return;
    setDownloading(true);

    const width = Math.max(EXPORT_MIN_WIDTH, series.length * EXPORT_PER_DAY);
    const canvas = exportCanvasRef.current;
    canvas.width = width;
    canvas.height = EXPORT_HEIGHT;

    if (exportChartRef.current) exportChartRef.current.destroy();
    exportChartRef.current = new Chart(
      canvas,
      buildConfig({ series, title, forExport: true })
    );

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const url = exportChartRef.current.toBase64Image("image/png", 1);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${title.replace(/\s+/g, "_").toLowerCase()}.png`;
        a.click();
        setDownloading(false);
      });
    });
  }

  return (
    <div className="chart-card">
      <div className="chart-canvas-wrap">
        <canvas ref={canvasRef} />
      </div>
      <div className="chart-actions">
        <button className="copy-btn" onClick={downloadPng} disabled={downloading}>
          {downloading ? "Menyiapkan..." : "Download PNG"}
        </button>
      </div>
      <canvas
        ref={exportCanvasRef}
        style={{ position: "fixed", top: 0, left: "-99999px" }}
        aria-hidden="true"
      />
    </div>
  );
}
