// Courbes du recall et de la fidélité du RAG, lues en direct sur son API.
// Sans JS ou si l'API ne répond pas, le bloc affiche « Données indisponibles ».
(() => {
  const block = document.querySelector("[data-quality-history]");
  if (!block) return;
  const SOURCE = "https://ionis.tanguym.fr/api/monitoring/history";
  const SVG_NS = "http://www.w3.org/2000/svg";
  const H = 150;
  const M = { top: 10, right: 52, bottom: 24, left: 38 };
  const percent = new Intl.NumberFormat("fr-FR", { style: "percent", maximumFractionDigits: 1 });
  const shortDate = (value) =>
    new Date(value).toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
  const longDate = (value) =>
    new Date(value).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });

  function node(name, attributes, parent) {
    const element = document.createElementNS(SVG_NS, name);
    Object.entries(attributes).forEach(([key, value]) => element.setAttribute(key, value));
    parent.append(element);
    return element;
  }

  function draw(chart, points, { min, step, threshold }, emptyText) {
    const svg = chart.querySelector("svg");
    const tooltip = chart.querySelector(".quality-tooltip");
    // Drawn at the real width so labels stay readable on a phone.
    const W = Math.max(260, Math.round(svg.parentElement.clientWidth || 320));
    svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
    svg.replaceChildren();
    tooltip.hidden = true;
    const plotW = W - M.left - M.right;
    const plotH = H - M.top - M.bottom;
    const y = (value) => M.top + plotH * (1 - (value - min) / (1 - min));

    for (let tick = min; tick <= 1.0001; tick += step) {
      node("line", { class: "quality-gridline", x1: M.left, x2: W - M.right, y1: y(tick), y2: y(tick) }, svg);
      node("text", { class: "quality-axis", x: M.left - 6, y: y(tick) + 4, "text-anchor": "end" }, svg)
        .textContent = percent.format(tick);
    }
    node("line", { class: "quality-threshold", x1: M.left, x2: W - M.right, y1: y(threshold), y2: y(threshold) }, svg);

    if (!points.length) {
      node("text", { class: "quality-empty", x: M.left + plotW / 2, y: M.top + plotH * 0.65, "text-anchor": "middle" }, svg)
        .textContent = emptyText;
      return;
    }

    const times = points.map((point) => new Date(point.at).getTime());
    const day = 24 * 3600 * 1000;
    const start = Math.min(...times) - day;
    const end = Math.max(...times) + day;
    const x = (time) => M.left + (plotW * (time - start)) / (end - start);
    const coords = points.map((point, index) => ({
      ...point,
      cx: x(times[index]),
      cy: y(Math.max(min, Math.min(1, point.value))),
    }));

    const first = coords[0];
    const last = coords[coords.length - 1];
    node("text", { class: "quality-axis", x: first.cx, y: H - 6, "text-anchor": "middle" }, svg)
      .textContent = shortDate(first.at);
    if (last.cx - first.cx > 50) {
      node("text", { class: "quality-axis", x: last.cx, y: H - 6, "text-anchor": "middle" }, svg)
        .textContent = shortDate(last.at);
    }
    if (coords.length > 1) {
      node("path", {
        class: "quality-line",
        d: coords.map((point, index) => `${index ? "L" : "M"}${point.cx},${point.cy}`).join(" "),
      }, svg);
    }
    coords.forEach((point) => node("circle", { class: "quality-dot", cx: point.cx, cy: point.cy, r: 4 }, svg));
    node("text", { class: "quality-value", x: last.cx + 9, y: last.cy + 4 }, svg).textContent =
      percent.format(last.value);

    const hide = () => { tooltip.hidden = true; };
    coords.forEach((point) => {
      const show = () => {
        tooltip.replaceChildren();
        const strong = document.createElement("strong");
        strong.textContent = percent.format(point.value);
        tooltip.append(strong, document.createElement("br"), longDate(point.at));
        point.details.forEach((line) => tooltip.append(document.createElement("br"), line));
        tooltip.style.left = `${(point.cx / W) * 100}%`;
        tooltip.style.top = `${(point.cy / H) * 100}%`;
        tooltip.hidden = false;
      };
      const target = node("circle", {
        class: "quality-hit", cx: point.cx, cy: point.cy, r: 13, tabindex: 0,
        "aria-label": `${longDate(point.at)} : ${percent.format(point.value)}`,
      }, svg);
      target.addEventListener("mouseenter", show);
      target.addEventListener("focus", show);
      target.addEventListener("mouseleave", hide);
      target.addEventListener("blur", hide);
    });
  }

  const charts = {
    recall: { element: block.querySelector('[data-metric="recall"]'), scale: { min: 0.6, step: 0.1, threshold: 0.8 } },
    faithfulness: { element: block.querySelector('[data-metric="faithfulness"]'), scale: { min: 0, step: 0.25, threshold: 0.8 } },
  };
  let series = { recall: [], faithfulness: [] };
  let emptyText = "Chargement…";
  const drawAll = () =>
    Object.entries(charts).forEach(([key, chart]) => draw(chart.element, series[key], chart.scale, emptyText));

  drawAll();
  new ResizeObserver(drawAll).observe(block);

  fetch(SOURCE)
    .then((response) => (response.ok ? response.json() : Promise.reject(response.status)))
    .then((history) => {
      const thresholds = history.thresholds || {};
      charts.recall.scale.threshold = thresholds.recall ?? 0.8;
      charts.faithfulness.scale.threshold = thresholds.faithfulness ?? 0.8;
      series = {
        recall: (history.recall || []).map((point) => ({
          at: point.at,
          value: point.video_recall,
          details: [
            point.kind === "recall_gate" ? "Avant un déploiement" : "Mesure en prod (1er et 15 du mois)",
            ...(point.commit ? [`commit ${point.commit}`] : []),
          ],
        })),
        faithfulness: (history.faithfulness || []).map((point) => ({
          at: point.at,
          value: point.canary_faithfulness,
          details: ["10 questions de référence"],
        })),
      };
      emptyText = "Pas encore de mesure";
      drawAll();
      // La pastille « Recall vidéos » suit la dernière mesure ; sans données, le HTML garde sa valeur.
      const latest = series.recall[series.recall.length - 1];
      const pill = document.querySelector("[data-latest-recall]");
      if (latest && pill) {
        pill.textContent = percent.format(latest.value);
        pill.title = `Dernière mesure : ${longDate(latest.at)}`;
      }
    })
    .catch(() => {
      emptyText = "Données indisponibles";
      drawAll();
    });
})();
