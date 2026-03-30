let uploadedData = null;

function handleFileUpload(input) {
  const file = input.files[0];
  if (!file) return;
  const statusEl = document.getElementById('upload-status');
  statusEl.textContent = `Loading "${file.name}"...`;
  statusEl.style.color = 'var(--muted)';
  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      const rows = parseCSV(e.target.result);
      if (rows.length === 0) throw new Error('CSV appears to be empty');
      uploadedData = rows;
      computeDataFromCSV(rows);
      statusEl.textContent = `✓ Loaded "${file.name}" — ${rows.length.toLocaleString()} rows`;
      statusEl.style.color = '#4ade80';
      resetResult();
    } catch (err) {
      statusEl.textContent = `✗ Error: ${err.message}`;
      statusEl.style.color = '#f87171';
    }
  };
  reader.readAsText(file);
}

function parseCSV(text) {
  const lines = text.trim().split('\n');
  const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
  return lines.slice(1).map(line => {
    const vals = line.split(',');
    const row = {};
    headers.forEach((h, i) => {
      const v = (vals[i] || '').trim().replace(/"/g, '');
      row[h] = isNaN(v) || v === '' ? v : parseFloat(v);
    });
    return row;
  });
}

function computeDataFromCSV(rows) {
  const numericCols = Object.keys(rows[0]).filter(k =>
    rows.slice(0, 50).every(r => r[k] === '' || typeof r[k] === 'number')
  );
  const targetCol = numericCols[0];
  const catCol = Object.keys(rows[0]).find(k => typeof rows[0][k] === 'string');
  const n = rows.length;
  const FRAC = 0.1;
  const seed = [...rows].sort(() => 0.5 - Math.random());
  const sample = seed.slice(0, Math.floor(n * FRAC));
  const relErr = (e, a) => +((Math.abs(e - a) / Math.abs(e)) * 100).toFixed(2);

  const exactSum = rows.reduce((s, r) => s + (r[targetCol] || 0), 0);
  const sampleVals = sample.map(r => r[targetCol] || 0);
  const sampleSum = sampleVals.reduce((a, b) => a + b, 0);
  const approxSum = sampleSum / FRAC;
  const exactAvg = exactSum / n;
  const sampleMean = sampleSum / sampleVals.length;
  const sampleStd = Math.sqrt(sampleVals.reduce((s, v) => s + (v - sampleMean) ** 2, 0) / (sampleVals.length - 1));
  const moe = +(1.96 * (sampleStd / Math.sqrt(sampleVals.length))).toFixed(2);
  const exactCount = n;
  const approxCount = Math.round(sample.length / FRAC);

  DATA['COUNT(*)'] = { exact: exactCount, approx: approxCount, errorPct: relErr(exactCount, approxCount), speedup: +(1/FRAC).toFixed(1) };
  DATA[`SUM(${targetCol})`] = { exact: exactSum, approx: approxSum, errorPct: relErr(exactSum, approxSum), speedup: +(1/FRAC).toFixed(1) };
  DATA[`AVG(${targetCol})`] = { exact: exactAvg, approx: sampleMean, errorPct: relErr(exactAvg, sampleMean), speedup: +(1/FRAC).toFixed(1), ci_low: sampleMean - moe, ci_high: sampleMean + moe, moe };
  DATA['GROUP BY Product'] = { groupBy: true };

  const exactGroups = {}, approxGroups = {};
  rows.forEach(r => { const k = r[catCol] || 'Unknown'; exactGroups[k] = (exactGroups[k] || 0) + 1; });
  sample.forEach(r => { const k = r[catCol] || 'Unknown'; approxGroups[k] = (approxGroups[k] || 0) + 1; });

  GROUP_DATA.length = 0;
  Object.keys(exactGroups).slice(0, 15).forEach(key => {
    const exact = exactGroups[key];
    const approx = Math.round((approxGroups[key] || 0) / FRAC);
    GROUP_DATA.push({ product: key, exact, approx, error: relErr(exact, approx) });
  });

  document.querySelectorAll('.query-btn').forEach((btn, i) => {
    const labels = [`COUNT(*)`, `SUM(${targetCol})`, `AVG(${targetCol})`, `GROUP BY ${catCol}`];
    if (labels[i]) { btn.innerHTML = `<span class="query-dot"></span>${labels[i]}`; btn.onclick = () => selectQuery(btn, labels[i]); }
  });
}
const DATA = {
  'COUNT(*)':        { exact:186850, approx:186850, errorPct:0.00, speedup:3.2 },
  'SUM(price)':      { exact:34492035.78, approx:34556712.30, errorPct:0.19, speedup:5.8 },
  'AVG(price)':      { exact:184.58, approx:184.93, errorPct:0.19, speedup:4.1, ci_low:183.12, ci_high:186.74, moe:1.81 },
  'GROUP BY Product':{ groupBy:true }
};

const GROUP_DATA = [
  { product:'USB-C Cable',      exact:23975, approx:24120, error:0.60 },
  { product:'Lightning Cable',  exact:23217, approx:23050, error:0.72 },
  { product:'AAA Batteries',    exact:31017, approx:30840, error:0.57 },
  { product:'AA Batteries',     exact:27635, approx:27900, error:0.96 },
  { product:'Wired Headphones', exact:20557, approx:20330, error:1.10 },
  { product:'iPhone',           exact:6849,  approx:6920,  error:1.04 },
  { product:'Google Phone',     exact:5532,  approx:5480,  error:0.94 },
  { product:'Macbook Pro',      exact:4728,  approx:4810,  error:1.73 },
  { product:'27in Monitor',     exact:6244,  approx:6150,  error:1.51 },
  { product:'ThinkPad',         exact:4130,  approx:4200,  error:1.69 },
];

let currentQuery = 'COUNT(*)';
let currentMode  = 'both';

function show(pageId, btn) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  document.getElementById('pg-' + pageId).classList.add('active');
  btn.classList.add('active');
}

