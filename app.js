(() => {
  "use strict";

  const cfg = window.VIETFLEX_CONFIG;
  if (!cfg) throw new Error("Thiếu VIETFLEX_CONFIG trong config.js");

  const archiveUrl = `${cfg.r2BaseUrl.replace(/\/$/, "")}/${cfg.pmtilesObject}`;
  const protocol = new pmtiles.Protocol();
  maplibregl.addProtocol("pmtiles", protocol.tile);

  const sourceState = document.getElementById("sourceState");
  const errorPanel = document.getElementById("errorPanel");
  const errorMessage = document.getElementById("errorMessage");
  const zoomValue = document.getElementById("zoomValue");
  const zoomMode = document.getElementById("zoomMode");
  const coordValue = document.getElementById("coordValue");

  function setState(state, text) {
    sourceState.dataset.state = state;
    sourceState.textContent = text;
  }

  function showError(message) {
    setState("error", "Lỗi nguồn dữ liệu");
    errorMessage.textContent = message || "Không xác định";
    errorPanel.hidden = false;
  }

  const map = new maplibregl.Map({
    container: "map",
    center: cfg.center,
    zoom: cfg.zoom,
    minZoom: cfg.minSourceZoom,
    maxZoom: cfg.mapMaxZoom,
    attributionControl: false,
    renderWorldCopies: false,
    style: {
      version: 8,
      sources: {
        vietflex: {
          type: "raster",
          url: `pmtiles://${archiveUrl}`,
          tileSize: 256,
          minzoom: cfg.minSourceZoom,
          maxzoom: cfg.maxSourceZoom,
          attribution: cfg.attribution
        }
      },
      layers: [
        {
          id: "vietflex-basemap",
          type: "raster",
          source: "vietflex",
          minzoom: cfg.minSourceZoom,
          paint: {
            "raster-opacity": 1,
            "raster-fade-duration": 0,
            "raster-resampling": "linear"
          }
        }
      ]
    }
  });

  map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), "bottom-right");
  map.addControl(new maplibregl.FullscreenControl(), "bottom-right");
  map.addControl(new maplibregl.ScaleControl({ maxWidth: 120, unit: "metric" }), "bottom-left");
  map.addControl(new maplibregl.AttributionControl({ compact: true }), "bottom-right");

  function updateZoomState() {
    const z = map.getZoom();
    zoomValue.textContent = z.toFixed(2);
    if (z <= cfg.maxSourceZoom) {
      zoomMode.textContent = `Tile thật Z${Math.floor(z)}`;
      zoomMode.dataset.mode = "native";
    } else {
      zoomMode.textContent = `Overzoom từ Z${cfg.maxSourceZoom}`;
      zoomMode.dataset.mode = "overzoom";
    }
  }

  map.on("load", () => {
    setState("ok", "PMTiles sẵn sàng");
    updateZoomState();
  });

  map.on("zoom", updateZoomState);

  map.on("mousemove", (event) => {
    coordValue.textContent = `${event.lngLat.lat.toFixed(5)}, ${event.lngLat.lng.toFixed(5)}`;
  });

  map.on("error", (event) => {
    const message = event?.error?.message || "MapLibre không thể tải dữ liệu bản đồ.";
    console.error("Vietflex WebGIS:", event?.error || event);
    if (/pmtiles|fetch|source|network|cors|range/i.test(message)) showError(message);
  });

  document.getElementById("fitBtn").addEventListener("click", () => {
    map.fitBounds(
      [[cfg.bounds[0], cfg.bounds[1]], [cfg.bounds[2], cfg.bounds[3]]],
      { padding: 36, duration: 900 }
    );
  });

  window.addEventListener("beforeunload", () => {
    maplibregl.removeProtocol("pmtiles");
  });
})();
