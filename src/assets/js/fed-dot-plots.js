/* Fed Dot Plots in 3D — Plotly.js.
 *
 * Single source: fed-dot-plots.json (fetched via the data-json attribute).
 * Axes: x = SEP vintage date, y = target year, z = federal funds rate (%).
 * One marker per (vintage, target_year, rate) count row, sized by count —
 * no random jitter, so every marker sits exactly on its published
 * coordinate. The median trace is never jittered either.
 * Longer run has no calendar year, so it is NOT in the 3D cloud: it gets
 * its own 2D panel below, labelled "Longer run (neutral rate)".
 * Medians before Sep 2016 are derived from the dots (median_source ==
 * "derived"); hover text says so and never presents them as published.
 */
(function () {
  var root = document.getElementById('fdp');
  if (!root) return;
  var url = root.getAttribute('data-json');
  var plotEl = document.getElementById('fdp-plot');
  var lrEl = document.getElementById('fdp-lr-plot');
  var lrSection = document.getElementById('fdp-lr-section');
  var detailEl = document.getElementById('fdp-detail');
  var lrDetailEl = document.getElementById('fdp-lr-detail');
  var summaryEl = document.getElementById('fdp-summary');
  var tableBody = document.querySelector('#fdp-table tbody');

  // Mobile tuning (Option 1): below 700px the modebar is hidden, the
  // colourbar goes horizontal, ticks thin out and type grows; on
  // coarse-pointer phones the charts also start locked behind a
  // tap-to-interact overlay so a swipe scrolls the page.
  function isNarrow() { return window.matchMedia('(max-width: 700px)').matches; }
  function needsLock() { return isNarrow() && window.matchMedia('(pointer: coarse)').matches; }

  var DAY = 24 * 60 * 60 * 1000;
  var EPOCH = Date.UTC(2012, 0, 25); // first vintage, Jan 25 2012
  var MEDIAN_COLOR = '#d97706';
  var data = null;
  var plotted3d = false;
  var plottedLr = false;

  var vintageMin = '2012-01-25';
  var vintageMax = '2026-09-16';
  var yearMin = 2012;
  var yearMax = 2029;
  var showMedian = true;
  var showLr = true;

  function parseDate(s) {
    var p = s.split('-');
    return Date.UTC(+p[0], +p[1] - 1, +p[2]);
  }

  function fmtDate(ms) {
    return new Date(ms).toLocaleDateString('en-US', {
      timeZone: 'UTC', month: 'short', day: 'numeric', year: 'numeric'
    });
  }

  function fmtRate(r) {
    // Rates sit on the 1/8-point grid; trim trailing zeros, keep the sign.
    var s = (Math.round(r * 1000) / 1000).toFixed(3).replace(/0+$/, '').replace(/\.$/, '');
    return s + '%';
  }

  function isDark() {
    var t = document.documentElement.getAttribute('data-theme');
    if (t) return t === 'dark';
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  }

  // Plotly's 3D (WebGL) path does not reliably parse oklch(), so use plain
  // hex approximations of the site tokens, per theme. Readable in both.
  function theme() {
    if (isDark()) {
      return { text: '#d6dae2', muted: '#9aa3b2', grid: '#3a4152', accent: '#38bdf8', card: '#232833' };
    }
    return { text: '#333a45', muted: '#6b7280', grid: '#e3e6ea', accent: '#4f46e5', card: '#ffffff' };
  }

  function medianKey(vintage, year) { return vintage + '|' + year; }

  function medianLookup() {
    var map = {};
    data.medians.forEach(function (m) { map[medianKey(m.vintage, m.target_year)] = m; });
    data.longer_run.medians.forEach(function (m) { map[medianKey(m.vintage, 'LR')] = m; });
    return map;
  }

  function inVintageRange(vintage) {
    return vintage >= vintageMin && vintage <= vintageMax;
  }

  function filteredDots() {
    return data.dots.filter(function (d) {
      return inVintageRange(d.vintage) && d.target_year >= yearMin && d.target_year <= yearMax;
    });
  }

  function yearlyTicks() {
    // x tick at Jan 1 of each year, labelled by year.
    var vals = [], text = [];
    for (var y = 2012; y <= 2026; y++) {
      vals.push((Date.UTC(y, 0, 1) - EPOCH) / DAY);
      text.push(String(y));
    }
    return { vals: vals, text: text };
  }

  function colorbarTicks() {
    // Colourbar ticks as years, not raw day counts. The 2012 tick sits on
    // the first vintage (Jan 25, 2012) — Jan 1 would fall off the scale.
    var years = [2012, 2016, 2020, 2024, 2026];
    return {
      vals: years.map(function (y) {
        return y === 2012 ? 0 : (Date.UTC(y, 0, 1) - EPOCH) / DAY;
      }),
      text: years.map(String)
    };
  }

  function buildDotsTrace(rows, medians) {
    var x = [], y = [], z = [], size = [], hover = [], color = [], custom = [];
    rows.forEach(function (d) {
      var days = (parseDate(d.vintage) - EPOCH) / DAY;
      var m = medians[medianKey(d.vintage, d.target_year)];
      x.push(days);
      y.push(d.target_year);
      z.push(d.rate);
      color.push(days);
      // customdata powers tap-to-inspect (plotly_click): [vintage, year,
      // rate, count, median_derived, median_source].
      custom.push([d.vintage, d.target_year, d.rate, d.count,
        m ? m.median_derived : null, m ? m.median_source : null]);
      // Marker size encodes the count: 1 participant -> 7, 19 -> ~39.
      size.push(5 + 1.8 * d.count);
      var med = m ? fmtRate(m.median_derived) : '—';
      var medNote = m && m.median_source === 'derived'
        ? ' (derived from dots, not published)'
        : '';
      hover.push(
        'SEP vintage: ' + fmtDate(parseDate(d.vintage)) +
        '<br>Target year: ' + d.target_year +
        '<br>Rate: ' + fmtRate(d.rate) +
        '<br>Participants at this rate: ' + d.count +
        '<br>Median for this vintage &amp; year: ' + med + medNote
      );
    });
    var cb = colorbarTicks();
    return {
      type: 'scatter3d',
      mode: 'markers',
      name: 'Dots (one marker per rate, sized by count)',
      x: x, y: y, z: z,
      text: hover,
      hoverinfo: 'text',
      customdata: custom,
      marker: {
        size: size,
        color: color,
        // On narrow screens the Plotly colourbar is hidden and an HTML
        // gradient legend below the chart takes its place: the horizontal
        // Plotly colourbar collided with the x-axis title/ticks. Note
        // this is marker.showscale, not the trace-level flag — for
        // scatter3d the marker's colourbar obeys the marker setting.
        showscale: !isNarrow(),
        // Bright-ended custom scale (sky -> indigo -> amber) so the
        // earliest vintages stay visible on the dark theme too; Viridis'
        // dark-purple low end vanished against the dark card.
        colorscale: [[0, '#38bdf8'], [0.5, '#818cf8'], [1, '#f59e0b']],
        colorbar: {
          title: 'SEP vintage',
          tickvals: cb.vals,
          ticktext: cb.text,
          len: 0.7,
          tickfont: { size: 11 }
        },
        opacity: 0.85,
        line: { width: 0.5, color: 'rgba(128,128,128,0.5)' }
      }
    };
  }

  function buildMedianTraces(medians) {
    // One line per target year across vintages: a single trace sorted by
    // (vintage, year) would zig-zag through the cloud. All lines share one
    // legend entry via legendgroup.
    var byYear = {};
    data.medians.forEach(function (m) {
      if (!inVintageRange(m.vintage)) return;
      if (m.target_year < yearMin || m.target_year > yearMax) return;
      (byYear[m.target_year] = byYear[m.target_year] || []).push(m);
    });
    var traces = [];
    Object.keys(byYear).sort(function (a, b) { return a - b; }).forEach(function (yr, idx) {
      var rows = byYear[yr].slice().sort(function (a, b) {
        return a.vintage < b.vintage ? -1 : 1;
      });
      var hover = rows.map(function (m) {
        var note = m.median_source === 'derived'
          ? '<br>Median derived from the dots — not a published Fed value'
          : '<br>Median as published in Table 1';
        return 'SEP vintage: ' + fmtDate(parseDate(m.vintage)) +
          '<br>Target year: ' + m.target_year +
          '<br>Median: ' + fmtRate(m.median_derived) + note;
      });
      traces.push({
        type: 'scatter3d',
        mode: 'lines+markers',
        name: 'Median path',
        legendgroup: 'median',
        showlegend: idx === 0,
        x: rows.map(function (m) { return (parseDate(m.vintage) - EPOCH) / DAY; }),
        y: rows.map(function (m) { return m.target_year; }),
        z: rows.map(function (m) { return m.median_derived; }),
        text: hover,
        hoverinfo: 'text',
        // customdata for tap-to-inspect: [vintage, year, median, source].
        customdata: rows.map(function (m) { return [m.vintage, m.target_year, m.median_derived, m.median_source]; }),
        line: { color: MEDIAN_COLOR, width: 4 },
        marker: { size: 3, color: MEDIAN_COLOR }
      });
    });
    return traces;
  }

  function narrowTicks() {
    // x ticks every 4 years on narrow screens; the yearly ticks crowd
    // and clip at 356px wide.
    var years = [2012, 2016, 2020, 2024, 2026];
    return {
      vals: years.map(function (y) {
        return y === 2012 ? 0 : (Date.UTC(y, 0, 1) - EPOCH) / DAY;
      }),
      text: years.map(String)
    };
  }

  function layout3d(t) {
    var ticks = isNarrow() ? narrowTicks() : yearlyTicks();
    var narrow = isNarrow();
    return {
      autosize: true,
      margin: { l: narrow ? 16 : 0, r: narrow ? 16 : 0, t: 0, b: narrow ? 20 : 0 },
      paper_bgcolor: 'rgba(0,0,0,0)',
      font: { color: t.text, family: 'Inter, system-ui, sans-serif', size: narrow ? 13 : 12 },
      // Legend top-left: the default top-right spot collides with the
      // colourbar and its title.
      legend: { x: 0, y: 1, font: { size: narrow ? 13 : 12 }, bgcolor: 'rgba(0,0,0,0)' },
      scene: {
        bgcolor: 'rgba(0,0,0,0)',
        camera: { eye: { x: 1.6, y: -1.4, z: 1.0 } },
        xaxis: {
          title: 'SEP vintage',
          tickvals: ticks.vals, ticktext: ticks.text,
          gridcolor: t.grid, zerolinecolor: t.grid,
          tickfont: { size: narrow ? 12 : 11 }, titlefont: { size: narrow ? 13 : 12 }
        },
        yaxis: {
          title: 'Target year',
          range: [2011.5, 2029.5],
          dtick: narrow ? 4 : 2,
          gridcolor: t.grid, zerolinecolor: t.grid,
          tickfont: { size: narrow ? 12 : 11 }, titlefont: { size: narrow ? 13 : 12 }
        },
        zaxis: {
          // Short title on narrow screens: the full "Federal funds rate
          // (%)" clipped at the left edge at 356px wide.
          title: narrow ? 'Rate (%)' : 'Federal funds rate (%)',
          range: [-0.5, 6.5],
          dtick: narrow ? 2 : 1,
          ticksuffix: '%',
          gridcolor: t.grid, zerolinecolor: t.grid,
          tickfont: { size: narrow ? 12 : 11 }, titlefont: { size: narrow ? 13 : 12 }
        }
      }
    };
  }

  function render3d() {
    var t = theme();
    var medians = medianLookup();
    var rows = filteredDots();
    var traces = [buildDotsTrace(rows, medians)];
    if (showMedian) traces = traces.concat(buildMedianTraces(medians));
    var p = plotted3d
      ? window.Plotly.react(plotEl, traces, layout3d(t), plotConfig())
      : window.Plotly.newPlot(plotEl, traces, layout3d(t), plotConfig());
    plotted3d = true;
    return p;
  }

  function plotConfig() {
    // The modebar's camera/download icons overlapped the colourbar and
    // legend at phone width, so it is hidden below 700px; the "Reset 3D
    // view" button in the controls covers the camera reset instead.
    return { responsive: true, displaylogo: false, displayModeBar: !isNarrow() };
  }

  function renderLr() {
    if (!showLr) {
      lrSection.style.display = 'none';
      return window.Plotly ? window.Plotly.purge(lrEl) : null;
    }
    lrSection.style.display = '';
    var t = theme();
    var rows = data.longer_run.dots.filter(function (d) { return inVintageRange(d.vintage); });
    var meds = data.longer_run.medians.filter(function (m) { return inVintageRange(m.vintage); })
      .slice().sort(function (a, b) { return a.vintage < b.vintage ? -1 : 1; });
    var medMap = {};
    meds.forEach(function (m) { medMap[m.vintage] = m; });
    var dotsTrace = {
      type: 'scatter',
      mode: 'markers',
      name: 'Longer-run dots',
      x: rows.map(function (d) { return d.vintage; }),
      y: rows.map(function (d) { return d.rate; }),
      text: rows.map(function (d) {
        var m = medMap[d.vintage];
        var med = m ? fmtRate(m.median_derived) : '—';
        var note = m && m.median_source === 'derived' ? ' (derived from dots)' : '';
        return 'SEP vintage: ' + fmtDate(parseDate(d.vintage)) +
          '<br>Longer run rate: ' + fmtRate(d.rate) +
          '<br>Participants at this rate: ' + d.count +
          '<br>Longer-run median: ' + med + note;
      }),
      hoverinfo: 'text',
      // customdata for tap-to-inspect: [vintage, rate, count, median, source].
      customdata: rows.map(function (d) {
        var m = medMap[d.vintage];
        return [d.vintage, d.rate, d.count,
          m ? m.median_derived : null, m ? m.median_source : null];
      }),
      marker: {
        size: rows.map(function (d) { return 5 + 1.8 * d.count; }),
        color: t.accent,
        opacity: 0.75,
        line: { width: 0.5, color: 'rgba(128,128,128,0.5)' }
      }
    };
    var medianTrace = {
      type: 'scatter',
      mode: 'lines+markers',
      name: 'Longer-run median',
      x: meds.map(function (m) { return m.vintage; }),
      y: meds.map(function (m) { return m.median_derived; }),
      text: meds.map(function (m) {
        var note = m.median_source === 'derived'
          ? 'Median derived from the dots — not a published Fed value'
          : 'Median as published in Table 1';
        return 'SEP vintage: ' + fmtDate(parseDate(m.vintage)) +
          '<br>Longer-run median: ' + fmtRate(m.median_derived) + '<br>' + note;
      }),
      hoverinfo: 'text',
      // customdata for tap-to-inspect: [vintage, median, source].
      customdata: meds.map(function (m) { return [m.vintage, m.median_derived, m.median_source]; }),
      line: { color: MEDIAN_COLOR, width: 3 },
      marker: { size: 5, color: MEDIAN_COLOR }
    };
    var layout = {
      autosize: true,
      margin: { l: 56, r: 16, t: 12, b: 48 },
      paper_bgcolor: 'rgba(0,0,0,0)',
      plot_bgcolor: 'rgba(0,0,0,0)',
      font: { color: t.text, family: 'Inter, system-ui, sans-serif', size: isNarrow() ? 13 : 12 },
      legend: { font: { size: isNarrow() ? 13 : 12 } },
      xaxis: {
        title: 'SEP vintage',
        nticks: isNarrow() ? 5 : 10,
        gridcolor: t.grid, zerolinecolor: t.grid,
        tickfont: { size: isNarrow() ? 12 : 11 }
      },
      yaxis: {
        title: 'Federal funds rate (%)',
        range: [1.5, 5],
        dtick: 0.5,
        ticksuffix: '%',
        gridcolor: t.grid, zerolinecolor: t.grid,
        tickfont: { size: isNarrow() ? 12 : 11 }
      }
    };
    var p = plottedLr
      ? window.Plotly.react(lrEl, [dotsTrace, medianTrace], layout, plotConfig())
      : window.Plotly.newPlot(lrEl, [dotsTrace, medianTrace], layout, plotConfig());
    plottedLr = true;
    return p;
  }

  function render() {
    if (!data || !window.Plotly) return;
    render3d();
    renderLr();
    bindClicks();
    ensureLocks();
  }

  // Tap-to-inspect: hover does not exist on a phone, so a tap on a dot
  // (or a median point) writes its detail into the box below the chart
  // instead. plotly_click fires for gl3d scenes on touch in Plotly 2.25+.
  var clickBound = false;
  function setDetail(html) { detailEl.innerHTML = '<p>' + html + '</p>'; }
  function setLrDetail(html) { lrDetailEl.innerHTML = '<p>' + html + '</p>'; }
  function bindClicks() {
    if (clickBound || !window.Plotly) return;
    clickBound = true;
    plotEl.on('plotly_click', function (ev) {
      var pt = ev.points && ev.points[0];
      if (!pt || !pt.customdata) return;
      var cd = pt.customdata;
      if (pt.curveNumber === 0) {
        setDetail('<strong>SEP vintage ' + fmtDate(parseDate(cd[0])) +
          ' · target year ' + cd[1] + '</strong><br>Rate: ' + fmtRate(cd[2]) +
          ' · ' + cd[3] + (cd[3] === 1 ? ' participant' : ' participants') +
          ' at this rate<br>Median: ' + fmtRate(cd[4]) +
          (cd[5] === 'derived' ? ' (derived from dots — not a published Fed value)' : ' (published in Table 1)'));
      } else {
        setDetail('<strong>Median path · SEP vintage ' + fmtDate(parseDate(cd[0])) +
          ' · target year ' + cd[1] + '</strong><br>Median: ' + fmtRate(cd[2]) +
          (cd[3] === 'derived' ? ' — derived from dots, not a published Fed value' : ' — as published in Table 1'));
      }
    });
    lrEl.on('plotly_click', function (ev) {
      var pt = ev.points && ev.points[0];
      if (!pt || !pt.customdata) return;
      var cd = pt.customdata;
      if (pt.curveNumber === 0) {
        setLrDetail('<strong>SEP vintage ' + fmtDate(parseDate(cd[0])) +
          '</strong><br>Longer-run rate: ' + fmtRate(cd[1]) +
          ' · ' + cd[2] + (cd[2] === 1 ? ' participant' : ' participants') +
          ' at this rate<br>Longer-run median: ' + fmtRate(cd[3]) +
          (cd[4] === 'derived' ? ' (derived from dots)' : ' (published in Table 1)'));
      } else {
        setLrDetail('<strong>Longer-run median · SEP vintage ' + fmtDate(parseDate(cd[0])) +
          '</strong><br>Median: ' + fmtRate(cd[1]) +
          (cd[2] === 'derived' ? ' — derived from dots, not a published Fed value' : ' — as published in Table 1'));
      }
    });
  }

  // Tap-to-interact lock: on coarse-pointer phones the chart starts
  // inert (pointer-events: none) behind an overlay button, so a swipe
  // scrolls the page instead of rotating the chart. Tapping the overlay
  // unlocks the chart and shows a "Lock chart" chip to get back.
  var lock3d = null;
  var lockLr = null;
  function makeLock(plot, label) {
    var wrap = plot.parentElement;
    var overlay = document.createElement('div');
    overlay.className = 'fdp-lock-overlay';
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'fdp-lock-btn';
    btn.textContent = label;
    overlay.appendChild(btn);
    var chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'fdp-lock-chip';
    chip.textContent = 'Lock chart to scroll';
    chip.style.display = 'none';
    wrap.appendChild(overlay);
    // The chip lives below the chart, not overlaid on it: overlaid
    // top-right it covered the Longer-run legend.
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
    if (!data) return;
    if (needsLock()) {
      if (!lock3d) lock3d = makeLock(plotEl, 'Tap to explore the 3D chart');
      if (!lockLr) lockLr = makeLock(lrEl, 'Tap to explore the Longer-run chart');
    } else {
      if (lock3d) { lock3d.remove(); lock3d = null; }
      if (lockLr) { lockLr.remove(); lockLr = null; }
    }
  }

  function renderTable() {
    var latest = data.vintages[data.vintages.length - 1].vintage;
    var rows = data.medians.filter(function (m) { return m.vintage === latest; })
      .slice().sort(function (a, b) { return a.target_year - b.target_year; });
    var lr = data.longer_run.medians.filter(function (m) { return m.vintage === latest; })[0];
    tableBody.innerHTML = '';
    function addRow(label, m) {
      var tr = document.createElement('tr');
      var cells = [
        label,
        String(m.n_dots),
        fmtRate(m.median_derived),
        m.median_published === null ? '—' : fmtRate(m.median_published),
        fmtRate(m.range_derived[0]) + ' – ' + fmtRate(m.range_derived[1])
      ];
      cells.forEach(function (text, idx) {
        var el = document.createElement(idx === 0 ? 'th' : 'td');
        if (idx === 0) el.scope = 'row';
        el.textContent = text;
        if (idx > 0) el.style.textAlign = 'right';
        tr.appendChild(el);
      });
      tableBody.appendChild(tr);
    }
    rows.forEach(function (m) { addRow(String(m.target_year), m); });
    if (lr) addRow('Longer run', lr);
  }

  function renderSummary() {
    var md = data.metadata;
    var first = fmtDate(parseDate(md.coverage.first_vintage));
    var last = fmtDate(parseDate(md.coverage.last_vintage));
    summaryEl.innerHTML =
      '<strong>' + md.coverage.n_vintages + ' SEP vintages</strong> · ' +
      '<strong>' + md.totals.dots.toLocaleString('en-US') + ' dots</strong> ' +
      '(' + md.totals.dots_calendar_years.toLocaleString('en-US') + ' calendar-year + ' +
      md.totals.dots_longer_run.toLocaleString('en-US') + ' Longer run) · ' +
      first + ' – ' + last + '.';
  }

  function fail(msg) {
    detailEl.innerHTML = '<p>' + msg + ' The underlying data is still available as ' +
      '<a href="/assets/data/fed-dot-plots.json">JSON</a>.</p>';
  }

  // Controls
  var vMinInput = document.getElementById('fdp-vintage-min');
  var vMaxInput = document.getElementById('fdp-vintage-max');
  var yMinInput = document.getElementById('fdp-year-min');
  var yMaxInput = document.getElementById('fdp-year-max');
  var medianToggle = document.getElementById('fdp-show-median');
  var lrToggle = document.getElementById('fdp-show-lr');
  var resetBtn = document.getElementById('fdp-reset');

  function readControls() {
    if (vMinInput.value) vintageMin = vMinInput.value;
    if (vMaxInput.value) vintageMax = vMaxInput.value;
    if (vintageMin > vintageMax) { var t = vintageMin; vintageMin = vintageMax; vintageMax = t; }
    var a = parseInt(yMinInput.value, 10);
    var b = parseInt(yMaxInput.value, 10);
    if (!isNaN(a)) yearMin = Math.max(2012, Math.min(2029, a));
    if (!isNaN(b)) yearMax = Math.max(2012, Math.min(2029, b));
    if (yearMin > yearMax) { var u = yearMin; yearMin = yearMax; yearMax = u; }
    showMedian = medianToggle.checked;
    showLr = lrToggle.checked;
    render();
  }
  [vMinInput, vMaxInput, yMinInput, yMaxInput].forEach(function (el) {
    el.addEventListener('change', readControls);
  });
  medianToggle.addEventListener('change', readControls);
  lrToggle.addEventListener('change', readControls);
  resetBtn.addEventListener('click', function () {
    vintageMin = '2012-01-25'; vintageMax = '2026-09-16';
    yearMin = 2012; yearMax = 2029;
    showMedian = true; showLr = true;
    vMinInput.value = vintageMin; vMaxInput.value = vintageMax;
    yMinInput.value = 2012; yMaxInput.value = 2029;
    medianToggle.checked = true; lrToggle.checked = true;
    render();
  });

  // The modebar is hidden on narrow screens, so this button covers its
  // camera-reset job there (and is harmless on desktop).
  var resetViewBtn = document.getElementById('fdp-reset-view');
  resetViewBtn.addEventListener('click', function () {
    if (!window.Plotly || !plotted3d) return;
    window.Plotly.relayout(plotEl, { 'scene.camera.eye': { x: 1.6, y: -1.4, z: 1.0 } });
  });

  // Crossing the 700px breakpoint changes the layout (modebar, colourbar,
  // ticks, fonts) and the lock, so re-render then; Plotly's own
  // responsive handling covers resizes within a breakpoint.
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
    if (!data || !window.Plotly) return;
    clearTimeout(themeTimer);
    themeTimer = setTimeout(function () { render(); }, 150);
  });
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'data-vibe'] });

  function waitForPlotly(tries, done) {
    if (window.Plotly) return done(true);
    if (tries <= 0) return done(false);
    setTimeout(function () { waitForPlotly(tries - 1, done); }, 200);
  }

  fetch(url).then(function (r) {
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return r.json();
  }).then(function (json) {
    data = json;
    renderSummary();
    renderTable();
    waitForPlotly(25, function (ok) {
      if (!ok) {
        fail('Plotly.js did not load (jsDelivr CDN). The chart needs it; the table above and the JSON download still work.');
        return;
      }
      render();
    });
  }).catch(function () {
    fail('Could not load the dot-plot data.');
  });
})();