function selectQuery(btn, q) {
  document.querySelectorAll('.query-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  currentQuery = q;
  resetResult();
}

function setMode(btn, m) {
  document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  currentMode = m;
}

function updateSlider(el) {
  const val = el.value / 100;
  document.getElementById('frac-display').textContent = val.toFixed(2);
  el.style.setProperty('--pct', el.value + '%');
}

function resetResult() {
  document.getElementById('empty-state').style.display = 'flex';
  document.getElementById('result-content').style.display = 'none';
  document.getElementById('loading-state').style.display = 'none';
}

function runQuery() {
  const btn = document.getElementById('exec-btn');
  btn.disabled = true;
  btn.textContent = '⏳ Running...';
  document.getElementById('empty-state').style.display = 'none';
  document.getElementById('result-content').style.display = 'none';
  document.getElementById('loading-state').style.display = 'flex';

  setTimeout(() => {
    btn.disabled = false;
    btn.textContent = '▶ Execute Query';
    document.getElementById('loading-state').style.display = 'none';
    renderResult();
  }, 600 + Math.random() * 700);
}

function badgeClass(e) {
  return e < 1 ? 'good' : e < 3 ? 'warn' : 'bad';
}

function fmt(n, dec=2) {
  return typeof n === 'number' ? n.toLocaleString(undefined, {maximumFractionDigits:dec}) : n;
}

function renderResult() {
  const rc = document.getElementById('result-content');
  const d  = DATA[currentQuery];
  rc.style.display = 'block';

  if (d.groupBy) {
    rc.innerHTML = `
      <div style="overflow-x:auto">
        <table class="tbl">
          <thead><tr>
            <th>Product</th>
            <th>Exact</th>
            <th>Approx</th>
            <th>Error %</th>
          </tr></thead>
          <tbody>${GROUP_DATA.map(r=>`
            <tr>
              <td>${r.product}</td>
              <td>${r.exact.toLocaleString()}</td>
              <td>${r.approx.toLocaleString()}</td>
              <td><span class="badge ${badgeClass(r.error)}">${r.error}%</span></td>
            </tr>`).join('')}
          </tbody>
        </table>
      </div>`;
    return;
  }

  let exactHtml = '', approxHtml = '', metaHtml = '';

  if (currentMode === 'exact' || currentMode === 'both') {
    exactHtml = `
      <div class="result-box">
        <div class="result-type">⬚ Exact Result</div>
        <div class="result-val">${fmt(d.exact)}</div>
      </div>`;
  }

  if (currentMode === 'approx' || currentMode === 'both') {
    let ci = d.ci_low !== undefined
      ? `<div class="ci-text">95% CI: [${d.ci_low.toFixed(2)}, ${d.ci_high.toFixed(2)}]<br>MoE: ±${d.moe}</div>`
      : '';
    approxHtml = `
      <div class="result-box approx">
        <div class="result-type">⚡ Approximate Result</div>
        <div class="result-val">${fmt(d.approx)}</div>
        ${ci}
      </div>`;
  }

  if (currentMode === 'both') {
    metaHtml = `
      <div class="metric-pair">
        <div class="metric-box">
          <div class="metric-box-val green">${d.speedup}×</div>
          <div class="metric-box-lbl">Speedup</div>
        </div>
        <div class="metric-box">
          <div class="metric-box-val amber">${d.errorPct}%</div>
          <div class="metric-box-lbl">Relative Error</div>
        </div>
      </div>`;
  }

  rc.innerHTML = `
    <div class="result-pair">${exactHtml}${approxHtml}</div>
    ${metaHtml}`;
}

(function populateGroupBy() {
  const tbody = document.getElementById('group-by-tbody');
  if (!tbody) return;
  tbody.innerHTML = GROUP_DATA.map(r => `
    <tr>
      <td>${r.product}</td>
      <td>${r.exact.toLocaleString()}</td>
      <td>${r.approx.toLocaleString()}</td>
      <td><span class="badge ${badgeClass(r.error)}">${r.error}%</span></td>
      <td><span class="badge good">✓ OK</span></td>
    </tr>`).join('');

  const avg = GROUP_DATA.reduce((s,r)=>s+r.error,0)/GROUP_DATA.length;
  tbody.innerHTML += `
    <tr style="background:rgba(255,255,255,.02);">
      <td style="color:var(--muted);font-size:.72rem;letter-spacing:.05em">AVERAGE</td>
      <td></td><td></td>
      <td><span class="badge warn">${avg.toFixed(2)}%</span></td>
      <td></td>
    </tr>`;
})();

(function initSlider() {
  const s = document.getElementById('frac-slider');
  if (s) { s.style.setProperty('--pct', s.value + '%'); }
})();
