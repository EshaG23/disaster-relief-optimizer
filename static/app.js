// ---------- Helpers ----------
const $ = (sel) => document.querySelector(sel);
const el = (tag, attrs = {}, children = []) => {
  const e = document.createElement(tag);
  Object.entries(attrs).forEach(([k, v]) => (k in e ? (e[k] = v) : e.setAttribute(k, v)));
  (Array.isArray(children) ? children : [children])
    .filter(Boolean)
    .forEach((c) => e.appendChild(typeof c === "string" ? document.createTextNode(c) : c));
  return e;
};

// ======================================================================
// Part 1: Bellman–Ford UI (Places, adjacency, source/destination)
// ======================================================================
const namesDiv = $("#bf-names");
const matrixDiv = $("#bf-matrix");
const srcSel = $("#bf-source");
const dstSel = $("#bf-dest");
let currentCount = 5;

$("#bf-build").addEventListener("click", () => {
  currentCount = parseInt($("#bf-count").value || "2", 10);
  buildNamesInputs(currentCount);
  buildMatrixTable(currentCount);
  buildSelectors(currentCount);
});

function buildNamesInputs(n) {
  namesDiv.innerHTML = "";
  const wrap = el("div");
  for (let i = 0; i < n; i++) {
    wrap.appendChild(
      el("div", { className: "row" }, [
        el("label", {}, `Place ${i + 1}`),
        el("input", { id: `name-${i}`, placeholder: `e.g., P${i + 1}` }),
      ])
    );
  }
  namesDiv.appendChild(wrap);
}

function buildSelectors(n) {
  srcSel.innerHTML = "";
  dstSel.innerHTML = "";
  for (let i = 0; i < n; i++) {
    const inp = $(`#name-${i}`);
    const name = (inp && inp.value.trim()) || `P${i + 1}`;
    const opt1 = el("option", { value: name }, name);
    const opt2 = el("option", { value: name }, name);
    srcSel.appendChild(opt1);
    dstSel.appendChild(opt2);
  }
}

// Live-update source/destination dropdowns when place names change
document.addEventListener("input", (e) => {
  if (e.target && e.target.id && e.target.id.startsWith("name-")) {
    buildSelectors(currentCount);
  }
});

function buildMatrixTable(n) {
  matrixDiv.innerHTML = "";
  const table = el("table");
  const thead = el("thead");
  const trh = el("tr");
  trh.appendChild(el("th", {}, "Adjacency Matrix (distance; 0 or blank = no edge)"));
  thead.appendChild(trh);
  table.appendChild(thead);

  const tbody = el("tbody");
  for (let i = 0; i < n; i++) {
    const row = el("tr");
    const cell = el("td");
    const grid = el("div", { className: "grid" });
    grid.style.gridTemplateColumns = `repeat(${n}, 1fr)`;
    for (let j = 0; j < n; j++) {
      const inp = el("input", {
        id: `w-${i}-${j}`,
        placeholder: i === j ? "0" : "",
        type: "number",
        step: "any",
      });
      if (i === j) inp.value = 0;
      grid.appendChild(inp);
    }
    cell.appendChild(grid);
    row.appendChild(cell);
    tbody.appendChild(row);
  }
  table.appendChild(tbody);
  matrixDiv.appendChild(table);
}

// ======================================================================
// NEW: Auto-fill distances for Bellman–Ford (India)
// ======================================================================
const bfAutoBtn = $("#bf-auto");
if (bfAutoBtn) {
  bfAutoBtn.addEventListener("click", async () => {
    const n = currentCount;
    if (!n || n < 2) {
      alert("Build at least 2 places first.");
      return;
    }

    const names = [];
    for (let i = 0; i < n; i++) {
      const nm = ($(`#name-${i}`)?.value || `P${i + 1}`).trim();
      if (!nm) { alert(`Place ${i + 1} is empty`); return; }
      names.push(nm);
    }

    const out = $("#bf-output");
    out.textContent = "Fetching real distances (km) for India…";

    try {
      const res = await fetch("/api/auto-matrix", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ places: names, metric: "road" })
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        out.textContent = `Error: ${err.error || res.status}`;
        return;
      }

      const data = await res.json(); // {names, adjacency, unit, metric}
      const mat = data.adjacency;
      for (let i = 0; i < n; i++) {
        for (let j = 0; j < n; j++) {
          const inp = $(`#w-${i}-${j}`);
          if (inp) inp.value = (i === j) ? 0 : mat[i][j];
        }
      }
      buildSelectors(n);
      out.innerHTML = `<span class="output success">Auto-filled adjacency with real distances (${data.metric}, ${data.unit}). You can now run Bellman–Ford.</span>`;
    } catch (e) {
      out.textContent = "Network/Service error while fetching distances.";
    }
  });
}

