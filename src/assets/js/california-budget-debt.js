(function () {
  var root = document.getElementById('ca-money');
  if (!root) return;
  var url = root.getAttribute('data-json');
  var svg = document.getElementById('ca-svg');
  var detail = document.getElementById('ca-detail');
  var summary = document.getElementById('ca-summary');
  var countEl = document.getElementById('ca-count');
  var table = document.getElementById('ca-table');
  var warning = document.getElementById('ca-conflict-warning');
  var notesBox = document.getElementById('ca-checked-notes');
  var data = null;
  var longView = false;

  var PROP_ORDER = ['prop-1', 'prop-38', 'prop-37', 'prop-3', 'prop-40', 'prop-2', 'prop-41', 'prop-42', 'prop-43', 'prop-44'];
  var PROP_NUM = { 'prop-1': '1', 'prop-38': '38', 'prop-37': '37', 'prop-3': '3', 'prop-40': '40', 'prop-2': '2', 'prop-41': '41', 'prop-42': '42', 'prop-43': '43', 'prop-44': '44' };

  function fmt(v, dp) {
    if (v === null || v === undefined || isNaN(v)) return '—';
    var d = dp === undefined ? 2 : dp;
    var n = Number(v);
    if (Math.abs(n) < 0.005) n = 0; // avoid "$-0.00B" from float dust
    return '$' + n.toFixed(d) + 'B';
  }
  function fmtPlain(v, dp) {
    if (v === null || v === undefined || isNaN(v)) return '—';
    var n = Number(v);
    if (Math.abs(n) < 0.005) n = 0;
    return n.toFixed(dp === undefined ? 2 : dp);
  }
  function checkedIds() {
    return PROP_ORDER.filter(function (id) {
      var el = document.getElementById('ca-prop-' + id);
      return el && el.checked;
    });
  }
  function deltaMaps() {
    var maps = {};
    (data.propositions || []).forEach(function (p) {
      var m = {};
      (p.annual_deltas || []).forEach(function (d) { m[d.fiscal_year] = d; });
      maps[p.id] = m;
    });
    return maps;
  }

  // Core scenario math, computed here in the browser from the JSON only.
  // GF revenue delta: for Prop 40 use general_fund_revenue_delta (0) — its
  // revenue_delta is Reserve Fund revenue, NEVER General Fund revenue.
  function computeRows(checked) {
    var maps = deltaMaps();
    var cumProceeds = 0, cumPrincipal = 0;
    var all = data.years.map(function (y) {
      var base = y.baseline || {};
      var gfRevDelta = 0, progDelta = 0, dsDelta = 0, reserve = null, memo37 = 0;
      checked.forEach(function (id) {
        var d = maps[id] && maps[id][y.fiscal_year];
        if (!d) return;
        if (id === 'prop-40') {
          gfRevDelta += (d.general_fund_revenue_delta || 0);
          reserve = {
            low: d.revenue_delta_low, central: d.revenue_delta, high: d.revenue_delta_high,
            spending: d.reserve_fund_spending_memo || 0,
            health: d.reserve_fund_spending_memo_health_90pct || 0,
            eduFood: d.reserve_fund_spending_memo_education_food_10pct || 0
          };
        } else {
          gfRevDelta += (d.revenue_delta || 0);
        }
        progDelta += (d.program_spending_delta || 0);
        dsDelta += (d.debt_service_delta || 0);
        memo37 += (d.revenue_bonds_issued_memo || 0);
      });
      // Bonded-debt stock: sold-only baseline stock, plus scenario GO bonds
      // sold (proceeds) minus scenario principal repaid. Prop 37 revenue
      // bonds never enter this GO series. Null baseline stays null (gap,
      // never interpolated) — notably FY2026-27, between the June 30, 2026
      // anchor and the sold-bond projection from FY2027-28.
      if (checked.indexOf('prop-1') !== -1 || checked.indexOf('prop-38') !== -1) {
        ['prop-1', 'prop-38'].forEach(function (id) {
          if (checked.indexOf(id) === -1) return;
          var d = maps[id] && maps[id][y.fiscal_year];
          if (!d) return;
          cumProceeds += (d.bond_proceeds_memo || 0);
          cumPrincipal += (d.debt_service_principal || 0);
        });
      }
      var baseBonded = y.bonded_debt ? y.bonded_debt.gf_supported_total : null;
      var scenBonded = baseBonded === null ? null : baseBonded + cumProceeds - cumPrincipal;
      var existingDS = (base.expenditure_existing_debt_service !== null && base.expenditure_existing_debt_service !== undefined)
        ? base.expenditure_existing_debt_service
        : (y.baseline_debt_service ? y.baseline_debt_service.total : null);
      var scenRev = base.revenue + gfRevDelta;
      var scenExp = base.expenditure + dsDelta + progDelta;
      return {
        fy: y.fiscal_year, kind: y.kind,
        baseRev: base.revenue, baseExp: base.expenditure, baseBal: base.balance,
        laoBal: y.baseline_lao ? y.baseline_lao.balance : null,
        gfRevDelta: gfRevDelta, progDelta: progDelta, dsDelta: dsDelta,
        scenRev: scenRev, scenExp: scenExp, scenBal: scenRev - scenExp,
        existingDS: existingDS, baseBonded: baseBonded, scenBonded: scenBonded,
        reserve: reserve, memo37: memo37
      };
    });
    var start = longView ? '2010-11' : '2015-16';
    return all.filter(function (r) { return r.fy >= start; });
  }

  function unfundedAnchors() {
    var out = [];
    var ctx = data.long_term_obligations_context;
    if (!ctx) return out;
    (ctx.unfunded_liabilities_state_share_anchors || []).forEach(function (a) {
      var yr = parseInt(a.as_of.slice(0, 4), 10);
      var fy = (yr - 1) + '-' + String(yr).slice(2);
      out.push({ fy: fy, label: a.measure, value: a.value, asOf: a.as_of });
    });
    return out;
  }

  var NS = 'http://www.w3.org/2000/svg';
  function el(name, attrs, parent) {
    var n = document.createElementNS(NS, name);
    Object.keys(attrs || {}).forEach(function (k) { n.setAttribute(k, attrs[k]); });
    if (parent) parent.appendChild(n);
    return n;
  }
  function polyline(pts, cls, parent) {
    if (pts.length < 2) return null;
    return el('polyline', { points: pts.map(function (p) { return p[0] + ',' + p[1]; }).join(' '), 'class': cls, fill: 'none' }, parent);
  }
  // Split a point list into contiguous runs, breaking at null values.
  function runs(rows, valFn) {
    var out = [], cur = [];
    rows.forEach(function (r) {
      var v = valFn(r);
      if (v === null || v === undefined) { if (cur.length) out.push(cur); cur = []; }
      else cur.push([r, v]);
    });
    if (cur.length) out.push(cur);
    return out;
  }

  function renderChart(rows, checked) {
    var W = 1000, L = 64, R = 150, plotW = W - L - R;
    var A_TOP = 34, A_BOT = 352, B_TOP = 428, B_BOT = 688, XLAB = 712;
    var A_H = A_BOT - A_TOP, B_H = B_BOT - B_TOP;
    var x = function (i) { return L + (rows.length === 1 ? plotW / 2 : i * plotW / (rows.length - 1)); };
    var maxA = 0;
    rows.forEach(function (r) {
      maxA = Math.max(maxA, r.baseRev, r.baseExp, r.scenRev, r.scenExp);
      if (r.reserve) maxA = Math.max(maxA, r.reserve.high);
    });
    var aMax = Math.ceil(maxA / 20) * 20;
    var aMin = -40;
    var yA = function (v) { return A_TOP + (aMax - v) / (aMax - aMin) * A_H; };
    var maxB = 0;
    rows.forEach(function (r) {
      if (r.baseBonded !== null) maxB = Math.max(maxB, r.baseBonded);
      if (r.scenBonded !== null) maxB = Math.max(maxB, r.scenBonded);
    });
    unfundedAnchors().forEach(function (a) { maxB = Math.max(maxB, a.value); });
    var bMax = Math.ceil(maxB / 20) * 20;
    var yB = function (v) { return B_TOP + (bMax - v) / bMax * B_H; };

    svg.innerHTML = '';
    svg.setAttribute('viewBox', '0 0 ' + W + ' 730');
    svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', 'Two-panel chart: annual General Fund flows on top, end-of-year bonded debt stocks below, sharing one fiscal-year axis to FY2057-58. Exact values are in the table below.');

    el('text', { x: L, y: 18, 'class': 'ca-panel-title' }, svg).textContent = 'Panel A — Annual flows ($B per fiscal year): General Fund revenue and expenditure';
    el('text', { x: L, y: B_TOP - 12, 'class': 'ca-panel-title' }, svg).textContent = 'Panel B — End-of-year stocks ($B): bonded debt outstanding (GO + lease-revenue)';

    // Gridlines + y labels, Panel A.
    for (var gv = aMin; gv <= aMax; gv += 50) {
      el('line', { x1: L, x2: W - R, y1: yA(gv), y2: yA(gv), 'class': 'ca-grid' }, svg);
      el('text', { x: L - 8, y: yA(gv) + 4, 'text-anchor': 'end', 'class': 'ca-axis' }, svg).textContent = gv;
    }
    el('line', { x1: L, x2: W - R, y1: yA(0), y2: yA(0), 'class': 'ca-zero' }, svg);
    for (var bv = 0; bv <= bMax; bv += 20) {
      el('line', { x1: L, x2: W - R, y1: yB(bv), y2: yB(bv), 'class': 'ca-grid' }, svg);
      el('text', { x: L - 8, y: yB(bv) + 4, 'text-anchor': 'end', 'class': 'ca-axis' }, svg).textContent = bv;
    }

    // Surplus/deficit gap shading between scenario revenue and expenditure.
    rows.forEach(function (r, i) {
      if (i === rows.length - 1) return;
      var n = rows[i + 1];
      var poly = [[x(i), yA(r.scenRev)], [x(i + 1), yA(n.scenRev)], [x(i + 1), yA(n.scenExp)], [x(i), yA(r.scenExp)]];
      var cls = (r.scenRev >= r.scenExp && n.scenRev >= n.scenExp) ? 'ca-gap-surplus'
        : (r.scenRev < r.scenExp && n.scenRev < n.scenExp) ? 'ca-gap-deficit' : 'ca-gap-mixed';
      el('polygon', { points: poly.map(function (p) { return p[0] + ',' + p[1]; }).join(' '), 'class': cls }, svg);
    });

    // Baseline revenue/expenditure: solid through last actual FY2023-24,
    // dashed + faded after (revised / enacted / proposal / illustration).
    var lastActual = -1;
    rows.forEach(function (r, i) { if (r.fy <= '2023-24') lastActual = i; });
    function baselineLine(valFn, solidCls, dashCls) {
      var pts = rows.map(function (r, i) { return [x(i), yA(valFn(r))]; });
      if (lastActual >= 0) {
        polyline(pts.slice(0, lastActual + 1), solidCls, svg);
        polyline(pts.slice(lastActual), dashCls, svg);
      } else polyline(pts, dashCls, svg);
    }
    baselineLine(function (r) { return r.baseRev; }, 'ca-line ca-base-rev', 'ca-line ca-base-rev-dash');
    baselineLine(function (r) { return r.baseExp; }, 'ca-line ca-base-exp', 'ca-line ca-base-exp-dash');

    // Scenario lines, full strength, only from the first year a scenario
    // can bite (FY2026-27) — before that scenario equals baseline.
    var scenPts = function (valFn) {
      return rows.map(function (r, i) { return [i, r, [x(i), yA(valFn(r))]]; })
        .filter(function (t) { return t[1].fy >= '2026-27'; }).map(function (t) { return t[2]; });
    };
    if (checked.length) {
      polyline(scenPts(function (r) { return r.scenRev; }), 'ca-line ca-scen-rev', svg);
      polyline(scenPts(function (r) { return r.scenExp; }), 'ca-line ca-scen-exp', svg);
    }

    // LAO balance (balance/deficit only, stops FY2029-30 — never extended).
    var laoPts = [];
    rows.forEach(function (r, i) { if (r.laoBal !== null) laoPts.push([x(i), yA(r.laoBal), r]); });
    if (laoPts.length >= 2) {
      polyline(laoPts.map(function (p) { return [p[0], p[1]]; }), 'ca-line ca-lao', svg);
      laoPts.forEach(function (p) { el('circle', { cx: p[0], cy: p[1], r: 4, 'class': 'ca-lao-dot' }, svg); });
      var last = laoPts[laoPts.length - 1];
      el('text', { x: last[0] + 8, y: last[1] - 8, 'class': 'ca-label ca-label-muted' }, svg).textContent = 'LAO balance — stops FY2029-30';
    }

    // Prop 40 Reserve Fund band + central line (same $B axis, small vs GF).
    if (checked.indexOf('prop-40') !== -1) {
      var bandRows = rows.map(function (r, i) { return [i, r]; }).filter(function (t) { return t[1].reserve; });
      if (bandRows.length >= 2) {
        var upper = bandRows.map(function (t) { return [x(t[0]), yA(t[1].reserve.high)]; });
        var lower = bandRows.map(function (t) { return [x(t[0]), yA(t[1].reserve.low)]; }).reverse();
        el('polygon', { points: upper.concat(lower).map(function (p) { return p[0] + ',' + p[1]; }).join(' '), 'class': 'ca-reserve-band' }, svg);
        polyline(bandRows.map(function (t) { return [x(t[0]), yA(t[1].reserve.central)]; }), 'ca-line ca-reserve-central', svg);
        var cLast = bandRows[bandRows.length - 1];
        el('text', { x: W - R + 6, y: yA(cLast[1].reserve.central) + 4, 'class': 'ca-label' }, svg).textContent = 'Reserve Fund revenue — NOT GF';
      }
    }

    // Last-actual vertical rule.
    if (lastActual >= 0 && lastActual < rows.length - 1) {
      var bx = (x(lastActual) + x(lastActual + 1)) / 2;
      el('line', { x1: bx, x2: bx, y1: A_TOP, y2: A_BOT, 'class': 'ca-rule' }, svg);
      el('text', { x: bx + 4, y: A_TOP + 14, 'class': 'ca-rule-label' }, svg).textContent = 'Last actual FY2023-24';
    }

    // Panel B: bonded debt (baseline faded dashed, scenario full), broken
    // at nulls — never a continuous line across an unverified year.
    runs(rows, function (r) { return r.baseBonded; }).forEach(function (run) {
      polyline(run.map(function (t, j) { return [x(rows.indexOf(t[0])), yB(t[1])]; }), 'ca-line ca-bond-base', svg);
    });
    if (checked.length) {
      runs(rows, function (r) { return r.scenBonded; }).forEach(function (run) {
        polyline(run.map(function (t) { return [x(rows.indexOf(t[0])), yB(t[1])]; }), 'ca-line ca-bond-scen', svg);
      });
    }
    // Unfunded-liability anchors: diamonds only, never connected, never
    // merged into bonded debt.
    var fyIndex = {};
    rows.forEach(function (r, i) { fyIndex[r.fy] = i; });
    unfundedAnchors().forEach(function (a) {
      if (fyIndex[a.fy] === undefined) return;
      var cx = x(fyIndex[a.fy]), cy = yB(a.value);
      el('rect', { x: cx - 6, y: cy - 6, width: 12, height: 12, transform: 'rotate(45 ' + cx + ' ' + cy + ')', 'class': 'ca-anchor' }, svg)
        .appendChild((function () { var t = document.createElementNS(NS, 'title'); t.textContent = a.label + ': ' + fmt(a.value) + ' at ' + a.asOf + ' (anchor only, not a series)'; return t; })());
    });

    // Direct labels at the right edge, Panel A.
    var lastRow = rows[rows.length - 1];
    el('text', { x: W - R + 6, y: yA(lastRow.scenRev) - 6, 'class': 'ca-label' }, svg).textContent = 'Revenue (scenario)';
    el('text', { x: W - R + 6, y: yA(lastRow.scenExp) + 14, 'class': 'ca-label' }, svg).textContent = 'Expenditure (scenario)';
    el('text', { x: W - R + 6, y: yA(lastRow.baseRev) - 20, 'class': 'ca-label ca-label-muted' }, svg).textContent = 'Revenue (DOF baseline, faded)';
    // Panel B right-edge label.
    var bLast = null;
    for (var bi = rows.length - 1; bi >= 0; bi--) { if (rows[bi].scenBonded !== null) { bLast = rows[bi]; break; } }
    if (bLast) el('text', { x: W - R + 6, y: yB(bLast.scenBonded) + 4, 'class': 'ca-label' }, svg).textContent = 'Bonded debt (scenario)';

    // X labels: every 5th year + last year.
    rows.forEach(function (r, i) {
      var yr = parseInt(r.fy.slice(0, 4), 10);
      if (i % 5 === 0 || i === rows.length - 1) {
        el('text', { x: x(i), y: XLAB, 'text-anchor': 'middle', 'class': 'ca-axis' }, svg).textContent = r.fy;
      }
    });
    el('text', { x: L, y: 728, 'class': 'ca-axis' }, svg).textContent = 'Fiscal year ending June 30 · Panel A and Panel B share this axis · Solid = actuals · Dashed/faded = baseline projection · Full strength = scenario';

    // Focusable year dots on the scenario (or baseline) revenue line.
    rows.forEach(function (r, i) {
      var dot = el('circle', { cx: x(i), cy: yA(r.scenRev), r: 7, 'class': 'ca-dot', tabindex: '0' }, svg);
      var title = document.createElementNS(NS, 'title');
      title.textContent = r.fy + ': GF revenue ' + fmt(r.scenRev) + ', expenditure ' + fmt(r.scenExp) + ', balance ' + fmt(r.scenBal);
      dot.appendChild(title);
      var show = function () { showDetail(r, checked); };
      dot.addEventListener('mouseenter', show);
      dot.addEventListener('focus', show);
      dot.addEventListener('click', show);
    });
    countEl.textContent = 'Showing ' + rows[0].fy + ' to ' + rows[rows.length - 1].fy + ' (' + rows.length + ' fiscal years). Hover, focus, or tap a point for its values; exact values are in the table.';
  }

  function showDetail(r, checked) {
    var parts = ['<strong>FY' + r.fy + '</strong> (' + r.kind + ')'];
    parts.push('DOF baseline: revenue ' + fmt(r.baseRev) + ' · expenditure ' + fmt(r.baseExp) + ' · balance ' + fmt(r.baseBal) + '.');
    if (r.laoBal !== null) parts.push('LAO outlook balance: ' + fmt(r.laoBal) + ' (balance/deficit only; not a Chart A operating balance).');
    if (checked.length) {
      parts.push('Scenario General Fund: revenue ' + fmt(r.scenRev) + ' · expenditure ' + fmt(r.scenExp) + ' · balance ' + fmt(r.scenBal) +
        ' (new GF revenue ' + fmt(r.gfRevDelta) + '; new program spending ' + fmt(r.progDelta) + '; new debt service ' + fmt(r.dsDelta) + ').');
    }
    parts.push('Existing debt service: ' + fmt(r.existingDS) + (r.existingDS === null ? ' (not verified for this year — see Gaps)' : '') + '.');
    parts.push('Bonded debt outstanding (sold-only baseline' + (checked.length ? ' + scenario GO bonds' : '') + '): ' + fmt(r.scenBonded) +
      (r.scenBonded === null ? ' (not verified for this year — no line is drawn across it)' : '') + '.');
    if (r.reserve) {
      parts.push('Reserve Fund revenue — NOT General Fund revenue: low ' + fmt(r.reserve.low) + ' · central ' + fmt(r.reserve.central) +
        ' · high ' + fmt(r.reserve.high) + '; Reserve Fund spending memo (central): ' + fmt(r.reserve.spending) +
        ' = ' + fmt(r.reserve.health) + ' health + ' + fmt(r.reserve.eduFood) + ' education/food.');
    }
    if (r.memo37) parts.push('Prop 37 revenue-bond issuance memo: ' + fmt(r.memo37) + ' (NOT GO debt, NO General Fund cost).');
    detail.innerHTML = parts.join('<br>');
  }

  function renderTable(rows, checked) {
    var showReserve = checked.indexOf('prop-40') !== -1;
    var show37 = checked.indexOf('prop-37') !== -1;
    var head = ['Fiscal year', 'DOF baseline revenue', 'DOF baseline expenditure', 'DOF baseline balance', 'LAO balance', 'Scenario GF revenue', 'Scenario GF expenditure', 'Scenario GF balance', 'Existing debt service', 'New scenario debt service', 'Bonded debt outstanding'];
    if (showReserve) head.push('Reserve Fund revenue: low', 'Reserve Fund revenue: central', 'Reserve Fund revenue: high', 'Reserve Fund spending memo (central)');
    if (show37) head.push('Prop 37 revenue-bond issuance (memo)');
    var thead = '<tr>' + head.map(function (h) { return '<th>' + h + '</th>'; }).join('') + '</tr>';
    var body = rows.map(function (r) {
      var cells = [r.fy, fmtPlain(r.baseRev), fmtPlain(r.baseExp), fmtPlain(r.baseBal), fmtPlain(r.laoBal), fmtPlain(r.scenRev), fmtPlain(r.scenExp), fmtPlain(r.scenBal), fmtPlain(r.existingDS), fmtPlain(r.dsDelta), fmtPlain(r.scenBonded)];
      if (showReserve) cells.push(fmtPlain(r.reserve ? r.reserve.low : null), fmtPlain(r.reserve ? r.reserve.central : null), fmtPlain(r.reserve ? r.reserve.high : null), fmtPlain(r.reserve ? r.reserve.spending : null));
      if (show37) cells.push(fmtPlain(r.memo37 || null));
      return '<tr><th scope="row">' + cells[0] + '</th>' + cells.slice(1).map(function (c) { return '<td style="text-align: right;">' + c + '</td>'; }).join('') + '</tr>';
    }).join('');
    table.innerHTML = '<thead>' + thead + '</thead><tbody>' + body + '</tbody>';
  }

  function renderSummary(rows, checked) {
    var row = null;
    rows.forEach(function (r) { if (r.fy === '2031-32') row = r; });
    if (!row) { summary.textContent = 'No FY2031-32 row in the current view.'; return; }
    if (!checked.length) {
      summary.innerHTML = 'With no propositions checked, the chart shows the DOF-based baseline alone: the General Fund balance in FY2031–32 is ' + fmt(row.baseBal) + ' on that illustration (not a forecast), with revenue ' + fmt(row.baseRev) + ' and expenditure ' + fmt(row.baseExp) + '.';
      return;
    }
    var names = checked.map(function (id) { return 'Prop ' + PROP_NUM[id]; }).join(', ');
    var s = 'With ' + names + ' checked, the scenario General Fund balance in FY2031–32 is ' + fmt(row.scenBal) + ', versus ' + fmt(row.baseBal) + ' on the DOF-based baseline — a change of ' + fmt(row.scenBal - row.baseBal) + ' in that year, from ' + fmt(row.dsDelta) + ' of new debt service, ' + fmt(row.progDelta) + ' of new program spending, and ' + fmt(row.gfRevDelta) + ' of new General Fund revenue.';
    if (checked.indexOf('prop-40') !== -1) {
      s += ' Separately, Prop 40 Reserve Fund revenue is $13.0B central ($6.0B low – $20.0B high) in each instalment year FY2026–27–FY2030–31; it is not General Fund revenue and does not change the General Fund balance above.';
    }
    if (checked.indexOf('prop-40') !== -1 && (checked.indexOf('prop-41') !== -1 || checked.indexOf('prop-42') !== -1)) {
      s += ' Warning: Prop 40 is checked together with Prop 41 or Prop 42, which LAO says could block Prop 40 even with a majority — see the warning above the chart.';
    }
    summary.innerHTML = s;
  }

  function renderNotes(checked) {
    var byId = {};
    (data.propositions || []).forEach(function (p) { byId[p.id] = p; });
    var unmodelled = checked.filter(function (id) { return byId[id] && !byId[id].modelled; });
    if (!unmodelled.length) { notesBox.innerHTML = ''; return; }
    notesBox.innerHTML = '<p><strong>Noted, not modelled — checked but adding $0 to every number above:</strong></p><ul>' +
      unmodelled.map(function (id) {
        return '<li><strong>Prop ' + PROP_NUM[id] + ' — ' + byId[id].short_title + ':</strong> ' + (byId[id].lao_reason_not_modelled || '') + '</li>';
      }).join('') + '</ul>';
  }

  function render() {
    var checked = checkedIds();
    var conflict = checked.indexOf('prop-40') !== -1 && (checked.indexOf('prop-41') !== -1 || checked.indexOf('prop-42') !== -1);
    warning.style.display = conflict ? 'block' : 'none';
    var rows = computeRows(checked);
    renderChart(rows, checked);
    renderTable(rows, checked);
    renderSummary(rows, checked);
    renderNotes(checked);
    var anchor = rows.find(function (r) { return r.fy === '2031-32'; }) || rows[0];
    if (anchor) showDetail(anchor, checked);
  }

  document.querySelectorAll('#ca-money input[type="checkbox"][data-prop]').forEach(function (cb) {
    cb.addEventListener('change', render);
  });
  var longCb = document.getElementById('ca-long-view');
  if (longCb) longCb.addEventListener('change', function () { longView = longCb.checked; render(); });
  var reset = document.getElementById('ca-reset');
  if (reset) reset.addEventListener('click', function () {
    document.querySelectorAll('#ca-money input[type="checkbox"][data-prop]').forEach(function (cb) { cb.checked = false; });
    if (longCb) { longCb.checked = false; longView = false; }
    render();
  });

  fetch(url).then(function (r) { return r.json(); }).then(function (json) {
    data = json;
    render();
  }).catch(function () {
    countEl.textContent = 'Could not load the California budget data. The underlying JSON is still available to download below.';
  });
})();
