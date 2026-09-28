(() => {
  "use strict";

  const cfg = window.VIETFLEX_CONFIG;
  const $ = (id) => document.getElementById(id);

  const sourceState = $("sourceState");
  const errorPanel = $("errorPanel");
  const errorTitle = $("errorTitle");
  const errorMessage = $("errorMessage");
  const errorHint = $("errorHint");
  const zoomValue = $("zoomValue");
  const zoomMode = $("zoomMode");
  const coordValue = $("coordValue");
  const fitBtn = $("fitBtn");

  function setState(state, text) {
    sourceState.dataset.state = state;
    sourceState.textContent = text;
  }

  function showError(title, message, hint) {
    setState("error", "Lỗi nguồn dữ liệu");
    errorTitle.textContent = title || "Không đọc được PMTiles";
    errorMessage.textContent = message || "Không xác định";
    errorHint.textContent = hint || "Kiểm tra object R2 và CORS/Range Request.";
    errorPanel.hidden = false;
  }

  function clearError() {
    errorPanel.hidden = true;
    errorMessage.textContent = "";
  }

  function withTimeout(promise, ms, label) {
    let timer;
    const timeout = new Promise((_, reject) => {
      timer = setTimeout(
        () => reject(new Error(`Hết thời gian chờ ${label} sau ${Math.round(ms / 1000)} giây`)),
        ms
      );
    });

    return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
  }

  function tileTypeName(tileType) {
    return ({
      1: "MVT",
      2: "PNG",
      3: "JPEG",
      4: "WebP",
      5: "AVIF",
      6: "MLT"
    })[tileType] || `type ${tileType}`;
  }

  function candidateNames() {
    const qs = new URLSearchParams(location.search);
    const forced = qs.get("pmtiles");
    const names = [];

    if (forced) {
      names.push(forced.trim());
    }

    for (const name of cfg.pmtilesCandidates || []) {
      if (name && !names.includes(name)) names.push(name);
    }

    return names;
  }

  async function resolveArchive(protocol) {
    const base = cfg.r2BaseUrl.replace(/\/$/, "");
    const failures = [];

    for (const name of candidateNames()) {
      const archiveUrl = `${base}/${encodeURIComponent(name).replace(/%2F/gi, "/")}`;
      setState("loading", `Kiểm tra ${name}`);

      try {
        const archive = new pmtiles.PMTiles(archiveUrl);
        protocol.add(archive);

        const header = await withTimeout(
          archive.getHeader(),
          cfg.probeTimeoutMs || 8000,
          name
        );

        if (!header || header.specVersion !== 3) {
          throw new Error("Không phải PMTiles v3 hợp lệ");
        }

        return { name, archiveUrl, archive, header };
      } catch (error) {
        failures.push(`${name}: ${error?.message || error}`);
      }
    }

    throw new Error(failures.join(" | "));
  }

  async function bootstrap() {
    try {
      if (!cfg) throw new Error("Thiếu VIETFLEX_CONFIG.");
      if (!window.maplibregl) throw new Error("MapLibre GL JS chưa tải được.");
      if (!window.pmtiles) throw new Error("PMTiles JS chưa tải được.");

      clearError();

      // metadata:true cho phép PMTiles Protocol tạo TileJSON đầy đủ hơn.
      const protocol = new pmtiles.Protocol({ metadata: true });
      maplibregl.addProtocol("pmtiles", protocol.tile);

      const resolved = await resolveArchive(protocol);
      const { archiveUrl, name, header } = resolved;

      const sourceMinZoom = Number.isFinite(header.minZoom)
        ? header.minZoom
        : cfg.expectedMinZoom;

      const sourceMaxZoom = Number.isFinite(header.maxZoom)
        ? header.maxZoom
        : cfg.expectedMaxZoom;

      setState(
        "ok",
        `${name} · Z${sourceMinZoom}–Z${sourceMaxZoom} · ${tileTypeName(header.tileType)}`
      );

      const initialCenter =
        Number.isFinite(header.centerLon) && Number.isFinite(header.centerLat)
          ? [header.centerLon, header.centerLat]
          : cfg.center;

      const map = new maplibregl.Map({
        container: "map",
        center: initialCenter,
        zoom: cfg.zoom,
        minZoom: Math.max(0, sourceMinZoom),
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
              attribution: cfg.attribution
            }
          },
          layers: [
            {
              id: "vietflex-basemap",
              type: "raster",
              source: "vietflex",
              paint: {
                "raster-opacity": 1,
                "raster-fade-duration": 0,
                "raster-resampling": "linear"
              }
            }
          ]
        }
      });

      map.addControl(
        new maplibregl.NavigationControl({ visualizePitch: true }),
        "bottom-right"
      );
      map.addControl(new maplibregl.FullscreenControl(), "bottom-right");
      map.addControl(
        new maplibregl.ScaleControl({ maxWidth: 120, unit: "metric" }),
        "bottom-left"
      );
      map.addControl(
        new maplibregl.AttributionControl({ compact: true }),
        "bottom-right"
      );

      function updateZoomState() {
        const z = map.getZoom();
        zoomValue.textContent = z.toFixed(2);

        if (z <= sourceMaxZoom) {
          zoomMode.textContent = `Tile thật Z${Math.floor(z)}`;
          zoomMode.dataset.mode = "native";
        } else {
          zoomMode.textContent = `Overzoom từ Z${sourceMaxZoom}`;
          zoomMode.dataset.mode = "overzoom";
        }
      }

      map.on("load", () => {
        updateZoomState();
        map.resize();
      });

      map.on("zoom", updateZoomState);

      map.on("mousemove", (event) => {
        coordValue.textContent =
          `${event.lngLat.lat.toFixed(5)}, ${event.lngLat.lng.toFixed(5)}`;
      });

      map.on("error", (event) => {
        const message =
          event?.error?.message || "MapLibre không thể tải tile PMTiles.";

        console.error("Vietflex WebGIS:", event?.error || event);
        showError(
          "MapLibre không tải được tile",
          message,
          "Nếu header PMTiles đã đọc được nhưng tile không hiện, kiểm tra CORS của R2 và phản hồi HTTP 206 Partial Content."
        );
      });

      fitBtn.addEventListener("click", () => {
        map.fitBounds(
          [
            [cfg.bounds[0], cfg.bounds[1]],
            [cfg.bounds[2], cfg.bounds[3]]
          ],
          { padding: 36, duration: 800 }
        );
      });

      window.__VIETFLEX_MAP__ = map;
      window.__VIETFLEX_PMTILES__ = resolved;

      window.addEventListener("beforeunload", () => {
        maplibregl.removeProtocol("pmtiles");
      });
    } catch (error) {
      console.error(error);

      showError(
        "Không tìm thấy archive PMTiles hợp lệ",
        error?.message || String(error),
        "WebGIS đã thử các tên file phổ biến trên R2. Nếu file có tên khác, mở trang với ?pmtiles=TEN_FILE.pmtiles hoặc sửa pmtilesCandidates trong config.js. CORS R2 phải cho phép origin https://base27-cvnss.github.io."
      );
    }
  }

  bootstrap();
})();