// ======================================================================
// Part 3: Coloring (Zones, adjacency, max colors) – dynamic headers
// ======================================================================
const colorNamesDiv = $("#color-names");
const colorMatrixDiv = $("#color-matrix");
let currentColorCount = 0;

$("#color-build").addEventListener("click", () => {
  currentColorCount = parseInt($("#color-zone-count").value || "2", 10);
  buildColorInputs(currentColorCount);
  buildColorMatrix(currentColorCount);
});

function buildColorInputs(n) {
  colorNamesDiv.innerHTML = "";
  const wrap = el("div");
  for (let i = 0; i < n; i++) {
    wrap.appendChild(
      el("div", { className: "row" }, [
        el("label", {}, `Zone ${i + 1}`),
        el("input", { id: `cname-${i}`, placeholder: `e.g., Zone ${i + 1}` }),
      ])
    );
  }
  colorNamesDiv.appendChild(wrap);
}

function buildColorMatrix(n) {
  colorMatrixDiv.innerHTML = "";

  const table = el("table");

  // Header row (top names)
  const thead = el("thead");
  const thr = el("tr");
  thr.appendChild(el("th", {}, "")); // top-left corner
  for (let j = 0; j < n; j++) {
    const name = ($(`#cname-${j}`)?.value || `Z${j + 1}`).trim() || `Z${j + 1}`;
    thr.appendChild(el("th", { id: `chdr-top-${j}` }, name));
  }
  thead.appendChild(thr);
  table.appendChild(thead);

  // Body rows with left name + inputs
  const tbody = el("tbody");
  for (let i = 0; i < n; i++) {
    const tr = el("tr");
    const rowName = ($(`#cname-${i}`)?.value || `Z${i + 1}`).trim() || `Z${i + 1}`;
    tr.appendChild(el("th", { id: `chdr-left-${i}` }, rowName));

    for (let j = 0; j < n; j++) {
      const td = el("td");
      const inp = el("input", {
        id: `cw-${i}-${j}`,
        type: "number",
        step: "any",
        placeholder: i === j ? "0" : "",
      });
      if (i === j) inp.value = 0;
      td.appendChild(inp);
      tr.appendChild(td);
    }
    tbody.appendChild(tr);
  }
  table.appendChild(tbody);
  colorMatrixDiv.appendChild(table);
}

function refreshColorMatrixHeaders() {
  const n = currentColorCount;
  for (let i = 0; i < n; i++) {
    const nm = ($(`#cname-${i}`)?.value || `Z${i + 1}`).trim() || `Z${i + 1}`;
    const top = $(`#chdr-top-${i}`);
    const left = $(`#chdr-left-${i}`);
    if (top) top.textContent = nm;
    if (left) left.textContent = nm;
  }
}

// Auto-rebuild when the zone count changes from the number input
const zoneCountEl = $("#color-zone-count");
if (zoneCountEl) {
  zoneCountEl.addEventListener("change", () => {
    currentColorCount = parseInt(zoneCountEl.value || "2", 10);
    buildColorInputs(currentColorCount);
    buildColorMatrix(currentColorCount);
  });
}

// Live-update matrix headers when zone names are typed
document.addEventListener("input", (e) => {
  if (e.target && e.target.id && e.target.id.startsWith("cname-")) {
    refreshColorMatrixHeaders();
  }
});

// ======================================================================
// Shared graph renderer (used for BF path & coloring).
// Safe if canvas is absent (e.g., you removed Bellman canvas).
// ======================================================================
const graphCanvas = $("#graph-canvas");  // may be null if hidden/removed
const colorCanvas = $("#color-canvas");

