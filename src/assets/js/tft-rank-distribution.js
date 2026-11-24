/* TFT Rank Distribution — Plotly.js.
 *
 * Single source: tft-rank-distribution-sampled-set18-2026-11.json
 * (top-4 rate sample, with a per-bin stacked_by_tier breakdown) +
 * tft-rank-distribution-tiers.json (League of Graphs NA tier shares,
 * used here only as the tier colour/name source), both fetched via
 * the data-json / data-tiers attributes. Every number on the page
 * comes from those files; nothing is hard-coded here.
 *
 * Lead metric is the TOP-4 RATE: the share of a player's ranked games
 * that ended in the top 4. The chart is one stacked histogram: each
 * bin's total height is that bin's share of sampled players, and each
 * segment is one tier's share inside the bin. Percentiles are
 * empirical, computed from the pooled bins — no model is fitted (the
 * JSON's model_fit entries are placeholders) and nothing is averaged
 * across sets.
 */
(function () {
  var root = document.getElementById('tft');
  if (!root) return;
  var sampleUrl = root.getAttribute('data-json');
  var tiersUrl = root.getAttribute('data-tiers');
  var plotEl = document.getElementById('tft-plot');
  var detailEl = document.getElementById('tft-detail');
  var summaryEl = document.getElementById('tft-summary');

  // Mobile tuning (Fed pattern): below 700px the modebar is hidden;
  // on coarse-pointer phones the chart starts locked behind a
  // tap-to-interact overlay so a swipe scrolls the page.
  function isNarrow() { return window.matchMedia('(max-width: 700px)').matches; }
  function needsLock() { return isNarrow() && window.matchMedia('(pointer: coarse)').matches; }

  var sample = null;
  var tiers = null;
  var plotted = false;

  // Tiers low to high; the chart stacks in this order (Iron at the
  // bottom, Challenger at the top).
  var TIER_ORDER = ['IRON', 'BRONZE', 'SILVER', 'GOLD', 'PLATINUM',
    'EMERALD', 'DIAMOND', 'MASTER', 'GRANDMASTER', 'CHALLENGER'];

  function fmtPct(frac, digits) {
    return (frac * 100).toFixed(digits === undefined ? 1 : digits) + '%';
  }

  function titleCase(s) {
    return s.charAt(0) + s.slice(1).toLowerCase();
  }

  function isDark() {
    var t = document.documentElement.getAttribute('data-theme');
    if (t) return t === 'dark';
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  }

  // Plotly does not reliably parse oklch(), so use plain hex
  // approximations of the site tokens, per theme. Readable in both.
  function theme() {
    if (isDark()) {
      return { text: '#d6dae2', muted: '#9aa3b2', grid: '#3a4152', accent: '#38bdf8', card: '#232833' };
    }
    return { text: '#333a45', muted: '#6b7280', grid: '#e3e6ea', accent: '#4f46e5', card: '#ffffff' };
  }

  function plotConfig() {
    return { responsive: true, displaylogo: false, displayModeBar: !isNarrow() };
  }

  // Tier colours come from the tiers JSON (one colour per tier), never
  // hard-coded here. Unknown tiers fall back to grey.
  function tierColor(tier) {
    for (var i = 0; i < tiers.buckets.length; i++) {
      if (tiers.buckets[i].tier === tier) return tiers.buckets[i].color;
    }
    return '#888888';
  }

  /* --- Stacked top-4 rate histogram --- */

  function binCenters() {
    return sample.metrics.top4_rate.bins.map(function (b) { return (b.lo + b.hi) / 2 * 100; });
  }

  function renderHist() {
    var t = theme();
    var m = sample.metrics.top4_rate;
    var x = binCenters();
    var stacked = m.stacked_by_tier;
    var traces = TIER_ORDER.map(function (tier) {
      var y = stacked.map(function (b) { return b.tiers[tier] || 0; });
      // Skip a tier with no players anywhere; it would add a dead
      // legend entry. (All 10 tiers are present in the Set 18 data.)
      if (y.every(function (v) { return v === 0; })) return null;
      return {
        type: 'bar',
        name: titleCase(tier),
        x: x,
        y: y,
        text: stacked.map(function (b, i) {
          var seg = b.tiers[tier] || 0;
          var total = m.bins[i].pct_pooled;
          return titleCase(tier) + '<br>' +
            fmtPct(b.lo) + ' – ' + fmtPct(b.hi) + ' top-4 rate<br>' +
            fmtPct(seg / 100) + ' of sampled players<br>' +
            'Bin total: ' + fmtPct(total / 100);
        }),
        hoverinfo: 'text',
        // text is hover-only: bar traces default textposition to 'auto',
        // which would draw the hover strings on the bars themselves.
        textposition: 'none',
        // customdata powers tap-to-inspect: [lo, hi, segment, bin total, tier].
        customdata: stacked.map(function (b, i) {
          return [b.lo, b.hi, b.tiers[tier] || 0, m.bins[i].pct_pooled, titleCase(tier)];
        }),
        marker: { color: tierColor(tier) }
      };
    }).filter(function (tr) { return tr !== null; });
    var layout = {
      autosize: true,
      margin: { l: 56, r: 16, t: 12, b: isNarrow() ? 118 : 104 },
      paper_bgcolor: 'rgba(0,0,0,0)',
      plot_bgcolor: 'rgba(0,0,0,0)',
      font: { color: t.text, family: 'Inter, system-ui, sans-serif', size: isNarrow() ? 13 : 12 },
      showlegend: true,
      legend: { orientation: 'h', y: -0.24, x: 0.5, xanchor: 'center' },
      barmode: 'stack',
      bargap: 0.05,
      xaxis: {
        title: 'Top-4 rate',
        ticksuffix: '%',
        gridcolor: t.grid, zerolinecolor: t.grid,
        tickfont: { size: isNarrow() ? 12 : 11 }
      },
      yaxis: {
        title: 'Share of sampled players (%)',
        gridcolor: t.grid, zerolinecolor: t.grid,
        tickfont: { size: isNarrow() ? 12 : 11 }
      }
    };
    var p = plotted
      ? window.Plotly.react(plotEl, traces, layout, plotConfig())
      : window.Plotly.newPlot(plotEl, traces, layout, plotConfig());
    plotted = true;
    return p;
  }

  /* --- Summary + bins table (every chart value, in text form) --- */

  function renderSummary() {
    var m = sample.metrics.top4_rate;
    var s = m.summary_pooled;
    summaryEl.textContent = m.n_pooled.toLocaleString('en-US') +
      ' sampled players in ' + sample.design.replicates + ' replicates · median top-4 rate ' +
      fmtPct(s.median) + ' · ' + fmtPct(s.share_gt_60pct, 1) +
      ' top-4 more than 60% of the time.';
  }

  function renderBinsTable() {
    var body = document.querySelector('#tft-bins-table tbody');
    body.innerHTML = '';
    sample.metrics.top4_rate.bins.forEach(function (b) {
      var tr = document.createElement('tr');
      var th = document.createElement('th');
      th.scope = 'row';
      th.textContent = fmtPct(b.lo) + ' – ' + fmtPct(b.hi);
      tr.appendChild(th);
      var td = document.createElement('td');
      td.style.textAlign = 'right';
      td.textContent = fmtPct(b.pct_pooled / 100);
      tr.appendChild(td);
      var td2 = document.createElement('td');
      td2.style.textAlign = 'right';
      td2.textContent = fmtPct(Math.min.apply(null, b.pct_by_replicate) / 100) +
        ' – ' + fmtPct(Math.max.apply(null, b.pct_by_replicate) / 100);
      tr.appendChild(td2);
      body.appendChild(tr);
    });
  }

  function render() {
    if (!sample || !tiers || !window.Plotly) return;
    renderHist();
    bindClicks();
    ensureLocks();
  }

  // Tap-to-inspect: hover does not exist on a phone, so a tap on a bar
  // segment writes its detail into the box below the chart instead.
  var clickBound = false;
  function setDetail(html) { detailEl.innerHTML = '<p>' + html + '</p>'; }
  function bindClicks() {
    if (clickBound || !window.Plotly) return;
    clickBound = true;
    plotEl.on('plotly_click', function (ev) {
      var pt = ev.points && ev.points[0];
      if (!pt || !pt.customdata) return;
      var cd = pt.customdata;
      setDetail('<strong>' + cd[4] + ' — top-4 rate ' + fmtPct(cd[0]) + ' – ' + fmtPct(cd[1]) + '</strong><br>' +
        fmtPct(cd[2] / 100) + ' of sampled players<br>' +
        'Bin total: ' + fmtPct(cd[3] / 100));
    });
  }

  // Tap-to-interact lock: on coarse-pointer phones the chart starts
  // inert (pointer-events: none) behind an overlay button, so a swipe
  // scrolls the page instead of dragging the chart. Tapping the overlay
  // unlocks the chart and shows a "Lock chart" chip to get back.
  var lockHist = null;
  function makeLock(plot, label) {
    var wrap = plot.parentElement;
    var overlay = document.createElement('div');
    overlay.className = 'tft-lock-overlay';
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'tft-lock-btn';
    btn.textContent = label;
    overlay.appendChild(btn);
    var chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'tft-lock-chip';
    chip.textContent = 'Lock chart to scroll';
    chip.style.display = 'none';
    wrap.appendChild(overlay);
    // The chip lives below the chart, not overlaid on it: overlaid
    // top-right it would cover the legend.
    wrap.parentNode.insertBefore(chip, wrap.nextSibling);
    function lock() { overlay.style.display = 'flex'; chip.style.display = 'none'; plot.style.pointerEvents = 'none'; }
    function unlock() { overlay.style.display = 'none'; chip.style.display = ''; plot.style.pointerEvents = ''; }
    btn.addEventListener('click', unlock);
    chip.addEventListener('click', lock);
    lock();
    return {
      remove: function () { overlay.remove(); chip.remove(); plot.style.pointerEvents = ''; }
    };
  }
  function ensureLocks() {
    if (!sample || !tiers) return;
    if (needsLock()) {
      if (!lockHist) lockHist = makeLock(plotEl, 'Tap to explore the chart');
    } else {
      if (lockHist) { lockHist.remove(); lockHist = null; }
    }
  }

  // Crossing the 700px breakpoint changes the layout (modebar, ticks,
  // fonts) and the lock, so re-render then; Plotly's own responsive
  // handling covers resizes within a breakpoint.
  var lastNarrow = isNarrow();
  var resizeTimer = null;
  window.addEventListener('resize', function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () {
      ensureLocks();
      var n = isNarrow();
      if (n !== lastNarrow) { lastNarrow = n; render(); }
    }, 200);
  });

  // Re-colour the plots when the site theme (or vibe) changes.
  var themeTimer = null;
  var observer = new MutationObserver(function () {
    if (!sample || !tiers || !window.Plotly) return;
    clearTimeout(themeTimer);
    themeTimer = setTimeout(function () { render(); }, 150);
  });
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'data-vibe'] });

  function waitForPlotly(tries, done) {
    if (window.Plotly) return done(true);
    if (tries <= 0) return done(false);
    setTimeout(function () { waitForPlotly(tries - 1, done); }, 200);
  }

  function fail(msg) {
    detailEl.innerHTML = '<p>' + msg + ' The underlying data is still available as ' +
      '<a href="/assets/data/tft-rank-distribution-sampled-set18-2026-11.json">JSON</a>.</p>';
  }

  Promise.all([
    fetch(sampleUrl).then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); }),
    fetch(tiersUrl).then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
  ]).then(function (results) {
    sample = results[0];
    tiers = results[1];
    renderSummary();
    renderBinsTable();
    waitForPlotly(25, function (ok) {
      if (!ok) {
        fail('Plotly.js did not load (jsDelivr CDN). The charts need it; the table below and the JSON download still work.');
        return;
      }
      render();
    });
  }).catch(function () {
    fail('Could not load the distribution data.');
  });
})();
