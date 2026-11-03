import {
  ACCEPTED_FILE_TYPES,
  UPLOAD_MAX_BYTES,
  type AcceptedMimeType,
} from "@/config/upload";

export type FileCheck = { ok: true; mimeType: AcceptedMimeType } | { ok: false; error: string };

const MAX_MB = UPLOAD_MAX_BYTES / (1024 * 1024);

function extensionOf(name: string): string {
  const dot = name.lastIndexOf(".");
  return dot >= 0 ? name.slice(dot).toLowerCase() : "";
}

/** Checks a file's name and size. Cheap enough to run in the browser before uploading. */
export function checkFileBasics(name: string, size: number): FileCheck | { ok: true } {
  if (size === 0) return { ok: false, error: "This file is empty." };
  if (size > UPLOAD_MAX_BYTES)
    return { ok: false, error: `This file is too large. The limit is ${MAX_MB} MB.` };
  const ext = extensionOf(name);
  const known = Object.values(ACCEPTED_FILE_TYPES).some((exts) =>
    (exts as readonly string[]).includes(ext),
  );
  if (!known) return { ok: false, error: "Please upload a PDF or an image (PNG, JPG, WEBP)." };
  return { ok: true };
}

/** Detects the real type from the file's first bytes — the extension alone is not trusted. */
export function sniffMimeType(bytes: Uint8Array): AcceptedMimeType | null {
  const startsWith = (sig: number[], offset = 0) => sig.every((b, i) => bytes[offset + i] === b);
  if (startsWith([0x25, 0x50, 0x44, 0x46, 0x2d])) return "application/pdf"; // %PDF-
  if (startsWith([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "image/png";
  if (startsWith([0xff, 0xd8, 0xff])) return "image/jpeg";
  if (startsWith([0x52, 0x49, 0x46, 0x46]) && startsWith([0x57, 0x45, 0x42, 0x50], 8)) return "image/webp";
  return null;
}

/** Full server-side check: size + extension + content signature must all agree. */
export function validateUpload(name: string, bytes: Uint8Array): FileCheck {
  const basics = checkFileBasics(name, bytes.byteLength);
  if (!basics.ok) return basics;
  const mimeType = sniffMimeType(bytes);
  if (!mimeType) return { ok: false, error: "This file doesn't look like a valid PDF or image." };
  const allowedExts = ACCEPTED_FILE_TYPES[mimeType] as readonly string[];
  if (!allowedExts.includes(extensionOf(name)))
    return { ok: false, error: "The file's extension doesn't match its contents." };
  return { ok: true, mimeType };
}
