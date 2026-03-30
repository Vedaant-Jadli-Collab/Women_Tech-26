let DATA = {};

let GROUP_DATA = [];

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

async function runQuery() {
  const btn = document.getElementById('exec-btn');
  btn.disabled = true;
  btn.textContent = '⏳ Running...';
  document.getElementById('empty-state').style.display = 'none';
  document.getElementById('result-content').style.display = 'none';
  document.getElementById('loading-state').style.display = 'flex';

  const fracVal = parseFloat(document.getElementById('frac-display').textContent);
  const queryMap = { 'COUNT(*)': 'COUNT', 'SUM(price)': 'SUM', 'AVG(price)': 'AVG', 'GROUP BY Product': 'GROUP_BY' };
  const queryType = queryMap[currentQuery] || 'COUNT';

  try {
    const res = await fetch('http://localhost:5000/api/query', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: queryType, column: 'price', sample_frac: fracVal })
    });
    const result = await res.json();

    if (queryType === 'GROUP_BY') {
      GROUP_DATA.length = 0;
      result.exact.forEach(row => {
        const approxRow = result.approx.find(r => r.Product === row.Product);
        const approxCount = approxRow ? approxRow.approx_count : 0;
        const error = +((Math.abs(row.exact_count - approxCount) / row.exact_count) * 100).toFixed(2);
        GROUP_DATA.push({ product: row.Product, exact: row.exact_count, approx: approxCount, error });
      });
      DATA[currentQuery] = { groupBy: true };
    } else {
      const speedup = +(result.time_exact_ms / result.time_approx_ms).toFixed(1);
      const errorPct = +((Math.abs(result.exact - result.approx) / Math.abs(result.exact)) * 100).toFixed(2);
      DATA[currentQuery] = { exact: result.exact, approx: result.approx, errorPct, speedup, ...(result.moe !== undefined && { moe: result.moe, ci_low: result.approx - result.moe, ci_high: result.approx + result.moe }) };
    }
  } catch (err) {
    document.getElementById('loading-state').style.display = 'none';
    document.getElementById('empty-state').style.display = 'flex';
    btn.disabled = false;
    btn.textContent = '▶ Execute Query';
    alert('Backend not reachable. Make sure api.py is running on port 5000.');
    return;
  }

  btn.disabled = false;
  btn.textContent = '▶ Execute Query';
  document.getElementById('loading-state').style.display = 'none';
  renderResult();
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
