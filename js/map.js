/* map.js — carte Leaflet, état partagé (année, département, espèce), animation. */
(function () {
  const { nf, makeColorScale, updateLegend, drawLine } = Charts;

  const GEO_LOCAL = "data/departements.geojson";
  const GEO_REMOTE =
    "https://raw.githubusercontent.com/gregoiredavid/france-geojson/master/departements-version-simplifiee.geojson";
  const DATA_URL = "data/prelevements.json";

  const state = { species: null, yearIndex: 0, dep: null, playing: false, timer: null };
  let DATA, map, layer, scale, maxValue;
  const layers = {};   // code -> couche Leaflet
  const names = {};    // code -> nom

  const $ = (id) => document.getElementById(id);
  const css = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  const theme = () => document.documentElement.getAttribute("data-theme") || "light";

  const speciesData = () => DATA.especes[state.species];
  const valueOf = (code, i = state.yearIndex) => {
    const s = speciesData()[code];
    return s ? s[i] : null;
  };
  const nationalSeries = () => {
    const n = DATA.years.length;
    return Array.from({ length: n }, (_, i) => {
      let sum = 0, any = false;
      for (const code in speciesData()) {
        const v = speciesData()[code][i];
        if (v != null) { sum += v; any = true; }
      }
      return any ? sum : null;
    });
  };

  async function fetchJSON(url) {
    const r = await fetch(url);
    if (!r.ok) throw new Error(url + " : " + r.status);
    return r.json();
  }

  async function loadGeo() {
    try { return await fetchJSON(GEO_LOCAL); }
    catch (e) { return fetchJSON(GEO_REMOTE); }
  }

  /* ---------- Rendu ---------- */

  function styleFor(feature) {
    const code = feature.properties.code;
    const v = valueOf(code);
    const selected = code === state.dep;
    return {
      fillColor: v == null ? css("--nodata") : scale(v),
      fillOpacity: 1,
      color: selected ? css("--text") : css("--dep-stroke"),
      weight: selected ? 2.4 : 0.6,
    };
  }

  function recomputeScale() {
    // Échelle fixe sur toutes les années, pour que les couleurs soient comparables
    maxValue = 0;
    for (const code in speciesData()) {
      for (const v of speciesData()[code]) if (v != null && v > maxValue) maxValue = v;
    }
    scale = makeColorScale(maxValue, theme());
    updateLegend(scale, maxValue);
  }

  function renderMap() {
    layer.setStyle(styleFor);
    if (state.dep && layers[state.dep]) layers[state.dep].bringToFront();
  }

  function renderPanel() {
    const years = DATA.years;
    const year = years[state.yearIndex];
    const series = state.dep ? (speciesData()[state.dep] || years.map(() => null)) : nationalSeries();
    const v = series[state.yearIndex];

    $("chart-title").textContent = state.dep ? `${names[state.dep]} (${state.dep})` : "France entière";
    $("reset").hidden = !state.dep;
    $("big-number").textContent = v == null ? "Pas de donnée" : nf.format(v);
    $("big-caption").textContent = `prélèvements en ${year}`;
    drawLine($("chart"), years, series, state.yearIndex, setYear);

    // Top 10
    const rows = Object.keys(speciesData())
      .map((code) => ({ code, v: valueOf(code) }))
      .filter((d) => d.v != null && d.v > 0)
      .sort((a, b) => b.v - a.v)
      .slice(0, 10);
    $("top-year").textContent = `· ${year}`;
    const tbody = $("top-body");
    tbody.innerHTML = "";
    rows.forEach((d, i) => {
      const tr = document.createElement("tr");
      if (d.code === state.dep) tr.className = "sel";
      tr.innerHTML = `<td>${i + 1}</td><td>${names[d.code] || d.code}</td><td class="num">${nf.format(d.v)}</td>`;
      tr.addEventListener("click", () => selectDep(d.code));
      tbody.appendChild(tr);
    });
  }

  function renderAll() {
    $("year-badge").textContent = DATA.years[state.yearIndex];
    $("slider").value = state.yearIndex;
    renderMap();
    renderPanel();
  }

  /* ---------- Actions ---------- */

  function setYear(i) {
    if (i === state.yearIndex) return;
    state.yearIndex = i;
    renderAll();
  }

  function selectDep(code) {
    state.dep = state.dep === code ? null : code;
    renderAll();
  }

  function setSpecies(name) {
    state.species = name;
    recomputeScale();
    renderAll();
  }

  function togglePlay() {
    state.playing = !state.playing;
    $("play").textContent = state.playing ? "❚❚" : "▶";
    clearInterval(state.timer);
    if (!state.playing) return;
    if (state.yearIndex >= DATA.years.length - 1) state.yearIndex = -1;
    state.timer = setInterval(() => {
      if (state.yearIndex >= DATA.years.length - 1) { togglePlay(); return; }
      state.yearIndex += 1;
      renderAll();
    }, 350);
  }

  function setTheme(t) {
    document.documentElement.setAttribute("data-theme", t);
    try { localStorage.setItem("theme", t); } catch (e) {}
    recomputeScale();
    renderAll();
  }

  /* ---------- Initialisation ---------- */

  async function init() {
    const [geo, data] = await Promise.all([loadGeo(), fetchJSON(DATA_URL)]);
    DATA = data;

    // Métropole uniquement (les codes 97x sont les DOM)
    const features = geo.features.filter((f) => !String(f.properties.code).startsWith("97"));
    features.forEach((f) => { names[f.properties.code] = f.properties.nom; });

    // Sélecteur d'espèce
    const sel = $("species");
    Object.keys(DATA.especes).forEach((name) => {
      const o = document.createElement("option");
      o.value = name; o.textContent = name;
      sel.appendChild(o);
    });
    sel.addEventListener("change", () => setSpecies(sel.value));

    // Curseur d'années
    const n = DATA.years.length;
    const slider = $("slider");
    slider.max = n - 1;
    slider.addEventListener("input", () => { setYear(+slider.value); });
    $("year-min").textContent = DATA.years[0];
    $("year-max").textContent = DATA.years[n - 1];
    $("range").textContent = `${DATA.years[0]}–${DATA.years[n - 1]}`;

    // Carte (sans fond de tuiles : départements sur fond uni)
    map = L.map("map", { zoomSnap: 0.25, minZoom: 4, zoomControl: true, attributionControl: true });
    map.attributionControl.setPrefix("Leaflet");
    layer = L.geoJSON({ type: "FeatureCollection", features }, {
      style: () => ({}),
      onEachFeature: (f, l) => {
        layers[f.properties.code] = l;
        l.bindTooltip(() => {
          const code = f.properties.code;
          const v = valueOf(code);
          return `<strong>${f.properties.nom}</strong><br>` +
            (v == null ? "Pas de donnée" : `${nf.format(v)} prélèvements`) +
            ` en ${DATA.years[state.yearIndex]}`;
        }, { sticky: true, className: "dep-tip" });
        l.on("click", () => selectDep(f.properties.code));
      },
    }).addTo(map);
    map.fitBounds(layer.getBounds(), { padding: [8, 8] });

    state.yearIndex = n - 1;
    state.species = Object.keys(DATA.especes)[0];
    recomputeScale();
    renderAll();

    $("theme").addEventListener("click", () => setTheme(theme() === "dark" ? "light" : "dark"));
    $("play").addEventListener("click", togglePlay);
    $("reset").addEventListener("click", () => { state.dep = null; renderAll(); });
    window.addEventListener("resize", () => map.invalidateSize());
  }

  init().catch((e) => {
    console.error(e);
    $("big-number").textContent = "Erreur de chargement";
    $("big-caption").textContent = String(e.message || e) +
      " — lancez un serveur local (python -m http.server) plutôt que d'ouvrir le fichier directement.";
  });
})();
