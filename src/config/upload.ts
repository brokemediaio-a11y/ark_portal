/** Upload rules shared by the browser (early feedback) and the server (enforcement). */
export const UPLOAD_MAX_BYTES = 10 * 1024 * 1024;

export const ACCEPTED_FILE_TYPES = {
  "application/pdf": [".pdf"],
  "image/png": [".png"],
  "image/jpeg": [".jpg", ".jpeg"],
  "image/webp": [".webp"],
} as const;

export type AcceptedMimeType = keyof typeof ACCEPTED_FILE_TYPES;

export const ACCEPTED_EXTENSIONS = Object.values(ACCEPTED_FILE_TYPES).flat();

/** Human-readable summary for the upload screen. */
export const ACCEPTED_FILES_LABEL = "PDF, PNG, JPG or WEBP · up to 10 MB";
