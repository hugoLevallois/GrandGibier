/* map.js — carte Leaflet, état partagé (années, départements, espèces cochées), animation. */
(function () {
  const { nf, makeColorScale, updateLegend, drawLine } = Charts;

  const GEO_LOCAL = "data/departements.geojson";
  const GEO_REMOTE =
    "https://raw.githubusercontent.com/gregoiredavid/france-geojson/master/departements-version-simplifiee.geojson";
  const DATA_URL = "data/prelevements.json";

  // selected : espèces cochées (la carte affiche leur somme par département)
  const state = { selected: new Set(), mapMode: null, yearIndex: 0, dep: null, playing: false, timer: null };
  let DATA, map, layer, scale, maxValue, ALL = [];
  const layers = {};   // code -> couche Leaflet
  const names = {};    // code -> nom

  const $ = (id) => document.getElementById(id);
  const css = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  const theme = () => document.documentElement.getAttribute("data-theme") || "light";
  const colorOf = (sp) => css("--sp-" + (ALL.indexOf(sp) % 6));

  const hasDeptData = (sp) => !!DATA.especes[sp];
  const selectedDept = () => [...state.selected].filter(hasDeptData);
  // Espèce(s) colorant la carte : une seule, ou la somme des cochées
  function mapSpecies() {
    const d = selectedDept();
    if (state.mapMode === "__sum" && d.length > 1) return d;
    if (d.includes(state.mapMode)) return [state.mapMode];
    return d.slice(0, 1);
  }
  const mapLabel = () => {
    const m = mapSpecies();
    return m.length > 1 ? "somme des espèces cochées" : (m[0] || "aucune donnée par département");
  };

  function syncMapSelect() {
    const d = selectedDept();
    const sel = $("map-species");
    if (state.mapMode !== "__sum" && !d.includes(state.mapMode)) state.mapMode = d[0] || null;
    if (state.mapMode === "__sum" && d.length < 2) state.mapMode = d[0] || null;
    sel.innerHTML = "";
    d.forEach((sp) => sel.add(new Option(sp, sp)));
    if (d.length > 1) sel.add(new Option("Somme des espèces cochées", "__sum"));
    sel.value = state.mapMode || "";
    sel.disabled = d.length === 0;
  }

  const nulls = () => DATA.years.map(() => null);

  // Somme de plusieurs séries ; null si aucune valeur à cette année
  function sumSeries(list) {
    return DATA.years.map((_, i) => {
      let sum = 0, any = false;
      for (const s of list) { const v = s[i]; if (v != null) { sum += v; any = true; } }
      return any ? sum : null;
    });
  }

  // Valeur d'un département pour les espèces cochées
  function valueOf(code, i = state.yearIndex) {
    let sum = 0, any = false;
    for (const sp of mapSpecies()) {
      const s = DATA.especes[sp][code];
      const v = s ? s[i] : null;
      if (v != null) { sum += v; any = true; }
    }
    return any ? sum : null;
  }

  // Série nationale d'une espèce (mouflon : fournie ; autres : somme des départements)
  function nationalSeries(sp) {
    if (DATA.nationales[sp]) return DATA.nationales[sp];
    return sumSeries(Object.values(DATA.especes[sp]));
  }

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
    const codes = new Set();
    mapSpecies().forEach((sp) => Object.keys(DATA.especes[sp]).forEach((c) => codes.add(c)));
    codes.forEach((code) => {
      DATA.years.forEach((_, i) => {
        const v = valueOf(code, i);
        if (v != null && v > maxValue) maxValue = v;
      });
    });
    scale = makeColorScale(maxValue, theme());
    updateLegend(scale, maxValue);
    $("legend-title").textContent = "Carte : " + mapLabel();
  }

  function renderMap() {
    layer.setStyle(styleFor);
    if (state.dep && layers[state.dep]) layers[state.dep].bringToFront();
  }

  function renderPanel() {
    const years = DATA.years;
    const year = years[state.yearIndex];
    const picked = [...state.selected];

    // Séries du graphique : une courbe par espèce cochée
    const list = picked.map((sp) => ({
      name: sp,
      color: colorOf(sp),
      values: state.dep
        ? (hasDeptData(sp) ? (DATA.especes[sp][state.dep] || nulls()) : nulls())
        : nationalSeries(sp),
    }));
    const total = sumSeries(list.map((s) => s.values))[state.yearIndex];

    $("chart-title").textContent = state.dep ? `${names[state.dep]} (${state.dep})` : "France entière";
    $("reset").hidden = !state.dep;
    $("big-number").textContent = total == null ? "Pas de donnée" : nf.format(total);
    $("big-caption").textContent =
      `prélèvements en ${year} · ${picked.join(" + ")}`;
    drawLine($("chart"), years, list, state.yearIndex, setYear);

    // Légende du graphique
    const lg = document.createElement("div");
    lg.className = "chart-legend";
    list.forEach((s) => {
      const span = document.createElement("span");
      span.innerHTML = `<i style="background:${s.color}"></i>${s.name}`;
      lg.appendChild(span);
    });
    $("chart").appendChild(lg);

    const natOnly = picked.filter((sp) => !hasDeptData(sp));
    $("chart-note").textContent = state.dep && natOnly.length
      ? `${natOnly.join(", ")} : données nationales uniquement, pas de détail par département.`
      : "";
    $("species-note").textContent = natOnly.length
      ? `${natOnly.join(", ")} : données nationales uniquement. Visible dans le graphique « France entière », absent de la carte.`
      : "";

    // Top 10 (espèces cochées avec données départementales)
    const rows = Object.keys(names)
      .map((code) => ({ code, v: valueOf(code) }))
      .filter((d) => d.v != null && d.v > 0)
      .sort((a, b) => b.v - a.v)
      .slice(0, 10);
    $("top-year").textContent = `· ${mapLabel()} · ${year}`;
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

  function buildSpeciesList() {
    const box = $("species-list");
    box.innerHTML = "";
    ALL.forEach((sp) => {
      const label = document.createElement("label");
      label.className = "sp-chip";
      label.style.setProperty("--c", colorOf(sp));
      label.innerHTML = `<input type="checkbox" value="${sp}"><i></i>${sp}`;
      const input = label.querySelector("input");
      input.checked = state.selected.has(sp);
      input.addEventListener("change", () => {
        if (input.checked) state.selected.add(sp);
        else if (state.selected.size > 1) state.selected.delete(sp);
        else input.checked = true;   // garde au moins une espèce
        syncMapSelect();
        recomputeScale();
        renderAll();
      });
      box.appendChild(label);
    });
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
    buildSpeciesList();   // les couleurs d'espèces dépendent du thème
    recomputeScale();
    renderAll();
  }

  /* ---------- Initialisation ---------- */

  async function init() {
    const [geo, data] = await Promise.all([loadGeo(), fetchJSON(DATA_URL)]);
    DATA = data;
    DATA.nationales = DATA.nationales || {};
    ALL = [...Object.keys(DATA.especes), ...Object.keys(DATA.nationales)].sort();

    // Métropole uniquement (les codes 97x sont les DOM)
    const features = geo.features.filter((f) => !String(f.properties.code).startsWith("97"));
    features.forEach((f) => { names[f.properties.code] = f.properties.nom; });

    // Espèce cochée par défaut : la première avec données départementales
    state.selected.add(Object.keys(DATA.especes)[0]);
    buildSpeciesList();
    syncMapSelect();
    $("map-species").addEventListener("change", (e) => {
      state.mapMode = e.target.value;
      recomputeScale();
      renderAll();
    });

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
