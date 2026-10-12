/* FamilyTreeMe — an explorable family tree: three generations, one family at a time.
 * Privacy rule: kinship titles ONLY (e.g. 叔叔, 嫲嫲, 外婆). No real names anywhere.
 * Person-node DAG rendered with D3 v7 (CDN). Pure logic below is DOM-free so it
 * can be unit-tested in Node (see the module.exports guard at the end). */
(function () {
  "use strict";

  /* ---------- Family data ---------- */
  /* me.parents = ["dad","mom"]: the view starts from "myself, my parents, and my
   * younger brother", so band 1 for focus=me must be [爸爸, 媽媽]. */
  var PEOPLE = {
    me:      { t: "我", parents: ["dad", "mom"] },
    mom:     { t: "媽媽", parents: ["gmaM", "gpaM"] },
    dad:     { t: "爸爸", parents: ["gmaD", "gpaD"] },
    brother: { t: "弟弟", parents: ["mom", "dad"] },
    niece:   { t: "弟弟的女兒", parents: ["brother"] },
    gmaD: { t: "嫲嫲" },
    gpaD: { t: "爺爺" },
    gmaM: { t: "外婆" },
    gpaM: { t: "公公" },
    aunt:    { t: "姑姑", parents: ["gmaD", "gpaD"] },
    uncle:   { t: "叔叔", parents: ["gmaD", "gpaD"] },
    cousinA: { t: "姑姑的女兒", parents: ["aunt"] },
    cousinU: { t: "叔叔的女兒", parents: ["uncle"] },
    uncleB:  { t: "大舅", parents: ["gmaM", "gpaM"] },
    uncleL:  { t: "小舅舅", parents: ["gmaM", "gpaM"] },
    auntM:   { t: "阿姨", parents: ["gmaM", "gpaM"] }
  };

  var SELF = "me";
  var START = "me";

  /* Card geometry */
  var PW = 150, PH = 56;   /* person card */
  var UW = 120, UH = 48;   /* up card (grandparents) */
  var PAIR_GAP = 16, GROUP_GAP = 64, DY = 170;
  var BADGE_R = 22;        /* ~44px touch target */

  /* ---------- Pure logic (no DOM) ---------- */

  function parentsOf(p) { return (PEOPLE[p].parents || []).slice(); }

  function childrenOf(p) {
    var out = [];
    Object.keys(PEOPLE).forEach(function (q) {
      if (parentsOf(q).indexOf(p) !== -1) out.push(q);
    });
    return out;
  }

  function siblingsOf(p) {
    var mine = parentsOf(p), out = [], seen = {};
    if (!mine.length) return out;
    Object.keys(PEOPLE).forEach(function (q) {
      if (q === p || seen[q]) return;
      var share = parentsOf(q).some(function (x) { return mine.indexOf(x) !== -1; });
      if (share) { seen[q] = true; out.push(q); }
    });
    return out;
  }

  /* The co-parent: q such that some child lists both p and q as parents. */
  function spouseOf(p) {
    var kids = childrenOf(p);
    for (var i = 0; i < kids.length; i++) {
      var ps = parentsOf(kids[i]);
      for (var j = 0; j < ps.length; j++) {
        if (ps[j] !== p) return ps[j];
      }
    }
    return undefined;
  }

  function descendants(p) {
    var out = [], seen = {};
    (function walk(q) {
      childrenOf(q).forEach(function (c) {
        if (!seen[c]) { seen[c] = true; out.push(c); walk(c); }
      });
    })(p);
    return out;
  }

  function pairW(n, w) { return n <= 0 ? 0 : n * w + (n - 1) * PAIR_GAP; }

  /* View model for a focus person:
   *   b1     — focus person's parents, individual cards
   *   groups — band 2: focus group [F, spouse?] then one single-card group per sibling
   *   ups    — grandparents: each band-1 card's parents, centered over that card */
  function buildView(focus, expanded) {
    var b1 = parentsOf(focus);
    var spouse = spouseOf(focus);
    var sibs = siblingsOf(focus).filter(function (s) { return s !== spouse; });
    var groups = [];
    var fg = [focus];
    if (spouse && spouse !== focus) fg.push(spouse);
    groups.push({ persons: fg, anchor: focus, isFocus: true });
    sibs.forEach(function (s) { groups.push({ persons: [s], anchor: s, isFocus: false }); });
    groups.forEach(function (g) {
      var kids = [], seen = {};
      g.persons.forEach(function (p) {
        childrenOf(p).forEach(function (c) {
          if (!seen[c]) { seen[c] = true; kids.push(c); }
        });
      });
      g.children = kids;
      var desc = {};
      g.persons.forEach(function (p) {
        descendants(p).forEach(function (d) { desc[d] = true; });
      });
      g.hidden = Object.keys(desc).length;
      g.open = !!expanded[g.anchor] && kids.length > 0;
    });
    var ups = [];
    b1.forEach(function (q) {
      parentsOf(q).forEach(function (u) { ups.push({ id: u, child: q }); });
    });
    return { focus: focus, b1: b1, groups: groups, ups: ups };
  }

  /* Custom DAG layout (not d3.tree — parentage is per-person, not per-couple).
   * Bottom-up group widths; band-1 slots widen to fit their up-cards so the
   * grandparent pairs never collide. Empty bands are skipped (y compacts). */
  function layout(view) {
    var nodes = [], links = [];
    var yUp = -1, yB1 = -1, yB2, yB3 = -1, yi = 0;
    if (view.ups.length) yUp = (yi++) * DY;
    if (view.b1.length) yB1 = (yi++) * DY;
    yB2 = (yi++) * DY;
    var anyOpen = view.groups.some(function (g) { return g.open && g.children.length; });
    if (anyOpen) yB3 = (yi++) * DY;

    function mkLink(sx, sy, tx, ty, up, key) {
      return { sx: sx, sy: sy, tx: tx, ty: ty, up: up, key: key };
    }

    /* Band 2 (+ band 3 beneath open groups) */
    var gws = view.groups.map(function (g) {
      var pw = pairW(g.persons.length, PW);
      var cw = (g.open && g.children.length) ? pairW(g.children.length, PW) : 0;
      return Math.max(pw, cw);
    });
    var total2 = gws.reduce(function (a, b) { return a + b; }, 0) + GROUP_GAP * (gws.length - 1);
    var x = -total2 / 2;
    var b1x = {}, b2x = {}, b3x = {};
    view.groups.forEach(function (g, gi) {
      g.cx = x + gws[gi] / 2;
      var pw = pairW(g.persons.length, PW);
      g.persons.forEach(function (p, j) {
        var px = g.cx - pw / 2 + PW / 2 + j * (PW + PAIR_GAP);
        b2x[p] = px;
        nodes.push({ kind: "b2", id: p, label: PEOPLE[p].t, x: px, y: yB2, w: PW, h: PH,
                     self: p === SELF, gi: gi });
      });
      if (g.open && g.children.length) {
        var cw = pairW(g.children.length, PW);
        g.children.forEach(function (c, j) {
          var cx = g.cx - cw / 2 + PW / 2 + j * (PW + PAIR_GAP);
          b3x[c] = cx;
          nodes.push({ kind: "b3", id: c, label: PEOPLE[c].t, x: cx, y: yB3, w: PW, h: PH,
                       self: c === SELF, hasKids: childrenOf(c).length > 0,
                       spawnX: g.cx, spawnY: yB2 });
        });
        g.persons.forEach(function (p) {
          g.children.forEach(function (c) {
            links.push(mkLink(b2x[p], yB2 + PH / 2, b3x[c], yB3 - PH / 2, false,
                              "b2:" + p + "->b3:" + c));
          });
        });
      }
      x += gws[gi] + GROUP_GAP;
    });

    /* Band 1 (up-aware slots) + up band */
    if (view.b1.length) {
      var slots = view.b1.map(function (q) {
        return Math.max(PW, pairW(parentsOf(q).length, UW));
      });
      var total1 = slots.reduce(function (a, b) { return a + b; }, 0) + GROUP_GAP * (slots.length - 1);
      var x1 = -total1 / 2;
      view.b1.forEach(function (q, i) {
        var qx = x1 + slots[i] / 2;
        b1x[q] = qx;
        nodes.push({ kind: "b1", id: q, label: PEOPLE[q].t, x: qx, y: yB1, w: PW, h: PH, self: q === SELF });
        x1 += slots[i] + GROUP_GAP;
      });
      if (yUp >= 0) {
        view.ups.forEach(function (u) {
          var qx = b1x[u.child];
          var sib = view.ups.filter(function (v) { return v.child === u.child; });
          var idx = sib.indexOf(u);
          var ux = qx - pairW(sib.length, UW) / 2 + UW / 2 + idx * (UW + PAIR_GAP);
          nodes.push({ kind: "up", id: u.id, label: PEOPLE[u.id].t, x: ux, y: yUp, w: UW, h: UH, self: false });
          links.push(mkLink(ux, yUp + UH / 2, qx, yB1 - PH / 2, true, "up:" + u.id + "->b1:" + u.child));
        });
      }
      /* Band 1 -> band 2 links follow actual parentage: only parents of r
       * that are present in band 1 get a link. (E.g. 媽媽 has no incoming
       * link in 爸爸's view — her parents are 外婆/公公, shown in her view.) */
      var b1set = {};
      view.b1.forEach(function (q) { b1set[q] = true; });
      view.groups.forEach(function (g) {
        g.persons.forEach(function (r) {
          parentsOf(r).forEach(function (q) {
            if (b1set[q]) {
              links.push(mkLink(b1x[q], yB1 + PH / 2, b2x[r], yB2 - PH / 2, false,
                                "b1:" + q + "->b2:" + r));
            }
          });
        });
      });
    }

    /* Group badges (+N expand / − collapse) */
    var badges = view.groups
      .filter(function (g) { return g.hidden > 0; })
      .map(function (g) {
        var pw = pairW(g.persons.length, PW);
        return {
          anchor: g.anchor, open: g.open, hidden: g.hidden,
          label: PEOPLE[g.anchor].t,
          x: g.cx + pw / 2 - 14, y: yB2 + PH / 2 - 12
        };
      });

    return { nodes: nodes, links: links, badges: badges, view: view,
             bands: { up: yUp, b1: yB1, b2: yB2, b3: yB3 } };
  }

  /* Export pure logic for Node unit tests (harmless in the browser). */
  if (typeof module !== "undefined" && module.exports) {
    module.exports = {
      PEOPLE: PEOPLE, SELF: SELF, START: START,
      PW: PW, PH: PH, UW: UW, UH: UH, PAIR_GAP: PAIR_GAP, GROUP_GAP: GROUP_GAP, DY: DY,
      parentsOf: parentsOf, childrenOf: childrenOf, siblingsOf: siblingsOf,
      spouseOf: spouseOf, descendants: descendants,
      buildView: buildView, layout: layout
    };
    return;
  }

  /* ---------- D3 rendering (browser only) ---------- */
  var mount = document.getElementById("family-tree");
  var heading = document.getElementById("ft-heading");
  var live = document.getElementById("ft-live");
  var resetBtn = document.getElementById("ft-reset");
  if (!mount || !heading) return;

  if (!window.d3) {
    mount.innerHTML = "<p class=\"ft-fallback\">The graphics library couldn\u2019t load \u2014 check your connection and reload.</p>";
    return;
  }
  var d3 = window.d3;

  var REDUCED = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var DUR = REDUCED ? 0 : 450;

  var state = { focus: START, expanded: {} };

  var svg = d3.select(mount).append("svg")
    .attr("class", "ft-svg")
    .attr("role", "group")
    .attr("aria-label", "FamilyTreeMe interactive family tree");
  svg.append("title").text("FamilyTreeMe");
  var viewport = svg.append("g").attr("class", "ft-viewport");
  var linkLayer = viewport.append("g").attr("class", "ft-links");
  var nodeLayer = viewport.append("g").attr("class", "ft-nodes");
  var badgeLayer = viewport.append("g").attr("class", "ft-badges");

  var zoom = d3.zoom()
    .scaleExtent([0.5, 2.5])
    .on("zoom", function (e) { viewport.attr("transform", e.transform); });
  svg.call(zoom);

  /* Suppress click-through after a pan/drag: record pointerdown, ignore
   * clicks that moved more than a few pixels. */
  var downPos = null;
  svg.on("pointerdown", function (e) { downPos = [e.clientX, e.clientY]; });
  function dragged(e) {
    return !!downPos && Math.hypot(e.clientX - downPos[0], e.clientY - downPos[1]) > 6;
  }

  var linkGen = d3.linkVertical()
    .x(function (d) { return d.x; })
    .y(function (d) { return d.y; });
  function linkPath(l) {
    return linkGen({ source: { x: l.sx, y: l.sy }, target: { x: l.tx, y: l.ty } });
  }

  function activateKey(e, fn) {
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); fn(); }
  }

  /* ---------- Navigation ---------- */

  function announce(msg) {
    if (!live) return;
    live.textContent = "";
    /* Re-setting in a rAF forces screen readers to re-announce identical text. */
    requestAnimationFrame(function () { live.textContent = msg; });
  }

  function focusHeading() {
    heading.focus({ preventScroll: false });
  }

  function afterNav() {
    heading.textContent = "「" + PEOPLE[state.focus].t + "」";
    render({ mode: "refocus" });
    announce("Now showing 「" + PEOPLE[state.focus].t + "」");
    focusHeading();
  }

  function gotoPerson(p) {
    if (p === state.focus) return;
    var next = {};
    Object.keys(state.expanded).forEach(function (k) { if (state.expanded[k]) next[k] = true; });
    next[p] = true; /* auto-expand the focus group's children */
    state.expanded = next;
    state.focus = p;
    afterNav();
  }

  function toggleGroup(anchor) {
    if (state.expanded[anchor]) delete state.expanded[anchor];
    else state.expanded[anchor] = true;
    render({ mode: "toggle" });
    /* Re-rendering rebuilds the badge, so restore focus to it. */
    var b = badgeLayer.select('g[data-badge="' + anchor + '"]').node();
    if (b) b.focus({ preventScroll: true });
  }

  function reset() {
    state.focus = START;
    state.expanded = {};
    afterNav();
  }

  /* ---------- Node + badge drawing ---------- */

  function drawNode(g, d) {
    g.selectAll("*").remove();
    var card = g.append("g")
      .attr("class", "ft-cardg ft-focusable")
      .attr("tabindex", "0").attr("role", "button")
      .attr("aria-label", "前往「" + d.label + "」");
    card.on("click", function (e) { if (!dragged(e)) gotoPerson(d.id); });
    card.on("keydown", function (e) { activateKey(e, function () { gotoPerson(d.id); }); });
    card.append("rect")
      .attr("class", "ft-card" + (d.kind === "up" ? " ft-card--up" : ""))
      .attr("x", -d.w / 2).attr("y", -d.h / 2)
      .attr("width", d.w).attr("height", d.h).attr("rx", 12);
    card.append("text")
      .attr("class", "ft-label" + (d.kind === "up" ? " ft-label--up" : ""))
      .text(d.label);
    if (d.self) {
      var pill = g.append("g")
        .attr("class", "ft-pill")
        .attr("transform", "translate(0," + (-(d.h / 2) - 18) + ")");
      pill.append("rect")
        .attr("x", -30).attr("y", -12).attr("width", 60).attr("height", 24).attr("rx", 12);
      pill.append("text").text("起點");
    }
    /* Band-3 person with children of their own: decorative → indicator
     * (the card itself navigates; never a 4th band inline). */
    if (d.kind === "b3" && d.hasKids) {
      var go = g.append("g").attr("class", "ft-goto")
        .attr("transform", "translate(" + (d.w / 2 - 16) + "," + (d.h / 2 - 14) + ")");
      go.append("circle").attr("r", 13);
      go.append("text").text("→");
    }
  }

  function drawBadge(g, b) {
    g.selectAll("*").remove();
    g.attr("tabindex", "0").attr("role", "button")
      .attr("data-badge", b.anchor)
      .attr("aria-expanded", String(b.open))
      .attr("aria-label", b.open ? "收起「" + b.label + "」的子女"
                                 : "展開「" + b.label + "」的子女（" + b.hidden + " 人）");
    g.append("circle").attr("r", BADGE_R);
    g.append("text").text(b.open ? "−" : "+" + b.hidden);
    g.on("click", function (e) { if (!dragged(e)) toggleGroup(b.anchor); });
    g.on("keydown", function (e) { activateKey(e, function () { toggleGroup(b.anchor); }); });
  }

  /* ---------- Render ---------- */

  var lastLayout = { nodes: [] };

  function contentBounds() {
    var xs = [], ys = [];
    lastLayout.nodes.forEach(function (n) {
      xs.push(n.x - n.w / 2 - 48, n.x + n.w / 2 + 48);
      ys.push(n.y - n.h / 2 - 56, n.y + n.h / 2 + 64);
    });
    if (!xs.length) return { cx: 0, cy: 0, w: 1, h: 1 };
    var minX = Math.min.apply(null, xs), maxX = Math.max.apply(null, xs);
    var minY = Math.min.apply(null, ys), maxY = Math.max.apply(null, ys);
    return { cx: (minX + maxX) / 2, cy: (minY + maxY) / 2, w: maxX - minX, h: maxY - minY };
  }

  function centerTree(animate) {
    var w = mount.clientWidth || 800;
    var h = mount.clientHeight || 520;
    var b = contentBounds();
    var scale = Math.min(1, (w - 32) / b.w, (h - 32) / b.h);
    scale = Math.max(0.5, Math.min(2.5, scale));
    var t = d3.zoomIdentity
      .translate(w / 2 - scale * b.cx, h / 2 - scale * b.cy)
      .scale(scale);
    if (animate && !REDUCED) svg.transition().duration(DUR).call(zoom.transform, t);
    else svg.call(zoom.transform, t);
  }

  function render(opts) {
    var mode = (opts && opts.mode) || "toggle";
    var L = layout(buildView(state.focus, state.expanded));
    lastLayout = L;

    function spawnPos(d) {
      if (mode === "refocus") return [d.x, d.y];
      if (d.kind === "b3") return [d.spawnX, d.spawnY];
      return [d.x, d.y];
    }

    /* Links */
    var linkSel = linkLayer.selectAll("path.ft-link").data(L.links, function (d) { return d.key; });
    linkSel.enter().append("path")
      .attr("class", function (d) { return "ft-link" + (d.up ? " ft-link--up" : ""); })
      .attr("d", function (d) {
        return linkGen({ source: { x: d.sx, y: d.sy }, target: { x: d.sx, y: d.sy } });
      })
      .style("opacity", 0)
      .merge(linkSel)
      .transition().duration(DUR).ease(d3.easeCubicOut)
      .attr("d", linkPath)
      .style("opacity", 1);
    linkSel.exit().transition().duration(DUR).style("opacity", 0).remove();

    /* Nodes */
    var nodeSel = nodeLayer.selectAll("g.ft-node").data(L.nodes, function (d) { return d.kind + ":" + d.id; });
    var nodeEnter = nodeSel.enter().append("g")
      .attr("class", function (d) { return "ft-node" + (d.self ? " ft-node--self" : ""); })
      .attr("transform", function (d) { var p = spawnPos(d); return "translate(" + p[0] + "," + p[1] + ")"; })
      .style("opacity", 0);
    nodeEnter.each(function (d) { drawNode(d3.select(this), d); });
    nodeSel.each(function (d) { drawNode(d3.select(this), d); });
    nodeEnter.merge(nodeSel)
      .transition().duration(DUR).ease(d3.easeCubicOut)
      .attr("transform", function (d) { return "translate(" + d.x + "," + d.y + ")"; })
      .style("opacity", 1);
    nodeSel.exit()
      .transition().duration(DUR)
      .attr("transform", function (d) { var p = spawnPos(d); return "translate(" + p[0] + "," + p[1] + ")"; })
      .style("opacity", 0)
      .remove();

    /* Group badges (+N / −) */
    var badgeSel = badgeLayer.selectAll("g.ft-badge").data(L.badges, function (d) { return d.anchor; });
    var badgeEnter = badgeSel.enter().append("g")
      .attr("class", "ft-badge ft-focusable")
      .attr("transform", function (d) { return "translate(" + d.x + "," + d.y + ")"; })
      .style("opacity", 0);
    badgeEnter.each(function (d) { drawBadge(d3.select(this), d); });
    badgeSel.each(function (d) { drawBadge(d3.select(this), d); });
    badgeEnter.merge(badgeSel)
      .transition().duration(DUR)
      .attr("transform", function (d) { return "translate(" + d.x + "," + d.y + ")"; })
      .style("opacity", 1);
    badgeSel.exit().transition().duration(DUR).style("opacity", 0).remove();

    centerTree(true);
  }

  /* Re-center (keeping the user's zoom level) on window resize. */
  var rzT = null;
  window.addEventListener("resize", function () {
    if (rzT) clearTimeout(rzT);
    rzT = setTimeout(function () {
      var w = mount.clientWidth || 800;
      var h = mount.clientHeight || 520;
      var b = contentBounds();
      var k = d3.zoomTransform(svg.node()).k;
      svg.call(zoom.transform,
        d3.zoomIdentity.translate(w / 2 - k * b.cx, h / 2 - k * b.cy).scale(k));
    }, 150);
  });

  if (resetBtn) resetBtn.addEventListener("click", reset);

  render({ mode: "refocus" });
})();
