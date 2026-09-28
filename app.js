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
    errorHint.textContent = hint || "Kiểm tra R2 CORS và HTTP Range Request.";
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

  async function bootstrap() {
    try {
      if (!cfg) throw new Error("Thiếu VIETFLEX_CONFIG.");
      if (!window.maplibregl) throw new Error("MapLibre GL JS chưa tải được.");
      if (!window.pmtiles) throw new Error("PMTiles JS chưa tải được.");

      clearError();

      const archiveUrl =
        `${cfg.r2BaseUrl.replace(/\/$/, "")}/${cfg.pmtilesObject}`;

      setState(
        "loading",
        `Đang kết nối ${cfg.pmtilesObject}`
      );

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
        throw new Error("Archive không phải PMTiles v3 hợp lệ.");
      }

      if (header.minZoom !== cfg.minSourceZoom || header.maxZoom !== cfg.maxSourceZoom) {
        console.warn(
          `PMTiles header báo Z${header.minZoom}–Z${header.maxZoom}; cấu hình yêu cầu Z${cfg.minSourceZoom}–Z${cfg.maxSourceZoom}.`
        );
      }

      // PMTiles v3 tileType 4 = WebP.
      if (header.tileType !== 4) {
        console.warn(
          `PMTiles header tileType=${header.tileType}; cấu hình dự kiến WebP (tileType=4).`
        );
      }

      setState(
        "ok",
        `${cfg.pmtilesObject} · Z${cfg.minSourceZoom}–Z${cfg.maxSourceZoom} · ${cfg.tileFormat}`
      );

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

      map.addControl(
        new maplibregl.NavigationControl({ visualizePitch: true }),
        "bottom-right"
      );

      map.addControl(
        new maplibregl.FullscreenControl(),
        "bottom-right"
      );

      map.addControl(
        new maplibregl.ScaleControl({
          maxWidth: 120,
          unit: "metric"
        }),
        "bottom-left"
      );

      map.addControl(
        new maplibregl.AttributionControl({
          compact: true
        }),
        "bottom-right"
      );

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
          "Không tải được Vietflex Basemap",
          message,
          "Nguồn đã khóa cố định: vietnam_biendong_webgis.pmtiles. Kiểm tra object này trên R2 và CORS phải cho phép Range Request từ https://base27-cvnss.github.io."
        );
      });

      fitBtn.addEventListener("click", () => {
        map.fitBounds(
          [
            [cfg.bounds[0], cfg.bounds[1]],
            [cfg.bounds[2], cfg.bounds[3]]
          ],
          {
            padding: 36,
            duration: 800
          }
        );
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
        error?.message || String(error),
        "WebGIS không còn dò tên file khác. Hãy bảo đảm object R2 tồn tại đúng tên vietnam_biendong_webgis.pmtiles và CORS cho phép HTTP Range Request."
      );
    }
  }

  bootstrap();
})();
