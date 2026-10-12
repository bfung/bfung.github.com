/* FamilyTreeMe — an explorable family tree: three generations, one family at a time.
 * Privacy rule: kinship titles ONLY (e.g. 叔叔, 嫲嫲). No real names anywhere.
 * D3 v7 (CDN) renders an SVG node-link tree; pure logic below is DOM-free so it
 * can be unit-tested in Node (see the module.exports guard at the end). */
(function () {
  "use strict";

  /* ---------- Family data ---------- */
  var PEOPLE = {
    me: "我",
    mom: "媽媽",
    dad: "爸爸",
    brother: "弟弟",
    niece: "弟弟的女兒",
    grandma: "嫲嫲",
    grandpa: "爺爺",
    aunt: "姑姑",
    cousinA: "姑姑的女兒",
    uncle: "叔叔",
    cousinU: "叔叔的女兒"
  };

  var FAMILIES = {
    parents:      { label: "「媽媽 · 爸爸」一家", parents: ["mom", "dad"],         children: ["me", "brother"] },
    grandparents: { label: "「嫲嫲 · 爺爺」一家", parents: ["grandma", "grandpa"], children: ["dad", "aunt", "uncle"] },
    brotherfam:   { label: "「弟弟」一家",         parents: ["brother"],             children: ["niece"] },
    auntfam:      { label: "「姑姑」一家",         parents: ["aunt"],                children: ["cousinA"] },
    unclefam:     { label: "「叔叔」一家",         parents: ["uncle"],               children: ["cousinU"] }
  };

  /* The family each person was a child in (null = top of the known tree). */
  var ORIGIN = {
    me: "parents", brother: "parents",
    dad: "grandparents", aunt: "grandparents", uncle: "grandparents",
    niece: "brotherfam", cousinA: "auntfam", cousinU: "unclefam",
    mom: null, grandma: null, grandpa: null
  };

  var SELF = "me";
  var START_FAMILY = "parents";
  var MAX_DEPTH = 2; /* generations below the root family node */

  /* familyId a person parents (each person parents at most one family here) */
  var CHILD_FAMILY = {};
  Object.keys(FAMILIES).forEach(function (fid) {
    FAMILIES[fid].parents.forEach(function (p) { CHILD_FAMILY[p] = fid; });
  });

  /* ---------- Pure logic (no DOM) ---------- */

  /* Total people hidden when family famId is collapsed: its children plus
   * every descendant subtree. */
  function countHidden(famId) {
    var n = FAMILIES[famId].children.length;
    FAMILIES[famId].children.forEach(function (pid) {
      var cf = CHILD_FAMILY[pid];
      if (cf) n += countHidden(cf);
    });
    return n;
  }

  /* Couple label shown on a family card, e.g. "媽媽 · 爸爸" or "弟弟". */
  function familyLabel(famId) {
    return FAMILIES[famId].parents.map(function (p) { return PEOPLE[p]; }).join(" · ");
  }

  /* Plain node tree for the focus family. Family nodes are collapsible and
   * keyed by familyId; nodes at MAX_DEPTH are terminal (navigate, never
   * expand inline) so at most 3 generations render. */
  function buildTree(focusId, expanded) {
    function kids(famId, depth) {
      return FAMILIES[famId].children.map(function (pid) {
        var cf = CHILD_FAMILY[pid];
        if (cf) {
          var isOpen = !!expanded[cf] && depth < MAX_DEPTH;
          return {
            kind: "family", id: cf, via: pid, depth: depth,
            label: familyLabel(cf),
            collapsed: !isOpen,
            terminal: depth >= MAX_DEPTH,
            hidden: countHidden(cf),
            self: false,
            children: isOpen ? kids(cf, depth + 1) : []
          };
        }
        return {
          kind: "person", id: pid, depth: depth, label: PEOPLE[pid],
          self: pid === SELF, children: []
        };
      });
    }
    return {
      kind: "family", id: focusId, depth: 0, label: familyLabel(focusId),
      collapsed: false, terminal: false, hidden: 0, self: false,
      children: kids(focusId, 1)
    };
  }

  /* Origin families rendered as dashed up-nodes above the focus family. */
  function upFamilies(focusId) {
    var seen = {};
    var out = [];
    FAMILIES[focusId].parents.forEach(function (p) {
      var o = ORIGIN[p];
      if (o && !seen[o]) {
        seen[o] = true;
        out.push({ familyId: o, via: p });
      }
    });
    return out;
  }

  /* Next expanded-map after navigating to focusId via person viaPid:
   * keep existing expansions, auto-expand viaPid's family when they appear
   * as a child in the new view. */
  function gotoState(focusId, viaPid, expanded) {
    var next = {};
    if (expanded) {
      Object.keys(expanded).forEach(function (k) { if (expanded[k]) next[k] = true; });
    }
    if (viaPid) {
      var cf = CHILD_FAMILY[viaPid];
      if (cf && cf !== focusId && FAMILIES[focusId].children.indexOf(viaPid) !== -1) {
        next[cf] = true;
      }
    }
    return next;
  }

  /* Export pure logic for Node unit tests (harmless in the browser). */
  if (typeof module !== "undefined" && module.exports) {
    module.exports = {
      PEOPLE: PEOPLE, FAMILIES: FAMILIES, ORIGIN: ORIGIN,
      CHILD_FAMILY: CHILD_FAMILY, SELF: SELF, START_FAMILY: START_FAMILY,
      MAX_DEPTH: MAX_DEPTH,
      countHidden: countHidden, familyLabel: familyLabel,
      buildTree: buildTree, upFamilies: upFamilies, gotoState: gotoState
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

  /* Card geometry */
  var FW = 208, FH = 66;   /* family card */
  var LW = 156, LH = 54;   /* person leaf */
  var UW = 184, UH = 60;   /* up-node card */
  var DX = 248, DY = 178;  /* d3.tree nodeSize: horizontal gap, level height */
  var BADGE_R = 22;        /* ~44px touch target */

  var state = { focus: START_FAMILY, expanded: {} };

  var svg = d3.select(mount).append("svg")
    .attr("class", "ft-svg")
    .attr("role", "group")
    .attr("aria-label", "FamilyTreeMe interactive family tree");
  svg.append("title").text("FamilyTreeMe");
  var viewport = svg.append("g").attr("class", "ft-viewport");
  var linkLayer = viewport.append("g").attr("class", "ft-links");
  var upLayer = viewport.append("g").attr("class", "ft-upnodes");
  var nodeLayer = viewport.append("g").attr("class", "ft-nodes");

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

  function nodeSize(d) {
    if (d.kind === "up") return { w: UW, h: UH };
    return d.kind === "family" ? { w: FW, h: FH } : { w: LW, h: LH };
  }

  var linkGen = d3.linkVertical().x(function (p) { return p.x; }).y(function (p) { return p.y; });
  function linkPath(d) {
    var ps = nodeSize(d.parent.data);
    var cs = nodeSize(d.data);
    return linkGen({
      source: { x: d.parent.x, y: d.parent.y + ps.h / 2 },
      target: { x: d.x, y: d.y - cs.h / 2 }
    });
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

  function gotoFamily(famId, viaPid) {
    if (famId === state.focus && !viaPid) return;
    state.focus = famId;
    state.expanded = gotoState(famId, viaPid, state.expanded);
    heading.textContent = FAMILIES[famId].label;
    render({ mode: "refocus" });
    announce("Now showing " + FAMILIES[famId].label);
    focusHeading();
  }

  function toggleFamily(famId) {
    if (state.expanded[famId]) delete state.expanded[famId];
    else state.expanded[famId] = true;
    render({ mode: "toggle" });
    /* Re-rendering rebuilds the badge, so restore focus to it. */
    var b = nodeLayer.select('g[data-badge="' + famId + '"]').node();
    if (b) b.focus({ preventScroll: true });
  }

  function reset() {
    state.focus = START_FAMILY;
    state.expanded = {};
    heading.textContent = FAMILIES[START_FAMILY].label;
    render({ mode: "refocus" });
    announce("Now showing " + FAMILIES[START_FAMILY].label);
    focusHeading();
  }

  /* ---------- Node drawing ---------- */

  function drawNode(g, d) {
    var data = d.data;
    g.selectAll("*").remove();

    if (data.kind === "person") {
      g.append("rect")
        .attr("class", "ft-card ft-card--person")
        .attr("x", -LW / 2).attr("y", -LH / 2)
        .attr("width", LW).attr("height", LH).attr("rx", 12);
      g.append("text").attr("class", "ft-label ft-label--leaf").text(data.label);
      if (data.self) {
        var pill = g.append("g")
          .attr("class", "ft-pill")
          .attr("transform", "translate(0," + (-(LH / 2) - 18) + ")");
        pill.append("rect")
          .attr("x", -30).attr("y", -12).attr("width", 60).attr("height", 24).attr("rx", 12);
        pill.append("text").text("起點");
      }
      return;
    }

    /* Family node: card navigates, badge expands/collapses. */
    var cardg = g.append("g")
      .attr("class", "ft-cardg ft-focusable")
      .attr("tabindex", "0").attr("role", "button")
      .attr("aria-label", "前往" + FAMILIES[data.id].label);
    cardg.on("click", function (e) { if (!dragged(e)) gotoFamily(data.id); });
    cardg.on("keydown", function (e) { activateKey(e, function () { gotoFamily(data.id); }); });
    cardg.append("rect")
      .attr("class", "ft-card ft-card--family")
      .attr("x", -FW / 2).attr("y", -FH / 2)
      .attr("width", FW).attr("height", FH).attr("rx", 14);
    cardg.append("text").attr("class", "ft-label").text(data.label);

    /* +N badge (bottom-right corner, clear of the child link). */
    if (data.hidden > 0) {
      var isOpen = !data.collapsed;
      var badge = g.append("g")
        .attr("class", "ft-badge ft-focusable")
        .attr("tabindex", "0").attr("role", "button")
        .attr("data-badge", data.id)
        .attr("transform", "translate(" + (FW / 2 - 10) + "," + (FH / 2 - 6) + ")");
      if (!data.terminal) badge.attr("aria-expanded", String(isOpen));
      badge.attr("aria-label", data.terminal
        ? "前往" + FAMILIES[data.id].label
        : (isOpen ? "收起" + FAMILIES[data.id].label
                  : "展開" + FAMILIES[data.id].label + "（" + data.hidden + " 人）"));
      badge.append("circle").attr("r", BADGE_R);
      badge.append("text").text(isOpen ? "−" : "+" + data.hidden);
      var badgeAction = data.terminal
        ? function () { gotoFamily(data.id); }
        : function () { toggleFamily(data.id); };
      badge.on("click", function (e) { if (!dragged(e)) badgeAction(); });
      badge.on("keydown", function (e) { activateKey(e, badgeAction); });
    }
  }

  /* ---------- Render ---------- */

  var lastLayout = { nodes: [], ups: [], root: { x: 0, y: 0 } };

  function contentBounds() {
    var xs = [], ys = [];
    lastLayout.nodes.forEach(function (n) {
      var s = nodeSize(n.data);
      xs.push(n.x - s.w / 2 - 40, n.x + s.w / 2 + 40);
      ys.push(n.y - s.h / 2 - 40, n.y + s.h / 2 + 80);
    });
    lastLayout.ups.forEach(function (u) {
      xs.push(u.x - UW / 2 - 40, u.x + UW / 2 + 40);
      ys.push(u.y - UH / 2 - 40, u.y + UH / 2 + 20);
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
    var tree = buildTree(state.focus, state.expanded);
    var root = d3.hierarchy(tree, function (d) { return d.children; });
    d3.tree().nodeSize([DX, DY])(root);
    var nodes = root.descendants();

    /* Up-nodes: positioned manually above the root, outside the hierarchy. */
    var ups = upFamilies(state.focus).map(function (u, i, arr) {
      return {
        kind: "up", id: "up:" + u.familyId, familyId: u.familyId, via: u.via,
        label: familyLabel(u.familyId),
        x: root.x + (i - (arr.length - 1) / 2) * (UW + 48),
        y: root.y - DY * 1.15
      };
    });
    lastLayout = { nodes: nodes, ups: ups, root: root };

    var key = function (d) { return d.data.kind + ":" + d.data.id + ":" + d.depth; };
    function spawnPos(d) {
      var p = mode === "refocus" ? { x: root.x, y: root.y } : (d.parent || d);
      return "translate(" + p.x + "," + p.y + ")";
    }

    /* Links (up-links carry .ft-link--up too, so exclude them here) */
    var linkSel = linkLayer.selectAll("path.ft-link:not(.ft-link--up)")
      .data(nodes.filter(function (d) { return d.parent; }), key);
    linkSel.enter().append("path")
      .attr("class", "ft-link")
      .attr("d", function (d) {
        var p = mode === "refocus" ? { x: root.x, y: root.y } : d.parent;
        return linkGen({ source: { x: p.x, y: p.y }, target: { x: p.x, y: p.y } });
      })
      .style("opacity", 0)
      .merge(linkSel)
      .transition().duration(DUR).ease(d3.easeCubicOut)
      .attr("d", linkPath)
      .style("opacity", 1);
    linkSel.exit().transition().duration(DUR).style("opacity", 0).remove();

    /* Up-links (dashed) */
    var upLinkSel = linkLayer.selectAll("path.ft-link--up")
      .data(ups, function (d) { return d.id; });
    upLinkSel.enter().append("path")
      .attr("class", "ft-link ft-link--up")
      .attr("d", function (d) {
        return linkGen({
          source: { x: d.x, y: d.y + UH / 2 },
          target: { x: root.x, y: root.y - FH / 2 }
        });
      })
      .style("opacity", 0)
      .merge(upLinkSel)
      .transition().duration(DUR).ease(d3.easeCubicOut)
      .attr("d", function (d) {
        return linkGen({
          source: { x: d.x, y: d.y + UH / 2 },
          target: { x: root.x, y: root.y - FH / 2 }
        });
      })
      .style("opacity", 1);
    upLinkSel.exit().transition().duration(DUR).style("opacity", 0).remove();

    /* Nodes */
    var nodeSel = nodeLayer.selectAll("g.ft-node").data(nodes, key);
    var nodeEnter = nodeSel.enter().append("g")
      .attr("class", function (d) { return "ft-node" + (d.data.self ? " ft-node--self" : ""); })
      .attr("transform", spawnPos)
      .style("opacity", 0);
    nodeEnter.each(function (d) { drawNode(d3.select(this), d); });
    nodeSel.each(function (d) { drawNode(d3.select(this), d); });
    nodeEnter.merge(nodeSel)
      .transition().duration(DUR).ease(d3.easeCubicOut)
      .attr("transform", function (d) { return "translate(" + d.x + "," + d.y + ")"; })
      .style("opacity", 1);
    nodeSel.exit()
      .transition().duration(DUR)
      .attr("transform", spawnPos)
      .style("opacity", 0)
      .remove();

    /* Up-nodes */
    var upSel = upLayer.selectAll("g.ft-upnode").data(ups, function (d) { return d.id; });
    var upEnter = upSel.enter().append("g")
      .attr("class", "ft-upnode")
      .attr("transform", "translate(" + root.x + "," + root.y + ")")
      .style("opacity", 0);
    upEnter.each(function (d) {
      var g = d3.select(this);
      var cg = g.append("g")
        .attr("class", "ft-cardg ft-focusable")
        .attr("tabindex", "0").attr("role", "button")
        .attr("aria-label", "上一代 — 前往" + FAMILIES[d.familyId].label);
      cg.on("click", function (e) { if (!dragged(e)) gotoFamily(d.familyId, d.via); });
      cg.on("keydown", function (e) {
        activateKey(e, function () { gotoFamily(d.familyId, d.via); });
      });
      cg.append("rect")
        .attr("class", "ft-card ft-card--up")
        .attr("x", -UW / 2).attr("y", -UH / 2)
        .attr("width", UW).attr("height", UH).attr("rx", 12);
      cg.append("text").attr("class", "ft-label ft-label--up").text(d.label);
    });
    upEnter.merge(upSel)
      .transition().duration(DUR).ease(d3.easeCubicOut)
      .attr("transform", function (d) { return "translate(" + d.x + "," + d.y + ")"; })
      .style("opacity", 1);
    upSel.exit().transition().duration(DUR).style("opacity", 0).remove();

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
