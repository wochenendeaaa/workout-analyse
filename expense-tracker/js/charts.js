let categoryChart = null;
let merchantChart = null;

// 14-color palette — cycles if there are more categories
const PALETTE = [
  "#6366f1","#8b5cf6","#ec4899","#f59e0b","#10b981",
  "#3b82f6","#f97316","#14b8a6","#a855f7","#06b6d4",
  "#84cc16","#ef4444","#78716c","#0ea5e9",
];

function baseOptions() {
  return {
    indexAxis: "y",
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: { label: ctx => ` CHF ${ctx.parsed.x.toFixed(2)}` },
      },
    },
    scales: {
      x: {
        ticks: { callback: v => `${v}` },
        grid: { color: "#f1f5f9" },
      },
      y: { grid: { display: false } },
    },
  };
}

function prepareWrap(canvasId, emptyId, entries) {
  const canvas = document.getElementById(canvasId);
  const empty = document.getElementById(emptyId);
  if (!entries.length) {
    canvas.hidden = true;
    empty.hidden = false;
    return null;
  }
  canvas.hidden = false;
  empty.hidden = true;
  canvas.style.height = Math.max(180, entries.length * 36) + "px";
  return canvas;
}

export function renderCategoryChart(data) {
  if (categoryChart) { categoryChart.destroy(); categoryChart = null; }
  const entries = Object.entries(data).sort((a, b) => b[1] - a[1]);
  const canvas = prepareWrap("category-chart", "category-chart-empty", entries);
  if (!canvas) return;

  categoryChart = new Chart(canvas, {
    type: "bar",
    data: {
      labels: entries.map(([k]) => k),
      datasets: [{ data: entries.map(([, v]) => v), backgroundColor: PALETTE }],
    },
    options: baseOptions(),
  });
}

export function renderMerchantChart(data) {
  if (merchantChart) { merchantChart.destroy(); merchantChart = null; }
  const entries = Object.entries(data).sort((a, b) => b[1] - a[1]).slice(0, 10);
  const canvas = prepareWrap("merchant-chart", "merchant-chart-empty", entries);
  if (!canvas) return;

  merchantChart = new Chart(canvas, {
    type: "bar",
    data: {
      labels: entries.map(([k]) => k || "(unnamed)"),
      datasets: [{ data: entries.map(([, v]) => v), backgroundColor: "#8b5cf6" }],
    },
    options: baseOptions(),
  });
}