function drawGraph(canvas, names, adj, pathNames = [], coloring = null) {
  if (!canvas) return; // gracefully no-op if canvas doesn't exist

  const ctx = canvas.getContext("2d");
  const n = names.length;

  // fixed size for clean layout
  const W = 650, H = 480;
  canvas.width = W;
  canvas.height = H;

  // background
  ctx.fillStyle = "#f9f9ff";
  ctx.fillRect(0, 0, W, H);

  // node positions
  const cx = W / 2, cy = H / 2;
  const R = Math.min(W, H) / 2.2 - 50;
  const coords = [];
  for (let i = 0; i < n; i++) {
    const theta = (2 * Math.PI * i) / n - Math.PI / 2; // start at top
    coords.push([cx + R * Math.cos(theta), cy + R * Math.sin(theta)]);
  }

  // edges
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = "#bfbff5";
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      if (adj[i][j] && adj[i][j] !== 0) {
        ctx.beginPath();
        ctx.moveTo(...coords[i]);
        ctx.lineTo(...coords[j]);
        ctx.stroke();
      }
    }
  }

  // optional highlighted path (Bellman–Ford)
  if (pathNames && pathNames.length > 1) {
    const idx = Object.fromEntries(names.map((nm, i) => [nm, i]));
    ctx.lineWidth = 3;
    ctx.strokeStyle = "#6b5fd3";
    for (let k = 0; k < pathNames.length - 1; k++) {
      const a = idx[pathNames[k]];
      const b = idx[pathNames[k + 1]];
      if (a != null && b != null) {
        ctx.beginPath();
        ctx.moveTo(...coords[a]);
        ctx.lineTo(...coords[b]);
        ctx.stroke();
      }
    }
  }

  // nodes
  const pastel = [
    "hsl(250,70%,85%)",
    "hsl(150,70%,80%)",
    "hsl(30,80%,85%)",
    "hsl(200,70%,80%)",
    "hsl(340,70%,85%)",
    "hsl(100,60%,80%)",
  ];

  for (let i = 0; i < n; i++) {
    const [x, y] = coords[i];
    const nodeR = 28;
    const slot = coloring ? coloring[i] || 1 : (i % pastel.length) + 1;
    const colorIdx = (slot - 1) % pastel.length;

    // circle
    ctx.beginPath();
    ctx.fillStyle = pastel[colorIdx];
    ctx.strokeStyle = "#6156b0";
    ctx.lineWidth = 2;
    ctx.arc(x, y, nodeR, 0, 2 * Math.PI);
    ctx.fill();
    ctx.stroke();

    // label
    ctx.font = "15px Poppins, Inter, sans-serif";
    ctx.fillStyle = "#2a1b6f";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(names[i], x, y);

    // slot text
    if (coloring) {
      ctx.font = "13px Poppins, Inter, sans-serif";
      ctx.fillStyle = "#444";
      ctx.fillText(`Slot ${slot}`, x, y + 24);
    }
  }
}

// ======================================================================
// Run Bellman–Ford
// ======================================================================
$("#bf-run").addEventListener("click", async () => {
  const n = currentCount;

  // names
  const names = [];
  for (let i = 0; i < n; i++) {
    names.push(($(`#name-${i}`)?.value || `P${i + 1}`).trim() || `P${i + 1}`);
  }

  // matrix
  const adj = Array.from({ length: n }, () => Array(n).fill(0));
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      const raw = $(`#w-${i}-${j}`)?.value;
      adj[i][j] = raw === "" ? 0 : Number(raw);
    }
  }

  const source = $("#bf-source").value || names[0];
  const destination = $("#bf-dest").value || names[n - 1];

  const res = await fetch("/api/bellman-ford", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ names, adjacency: adj, source, destination }),
  });

  const out = $("#bf-output");
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    out.textContent = `Error: ${err.error || res.status}`;
    drawGraph(graphCanvas, names, adj);
    return;
  }
  const data = await res.json();
  out.innerHTML = `
    <strong>Shortest Distance:</strong> ${data.distance}<br>
    <strong>Optimized Path:</strong> ${data.path.join(" → ")}
  `;
  drawGraph(graphCanvas, names, adj, data.path);
});

// ======================================================================
// Part 2: Knapsack
// ======================================================================
const itemsBody = $("#items-body");

$("#add-item").addEventListener("click", () => {
  const n = $("#item-name").value.trim();
  const w = parseFloat($("#item-weight").value);
  const v = parseFloat($("#item-value").value);
  if (!n || isNaN(w) || isNaN(v) || w <= 0 || v < 0) return;
  addItemRow(n, w, v);
  $("#item-name").value = "";
  $("#item-weight").value = "";
  $("#item-value").value = "";
});

function addItemRow(name, weight, value) {
  const tr = el("tr");
  tr.appendChild(el("td", {}, name));
  tr.appendChild(el("td", {}, weight.toString()));
  tr.appendChild(el("td", {}, value.toString()));
  const rm = el("button", { className: "danger" }, "Remove");
  rm.addEventListener("click", () => tr.remove());
  tr.appendChild(el("td", {}, rm));
  itemsBody.appendChild(tr);
}

let pieChart = null;

