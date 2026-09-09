export type ImageDimensions = { width: number; height: number };
export type PngMetadata = ImageDimensions & { hasTransparency: boolean };

export function parsePngMetadata(bytes: Buffer): PngMetadata | null {
  const pngSignature = [
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
  ];
  if (bytes.length < 8) {
    return null;
  }

  for (let i = 0; i < pngSignature.length; i += 1) {
    if (bytes[i] !== pngSignature[i]) {
      return null;
    }
  }

  let width = 0;
  let height = 0;
  let hasTRNS = false;
  let colorType = -1;
  let offset = 8;
  let hasImageData = false;
  let hasEnd = false;

  while (offset + 12 <= bytes.length) {
    const chunkLength = bytes.readUInt32BE(offset);
    const chunkType = bytes.toString("ascii", offset + 4, offset + 8);
    const chunkDataStart = offset + 8;
    const chunkDataEnd = chunkDataStart + chunkLength;
    const nextChunkOffset = chunkDataEnd + 4;

    if (nextChunkOffset > bytes.length) {
      return null;
    }

    if (offset === 8 && chunkType !== "IHDR") return null;
    if (chunkType === "IHDR") {
      if (offset !== 8 || chunkLength !== 13) {
        return null;
      }
      width = bytes.readUInt32BE(chunkDataStart);
      height = bytes.readUInt32BE(chunkDataStart + 4);
      colorType = bytes[chunkDataStart + 9];
    } else if (chunkType === "tRNS") {
      hasTRNS = true;
    } else if (chunkType === "IDAT") {
      hasImageData = hasImageData || chunkLength > 0;
    } else if (chunkType === "IEND") {
      hasEnd = chunkLength === 0 && nextChunkOffset === bytes.length;
      break;
    }

    offset = nextChunkOffset;
  }

  if (!width || !height || !hasImageData || !hasEnd || ![0, 2, 3, 4, 6].includes(colorType)) {
    return null;
  }

  const hasAlphaChannel = colorType === 4 || colorType === 6;
  return {
    width,
    height,
    hasTransparency: hasAlphaChannel || hasTRNS,
  };
}

function parseJpegDimensions(bytes: Buffer): ImageDimensions | null {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) {
    return null;
  }

  const sofMarkers = new Set([
    0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce,
    0xcf,
  ]);

  let offset = 2;
  while (offset + 3 < bytes.length) {
    if (bytes[offset] !== 0xff) {
      offset += 1;
      continue;
    }

    const marker = bytes[offset + 1];
    offset += 2;

    if (marker === 0xd8 || marker === 0xd9) {
      continue;
    }

    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      continue;
    }

    if (offset + 2 > bytes.length) {
      return null;
    }

    const segmentLength = bytes.readUInt16BE(offset);
    if (segmentLength < 2 || offset + segmentLength > bytes.length) {
      return null;
    }

    if (sofMarkers.has(marker)) {
      if (segmentLength < 7) {
        return null;
      }

      const height = bytes.readUInt16BE(offset + 3);
      const width = bytes.readUInt16BE(offset + 5);
      if (!width || !height) {
        return null;
      }
      return { width, height };
    }

    offset += segmentLength;
  }

  return null;
}

export function parseImageDimensions(bytes: Buffer, mimeType: string): ImageDimensions | null {
  if (mimeType === "image/png") {
    const png = parsePngMetadata(bytes);
    if (!png) {
      return null;
    }
    return { width: png.width, height: png.height };
  }

  if (mimeType === "image/jpeg" || mimeType === "image/jpg") {
    return parseJpegDimensions(bytes);
  }

  return null;
}
