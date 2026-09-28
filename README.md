# Vietflex Basemap — PMTiles WebGIS

Static WebGIS cho **Vietflex Basemap**, tối ưu để chạy trực tiếp trên GitHub Pages với dữ liệu PMTiles đặt tại Cloudflare R2.

## Kiến trúc

```text
VIETFLEX BASEMAP
       │
    PMTiles
       │
 Cloudflare R2
       │
HTTP Range Request
       │
 PMTiles Protocol
       │
 MapLibre GL JS
       │
 ┌─────┴──────────┐
 ↓                ↓
Z3–Z11         Z12+
tile thật       overzoom
```

Không cần tile server riêng. Trình duyệt chỉ đọc các byte-range cần thiết trong archive PMTiles.

## Cấu hình dữ liệu

Chỉ cần sửa `config.js`:

```js
r2BaseUrl: "https://pub-40df081e07ea4052aeb0ac2c33ae3fb4.r2.dev",
pmtilesObject: "vietnam_biendong_webgis.pmtiles"
```

Nếu object trên R2 có tên khác, chỉ đổi `pmtilesObject`.

## Cloudflare R2 CORS Policy khuyến nghị

Production cho GitHub Pages:

```json
[
  {
    "AllowedOrigins": [
      "https://base27-cvnss.github.io"
    ],
    "AllowedMethods": [
      "GET",
      "HEAD"
    ],
    "AllowedHeaders": [
      "Range",
      "If-Range",
      "If-None-Match",
      "If-Modified-Since"
    ],
    "ExposeHeaders": [
      "Accept-Ranges",
      "Content-Range",
      "Content-Length",
      "Content-Type",
      "ETag",
      "Last-Modified"
    ],
    "MaxAgeSeconds": 86400
  }
]
```

**Quan trọng:** CORS Origin chỉ gồm scheme + host, không có `/mapbase/`. Vì vậy dùng `https://base27-cvnss.github.io`, không dùng `https://base27-cvnss.github.io/mapbase/`.

Nếu cần chạy local để kiểm thử, tạm thêm origin local đang dùng, ví dụ:

```json
"AllowedOrigins": [
  "https://base27-cvnss.github.io",
  "http://localhost:5500",
  "http://127.0.0.1:5500"
]
```

Sau khi deploy production nên bỏ các origin local.

## R2 object

Khuyến nghị:

- Object: `vietnam_biendong_webgis.pmtiles`
- Content-Type: `application/octet-stream`
- Không gzip/brotli toàn bộ file `.pmtiles` ở tầng object.
- Cho phép HTTP Range Request.
- Public URL dùng trong `config.js` phải trả được phản hồi `206 Partial Content` khi client gửi `Range`.

## Zoom

Nguồn có tile thật đến `maxzoom = 11`. MapLibre được phép zoom đến 18; từ Z12 trở lên, raster source tự overzoom từ tile cha Z11. Không cần sinh thêm Z12–Z18.

## GitHub Pages

Repository: `Base27-CVNSS/mapbase`

Sau khi có commit đầu tiên, bật Pages:

- Settings → Pages
- Source: `Deploy from a branch`
- Branch: `main`
- Folder: `/ (root)`

Trang dự kiến: `https://base27-cvnss.github.io/mapbase/`

## Kiểm tra Range/CORS

Trong DevTools → Network, request đến `.pmtiles` nên có các phản hồi range (thường `206`) và các header như `Content-Range`, `Accept-Ranges`.