$("#knap-run").addEventListener("click", async () => {
  const capacity = parseFloat($("#cap-input").value);
  if (isNaN(capacity) || capacity <= 0) {
    $("#knap-output").textContent = "Enter a valid capacity.";
    return;
  }

  const items = [];
  itemsBody.querySelectorAll("tr").forEach((tr) => {
    const tds = tr.querySelectorAll("td");
    const name = tds[0].textContent.trim();
    const weight = parseFloat(tds[1].textContent);
    const value = parseFloat(tds[2].textContent);
    if (name && !isNaN(weight) && !isNaN(value)) {
      items.push({ name, weight, demand: value });
    }
  });

  const res = await fetch("/api/knapsack", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ items, capacity }),
  });

  const out = $("#knap-output");
  if (!res.ok) {
    out.textContent = "Knapsack error.";
    return;
  }
  const data = await res.json();

  const lines = data.allocation.map(
    (a) => `${a.name}: ${a.weight_taken.toFixed(2)} kg (${(a.fraction * 100).toFixed(1)}%)`
  );
  out.innerHTML = `
    <strong>Total Value:</strong> ${data.total_value.toFixed(2)}<br>
    <strong>Allocated:</strong><br>${lines.join("<br>")}
  `;

  const labels = data.allocation.map((a) => a.name);
  const values = data.allocation.map((a) => a.weight_taken);
  const ctx = $("#knap-pie").getContext("2d");
  if (pieChart) pieChart.destroy();

  pieChart = new Chart(ctx, {
    type: "pie",
    data: { labels, datasets: [{ data: values }] },
    options: {
      responsive: true,
      maintainAspectRatio: false, // allows manual sizing via CSS
      plugins: {
        legend: {
          position: "bottom",
          labels: { font: { size: 13 } }
        },
        title: {
          display: true,
          text: "Allocation by Weight Taken (kg)",
          font: { size: 15 }
        }
      },
      layout: { padding: 10 }
    }
  });
});

// ======================================================================
// NEW: Auto adjacency for Coloring (<= threshold km => 1)
// ======================================================================
const colorAutoBtn = $("#color-auto");
if (colorAutoBtn) {
  colorAutoBtn.addEventListener("click", async () => {
    const n = currentColorCount || parseInt($("#color-zone-count").value || "0", 10);
    if (!n || n < 2) { alert("Build at least 2 zones first."); return; }

    const names = [];
    for (let i = 0; i < n; i++) {
      const nm = ($(`#cname-${i}`)?.value || `Z${i + 1}`).trim();
      if (!nm) { alert(`Zone ${i + 1} is empty`); return; }
      names.push(nm);
    }

    const threshold = parseFloat($("#distance-threshold").value || "20");
    const out = $("#color-output");
    out.textContent = "Computing distances and threshold-based adjacency…";

    try {
      const res = await fetch("/api/threshold-adjacency", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ places: names, threshold_km: threshold, metric: "road" })
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        out.textContent = `Error: ${err.error || res.status}`;
        return;
      }

      const data = await res.json(); // {distance, adjacency,...}
      for (let i = 0; i < n; i++) {
        for (let j = 0; j < n; j++) {
          const inp = $(`#cw-${i}-${j}`);
          if (inp) inp.value = data.adjacency[i][j];
        }
      }

      out.innerHTML = `<span class="output success">
        Filled adjacency using threshold ≤ ${threshold} km (1 = connected, 0 = not connected).
      </span>`;
    } catch (e) {
      out.textContent = "Network/Service error while computing adjacency.";
    }
  });
}

// ======================================================================
// Coloring: run
// ======================================================================
$("#color-run").addEventListener("click", async () => {
  const n = currentColorCount || parseInt($("#color-zone-count").value || "0", 10);
  if (n <= 0) {
    alert("Please build zones first!");
    return;
  }

  const names = [];
  for (let i = 0; i < n; i++) {
    names.push(($(`#cname-${i}`)?.value || `Z${i + 1}`).trim() || `Z${i + 1}`);
  }

  const adj = Array.from({ length: n }, () => Array(n).fill(0));
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      const raw = $(`#cw-${i}-${j}`)?.value;
      adj[i][j] = raw === "" ? 0 : Number(raw);
    }
  }

  const max_colors = parseInt($("#color-limit").value || "0");

  const res = await fetch("/api/coloring", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ names, adjacency: adj, max_colors }),
  });

  const out = $("#color-output");
  if (!res.ok) {
    out.textContent = "Coloring error.";
    return;
  }

  const data = await res.json();
  const idxMap = Object.fromEntries(names.map((nm, i) => [nm, i]));
  const coloringByIndex = {};
  Object.entries(data.coloring).forEach(([nm, c]) => (coloringByIndex[idxMap[nm]] = c));

  out.innerHTML =
    `<strong>Colors used:</strong> ${data.num_colors}<br>` +
    Object.entries(data.coloring)
      .map(([nm, c]) => `${nm}: Slot ${c}`)
      .join(" · ");

  drawGraph(colorCanvas, names, adj, [], coloringByIndex);
});

// ======================================================================
// Defaults on load
// ======================================================================
document.addEventListener("DOMContentLoaded", () => {
  // Build BF inputs
  $("#bf-build").click();

  // Seed knapsack items
  const defaults = ["rice", "dal", "potato", "medicines", "tent material", "torch", "clothes", "water"];
  defaults.forEach((r, i) => addItemRow(r, 100 + i * 10, 50 + i * 5));

  // Initialize Coloring section with current count
  const initialZones = parseInt($("#color-zone-count")?.value || "4", 10);
  currentColorCount = initialZones;
  buildColorInputs(initialZones);
  buildColorMatrix(initialZones);
});
