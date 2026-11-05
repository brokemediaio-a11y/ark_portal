import { connection } from "next/server";
import { createCanvas, loadImage } from "@napi-rs/canvas";
import { createTtlCache } from "@/lib/ttl-cache";

/** Duffel's public airline artwork, available for any IATA airline code; no token is needed. */
const logoUrl = (code: string) => `https://assets.duffel.com/img/airlines/for-light-background/full-color-logo/${code}.svg`;

const AIRLINE_CODE = /^[A-Z0-9]{2}$/;
const LOGO_SIZE_PX = 192;
const MAX_LOGO_BYTES = 512 * 1024;
const DAY_MS = 24 * 60 * 60 * 1000;

const logoCache = createTtlCache<Uint8Array>({ ttlMs: 7 * DAY_MS, maxEntries: 500, name: "airline-logos" });

async function fetchLogoPng(code: string): Promise<Uint8Array> {
  const res = await fetch(logoUrl(code), { signal: AbortSignal.timeout(8_000) });
  if (!res.ok) throw new Error(`logo ${res.status}`);
  const svg = Buffer.from(await res.arrayBuffer());
  if (svg.length > MAX_LOGO_BYTES) throw new Error("logo too large");

  // Rasterised here because react-pdf can't draw SVG files.
  const image = await loadImage(svg);
  const scale = LOGO_SIZE_PX / Math.max(image.width, image.height);
  const canvas = createCanvas(Math.round(image.width * scale), Math.round(image.height * scale));
  canvas.getContext("2d").drawImage(image, 0, 0, canvas.width, canvas.height);
  return new Uint8Array(canvas.toBuffer("image/png"));
}

/** Serves an airline's logo as PNG from this site, so both the browser and the PDF can load it. */
export async function GET(_request: Request, { params }: RouteContext<"/api/airlines/[code]/logo">) {
  await connection();
  const code = (await params).code.toUpperCase();
  if (!AIRLINE_CODE.test(code)) return new Response(null, { status: 400 });
  try {
    const png = await logoCache(code, () => fetchLogoPng(code));
    return new Response(Buffer.from(png), {
      headers: { "Content-Type": "image/png", "Cache-Control": "public, max-age=604800, immutable" },
    });
  } catch {
    // Callers show the airline's code instead, so a missing logo never blocks a quotation.
    return new Response(null, { status: 404 });
  }
}
