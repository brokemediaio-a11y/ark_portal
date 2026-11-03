import { describe, expect, it } from "vitest";
import { UPLOAD_MAX_BYTES } from "@/config/upload";
import { checkFileBasics, sniffMimeType, validateUpload } from "./file-validation";

const bytes = (...values: number[]) => new Uint8Array([...values, ...new Array(32).fill(0)]);
const PDF = bytes(0x25, 0x50, 0x44, 0x46, 0x2d, 0x31);
const PNG = bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a);
const JPG = bytes(0xff, 0xd8, 0xff, 0xe0);

describe("file validation", () => {
  it("detects real file types from content", () => {
    expect(sniffMimeType(PDF)).toBe("application/pdf");
    expect(sniffMimeType(PNG)).toBe("image/png");
    expect(sniffMimeType(JPG)).toBe("image/jpeg");
    expect(sniffMimeType(bytes(0x4d, 0x5a))).toBeNull(); // .exe header
  });

  it("accepts matching name and content", () => {
    expect(validateUpload("quote.PDF", PDF)).toEqual({ ok: true, mimeType: "application/pdf" });
    expect(validateUpload("shot.jpeg", JPG)).toEqual({ ok: true, mimeType: "image/jpeg" });
  });

  it("rejects a renamed file whose content doesn't match", () => {
    expect(validateUpload("quote.pdf", PNG).ok).toBe(false);
    expect(validateUpload("virus.pdf", bytes(0x4d, 0x5a)).ok).toBe(false);
  });

  it("rejects unsupported, empty and oversized files", () => {
    expect(checkFileBasics("notes.docx", 100).ok).toBe(false);
    expect(checkFileBasics("quote.pdf", 0).ok).toBe(false);
    expect(checkFileBasics("quote.pdf", UPLOAD_MAX_BYTES + 1).ok).toBe(false);
    expect(checkFileBasics("quote.pdf", UPLOAD_MAX_BYTES).ok).toBe(true);
  });
});
