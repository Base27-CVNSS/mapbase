window.VIETFLEX_CONFIG = Object.freeze({
  r2BaseUrl: "https://pub-40df081e07ea4052aeb0ac2c33ae3fb4.r2.dev",

  // WebGIS sẽ thử lần lượt các tên này và dùng archive PMTiles đầu tiên hợp lệ.
  // Có thể ép tên file bằng URL: ?pmtiles=ten-file.pmtiles
  pmtilesCandidates: [
    "vietnam_biendong_webgis.pmtiles",
    "vietnam_biendong_z11.pmtiles",
    "vietnam_biendong.pmtiles",
    "vietnam_biendong_optimized.pmtiles",
    "VietflexBasemap.pmtiles",
    "vietflex_basemap.pmtiles"
  ],

  expectedMinZoom: 3,
  expectedMaxZoom: 11,
  mapMaxZoom: 18,

  center: [108.2, 15.7],
  zoom: 4.7,
  bounds: [92.0, -2.0, 126.0, 26.0],

  attribution: "Vietflex Basemap",
  probeTimeoutMs: 8000
});
