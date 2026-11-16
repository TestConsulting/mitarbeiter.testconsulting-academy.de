import { inflateRawSync } from "node:zlib";

const attachmentContentTypes: Record<string, string> = {
  ".gif": "image/gif",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".pdf": "application/pdf",
  ".png": "image/png",
  ".webp": "image/webp",
  ".xls": "application/vnd.ms-excel",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
};

function crc32(content: Buffer): number {
  let crc = 0xffffffff;
  for (const byte of content) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ ((crc & 1) === 1 ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

export function parseAttachmentFileName(encodedName: string | undefined): string | null {
  if (!encodedName || encodedName.length > 2048) return null;

  let fileName: string;
  try {
    fileName = decodeURIComponent(encodedName).normalize("NFC").trim();
  } catch {
    return null;
  }

  if (
    !fileName ||
    [...fileName].length > 255 ||
    /[\u0000-\u001f\u007f/\\]/.test(fileName) ||
    fileName === "." ||
    fileName === ".."
  ) {
    return null;
  }
  return fileName;
}

export function getAttachmentContentType(fileName: string): string | null {
  const extension = fileName.match(/\.[^.]+$/)?.[0].toLowerCase();
  return extension ? attachmentContentTypes[extension] ?? null : null;
}

function isXlsxArchive(content: Buffer): boolean {
  if (content.length < 4 + 22 || content.readUInt32LE(0) !== 0x04034b50) return false;

  const minimumEocdOffset = Math.max(0, content.length - 22 - 0xffff);
  let eocdOffset = -1;
  for (let offset = content.length - 22; offset >= minimumEocdOffset; offset -= 1) {
    if (content.readUInt32LE(offset) === 0x06054b50) {
      const commentLength = content.readUInt16LE(offset + 20);
      if (offset + 22 + commentLength === content.length) {
        eocdOffset = offset;
        break;
      }
    }
  }
  if (eocdOffset < 0) return false;

  const diskNumber = content.readUInt16LE(eocdOffset + 4);
  const centralDirectoryDisk = content.readUInt16LE(eocdOffset + 6);
  const entriesOnDisk = content.readUInt16LE(eocdOffset + 8);
  const entryCount = content.readUInt16LE(eocdOffset + 10);
  const centralDirectorySize = content.readUInt32LE(eocdOffset + 12);
  const centralDirectoryOffset = content.readUInt32LE(eocdOffset + 16);
  if (
    diskNumber !== 0 ||
    centralDirectoryDisk !== 0 ||
    entriesOnDisk !== entryCount ||
    entryCount === 0 ||
    entryCount === 0xffff ||
    centralDirectorySize === 0xffffffff ||
    centralDirectoryOffset === 0xffffffff ||
    centralDirectoryOffset + centralDirectorySize > eocdOffset
  ) {
    return false;
  }

  const requiredEntries = new Set(["[Content_Types].xml", "xl/workbook.xml"]);
  const packageParts = new Map<string, Buffer>();
  let offset = centralDirectoryOffset;
  const centralDirectoryEnd = centralDirectoryOffset + centralDirectorySize;
  for (let index = 0; index < entryCount; index += 1) {
    if (offset + 46 > centralDirectoryEnd || content.readUInt32LE(offset) !== 0x02014b50) return false;
    const flags = content.readUInt16LE(offset + 8);
    const compressionMethod = content.readUInt16LE(offset + 10);
    const fileNameLength = content.readUInt16LE(offset + 28);
    const extraLength = content.readUInt16LE(offset + 30);
    const commentLength = content.readUInt16LE(offset + 32);
    const compressedSize = content.readUInt32LE(offset + 20);
    const uncompressedSize = content.readUInt32LE(offset + 24);
    const checksum = content.readUInt32LE(offset + 16);
    const localHeaderOffset = content.readUInt32LE(offset + 42);
    const entryLength = 46 + fileNameLength + extraLength + commentLength;
    if (
      offset + entryLength > centralDirectoryEnd ||
      fileNameLength === 0 ||
      (flags & 0x41) !== 0 ||
      (compressionMethod !== 0 && compressionMethod !== 8) ||
      localHeaderOffset + 30 > centralDirectoryOffset
    ) {
      return false;
    }

    const entryName = content.subarray(offset + 46, offset + 46 + fileNameLength).toString("utf8");
    const localNameLength = content.readUInt16LE(localHeaderOffset + 26);
    const localExtraLength = content.readUInt16LE(localHeaderOffset + 28);
    const dataOffset = localHeaderOffset + 30 + localNameLength + localExtraLength;
    if (
      content.readUInt32LE(localHeaderOffset) !== 0x04034b50 ||
      content.readUInt16LE(localHeaderOffset + 6) !== flags ||
      content.readUInt16LE(localHeaderOffset + 8) !== compressionMethod ||
      ((flags & 8) === 0 && (
        content.readUInt32LE(localHeaderOffset + 14) !== checksum ||
        content.readUInt32LE(localHeaderOffset + 18) !== compressedSize ||
        content.readUInt32LE(localHeaderOffset + 22) !== uncompressedSize
      )) ||
      dataOffset + compressedSize > centralDirectoryOffset ||
      localNameLength !== fileNameLength ||
      !content.subarray(localHeaderOffset + 30, localHeaderOffset + 30 + localNameLength).equals(
        content.subarray(offset + 46, offset + 46 + fileNameLength),
      )
    ) {
      return false;
    }

    if (requiredEntries.has(entryName)) {
      if (uncompressedSize > 1024 * 1024 || packageParts.has(entryName)) return false;
      try {
        const compressed = content.subarray(dataOffset, dataOffset + compressedSize);
        const part = compressionMethod === 0
          ? Buffer.from(compressed)
          : inflateRawSync(compressed, { maxOutputLength: 1024 * 1024 });
        if (part.byteLength !== uncompressedSize || crc32(part) !== checksum) return false;
        packageParts.set(entryName, part);
      } catch {
        return false;
      }
    }
    offset += entryLength;
  }

  if (offset !== centralDirectoryEnd || packageParts.size !== requiredEntries.size) return false;
  const contentTypes = packageParts.get("[Content_Types].xml")?.toString("utf8") ?? "";
  const workbook = packageParts.get("xl/workbook.xml")?.toString("utf8") ?? "";
  return contentTypes.includes("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml") &&
    /<(?:[A-Za-z_][\w.-]*:)?workbook(?:\s|>)/.test(workbook);
}

export function matchesAttachmentSignature(fileName: string, content: Buffer): boolean {
  const extension = fileName.match(/\.[^.]+$/)?.[0].toLowerCase();
  switch (extension) {
    case ".gif":
      return ["GIF87a", "GIF89a"].includes(content.subarray(0, 6).toString("ascii"));
    case ".jpeg":
    case ".jpg":
      return content.length >= 3 && content[0] === 0xff && content[1] === 0xd8 && content[2] === 0xff;
    case ".pdf":
      return content.length >= 8 &&
        /^%PDF-(?:1\.[0-7]|2\.0)$/.test(content.subarray(0, 8).toString("ascii"));
    case ".png":
      return content.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
    case ".webp":
      if (content.length < 20 || content.subarray(0, 4).toString("ascii") !== "RIFF" ||
          content.readUInt32LE(4) !== content.byteLength - 8 ||
          content.subarray(8, 12).toString("ascii") !== "WEBP") return false;
      {
        let offset = 12;
        let imageFound = false;
        while (offset + 8 <= content.length) {
          const type = content.subarray(offset, offset + 4).toString("ascii");
          const size = content.readUInt32LE(offset + 4);
          if (size === 0 || offset + 8 + size + (size % 2) > content.length) return false;
          if (["VP8 ", "VP8L", "ANMF"].includes(type)) imageFound = true;
          offset += 8 + size + (size % 2);
        }
        return imageFound && offset === content.length;
      }
    case ".xls":
      return content.subarray(0, 8).equals(Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]));
    case ".xlsx":
      return isXlsxArchive(content);
    default:
      return false;
  }
}

export function contentDisposition(fileName: string, disposition: "attachment" | "inline"): string {
  const fallback = fileName
    .replace(/[^\x20-\x7e]/g, "_")
    .replace(/["\\;]/g, "_");
  const encoded = encodeURIComponent(fileName).replace(/['()*]/g, (character) =>
    `%${character.charCodeAt(0).toString(16).toUpperCase()}`,
  );
  return `${disposition}; filename="${fallback}"; filename*=UTF-8''${encoded}`;
}
