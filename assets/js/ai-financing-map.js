/* AI Financing Map — D3 force graph over the JSON dataset.
   Data: /assets/data/ai-financing-map.json (nodes + directional links).
   Filters mirror the spreadsheet: category group, status, confidence,
   start-year range, node type, search, and aggregate/component toggles.
   Aggregate and component rows are OFF by default, exactly as the
   spreadsheet's Is_Aggregate=No rule. Blank amount = no dollar figure
   disclosed, not zero. */
(function () {
  "use strict";
  var root = document.getElementById("afm");
  if (!root || typeof d3 === "undefined") return;
  var dataUrl = root.getAttribute("data-json");
  var svgEl = document.getElementById("afm-svg");
  var countEl = document.getElementById("afm-count");
  var detailEl = document.getElementById("afm-detail");
  var tableBody = document.querySelector("#afm-table tbody");
  var tooltip = document.getElementById("afm-tooltip");

  var TYPE_COLORS = {
    Chip: "#4f46e5", Hyperscaler: "#0e7490", Neocloud: "#ea580c",
    Lab: "#7c3aed", Investor: "#15803d", Lender: "#64748b",
    Developer: "#92400e", Other: "#475569"
  };

  function categoryGroup(c) {
    if (c.indexOf("Equity") === 0) return "Equity";
    if (c.indexOf("Debt") === 0) return "Debt";
    if (c === "Compute_Spend_Commitment") return "Compute spend";
    if (c === "Capacity_Backstop") return "Capacity backstop";
    if (c.indexOf("Purchase") === 0) return "Purchase";
    if (c.indexOf("JV") === 0 || c.indexOf("SPV") === 0) return "JV / SPV";
    return "Other";
  }
  function statusGroup(s) {
    if (s === "Closed" || s === "Closed_Reported") return "Closed";
    if (s === "Committed" || s === "Committed_Conditional") return "Committed";
    if (s === "Contingent" || s === "Contract_Contingent") return "Contingent";
    if (s === "Facility" || s === "Facility_Available") return "Facility";
    if (s === "Announced" || s === "Announced_Programme" || s === "Arranged_Reported") return "Announced";
    if (s === "LOI_Up_To") return "LOI / up to";
    return "Reported";
  }
  function fmt(n) {
    if (n === null || n === undefined) return "—";
    return "$" + n.toLocaleString("en-US", { maximumFractionDigits: 2 }) + "bn";
  }
  function amountLabel(l) {
    if (l.amount_low_usd_bn === null) {
      if (l.quantity_value !== null) return l.quantity_value.toLocaleString() + " " + (l.quantity_unit || "");
      return "No $ figure disclosed";
    }
    var s = fmt(l.amount_low_usd_bn);
    if (l.amount_high_usd_bn !== null && l.amount_high_usd_bn !== l.amount_low_usd_bn) s += " – " + fmt(l.amount_high_usd_bn);
    if (l.is_up_to) s += " (up to)";
    return s;
  }
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  }

  fetch(dataUrl).then(function (r) { return r.json(); }).then(function (data) {
    var allNodes = data.nodes, allLinks = data.links;
    var nodeById = {};
    allNodes.forEach(function (n) { nodeById[n.id] = n; });

    // Build controls
    var catGroups = ["Equity", "Debt", "Compute spend", "Capacity backstop", "Purchase", "JV / SPV", "Other"];
    var statGroups = ["Closed", "Committed", "Reported", "Contingent", "Facility", "Announced", "LOI / up to"];
    var types = data.filters.types;
    function checks(id, items) {
      var el = document.getElementById(id);
      el.innerHTML = items.map(function (it) {
        return '<label><input type="checkbox" value="' + esc(it) + '" checked> ' + esc(it) + "</label>";
      }).join("");
      return el;
    }
    checks("afm-cat", catGroups);
    checks("afm-status", statGroups);
    checks("afm-conf", ["High", "Medium", "Low"]);
    checks("afm-type", types);
    document.getElementById("afm-year-min").value = data.filters.year_min;
    document.getElementById("afm-year-max").value = data.filters.year_max;
    document.getElementById("afm-year-min").min = data.filters.year_min;
    document.getElementById("afm-year-max").max = data.filters.year_max;

    function checkedValues(id) {
      return Array.prototype.slice.call(document.querySelectorAll("#" + id + " input:checked")).map(function (i) { return i.value; });
    }
    function state() {
      return {
        cats: checkedValues("afm-cat"), stats: checkedValues("afm-status"),
        confs: checkedValues("afm-conf"), types: checkedValues("afm-type"),
        search: (document.getElementById("afm-search").value || "").toLowerCase(),
        yMin: parseInt(document.getElementById("afm-year-min").value, 10),
        yMax: parseInt(document.getElementById("afm-year-max").value, 10),
        agg: document.getElementById("afm-agg").checked,
        comp: document.getElementById("afm-comp").checked,
        labels: document.getElementById("afm-labels").checked
      };
    }
    var selected = null; // node id or null

    function filtered() {
      var s = state();
      return allLinks.filter(function (l) {
        if (!s.agg && l.is_aggregate) return false;
        if (!s.comp && l.is_component) return false;
        if (catGroups.length && s.cats.indexOf(categoryGroup(l.category)) === -1) return false;
        if (s.stats.indexOf(statusGroup(l.status)) === -1) return false;
        if (s.confs.indexOf(l.confidence) === -1) return false;
        if (s.types.indexOf((nodeById[l.source] || {}).type || "Other") === -1) return false;
        if (s.types.indexOf((nodeById[l.target] || {}).type || "Other") === -1) return false;
        if (l.start_year !== null && (l.start_year < s.yMin || l.start_year > s.yMax)) return false;
        if (s.search && (l.source.toLowerCase().indexOf(s.search) === -1 && l.target.toLowerCase().indexOf(s.search) === -1)) return false;
        if (selected && l.source !== selected && l.target !== selected) return false;
        return true;
      });
    }

    // D3 setup
    var width = svgEl.clientWidth || 900, height = svgEl.clientHeight || 640;
    var svg = d3.select(svgEl).attr("viewBox", "0 0 " + width + " " + height);
    svg.append("defs").append("marker").attr("id", "afm-arrow").attr("viewBox", "0 -5 10 10")
      .attr("refX", 18).attr("refY", 0).attr("markerWidth", 7).attr("markerHeight", 7)
      .attr("orient", "auto").append("path").attr("d", "M0,-5L10,0L0,5").attr("fill", "#94a3b8");
    var g = svg.append("g");
    svg.call(d3.zoom().scaleExtent([0.4, 3]).on("zoom", function (e) { g.attr("transform", e.transform); }));
    var linkG = g.append("g"), nodeG = g.append("g");
    var simulation = d3.forceSimulation()
      .force("link", d3.forceLink().id(function (d) { return d.id; }).distance(130))
      .force("charge", d3.forceManyBody().strength(-420))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force("collide", d3.forceCollide(42));

    function radius(n) {
      var v = n.total_volume_low_usd_bn || 0;
      return Math.min(34, 9 + Math.sqrt(v) * 1.1);
    }
    function linkWidth(l) {
      if (l.amount_low_usd_bn === null) return 1;
      return 1 + Math.log10(l.amount_low_usd_bn + 1) * 2.2;
    }

    function render() {
      var links = filtered();
      var nodeIds = {};
      links.forEach(function (l) { nodeIds[l.source] = true; nodeIds[l.target] = true; });
      var nodes = allNodes.filter(function (n) { return nodeIds[n.id]; });
      // D3 link objects need node references; clone to avoid mutating source data across renders
      var linkObjs = links.map(function (l) {
        return Object.assign({}, l, { source: nodeById[l.source], target: nodeById[l.target] });
      });

      countEl.textContent = "Showing " + links.length + " of " + allLinks.length + " links · " + nodes.length + " of " + allNodes.length + " companies";
      renderTable(links);
      if (selected && !nodeIds[selected]) { selected = null; detailEl.innerHTML = "<p>Select a company or a link for details.</p>"; }

      var linkSel = linkG.selectAll("line").data(linkObjs, function (d) { return d.id; });
      linkSel.exit().remove();
      var linkEnter = linkSel.enter().append("line").attr("class", "afm-link")
        .attr("marker-end", "url(#afm-arrow)")
        .on("click", function (e, d) { showLink(d); })
        .on("mouseover", function (e, d) { showTip(e, d.source.id + " → " + d.target.id + ": " + amountLabel(d) + " · " + d.status + " · " + d.confidence); })
        .on("mouseout", hideTip);
      var linkAll = linkEnter.merge(linkSel);
      linkAll
        .attr("stroke", function (d) { return TYPE_COLORS[(nodeById[d.target.id] || {}).type] || "#94a3b8"; })
        .attr("stroke-width", linkWidth)
        .attr("stroke-opacity", function (d) { return d.confidence === "High" ? 0.9 : d.confidence === "Medium" ? 0.6 : 0.4; })
        .classed("afm-link--contingent", function (d) { return d.is_up_to || d.status.indexOf("Contingent") !== -1 || d.status === "LOI_Up_To"; })
        .classed("afm-link--dim", function (d) { return selected && d.source.id !== selected && d.target.id !== selected; });

      var nodeSel = nodeG.selectAll("g").data(nodes, function (d) { return d.id; });
      nodeSel.exit().remove();
      var nodeEnter = nodeSel.enter().append("g").attr("class", "afm-node").attr("tabindex", "0")
        .call(d3.drag().on("start", function (e, d) { if (!e.active) simulation.alphaTarget(0.3).restart(); d.fx = d.x; d.fy = d.y; })
          .on("drag", function (e, d) { d.fx = e.x; d.fy = e.y; })
          .on("end", function (e, d) { if (!e.active) simulation.alphaTarget(0); d.fx = null; d.fy = null; }));
      nodeEnter.append("circle");
      nodeEnter.append("text").attr("dy", -14).attr("text-anchor", "middle");
      nodeEnter.on("click", function (e, d) { selected = (selected === d.id) ? null : d.id; render(); showNode(d.id); })
        .on("mouseover", function (e, d) { showTip(e, d.id + " · " + d.type + " · out " + fmt(d.outflow_low_usd_bn) + " · in " + fmt(d.inflow_low_usd_bn)); })
        .on("mouseout", hideTip);
      var nodeAll = nodeEnter.merge(nodeSel);
      nodeAll
        .classed("afm-node--dim", function (d) { return selected && d.id !== selected; })
        .classed("afm-node--selected", function (d) { return d.id === selected; });
      nodeAll.select("circle").attr("r", radius).attr("fill", function (d) { return TYPE_COLORS[d.type] || "#475569"; });
      nodeAll.select("text").text(function (d) { return state().labels ? d.id : ""; });

      simulation.nodes(nodes);
      simulation.force("link").links(linkObjs);
      simulation.alpha(0.7).restart();
      simulation.on("tick", function () {
        linkAll.attr("x1", function (d) { return d.source.x; }).attr("y1", function (d) { return d.source.y; })
          .attr("x2", function (d) { return d.target.x; }).attr("y2", function (d) { return d.target.y; });
        nodeAll.attr("transform", function (d) { return "translate(" + d.x + "," + d.y + ")"; });
      });
    }

    function renderTable(links) {
      var sorted = links.slice().sort(function (a, b) { return (b.amount_low_usd_bn || 0) - (a.amount_low_usd_bn || 0); });
      tableBody.innerHTML = sorted.map(function (l) {
        return "<tr><td>" + esc(l.source) + "</td><td>" + esc(l.target) + "</td><td>" + esc(l.category) + "</td><td>" + esc(amountLabel(l)) + "</td><td>" + esc(l.status) + "</td><td>" + esc(l.confidence) + "</td><td>" + (l.start_year || "—") + (l.end_year && l.end_year !== l.start_year ? "–" + l.end_year : "") + "</td></tr>";
      }).join("") || "<tr><td colspan='7'>No links match these filters.</td></tr>";
    }
    function showNode(id) {
      var n = nodeById[id];
      var links = filtered();
      var out = links.filter(function (l) { return l.source === id; });
      var inn = links.filter(function (l) { return l.target === id; });
      function sum(arr) { return arr.reduce(function (s, l) { return s + (l.amount_low_usd_bn || 0); }, 0); }
      detailEl.innerHTML = "<h3>" + esc(n.id) + "</h3><p>" + esc(n.type) + (n.parent ? " · parent: " + esc(n.parent) : "") +
        " · Filtered outflows: " + fmt(sum(out)) + " · Filtered inflows: " + fmt(sum(inn)) + "</p><p>Click the company again to clear the highlight. Totals use low amounts, non-aggregate rows only under current filters, and mix statuses — filter Status first for a clean total.</p>";
    }
    function showLink(l) {
      detailEl.innerHTML = "<h3>" + esc(l.source.id || l.source) + " → " + esc(l.target.id || l.target) + "</h3>" +
        "<p>" + esc(l.category) + " · " + esc(amountLabel(l)) + " · " + esc(l.status) + " · Confidence: " + esc(l.confidence) +
        (l.start_year ? " · " + l.start_year + (l.end_year && l.end_year !== l.start_year ? "–" + l.end_year : "") : "") + "</p>" +
        "<p>" + esc(l.notes || "") + "</p><p>Source basis: " + esc(l.source_basis) + "</p>";
    }
    function showTip(e, text) {
      tooltip.textContent = text; tooltip.hidden = false;
      tooltip.style.left = (e.pageX + 12) + "px"; tooltip.style.top = (e.pageY + 12) + "px";
    }
    function hideTip() { tooltip.hidden = true; }

    // Capex table
    var capexBody = document.querySelector("#afm-capex tbody");
    if (capexBody) {
      capexBody.innerHTML = data.capex.map(function (c) {
        return "<tr><td>" + esc(c.company) + "</td><td>" + c.year + "</td><td>" + fmt(c.amount_low_usd_bn) + (c.amount_high_usd_bn !== c.amount_low_usd_bn ? " – " + fmt(c.amount_high_usd_bn) : "") + "</td><td>" + esc(c.status) + "</td><td>" + esc(c.confidence) + "</td><td>" + esc(c.notes) + "</td></tr>";
      }).join("");
    }

    ["afm-cat", "afm-status", "afm-conf", "afm-type"].forEach(function (id) {
      document.getElementById(id).addEventListener("change", render);
    });
    ["afm-search", "afm-year-min", "afm-year-max"].forEach(function (id) {
      document.getElementById(id).addEventListener("input", render);
    });
    ["afm-agg", "afm-comp", "afm-labels"].forEach(function (id) {
      document.getElementById(id).addEventListener("change", render);
    });
    document.getElementById("afm-reset").addEventListener("click", function () {
      document.querySelectorAll("#afm input[type=checkbox]").forEach(function (i) { i.checked = true; });
      document.getElementById("afm-agg").checked = false; document.getElementById("afm-comp").checked = false;
      document.getElementById("afm-search").value = "";
      document.getElementById("afm-year-min").value = data.filters.year_min;
      document.getElementById("afm-year-max").value = data.filters.year_max;
      selected = null; render(); detailEl.innerHTML = "<p>Select a company or a link for details.</p>";
    });
    render();
  }).catch(function () {
    countEl.textContent = "Could not load the graph data. The JSON is at /assets/data/ai-financing-map.json.";
  });
})();
