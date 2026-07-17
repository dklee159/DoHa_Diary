// PWA 아이콘 생성기 — 의존성 없이 PNG를 직접 인코딩한다.
// 살구빛 배경 위 로즈 하트(음함수 곡선)를 픽셀로 그린다.
import { deflateSync } from 'node:zlib'
import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const outDir = join(here, '..', 'public')
mkdirSync(outDir, { recursive: true })

const BG = [0xff, 0xf9, 0xf7]
const HEART = [0xe4, 0x72, 0x8c]
const HEART_DEEP = [0xc9, 0x54, 0x74]

// (x²+y²-1)³ - x²y³ ≤ 0 이면 하트 내부
function inHeart(nx, ny) {
  const a = nx * nx + ny * ny - 1
  return a * a * a - nx * nx * ny * ny * ny <= 0
}

function drawIcon(size) {
  const px = Buffer.alloc(size * size * 4)
  const cx = size / 2
  const cy = size / 2 + size * 0.02
  const scale = size * 0.30 // safe zone(80%) 안에 들어오는 크기

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4
      // 정규화 좌표 (하트 방정식은 y가 위로 갈수록 +)
      const nx = (x - cx) / scale
      const ny = (cy - y) / scale
      let color = BG
      if (inHeart(nx, ny)) {
        // 왼쪽 위에서 빛이 드는 느낌의 미묘한 투톤
        color = ny - nx * 0.4 > 0.25 ? HEART : HEART_DEEP
      }
      px[i] = color[0]
      px[i + 1] = color[1]
      px[i + 2] = color[2]
      px[i + 3] = 255
    }
  }
  return px
}

// ── 최소 PNG 인코더 ──────────────────────────
const CRC_TABLE = new Int32Array(256).map((_, n) => {
  let c = n
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  return c
})

function crc32(buf) {
  let c = 0xffffffff
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const out = Buffer.alloc(12 + data.length)
  out.writeUInt32BE(data.length, 0)
  out.write(type, 4, 'ascii')
  data.copy(out, 8)
  out.writeUInt32BE(crc32(out.subarray(4, 8 + data.length)), 8 + data.length)
  return out
}

function encodePng(px, size) {
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 6 // RGBA
  // 행마다 필터 바이트(0) 삽입
  const raw = Buffer.alloc(size * (size * 4 + 1))
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0
    px.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4)
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

for (const [name, size] of [
  ['icon-192.png', 192],
  ['icon-512.png', 512],
  ['apple-touch-icon.png', 180],
]) {
  writeFileSync(join(outDir, name), encodePng(drawIcon(size), size))
  console.log(`생성: public/${name} (${size}x${size})`)
}
