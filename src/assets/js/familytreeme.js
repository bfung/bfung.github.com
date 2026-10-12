/* FamilyTreeMe — an explorable family tree: three generations, one family at a time.
 * Privacy rule: kinship titles ONLY (e.g. 叔叔, 嫲嫲). No real names anywhere.
 * Vanilla JS, no dependencies. Renders into #family-tree on /familytreeme/. */
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

  /* familyId a person parents (each person parents at most one family here) */
  var CHILD_FAMILY = {};
  Object.keys(FAMILIES).forEach(function (fid) {
    FAMILIES[fid].parents.forEach(function (p) { CHILD_FAMILY[p] = fid; });
  });

  /* ---------- State ---------- */
  var state = { focus: START_FAMILY, expanded: {} }; // expanded: childId -> true

  var mount = document.getElementById("family-tree");
  var heading = document.getElementById("ft-heading");
  var live = document.getElementById("ft-live");
  var resetBtn = document.getElementById("ft-reset");
  if (!mount || !heading) return;

  function esc(s) {
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  /* ---------- Nodes ---------- */

  /* A person node: a <button> when clicking navigates somewhere, a static
   * <span> when the person is a dead end in this view. */
  function personNode(id, small) {
    var title = esc(PEOPLE[id]);
    var isSelf = id === SELF;
    var origin = ORIGIN[id];
    var childFam = CHILD_FAMILY[id];
    var navigates = (origin && origin !== state.focus) || (childFam && childFam !== state.focus);
    var cls = "ft-node" + (isSelf ? " ft-node--self" : "") + (small ? " ft-node--small" : "");
    var pill = isSelf ? '<span class="ft-self-pill">起點</span>' : "";
    if (navigates) {
      var target = (origin && origin !== state.focus) ? FAMILIES[origin].label : FAMILIES[childFam].label;
      return '<button type="button" class="' + cls + '" data-navigate="' + id + '"' +
        ' aria-label="' + title + ' — 前往 ' + esc(target) + '">' + title + pill + "</button>";
    }
    return '<span class="' + cls + ' ft-node--static">' + title + pill + "</span>";
  }

  /* Up band: for each parent of the focus family that has an origin family,
   * show that origin family's parents as small nodes in the same column. */
  function upBandHTML(fam) {
    var hasUp = fam.parents.some(function (p) { return ORIGIN[p]; });
    if (!hasUp) return "";
    var cells = fam.parents.map(function (p) {
      var o = ORIGIN[p];
      if (!o) return '<div class="ft-upcell"></div>';
      var nodes = FAMILIES[o].parents.map(function (id) { return personNode(id, true); }).join("");
      return '<div class="ft-upcell">' +
        '<div class="ft-upgroup" role="group" aria-label="' + esc(PEOPLE[p]) + " 的祖先 · 前往 " + esc(FAMILIES[o].label) + '">' + nodes + "</div>" +
        '<span class="ft-up-trunk" aria-hidden="true"></span>' +
        "</div>";
    }).join("");
    return '<div class="ft-upband" style="--ft-cols:' + fam.parents.length + '">' + cells + "</div>";
  }

  function parentsHTML(fam) {
    var cells = fam.parents.map(function (p) {
      return '<div class="ft-parentcell">' + personNode(p) + "</div>";
    }).join("");
    return '<div class="ft-parents" style="--ft-cols:' + fam.parents.length + '" role="list" aria-label="父母">' + cells + "</div>";
  }

  /* Generation 3: expanded grandchildren. Hard cap — a grandchild who parents
   * their own family gets a "visit family" button, never inline expansion. */
  function grandkidsHTML(parentId, famId) {
    var gkids = FAMILIES[famId].children;
    var items = gkids.map(function (gid) {
      var gChildFam = CHILD_FAMILY[gid];
      var visit = "";
      if (gChildFam && gChildFam !== state.focus) {
        visit = '<button type="button" class="ft-visit" data-family="' + gChildFam + '" data-highlight="' + gid + '"' +
          ' aria-label="' + esc(PEOPLE[gid]) + " — 前往 " + esc(FAMILIES[gChildFam].label) + '">' +
          '<span aria-hidden="true">→</span> visit family</button>';
      }
      return '<div class="ft-gkid" role="listitem"><span class="ft-stub" aria-hidden="true"></span>' +
        personNode(gid, true) + visit + "</div>";
    }).join("");
    return '<div class="ft-gtrunk" aria-hidden="true"></div>' +
      '<div class="ft-gkids" id="ft-gk-' + parentId + '" style="--ft-n:' + gkids.length + '"' +
      ' role="list" aria-label="' + esc(PEOPLE[parentId]) + ' 的子女">' + items + "</div>";
  }

  /* Generation 2: one slot per child of the focus family. */
  function childSlotHTML(id) {
    var childFamId = CHILD_FAMILY[id];
    var under = "";
    if (childFamId && childFamId !== state.focus) {
      var count = FAMILIES[childFamId].children.length;
      var isOpen = !!state.expanded[id];
      var label = isOpen
        ? "收起 " + PEOPLE[id] + " 的子女"
        : "展開 " + PEOPLE[id] + " 的子女（" + count + " 人）";
      under = '<button type="button" class="ft-expander" data-expand="' + id + '"' +
        ' aria-expanded="' + isOpen + '"' + (isOpen ? ' aria-controls="ft-gk-' + id + '"' : "") +
        ' aria-label="' + esc(label) + '">' +
        (isOpen
          ? '<span aria-hidden="true">−</span><span class="ft-expander-text">收起</span>'
          : '<span class="ft-count" aria-hidden="true">+' + count + "</span>") +
        "</button>";
      if (isOpen) under += grandkidsHTML(id, childFamId);
    }
    return '<div class="ft-kid" role="listitem"><span class="ft-stub" aria-hidden="true"></span>' +
      personNode(id) + under + "</div>";
  }

  function childrenHTML(fam) {
    var slots = fam.children.map(childSlotHTML).join("");
    return '<div class="ft-trunk" aria-hidden="true"></div>' +
      '<div class="ft-kids" style="--ft-n:' + fam.children.length + '" role="list" aria-label="子女">' + slots + "</div>";
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

  function gotoFamily(famId, highlightId) {
    state.focus = famId;
    var fam = FAMILIES[famId];
    /* Auto-expand the branch of the person we navigated via, when they appear
     * as a child in the new view. */
    if (highlightId && fam.children.indexOf(highlightId) !== -1 && CHILD_FAMILY[highlightId]) {
      state.expanded[highlightId] = true;
    }
    render();
    announce("Now showing " + fam.label);
    focusHeading();
  }

  function navigateTo(id) {
    var origin = ORIGIN[id];
    var childFam = CHILD_FAMILY[id];
    if (origin && origin !== state.focus) gotoFamily(origin, id);
    else if (childFam && childFam !== state.focus) gotoFamily(childFam, id);
  }

  function toggleExpand(id) {
    if (state.expanded[id]) delete state.expanded[id];
    else state.expanded[id] = true;
    render();
    /* Re-rendering replaces the button, so restore focus to it. */
    var btn = mount.querySelector('[data-expand="' + id + '"]');
    if (btn) btn.focus({ preventScroll: true });
  }

  function reset() {
    state.focus = START_FAMILY;
    state.expanded = {};
    render();
    announce("Now showing " + FAMILIES[START_FAMILY].label);
    focusHeading();
  }

  /* ---------- Render ---------- */

  function render() {
    var fam = FAMILIES[state.focus];
    heading.textContent = fam.label;
    mount.innerHTML = upBandHTML(fam) + parentsHTML(fam) + childrenHTML(fam);
  }

  mount.addEventListener("click", function (e) {
    var nav = e.target.closest("[data-navigate]");
    if (nav) { navigateTo(nav.getAttribute("data-navigate")); return; }
    var famBtn = e.target.closest("[data-family]");
    if (famBtn) {
      gotoFamily(famBtn.getAttribute("data-family"), famBtn.getAttribute("data-highlight"));
      return;
    }
    var exp = e.target.closest("[data-expand]");
    if (exp) toggleExpand(exp.getAttribute("data-expand"));
  });

  if (resetBtn) resetBtn.addEventListener("click", reset);

  render();
})();
