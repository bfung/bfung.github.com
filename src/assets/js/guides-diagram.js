/* Architecture diagram for the Guides article: Muse -> GitHub repo -> GitHub Actions -> GitHub Pages URL.
   Drawn with D3; horizontal on wide screens, vertical stack on narrow ones. Colors come from CSS. */
(function () {
  var container = document.getElementById("arch-diagram");
  if (!container || typeof d3 === "undefined") return;

  var nodes = [
    { id: "muse", title: "Muse app", sub: "on your phone" },
    { id: "repo", title: "GitHub repository", sub: "your site's files" },
    { id: "actions", title: "GitHub Actions", sub: "builds on every push" },
    { id: "pages", title: "GitHub Pages URL", sub: "your live site" }
  ];
  var edges = [
    { from: "muse", to: "repo", label: "clone \u00B7 commit \u00B7 push" },
    { from: "repo", to: "actions", label: "push triggers a build" },
    { from: "actions", to: "pages", label: "publishes your site" }
  ];
  var byId = {};
  nodes.forEach(function (n, i) { byId[n.id] = { node: n, index: i }; });

  function draw() {
    container.innerHTML = "";
    var width = container.clientWidth || 640;
    var vertical = width < 720;

    var boxW = vertical ? Math.min(280, width - 32) : Math.min(130, (width - 3 * 70) / 4);
    var boxH = 76;
    var gap = vertical ? 64 : 70;

    var svgW = width;
    var svgH = vertical
      ? nodes.length * boxH + (nodes.length - 1) * gap + 16
      : 40 + boxH + 48;

    var svg = d3.select(container)
      .append("svg")
      .attr("viewBox", "0 0 " + svgW + " " + svgH)
      .attr("aria-hidden", "true");

    svg.append("defs").append("marker")
      .attr("id", "arch-arrow")
      .attr("viewBox", "0 0 10 10")
      .attr("refX", 9)
      .attr("refY", 5)
      .attr("markerWidth", 7)
      .attr("markerHeight", 7)
      .attr("orient", "auto-start-reverse")
      .append("path")
      .attr("d", "M 0 1 L 9 5 L 0 9 z")
      .attr("class", "edge-label");

    // Node positions
    var boxY = vertical ? 0 : 40;
    var pos = nodes.map(function (n, i) {
      if (vertical) {
        return { x: (svgW - boxW) / 2, y: 8 + i * (boxH + gap) };
      }
      var totalW = nodes.length * boxW + (nodes.length - 1) * gap;
      return { x: (svgW - totalW) / 2 + i * (boxW + gap), y: boxY };
    });

    // Edges (under the boxes)
    edges.forEach(function (e) {
      var a = pos[byId[e.from].index];
      var b = pos[byId[e.to].index];
      var x1, y1, x2, y2, lx, ly, anchor;
      if (vertical) {
        x1 = a.x + boxW / 2; y1 = a.y + boxH;
        x2 = b.x + boxW / 2; y2 = b.y;
        lx = x1 + 10; ly = (y1 + y2) / 2 + 4; anchor = "start";
      } else {
        x1 = a.x + boxW; y1 = a.y + boxH / 2;
        x2 = b.x; y2 = b.y + boxH / 2;
        lx = (x1 + x2) / 2; ly = boxY + boxH + 28; anchor = "middle";
      }
      svg.append("line")
        .attr("class", "edge")
        .attr("x1", x1).attr("y1", y1)
        .attr("x2", x2).attr("y2", y2)
        .attr("marker-end", "url(#arch-arrow)");
      svg.append("text")
        .attr("class", "edge-label")
        .attr("x", lx).attr("y", ly)
        .attr("text-anchor", anchor)
        .attr("font-size", 12)
        .text(e.label);
    });

    // Nodes
    var g = svg.selectAll(".arch-node")
      .data(nodes)
      .enter().append("g")
      .attr("class", "arch-node")
      .attr("transform", function (n, i) { return "translate(" + pos[i].x + "," + pos[i].y + ")"; });

    g.append("rect")
      .attr("class", "node-box")
      .attr("width", boxW)
      .attr("height", boxH)
      .attr("rx", 12);

    g.append("text")
      .attr("class", "node-title")
      .attr("x", boxW / 2)
      .attr("y", boxH / 2 - 6)
      .attr("text-anchor", "middle")
      .attr("font-size", 13)
      .text(function (n) { return n.title; });

    g.append("text")
      .attr("class", "node-sub")
      .attr("x", boxW / 2)
      .attr("y", boxH / 2 + 16)
      .attr("text-anchor", "middle")
      .attr("font-size", 12)
      .text(function (n) { return n.sub; });

    // Step numbers
    g.append("circle")
      .attr("class", "node-box")
      .attr("cx", 0).attr("cy", 0).attr("r", 13);
    g.append("text")
      .attr("class", "node-title")
      .attr("x", 0).attr("y", 5)
      .attr("text-anchor", "middle")
      .attr("font-size", 12)
      .text(function (n, i) { return i + 1; });
  }

  var timer = null;
  window.addEventListener("resize", function () {
    if (timer) window.clearTimeout(timer);
    timer = window.setTimeout(draw, 150);
  });

  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(draw);
  } else {
    draw();
  }
})();
