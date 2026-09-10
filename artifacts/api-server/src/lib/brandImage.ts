import sharp from "sharp";
import { Buffer } from "node:buffer";
import { ANTIQ_WORDMARK_B64, ANTIQ_ICON_B64 } from "./logoAsset";

export type LogoVariant = "wordmark" | "icon";
export type LogoPosition =
  | "top-left"
  | "top-right"
  | "top-center"
  | "bottom-left"
  | "bottom-right"
  | "bottom-center"
  | "center";
export type LogoColor = "auto" | "white" | "black" | string;

const WORDMARK_BUF = Buffer.from(ANTIQ_WORDMARK_B64, "base64");
const ICON_BUF = Buffer.from(ANTIQ_ICON_B64, "base64");

interface RGB {
  r: number;
  g: number;
  b: number;
}

function hexToRgb(hex: string): RGB | null {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const int = parseInt(m[1], 16);
  return { r: (int >> 16) & 255, g: (int >> 8) & 255, b: int & 255 };
}

async function regionLuminance(
  base: Buffer,
  left: number,
  top: number,
  width: number,
  height: number,
): Promise<number> {
  const meta = await sharp(base).metadata();
  const BW = meta.width ?? 1;
  const BH = meta.height ?? 1;
  const l = Math.max(0, Math.min(BW - 1, Math.round(left)));
  const t = Math.max(0, Math.min(BH - 1, Math.round(top)));
  const w = Math.max(1, Math.min(BW - l, Math.round(width)));
  const h = Math.max(1, Math.min(BH - t, Math.round(height)));
  const stats = await sharp(base)
    .extract({ left: l, top: t, width: w, height: h })
    .stats();
  const [rCh, gCh, bCh] = stats.channels;
  const r = rCh?.mean ?? 0;
  const g = gCh?.mean ?? 0;
  const b = bCh?.mean ?? 0;
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

// Recolor a (typically black) transparent-PNG logo to a solid color while
// preserving its exact alpha shape — gives pixel-perfect white/black/brand logos.
async function recolorLogo(
  logoBuf: Buffer,
  targetWidth: number,
  color: RGB,
): Promise<{ buf: Buffer; width: number; height: number }> {
  const resized = await sharp(logoBuf)
    .resize({ width: Math.max(1, Math.round(targetWidth)) })
    .ensureAlpha()
    .png()
    .toBuffer();
  const meta = await sharp(resized).metadata();
  const width = meta.width ?? targetWidth;
  const height = meta.height ?? targetWidth;

  const alpha = await sharp(resized).extractChannel(3).raw().toBuffer();
  const solid = await sharp({
    create: {
      width,
      height,
      channels: 3,
      background: { r: color.r, g: color.g, b: color.b },
    },
  })
    .raw()
    .toBuffer();

  const recolored = await sharp(solid, {
    raw: { width, height, channels: 3 },
  })
    .joinChannel(alpha, { raw: { width, height, channels: 1 } })
    .png()
    .toBuffer();

  return { buf: recolored, width, height };
}

export interface OverlayLogoOptions {
  variant?: LogoVariant;
  position?: LogoPosition;
  color?: LogoColor;
  sizePct?: number; // logo width as a percentage of the base image width
  marginPct?: number; // padding from edges as a percentage of the base image width
}

/**
 * Composites the exact antiq brand logo onto a base image as a real PNG element.
 * Returns a PNG buffer.
 */
export async function overlayLogo(
  baseImage: Buffer,
  opts: OverlayLogoOptions = {},
): Promise<Buffer> {
  const variant: LogoVariant = opts.variant === "icon" ? "icon" : "wordmark";
  const position: LogoPosition = opts.position ?? "bottom-left";
  const sizePct = Math.max(4, Math.min(60, opts.sizePct ?? (variant === "icon" ? 14 : 24)));
  const marginPct = Math.max(0, Math.min(20, opts.marginPct ?? 5));

  // Normalize base to a known format/orientation
  const base = await sharp(baseImage).rotate().png().toBuffer();
  const baseMeta = await sharp(base).metadata();
  const BW = baseMeta.width ?? 1024;
  const BH = baseMeta.height ?? 1024;

  const targetW = Math.round((BW * sizePct) / 100);
  const margin = Math.round((BW * marginPct) / 100);

  const logoSrc = variant === "icon" ? ICON_BUF : WORDMARK_BUF;

  // Determine logo dimensions first (for positioning + luminance sampling)
  const probe = await sharp(logoSrc)
    .resize({ width: Math.max(1, targetW) })
    .ensureAlpha()
    .metadata();
  const lw = probe.width ?? targetW;
  const lh = probe.height ?? targetW;

  // Compute placement
  let left: number;
  let top: number;
  switch (position) {
    case "top-left":
      left = margin;
      top = margin;
      break;
    case "top-right":
      left = BW - lw - margin;
      top = margin;
      break;
    case "top-center":
      left = Math.round((BW - lw) / 2);
      top = margin;
      break;
    case "bottom-right":
      left = BW - lw - margin;
      top = BH - lh - margin;
      break;
    case "bottom-center":
      left = Math.round((BW - lw) / 2);
      top = BH - lh - margin;
      break;
    case "center":
      left = Math.round((BW - lw) / 2);
      top = Math.round((BH - lh) / 2);
      break;
    case "bottom-left":
    default:
      left = margin;
      top = BH - lh - margin;
      break;
  }
  left = Math.max(0, Math.min(BW - lw, left));
  top = Math.max(0, Math.min(BH - lh, top));

  // Resolve color
  let rgb: RGB;
  const colorReq = (opts.color ?? "auto").toString().toLowerCase();
  if (colorReq === "white") {
    rgb = { r: 255, g: 255, b: 255 };
  } else if (colorReq === "black") {
    rgb = { r: 0, g: 0, b: 0 };
  } else if (colorReq.startsWith("#") || /^[0-9a-f]{6}$/i.test(colorReq)) {
    rgb = hexToRgb(colorReq) ?? { r: 255, g: 255, b: 255 };
  } else {
    // auto: sample the region behind the logo and pick the most legible tint
    const lum = await regionLuminance(base, left, top, lw, lh);
    rgb = lum < 140 ? { r: 255, g: 255, b: 255 } : { r: 17, g: 17, b: 17 };
  }

  const { buf: logoBuf } = await recolorLogo(logoSrc, targetW, rgb);

  const out = await sharp(base)
    .composite([{ input: logoBuf, left, top }])
    .png()
    .toBuffer();

  return out;
}

// Stamps a small URL string (e.g. "antiq.xyz") centered at the bottom of the
// image. Auto-picks white/black text based on the bottom region luminance and
// adds a subtle contrasting outline so it stays legible on any background.
export async function overlayUrlText(baseImage: Buffer, text = "antiq.xyz"): Promise<Buffer> {
  const base = await sharp(baseImage).rotate().png().toBuffer();
  const meta = await sharp(base).metadata();
  const BW = meta.width ?? 1024;
  const BH = meta.height ?? 1024;

  const fontSize = Math.max(14, Math.round(BW * 0.03));
  const bottomMargin = Math.round(BH * 0.035);
  const bandH = Math.round(fontSize * 2.4);
  const bandTop = Math.max(0, BH - bandH);

  const lum = await regionLuminance(base, 0, bandTop, BW, bandH);
  const dark = lum < 140;
  const fill = dark ? "#ffffff" : "#111111";
  const stroke = dark ? "rgba(0,0,0,0.5)" : "rgba(255,255,255,0.6)";
  const strokeW = Math.max(1, Math.round(fontSize * 0.09));

  const escapeXml = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  const y = BH - bottomMargin;
  const svg = `<svg width="${BW}" height="${BH}" xmlns="http://www.w3.org/2000/svg"><text x="50%" y="${y}" fill="${fill}" font-family="Helvetica, Arial, sans-serif" font-size="${fontSize}" font-weight="600" letter-spacing="${(fontSize * 0.04).toFixed(2)}" text-anchor="middle" style="paint-order:stroke;stroke:${stroke};stroke-width:${strokeW}px;">${escapeXml(text)}</text></svg>`;

  return sharp(base)
    .composite([{ input: Buffer.from(svg), left: 0, top: 0 }])
    .png()
    .toBuffer();
}

export async function toJpegDataUrl(buf: Buffer, quality = 92): Promise<string> {
  const jpeg = await sharp(buf).jpeg({ quality }).toBuffer();
  return `data:image/jpeg;base64,${jpeg.toString("base64")}`;
}

export async function toPngDataUrl(buf: Buffer): Promise<string> {
  const png = await sharp(buf).png().toBuffer();
  return `data:image/png;base64,${png.toString("base64")}`;
}

// Soft, retro film-grain finish. Adds monochrome (luminance) gaussian noise in
// raw-pixel space so the grain is uniform across shadows AND highlights — unlike
// an "overlay" blend, which all but vanishes on antiq's dark backgrounds. The
// same delta is applied to R/G/B per pixel so the grain stays color-neutral and
// reads like classic 35mm film. `strength` is the noise sigma (~8-12 is subtle).
export async function applyGrain(baseImage: Buffer, strength = 9): Promise<Buffer> {
  const sigma = Math.max(0, Math.min(40, strength));
  if (sigma <= 0) return baseImage;
  const { data, info } = await sharp(baseImage)
    .rotate()
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;
  if (!width || !height) return baseImage;
  const px = width * height;
  for (let i = 0; i < px; i++) {
    // Box-Muller transform → one gaussian sample per pixel (shared across RGB).
    const u1 = Math.random() || 1e-9;
    const u2 = Math.random();
    const n = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2) * sigma;
    const b = i * channels;
    const lim = Math.min(3, channels);
    for (let c = 0; c < lim; c++) {
      const v = data[b + c] + n;
      data[b + c] = v < 0 ? 0 : v > 255 ? 255 : v;
    }
  }
  return sharp(data, { raw: { width, height, channels } }).png().toBuffer();
}

