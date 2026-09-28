(() => {
  "use strict";

  const cfg = window.VIETFLEX_CONFIG;
  const errorPanel = document.getElementById("errorPanel");
  const errorTitle = document.getElementById("errorTitle");
  const errorMessage = document.getElementById("errorMessage");

  function showError(title, message) {
    if (!errorPanel) return;
    if (errorTitle) errorTitle.textContent = title || "Không đọc được bản đồ";
    if (errorMessage) errorMessage.textContent = message || "Không xác định";
    errorPanel.hidden = false;
  }

  function withTimeout(promise, ms, label) {
    let timer;

    const timeout = new Promise((_, reject) => {
      timer = setTimeout(
        () => reject(new Error(`Hết thời gian chờ ${label}`)),
        ms
      );
    });

    return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
  }

  async function bootstrap() {
    try {
      if (!cfg) throw new Error("Thiếu cấu hình bản đồ.");
      if (!window.maplibregl) throw new Error("MapLibre GL JS chưa tải được.");
      if (!window.pmtiles) throw new Error("PMTiles JS chưa tải được.");

      const archiveUrl =
        `${cfg.r2BaseUrl.replace(/\/$/, "")}/${cfg.pmtilesObject}`;

      const protocol = new pmtiles.Protocol({ metadata: true });
      const archive = new pmtiles.PMTiles(archiveUrl);

      protocol.add(archive);
      maplibregl.addProtocol("pmtiles", protocol.tile);

      const header = await withTimeout(
        archive.getHeader(),
        cfg.probeTimeoutMs || 8000,
        cfg.pmtilesObject
      );

      if (!header || header.specVersion !== 3) {
        throw new Error("Archive PMTiles không hợp lệ.");
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
              maxzoom: cfg.maxSourceZoom
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

      map.addControl(
        new maplibregl.NavigationControl({ visualizePitch: true }),
        "bottom-right"
      );

      map.addControl(
        new maplibregl.FullscreenControl(),
        "bottom-right"
      );

      map.on("load", () => {
        map.resize();
      });

      map.on("error", (event) => {
        const message =
          event?.error?.message || "Không thể tải tile PMTiles.";

        console.error("Vietflex WebGIS:", event?.error || event);
        showError("Không tải được bản đồ", message);
      });

      window.__VIETFLEX_MAP__ = map;
      window.__VIETFLEX_PMTILES__ = {
        archive,
        archiveUrl,
        header
      };

      window.addEventListener("beforeunload", () => {
        maplibregl.removeProtocol("pmtiles");
      });
    } catch (error) {
      console.error(error);
      showError(
        "Không đọc được vietnam_biendong_webgis.pmtiles",
        error?.message || String(error)
      );
    }
  }

  bootstrap();
})();
