/* TFT Rank Distribution — Plotly.js.
 *
 * Single source: tft-rank-distribution-sampled-set18-2026-11.json
 * (top-4 rate sample) + tft-rank-distribution-tiers.json (League of
 * Graphs NA tier shares), both fetched via the data-json / data-tiers
 * attributes. Every number on the page comes from those files; nothing
 * is hard-coded here.
 *
 * Lead metric is the TOP-4 RATE: the share of a player's ranked games
 * that ended in the top 4. Percentiles are empirical, computed from the
 * pooled bins — no model is fitted (the JSON's model_fit entries are
 * placeholders) and nothing is averaged across sets.
 */
(function () {
  var root = document.getElementById('tft');
  if (!root) return;
  var sampleUrl = root.getAttribute('data-json');
  var tiersUrl = root.getAttribute('data-tiers');
  var plotEl = document.getElementById('tft-plot');
  var tierEl = document.getElementById('tft-tier-plot');
  var detailEl = document.getElementById('tft-detail');
  var tierDetailEl = document.getElementById('tft-tier-detail');
  var summaryEl = document.getElementById('tft-summary');
  var lookupInput = document.getElementById('tft-lookup-input');
  var lookupBtn = document.getElementById('tft-lookup-btn');
  var lookupResult = document.getElementById('tft-lookup-result');
  var logToggle = document.getElementById('tft-tier-log');
  var cumToggle = document.getElementById('tft-tier-cum');

  // Mobile tuning (Fed pattern): below 700px the modebar is hidden;
  // on coarse-pointer phones each chart starts locked behind a
  // tap-to-interact overlay so a swipe scrolls the page.
  function isNarrow() { return window.matchMedia('(max-width: 700px)').matches; }
  function needsLock() { return isNarrow() && window.matchMedia('(pointer: coarse)').matches; }

  var sample = null;
  var tiers = null;
  var plotted = false;
  var plottedTier = false;
  var logScale = false;
  var showCum = true;

  function fmtPct(frac, digits) {
    return (frac * 100).toFixed(digits === undefined ? 1 : digits) + '%';
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

  /* --- Top-4 rate histogram --- */

  function binCenters() {
    return sample.metrics.top4_rate.bins.map(function (b) { return (b.lo + b.hi) / 2 * 100; });
  }

  function renderHist() {
    var t = theme();
    var bins = sample.metrics.top4_rate.bins;
    var x = binCenters();
    var y = bins.map(function (b) { return b.pct_pooled; });
    var errUp = bins.map(function (b) {
      return Math.max.apply(null, b.pct_by_replicate) - b.pct_pooled;
    });
    var errDown = bins.map(function (b) {
      return b.pct_pooled - Math.min.apply(null, b.pct_by_replicate);
    });
    var trace = {
      type: 'bar',
      name: 'Share of sampled players',
      x: x,
      y: y,
      text: bins.map(function (b) {
        return fmtPct(b.lo) + ' – ' + fmtPct(b.hi) + '<br>' +
          fmtPct(b.pct_pooled / 100) + ' of sampled players<br>' +
          'Replicates: ' + fmtPct(Math.min.apply(null, b.pct_by_replicate) / 100) +
          ' – ' + fmtPct(Math.max.apply(null, b.pct_by_replicate) / 100);
      }),
      hoverinfo: 'text',
      // text is hover-only: bar traces default textposition to 'auto',
      // which would draw the hover strings on the bars themselves.
      textposition: 'none',
      // customdata powers tap-to-inspect: [lo, hi, pct, rep min, rep max].
      customdata: bins.map(function (b) {
        return [b.lo, b.hi, b.pct_pooled,
          Math.min.apply(null, b.pct_by_replicate),
          Math.max.apply(null, b.pct_by_replicate)];
      }),
      marker: { color: t.accent },
      // The error bars are the replicate spread band: min–max across
      // the 5 replicates per bin (sampling noise only).
      error_y: {
        type: 'data', symmetric: false,
        array: errUp, arrayminus: errDown,
        visible: true, color: t.muted, thickness: 1, width: 2
      }
    };
    var layout = {
      autosize: true,
      margin: { l: 56, r: 16, t: 12, b: 56 },
      paper_bgcolor: 'rgba(0,0,0,0)',
      plot_bgcolor: 'rgba(0,0,0,0)',
      font: { color: t.text, family: 'Inter, system-ui, sans-serif', size: isNarrow() ? 13 : 12 },
      showlegend: false,
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
      ? window.Plotly.react(plotEl, [trace], layout, plotConfig())
      : window.Plotly.newPlot(plotEl, [trace], layout, plotConfig());
    plotted = true;
    return p;
  }

  /* --- Percentile lookup: share above a top-4 rate, from the bins --- */

  function shareAbove(rateFrac) {
    // Bins fully above the rate count in full; the bin containing the
    // rate counts in proportion (uniform within the 2.5pp bin).
    var total = 0;
    sample.metrics.top4_rate.bins.forEach(function (b) {
      if (b.lo >= rateFrac) {
        total += b.pct_pooled;
      } else if (b.hi > rateFrac) {
        total += b.pct_pooled * (b.hi - rateFrac) / (b.hi - b.lo);
      }
    });
    return total / 100;
  }

  function runLookup() {
    var v = parseFloat(lookupInput.value);
    if (isNaN(v) || v < 0 || v > 100) {
      lookupResult.textContent = 'Enter a top-4 rate between 0 and 100.';
      return;
    }
    var above = shareAbove(v / 100);
    var betterThan = 100 - above * 100;
    lookupResult.textContent = 'A ' + v.toFixed(1) + '% top-4 rate is better than about ' +
      betterThan.toFixed(1) + '% of sampled players — top ' + (above * 100).toFixed(1) + '%.';
  }
  lookupBtn.addEventListener('click', runLookup);
  lookupInput.addEventListener('change', runLookup);

  /* --- Tier chart --- */

  // Cumulative share from the top (Challenger down), in percent.
  function cumFromTop() {
    var cum = [];
    var running = 0;
    for (var i = tiers.buckets.length - 1; i >= 0; i--) {
      running += tiers.buckets[i].share_pct;
      cum[i] = running;
    }
    return cum;
  }

  function renderTier() {
    var t = theme();
    var labels = tiers.buckets.map(function (b) { return b.label; });
    var shares = tiers.buckets.map(function (b) { return b.share_pct; });
    var colors = tiers.buckets.map(function (b) { return b.color; });
    var cum = cumFromTop();
    var bar = {
      type: 'bar',
      name: 'Share of players',
      x: labels,
      y: shares,
      text: tiers.buckets.map(function (b, i) {
        return b.label + '<br>' + fmtPct(b.share_pct / 100) + ' of players<br>' +
          'Cumulative from the top: ' + fmtPct(cum[i] / 100);
      }),
      hoverinfo: 'text',
      // text is hover-only (see histogram trace: bar default would
      // draw the hover strings on the bars).
      textposition: 'none',
      customdata: tiers.buckets.map(function (b, i) { return [b.label, b.share_pct, cum[i]]; }),
      marker: { color: colors }
    };
    var traces = [bar];
    if (showCum) {
      traces.push({
        type: 'scatter',
        mode: 'lines+markers',
        name: 'Cumulative share from the top',
        x: labels,
        y: cum,
        yaxis: 'y2',
        text: tiers.buckets.map(function (b, i) {
          return b.label + '<br>Cumulative from the top: ' + fmtPct(cum[i] / 100);
        }),
        hoverinfo: 'text',
        line: { color: t.text, width: 2 },
        marker: { size: 4, color: t.text }
      });
    }
    var layout = {
      autosize: true,
      // Wide bottom margin + steep tick angle: 31 tier labels need room
      // or they run together. Wide right margin keeps the cumulative
      // axis and its ticks clear of the modebar.
      margin: { l: 56, r: 64, t: 12, b: isNarrow() ? 130 : 120 },
      paper_bgcolor: 'rgba(0,0,0,0)',
      plot_bgcolor: 'rgba(0,0,0,0)',
      font: { color: t.text, family: 'Inter, system-ui, sans-serif', size: isNarrow() ? 13 : 12 },
      showlegend: false,
      bargap: 0.1,
      xaxis: {
        title: 'Tier',
        tickangle: -55,
        gridcolor: t.grid, zerolinecolor: t.grid,
        tickfont: { size: 10 }
      },
      yaxis: {
        title: 'Share of players (%)',
        type: logScale ? 'log' : 'linear',
        gridcolor: t.grid, zerolinecolor: t.grid,
        tickfont: { size: isNarrow() ? 12 : 11 }
      },
      yaxis2: {
        // Short title: the full "Cumulative from the top (%)" ran up
        // behind the modebar at the top-right corner.
        title: 'Cumulative (%)',
        titlefont: { size: 11 },
        overlaying: 'y',
        side: 'right',
        range: [0, 100],
        showgrid: false,
        tickfont: { size: isNarrow() ? 12 : 11 }
      }
    };
    var p = plottedTier
      ? window.Plotly.react(tierEl, traces, layout, plotConfig())
      : window.Plotly.newPlot(tierEl, traces, layout, plotConfig());
    plottedTier = true;
    return p;
  }

  logToggle.addEventListener('change', function () { logScale = logToggle.checked; render(); });
  cumToggle.addEventListener('change', function () { showCum = cumToggle.checked; render(); });

  /* --- Tables (every chart value, in text form) --- */

  function renderSummary() {
    var m = sample.metrics.top4_rate;
    var s = m.summary_pooled;
    summaryEl.textContent = m.n_pooled.toLocaleString('en-US') +
      ' sampled players in ' + sample.design.replicates + ' replicates · median top-4 rate ' +
      fmtPct(s.median) + ' · ' + fmtPct(s.share_gt_60pct, 1) +
      ' top-4 more than 60% of the time.';
  }

  function renderThresholdsTable() {
    var s = sample.metrics.top4_rate.summary_pooled;
    var rows = [
      ['Median', s.median, '50%'],
      ['90th percentile', s.p90, '10%'],
      ['95th percentile', s.p95, '5%'],
      ['99th percentile', s.p99, '1%'],
      ['Above 60%', 0.60, fmtPct(s.share_gt_60pct)],
      ['Above 70%', 0.70, fmtPct(s.share_gt_70pct)]
    ];
    var body = document.querySelector('#tft-thresholds-table tbody');
    body.innerHTML = '';
    rows.forEach(function (r) {
      var tr = document.createElement('tr');
      var th = document.createElement('th');
      th.scope = 'row';
      th.textContent = r[0] + ' (' + fmtPct(r[1]) + ')';
      tr.appendChild(th);
      var td = document.createElement('td');
      td.style.textAlign = 'right';
      td.textContent = r[2];
      tr.appendChild(td);
      body.appendChild(tr);
    });
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

  // "What counts as good?": for each top-share cut, the first bucket
  // (from the top) whose cumulative share reaches it.
  function renderGoodTable() {
    var cum = cumFromTop();
    var cuts = [50, 25, 10, 5, 1, 0.1];
    var body = document.querySelector('#tft-good-table tbody');
    body.innerHTML = '';
    cuts.forEach(function (cut) {
      var label = '—';
      // Scan from the top (Challenger) down and stop at the first bucket
      // whose cumulative share reaches the cut — that bucket is where
      // the top cut% starts. (Without the break, every lower bucket
      // also satisfies the test and the answer collapses to Iron IV.)
      for (var i = tiers.buckets.length - 1; i >= 0; i--) {
        if (cum[i] >= cut) { label = tiers.buckets[i].label; break; }
      }
      var tr = document.createElement('tr');
      var th = document.createElement('th');
      th.scope = 'row';
      th.textContent = 'Top ' + cut + '%';
      tr.appendChild(th);
      var td = document.createElement('td');
      td.textContent = '≈ ' + label + ' and above';
      tr.appendChild(td);
      body.appendChild(tr);
    });
  }

  function renderTiersTable() {
    var cum = cumFromTop();
    var body = document.querySelector('#tft-tiers-table tbody');
    body.innerHTML = '';
    tiers.buckets.forEach(function (b, i) {
      var tr = document.createElement('tr');
      var th = document.createElement('th');
      th.scope = 'row';
      th.textContent = b.label;
      tr.appendChild(th);
      var td = document.createElement('td');
      td.style.textAlign = 'right';
      td.textContent = fmtPct(b.share_pct / 100, 3);
      tr.appendChild(td);
      var td2 = document.createElement('td');
      td2.style.textAlign = 'right';
      td2.textContent = fmtPct(cum[i] / 100);
      tr.appendChild(td2);
      body.appendChild(tr);
    });
  }

  function render() {
    if (!sample || !tiers || !window.Plotly) return;
    renderHist();
    renderTier();
    bindClicks();
    ensureLocks();
  }

  // Tap-to-inspect: hover does not exist on a phone, so a tap on a bar
  // writes its detail into the box below the chart instead.
  var clickBound = false;
  function setDetail(html) { detailEl.innerHTML = '<p>' + html + '</p>'; }
  function setTierDetail(html) { tierDetailEl.innerHTML = '<p>' + html + '</p>'; }
  function bindClicks() {
    if (clickBound || !window.Plotly) return;
    clickBound = true;
    plotEl.on('plotly_click', function (ev) {
      var pt = ev.points && ev.points[0];
      if (!pt || !pt.customdata) return;
      var cd = pt.customdata;
      setDetail('<strong>Top-4 rate ' + fmtPct(cd[0]) + ' – ' + fmtPct(cd[1]) + '</strong><br>' +
        fmtPct(cd[2] / 100) + ' of sampled players<br>' +
        'Across the 5 replicates: ' + fmtPct(cd[3] / 100) + ' – ' + fmtPct(cd[4] / 100));
    });
    tierEl.on('plotly_click', function (ev) {
      var pt = ev.points && ev.points[0];
      if (!pt || !pt.customdata) return;
      var cd = pt.customdata;
      setTierDetail('<strong>' + cd[0] + '</strong><br>' +
        fmtPct(cd[1] / 100) + ' of players<br>' +
        'Cumulative from the top: ' + fmtPct(cd[2] / 100));
    });
  }

  // Tap-to-interact lock: on coarse-pointer phones each chart starts
  // inert (pointer-events: none) behind an overlay button, so a swipe
  // scrolls the page instead of dragging the chart. Tapping the overlay
  // unlocks the chart and shows a "Lock chart" chip to get back.
  var lockHist = null;
  var lockTier = null;
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
      if (!lockTier) lockTier = makeLock(tierEl, 'Tap to explore the tier chart');
    } else {
      if (lockHist) { lockHist.remove(); lockHist = null; }
      if (lockTier) { lockTier.remove(); lockTier = null; }
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
    renderThresholdsTable();
    renderBinsTable();
    renderGoodTable();
    renderTiersTable();
    runLookup();
    waitForPlotly(25, function (ok) {
      if (!ok) {
        fail('Plotly.js did not load (jsDelivr CDN). The charts need it; the tables above and the JSON download still work.');
        return;
      }
      render();
    });
  }).catch(function () {
    fail('Could not load the distribution data.');
  });
})();
