import { useEffect, useRef, useState } from "react";
import {
  Chart,
  BarController,
  BarElement,
  CategoryScale,
  LinearScale,
  Tooltip,
  Legend,
} from "chart.js";
import ChartDataLabels from "chartjs-plugin-datalabels";

Chart.register(
  BarController,
  BarElement,
  CategoryScale,
  LinearScale,
  Tooltip,
  Legend,
  ChartDataLabels
);

const COLORS = {
  voice: "#8fa3ba",
  email: "#f5a35c",
  whatsapp: "#34d399",
};

// Two text/grid palettes: "dark" for the on-screen chart (dark app
// background), "light" for exported PNGs (white background).
const THEME = {
  dark: {
    title: "#e6efe9",
    legend: "#8ba396",
    tickX: "#8ba396",
    tickY: "#617369",
    gridY: "#1a2420",
    borderX: "#22302a",
  },
  light: {
    title: "#1a2620",
    legend: "#33413a",
    tickX: "#33413a",
    tickY: "#4b5b53",
    gridY: "#e2e8e4",
    borderX: "#c9d3ce",
  },
};

// Fills the export canvas with a solid white background before Chart.js
// draws, since <canvas> is transparent by default.
const whiteBackgroundPlugin = {
  id: "whiteBackground",
  beforeDraw: (chart) => {
    const { ctx, width, height } = chart;
    ctx.save();
    ctx.globalCompositeOperation = "destination-over";
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);
    ctx.restore();
  },
};

// Fixed export canvas size. Wide enough per bar-group that 2-line labels
// ("Sun" / "17 Aug") never need to rotate, and rendered at devicePixelRatio
// 2 so the PNG stays crisp whether it was generated on a phone or a
// desktop — the exported image's quality never depends on screen size.
const EXPORT_PER_DAY = 46;
const EXPORT_MIN_WIDTH = 900;
const EXPORT_HEIGHT = 620;

function buildConfig({ series, title, width, height, forExport }) {
  const labels = series.map((d) => [d.dayName, d.dateLabel]);
  const axisFontSize = forExport ? 13 : Math.max(9, Math.min(11, 900 / series.length / 4));
  const titleFontSize = forExport ? 17 : 14;
  const c = forExport ? THEME.light : THEME.dark;

  return {
    type: "bar",
    data: {
      labels,
      datasets: [
        {
          label: "Voice",
          data: series.map((d) => d.voice),
          backgroundColor: COLORS.voice,
          stack: "s",
          borderRadius: 4,
          borderSkipped: false,
          maxBarThickness: forExport ? 28 : 34,
        },
        {
          label: "Email",
          data: series.map((d) => d.email),
          backgroundColor: COLORS.email,
          stack: "s",
          borderRadius: 4,
          borderSkipped: false,
          maxBarThickness: forExport ? 28 : 34,
        },
        {
          label: "WhatsApp",
          data: series.map((d) => d.whatsapp),
          backgroundColor: COLORS.whatsapp,
          stack: "s",
          borderRadius: 4,
          borderSkipped: false,
          maxBarThickness: forExport ? 28 : 34,
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
          color: c.title,
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
            color: c.legend,
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
        },
        datalabels: {
          color: (ctx) =>
            ctx.dataset.label === "Voice" ? "#1a2620" : "#0b0f0d",
          font: {
            family: "'JetBrains Mono', monospace",
            size: forExport ? 11 : 10,
            weight: "600",
          },
          formatter: (value) => (value > 0 ? value : ""),
          display: (ctx) => {
            const value = ctx.dataset.data[ctx.dataIndex];
            return typeof value === "number" && value > 0;
          },
        },
      },
      scales: {
        x: {
          stacked: true,
          grid: { display: false },
          border: { color: c.borderX },
          ticks: {
            color: c.tickX,
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
          stacked: true,
          beginAtZero: true,
          grid: { color: c.gridY },
          border: { display: false },
          ticks: {
            color: c.tickY,
            font: {
              family: "'JetBrains Mono', monospace",
              size: forExport ? 12 : 10.5,
            },
            stepSize: 50,
          },
        },
      },
    },
  };
}

export default function DailyChart({ series, title }) {
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
    exportChartRef.current = new Chart(canvas, {
      ...buildConfig({
        series,
        title,
        width,
        height: EXPORT_HEIGHT,
        forExport: true,
      }),
      plugins: [whiteBackgroundPlugin],
    });

    // Let Chart.js finish its render pass before reading the canvas.
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
      {/* Off-screen fixed-resolution canvas used purely for PNG export so
          the downloaded image always looks tidy regardless of the device
          or viewport width it was generated from. */}
      <canvas
        ref={exportCanvasRef}
        style={{ position: "fixed", top: 0, left: "-99999px" }}
        aria-hidden="true"
      />
    </div>
  );
}
