import { describe, expect, it } from "vitest";
import {
  contentDisposition,
  getAttachmentContentType,
  matchesAttachmentSignature,
  parseAttachmentFileName,
} from "./attachment-validation.js";

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

function createXlsx(entries: Array<[string, string]>): Buffer {
  const localRecords: Buffer[] = [];
  const centralRecords: Buffer[] = [];
  let localOffset = 0;
  for (const [fileName, text] of entries) {
    const name = Buffer.from(fileName, "utf8");
    const data = Buffer.from(text, "utf8");
    const checksum = crc32(data);
    const local = Buffer.alloc(30 + name.length + data.length);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt32LE(checksum, 14);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(name.length, 26);
    name.copy(local, 30);
    data.copy(local, 30 + name.length);
    localRecords.push(local);

    const central = Buffer.alloc(46 + name.length);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt32LE(checksum, 16);
    central.writeUInt32LE(data.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt32LE(localOffset, 42);
    name.copy(central, 46);
    centralRecords.push(central);
    localOffset += local.length;
  }

  const centralDirectory = Buffer.concat(centralRecords);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(centralDirectory.length, 12);
  end.writeUInt32LE(localOffset, 16);
  return Buffer.concat([...localRecords, centralDirectory, end]);
}

const webp = Buffer.alloc(30);
webp.write("RIFF", 0);
webp.writeUInt32LE(webp.byteLength - 8, 4);
webp.write("WEBP", 8);
webp.write("VP8 ", 12);
webp.writeUInt32LE(10, 16);

describe("ticket attachment validation", () => {
  it("decodes and bounds safe file names", () => {
    expect(parseAttachmentFileName(encodeURIComponent("Bericht ü.png"))).toBe("Bericht ü.png");
    expect(parseAttachmentFileName("%E0%A4%A")).toBeNull();
    expect(parseAttachmentFileName(encodeURIComponent("../report.pdf"))).toBeNull();
    expect(parseAttachmentFileName(encodeURIComponent("line\r\nbreak.png"))).toBeNull();
    expect(parseAttachmentFileName(undefined)).toBeNull();
  });

  it.each([
    ["photo.PNG", "image/png", Buffer.from("89504e470d0a1a0a", "hex")],
    ["photo.jpg", "image/jpeg", Buffer.from("ffd8ff", "hex")],
    ["photo.gif", "image/gif", Buffer.from("GIF89a", "ascii")],
    ["photo.webp", "image/webp", webp],
    ["document.pdf", "application/pdf", Buffer.from("%PDF-1.7\n", "ascii")],
    ["legacy.xls", "application/vnd.ms-excel", Buffer.from("d0cf11e0a1b11ae1", "hex")],
  ])("recognizes %s using its signature", (fileName, contentType, content) => {
    expect(getAttachmentContentType(fileName)).toBe(contentType);
    expect(matchesAttachmentSignature(fileName, content)).toBe(true);
    expect(matchesAttachmentSignature(fileName, Buffer.from("not this format"))).toBe(false);
  });

  it("accepts a structurally valid XLSX package and rejects an unrelated ZIP", () => {
    const xlsx = createXlsx([
      [
        "[Content_Types].xml",
        '<Types><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/></Types>',
      ],
      ["xl/workbook.xml", '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"/>'],
    ]);
    expect(getAttachmentContentType("report.xlsx")).toBe(
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    expect(matchesAttachmentSignature("report.xlsx", xlsx)).toBe(true);
    expect(matchesAttachmentSignature("report.xlsx", createXlsx([["readme.txt", "hello"]]))).toBe(false);
    expect(matchesAttachmentSignature("report.xlsx", xlsx.subarray(0, -5))).toBe(false);
  });

  it("accepts spreadsheets with large worksheet entries", () => {
    const xlsx = createXlsx([
      ["[Content_Types].xml", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"],
      ["xl/workbook.xml", "<workbook />"],
      ["xl/worksheets/sheet1.xml", "x".repeat(1024 * 1024 + 1)],
    ]);
    expect(matchesAttachmentSignature("report.xlsx", xlsx)).toBe(true);
  });

  it("accepts WebP images with multiple RIFF chunks", () => {
    const extended = Buffer.alloc(40);
    extended.write("RIFF", 0);
    extended.writeUInt32LE(extended.length - 8, 4);
    extended.write("WEBP", 8);
    extended.write("VP8X", 12);
    extended.writeUInt32LE(10, 16);
    extended.write("VP8 ", 30);
    extended.writeUInt32LE(2, 34);
    expect(matchesAttachmentSignature("photo.webp", extended)).toBe(true);
    expect(matchesAttachmentSignature("photo.webp", extended.subarray(0, -1))).toBe(false);
  });

  it("creates a safe RFC 5987 content disposition", () => {
    const header = contentDisposition('Überblick "final".png', "attachment");
    expect(header).toContain('attachment; filename="_berblick _final_.png"');
    expect(header).toContain("filename*=UTF-8''%C3%9Cberblick%20%22final%22.png");
    expect(header).not.toMatch(/[\r\n]/);
  });
});
