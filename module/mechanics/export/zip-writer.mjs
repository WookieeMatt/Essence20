/**
 * A plain .zip of files, stored without compression (Export Homebrew's download, apps/homebrew-export.mjs). Every unzip
 * tool and Foundry's own module installer read stored entries; packs and images gain little from deflate anyway.
 *
 * Format: PKWARE APPNOTE - a local header and the bytes per file, then the central directory and its end record. Names
 * are UTF-8 (flag bit 11). No zip64, so under 65535 files and 4 GiB.
 * Import-free: jest runs it as is.
 */

const CRC32_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
    }

    table[n] = c >>> 0;
  }

  return table;
})();

/**
 * CRC-32, as zip checks each file.
 * @param {Uint8Array} bytes
 * @returns {Number}
 */
export function crc32(bytes) {
  let crc = 0xFFFFFFFF;
  for (const byte of bytes) {
    crc = CRC32_TABLE[(crc ^ byte) & 0xFF] ^ (crc >>> 8);
  }

  return (crc ^ 0xFFFFFFFF) >>> 0;
}

/** MS-DOS time and date words for a Date. */
function dosDateTime(date) {
  const year = Math.max(date.getFullYear(), 1980);
  return {
    time: (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2),
    date: ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate(),
  };
}

/**
 * A zip holding these files.
 * @param {Array<{path: String, data: Uint8Array|String}>} files   Paths use "/", relative to the zip's root.
 * @param {Date} [when]   The files' modified time.
 * @returns {Uint8Array}
 */
export function zipFiles(files, when = new Date()) {
  if (files.length >= 0xFFFF) {
    throw new Error('Essence20 | zipFiles: too many files for a zip without zip64');
  }

  // Made here, not at load: settings.js loads this, and jsdom test environments have no TextEncoder.
  const encoder = new TextEncoder();
  const { time, date } = dosDateTime(when);
  const locals = [];
  const centrals = [];
  let offset = 0;
  for (const file of files) {
    const name = encoder.encode(file.path);
    const data = file.data instanceof Uint8Array ? file.data : encoder.encode(String(file.data ?? ''));
    const crc = crc32(data);

    const local = new Uint8Array(30 + name.length);
    const lv = new DataView(local.buffer);
    lv.setUint32(0, 0x04034B50, true);
    lv.setUint16(4, 20, true); // version needed
    lv.setUint16(6, 0x0800, true); // UTF-8 names
    lv.setUint16(8, 0, true); // stored
    lv.setUint16(10, time, true);
    lv.setUint16(12, date, true);
    lv.setUint32(14, crc, true);
    lv.setUint32(18, data.length, true);
    lv.setUint32(22, data.length, true);
    lv.setUint16(26, name.length, true);
    lv.setUint16(28, 0, true);
    local.set(name, 30);
    locals.push(local, data);

    const central = new Uint8Array(46 + name.length);
    const cv = new DataView(central.buffer);
    cv.setUint32(0, 0x02014B50, true);
    cv.setUint16(4, 20, true); // made by
    cv.setUint16(6, 20, true);
    cv.setUint16(8, 0x0800, true);
    cv.setUint16(10, 0, true);
    cv.setUint16(12, time, true);
    cv.setUint16(14, date, true);
    cv.setUint32(16, crc, true);
    cv.setUint32(20, data.length, true);
    cv.setUint32(24, data.length, true);
    cv.setUint16(28, name.length, true);
    cv.setUint32(42, offset, true);
    central.set(name, 46);
    centrals.push(central);

    offset += local.length + data.length;
  }

  const centralSize = centrals.reduce((sum, part) => sum + part.length, 0);
  const end = new Uint8Array(22);
  const ev = new DataView(end.buffer);
  ev.setUint32(0, 0x06054B50, true);
  ev.setUint16(8, files.length, true);
  ev.setUint16(10, files.length, true);
  ev.setUint32(12, centralSize, true);
  ev.setUint32(16, offset, true);

  const parts = [...locals, ...centrals, end];
  const out = new Uint8Array(offset + centralSize + end.length);
  let at = 0;
  for (const part of parts) {
    out.set(part, at);
    at += part.length;
  }

  return out;
}
