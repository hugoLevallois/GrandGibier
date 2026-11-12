/* charts.js — parties D3 : échelle de couleurs, courbe d'évolution, légende.
   Chargé avant map.js ; expose un objet global `Charts`. */
(function () {
  const nf = new Intl.NumberFormat("fr-FR");

  // Interpolateurs par thème (la valeur 0 reste lisible sur chaque fond)
  const interpolators = {
    light: d3.interpolateYlOrRd,
    dark: (t) => d3.interpolateInferno(0.12 + 0.88 * t),
  };

  function makeColorScale(maxValue, theme) {
    // Racine carrée : la distribution est très asymétrique (0 → ~5 600)
    return d3.scaleSequentialSqrt([0, Math.max(maxValue, 1)], interpolators[theme] || interpolators.light);
  }

  function updateLegend(scale, maxValue) {
    const stops = d3.range(0, 1.01, 0.1).map((t) => scale(t * maxValue));
    document.getElementById("legend-bar").style.background =
      "linear-gradient(to right," + stops.join(",") + ")";
    document.getElementById("legend-max").textContent = nf.format(Math.round(maxValue));
  }

  /* Courbes d'évolution (une par espèce).
     seriesList : [{name, color, values}] ; values alignées sur `years` (null = pas de donnée)
     onYear(i) : appelé quand on survole le graphique */
  function drawLine(container, years, seriesList, yearIndex, onYear) {
    const W = 420, H = 210, m = { top: 12, right: 12, bottom: 24, left: 46 };
    const root = d3.select(container);
    root.selectAll("*").remove();

    const svg = root.append("svg").attr("viewBox", `0 0 ${W} ${H}`);
    const x = d3.scaleLinear([years[0], years[years.length - 1]], [m.left, W - m.right]);
    const maxY = d3.max(seriesList, (s) => d3.max(s.values)) || 1;
    const y = d3.scaleLinear([0, maxY], [H - m.bottom, m.top]).nice();

    svg.append("g").attr("class", "grid")
      .attr("transform", `translate(${m.left},0)`)
      .call(d3.axisLeft(y).ticks(4).tickSize(-(W - m.left - m.right)).tickFormat(""))
      .call((g) => g.select(".domain").remove());
    svg.append("g").attr("class", "axis")
      .attr("transform", `translate(0,${H - m.bottom})`)
      .call(d3.axisBottom(x).ticks(6).tickFormat(d3.format("d")));
    svg.append("g").attr("class", "axis")
      .attr("transform", `translate(${m.left},0)`)
      .call(d3.axisLeft(y).ticks(4).tickFormat((d) => nf.format(d)))
      .call((g) => g.select(".domain").remove());

    const line = d3.line().defined((d) => d.v != null).x((d) => x(d.year)).y((d) => y(d.v));
    const cx = x(years[yearIndex]);
    svg.append("line").attr("class", "marker")
      .attr("x1", cx).attr("x2", cx).attr("y1", m.top).attr("y2", H - m.bottom);

    seriesList.forEach((s) => {
      const pts = s.values.map((v, i) => ({ v, year: years[i] }));
      svg.append("path").datum(pts).attr("class", "line")
        .style("stroke", s.color).attr("d", line);
      if (s.values[yearIndex] != null) {
        svg.append("circle").attr("class", "dot").style("fill", s.color)
          .attr("cx", cx).attr("cy", y(s.values[yearIndex])).attr("r", 4.5);
      }
    });

    svg.append("rect")
      .attr("x", m.left).attr("y", m.top)
      .attr("width", W - m.left - m.right).attr("height", H - m.top - m.bottom)
      .attr("fill", "transparent").style("cursor", "ew-resize")
      .on("pointermove", function (event) {
        const [px] = d3.pointer(event, this);
        const yr = Math.round(x.invert(px + m.left));
        const i = Math.min(years.length - 1, Math.max(0, yr - years[0]));
        if (onYear) onYear(i);
      });
  }

  window.Charts = { nf, makeColorScale, updateLegend, drawLine };
})();
