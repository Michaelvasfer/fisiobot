// Genera los íconos PNG de la PWA sin dependencias (zlib de Node).
// Ícono: cuadrado verde del consultorio con una cruz médica blanca.
const zlib = require('zlib');
const fs = require('fs');
const path = require('path');

const VERDE = [7, 94, 84]; // #075e54
const BLANCO = [255, 255, 255];

function crc32(buf) {
  let tabla = crc32.tabla;
  if (!tabla) {
    tabla = crc32.tabla = new Int32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      tabla[n] = c;
    }
  }
  let crc = -1;
  for (let i = 0; i < buf.length; i++) crc = (crc >>> 8) ^ tabla[(crc ^ buf[i]) & 0xff];
  return (crc ^ -1) >>> 0;
}

function chunk(tipo, datos) {
  const buf = Buffer.alloc(8 + datos.length + 4);
  buf.writeUInt32BE(datos.length, 0);
  buf.write(tipo, 4);
  datos.copy(buf, 8);
  buf.writeUInt32BE(crc32(Buffer.concat([Buffer.from(tipo), datos])), 8 + datos.length);
  return buf;
}

function generarIcono(tam, rutaSalida) {
  // Fila de píxeles RGBA con filtro 0 al inicio.
  const cruzAncho = Math.round(tam * 0.18);
  const cruzLargo = Math.round(tam * 0.62);
  const centro = tam / 2;
  const raw = Buffer.alloc(tam * (1 + tam * 4));
  for (let y = 0; y < tam; y++) {
    const fila = y * (1 + tam * 4);
    raw[fila] = 0;
    for (let x = 0; x < tam; x++) {
      const enVertical = Math.abs(x - centro) <= cruzAncho / 2 && Math.abs(y - centro) <= cruzLargo / 2;
      const enHorizontal = Math.abs(y - centro) <= cruzAncho / 2 && Math.abs(x - centro) <= cruzLargo / 2;
      const color = enVertical || enHorizontal ? BLANCO : VERDE;
      const p = fila + 1 + x * 4;
      raw[p] = color[0];
      raw[p + 1] = color[1];
      raw[p + 2] = color[2];
      raw[p + 3] = 255;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(tam, 0);
  ihdr.writeUInt32BE(tam, 4);
  ihdr[8] = 8; // profundidad de bits
  ihdr[9] = 6; // RGBA
  const png = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
  fs.mkdirSync(path.dirname(rutaSalida), { recursive: true });
  fs.writeFileSync(rutaSalida, png);
  console.log(`OK ${rutaSalida} (${png.length} bytes)`);
}

generarIcono(192, path.join(__dirname, '..', 'public', 'pwa', 'icon-192.png'));
generarIcono(512, path.join(__dirname, '..', 'public', 'pwa', 'icon-512.png'));