// Deterministic, last-resort branded placeholder so the pipeline can ALWAYS
// return an image even when AI generation and real-photo search both fail.
// Black background, centered white wordmark-style caption derived from the
// requested prompt. The antiq logo is still applied later via overlayLogo.
export async function makePlaceholderImage(
  width: number,
  height: number,
  caption: string,
): Promise<Buffer> {
  const escapeXml = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  const raw = (caption || "").trim().replace(/\s+/g, " ").slice(0, 90);
  const fontSize = Math.round(Math.min(width, height) * 0.052);
  // wrap into up to 3 lines of ~28 chars
  const words = raw.split(" ");
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    if ((cur + " " + w).trim().length > 28) {
      if (cur) lines.push(cur);
      cur = w;
    } else {
      cur = (cur + " " + w).trim();
    }
    if (lines.length >= 3) break;
  }
  if (cur && lines.length < 3) lines.push(cur);
  const lineHeight = Math.round(fontSize * 1.3);
  const startY = Math.round(height / 2) - Math.round(((lines.length - 1) * lineHeight) / 2);
  const tspans = lines
    .map(
      (ln, i) =>
        `<text x="50%" y="${startY + i * lineHeight}" fill="#ffffff" font-family="Helvetica, Arial, sans-serif" font-size="${fontSize}" font-weight="600" text-anchor="middle" dominant-baseline="middle">${escapeXml(ln)}</text>`,
    )
    .join("");
  const svg = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" fill="#000000"/>${tspans}</svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}

// Center-crop an image to an exact width:height aspect ratio. The largest
// region with the target ratio is kept; nothing is scaled up or letterboxed.
export async function cropToAspectRatio(buf: Buffer, ratioW: number, ratioH: number): Promise<Buffer> {
  const img = sharp(buf).rotate();
  const meta = await img.metadata();
  const w = meta.width ?? 0;
  const h = meta.height ?? 0;
  if (!w || !h) return buf;
  const target = ratioW / ratioH;
  const current = w / h;
  if (Math.abs(current - target) < 0.01) return buf;
  let cropW = w;
  let cropH = h;
  if (current > target) {
    cropW = Math.round(h * target);
  } else {
    cropH = Math.round(w / target);
  }
  const left = Math.max(0, Math.round((w - cropW) / 2));
  const top = Math.max(0, Math.round((h - cropH) / 2));
  return img.extract({ left, top, width: cropW, height: cropH }).png().toBuffer();
}
