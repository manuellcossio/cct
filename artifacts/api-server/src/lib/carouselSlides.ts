import { createCanvas, loadImage, GlobalFonts, type Image, type SKRSContext2D } from "@napi-rs/canvas";
import { Buffer } from "node:buffer";
import { ANTIQ_WORDMARK_B64 } from "./logoAsset";

// Server-side replica of the Instagram carousel slide format that the CCT
// frontend renders via Canvas 2D (see artifacts/cct/src/pages/instagram.tsx:
// drawCoverSlide / drawContentSlide). Used by the content-gen carousel mode so
// the chat can deliver fully-formatted slides (cover + content) inline — same
// information-division logic and visual format as Instagram, WITHOUT the meme.

const W = 1080;
const H = 1350;
// Supersampling factor: render at SCALE× the logical 1080×1350 layout so the
// exported JPEG is high-resolution (2160×2700 ≈ retina/HD). All drawing code
// stays in logical 1080×1350 coordinates — the context is scaled once per slide.
const SCALE = 2;

// DejaVu Sans ships on the system and auto-loads as a @napi-rs/canvas family.
// The browser uses Impact / -apple-system; we fall back to the closest weights
// available here (bold for headlines, regular for body).
let fontsReady = false;
function ensureFonts(): { head: string; body: string } {
  if (!fontsReady) {
    try {
      GlobalFonts.registerFromPath("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", "DejaVu Sans");
      GlobalFonts.registerFromPath("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", "DejaVu Sans");
    } catch {
      /* system fonts already auto-load; ignore */
    }
    fontsReady = true;
  }
  const families = new Set((GlobalFonts.families ?? []).map((f) => f.family));
  const fam = families.has("DejaVu Sans") ? "'DejaVu Sans'" : "sans-serif";
  return { head: fam, body: fam };
}

let logoPromise: Promise<Image> | null = null;
function loadLogo(): Promise<Image> {
  if (!logoPromise) {
    logoPromise = loadImage(Buffer.from(ANTIQ_WORDMARK_B64, "base64"));
  }
  return logoPromise;
}

// Recolor the (black, transparent) wordmark to solid white while preserving its
// alpha shape — mirror of makeLogoWhite in the frontend.
function whiteLogo(logo: Image, w: number, h: number, ss = 1) {
  const pw = Math.max(1, Math.round(w * ss));
  const ph = Math.max(1, Math.round(h * ss));
  const off = createCanvas(pw, ph);
  const octx = off.getContext("2d");
  octx.imageSmoothingEnabled = true;
  octx.imageSmoothingQuality = "high";
  octx.drawImage(logo, 0, 0, pw, ph);
  octx.globalCompositeOperation = "source-atop";
  octx.fillStyle = "#ffffff";
  octx.fillRect(0, 0, pw, ph);
  return off;
}

function coverFit(ctx: SKRSContext2D, img: Image, dx: number, dy: number, dw: number, dh: number) {
  const imgAspect = img.width / img.height;
  const boxAspect = dw / dh;
  let sx = 0, sy = 0, sw = img.width, sh = img.height;
  if (imgAspect > boxAspect) {
    sw = img.height * boxAspect;
    sx = (img.width - sw) / 2;
  } else {
    sh = img.width / boxAspect;
    sy = (img.height - sh) / 2;
  }
  ctx.drawImage(img, sx, sy, sw, sh, dx, dy, dw, dh);
}

function wrap(ctx: SKRSContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const test = current ? `${current} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && current) {
      lines.push(current);
      current = word;
    } else {
      current = test;
    }
  }
  if (current) lines.push(current);
  return lines;
}


const ACCENT = "#C6FF4A";

function roundRectPath(ctx: SKRSContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function drawSparkle(ctx: SKRSContext2D, x: number, y: number, r: number, color: string) {
  ctx.save();
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x, y - r);
  ctx.quadraticCurveTo(x + r * 0.16, y - r * 0.16, x + r, y);
  ctx.quadraticCurveTo(x + r * 0.16, y + r * 0.16, x, y + r);
  ctx.quadraticCurveTo(x - r * 0.16, y + r * 0.16, x - r, y);
  ctx.quadraticCurveTo(x - r * 0.16, y - r * 0.16, x, y - r);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

// Tilted "polaroid" photo card — mirror of drawPolaroidImg in the frontend.
function drawPolaroid(
  ctx: SKRSContext2D,
  img: Image,
  cx: number,
  cy: number,
  photoW: number,
  photoH: number,
  rotDeg: number,
) {
  const pad = 22;
  const bottomPad = 66;
  const frameW = photoW + pad * 2;
  const frameH = photoH + pad + bottomPad;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate((rotDeg * Math.PI) / 180);
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.55)";
  ctx.shadowBlur = 46;
  ctx.shadowOffsetY = 20;
  ctx.fillStyle = "#ffffff";
  roundRectPath(ctx, -frameW / 2, -frameH / 2, frameW, frameH, 18);
  ctx.fill();
  ctx.restore();
  const px = -frameW / 2 + pad;
  const py = -frameH / 2 + pad;
  ctx.save();
  roundRectPath(ctx, px, py, photoW, photoH, 8);
  ctx.clip();
  coverFit(ctx, img, px, py, photoW, photoH);
  ctx.restore();
  ctx.restore();
}

async function drawCover(ctx: SKRSContext2D, photo: Image | null, headline: string, fonts: { head: string }) {
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";

  // Clean black canvas — photo becomes a tilted polaroid accent, not a background
  ctx.fillStyle = "#000000";
  ctx.fillRect(0, 0, W, H);

  ctx.save();
  ctx.strokeStyle = "rgba(198,255,74,0.35)";
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.arc(W - 96, 210, 110, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();

  const logo = await loadLogo();
  const logoH = 135;
  const logoW = (logo.width / logo.height) * logoH;
  ctx.drawImage(whiteLogo(logo, logoW, logoH, SCALE), 48, 12, logoW, logoH);

  if (photo) {
    drawPolaroid(ctx, photo, W / 2 + 14, 505, 700, 620, -3.2);
  }

  drawSparkle(ctx, W / 2 - 400, 235, 30, ACCENT);
  drawSparkle(ctx, W / 2 + 420, 810, 22, "rgba(255,255,255,0.9)");
  drawSparkle(ctx, W / 2 - 430, 860, 14, ACCENT);

  const maxWidth = W - 96;
  const fontSize = Math.min(104, Math.max(80, Math.floor(W * 0.096)));
  ctx.font = `bold ${fontSize}px ${fonts.head}`;
  ctx.textBaseline = "alphabetic";

  const lines = wrap(ctx, headline, maxWidth);
  const lineH = fontSize * 1.14;
  const totalH = lines.length * lineH;
  let textY = H - 64 - totalH + lineH;
  lines.forEach((line, i) => {
    ctx.fillStyle = i === lines.length - 1 ? ACCENT : "rgba(255,255,255,0.95)";
    ctx.fillText(line, 48, textY);
    textY += lineH;
  });
}

async function drawContent(ctx: SKRSContext2D, photo: Image | null, paragraph: string, fonts: { body: string }) {
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.fillStyle = "#000000";
  ctx.fillRect(0, 0, W, H);

  const margin = 72;
  const textZoneTop = H * 0.07;
  // Without a photo the text gets the whole slide to breathe
  const textZoneBottom = photo ? H * 0.47 : H * 0.8;
  const footerTop = H * 0.86;

  ctx.fillStyle = ACCENT;
  roundRectPath(ctx, margin, textZoneTop - 26, 76, 12, 6);
  ctx.fill();

  const maxTextWidth = W - margin * 2;
  const fontSize = 42;
  const lineH = fontSize * 1.6;
  ctx.font = `${fontSize}px ${fonts.body}`;
  ctx.fillStyle = "rgba(255,255,255,0.96)";
  ctx.textBaseline = "top";

  const lines = wrap(ctx, paragraph, maxTextWidth);
  const textBlockH = lines.length * lineH;
  const textAreaH = textZoneBottom - textZoneTop;
  const textStartY = textZoneTop + 18 + Math.max(0, (textAreaH - textBlockH) / 2 - 18);
  let ty = textStartY;
  for (const line of lines) {
    if (ty + lineH > textZoneBottom + 20) break;
    ctx.fillText(line, margin, ty);
    ty += lineH;
  }

  const tilt = paragraph.length % 2 === 0 ? 2.6 : -2.6;
  if (photo) {
    drawPolaroid(ctx, photo, W / 2 + (tilt > 0 ? -10 : 10), H * 0.665, 640, 380, tilt);
    drawSparkle(ctx, tilt > 0 ? W - 140 : 140, H * 0.52, 22, ACCENT);
    drawSparkle(ctx, tilt > 0 ? 150 : W - 150, H * 0.81, 14, "rgba(255,255,255,0.85)");
  } else {
    drawSparkle(ctx, W - 140, H * 0.12, 22, ACCENT);
    drawSparkle(ctx, 140, H * 0.82, 14, "rgba(255,255,255,0.85)");
  }

  const footerH = H - footerTop;
  const logo = await loadLogo();
  const logoH = 92;
  const logoW = (logo.width / logo.height) * logoH;
  const logoY = footerTop + (footerH - logoH) / 2;
  ctx.drawImage(whiteLogo(logo, logoW, logoH, SCALE), margin, logoY, logoW, logoH);

  const arrowLen = 80;
  const arrowTipX = W - margin;
  const arrowBaseX = arrowTipX - arrowLen;
  const arrowY = logoY + logoH / 2;
  const headSize = 20;
  ctx.strokeStyle = ACCENT;
  ctx.lineWidth = 5;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  ctx.moveTo(arrowBaseX, arrowY);
  ctx.lineTo(arrowTipX, arrowY);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(arrowTipX - headSize, arrowY - headSize);
  ctx.lineTo(arrowTipX, arrowY);
  ctx.lineTo(arrowTipX - headSize, arrowY + headSize);
  ctx.stroke();
}

async function toImage(buf: Buffer | null): Promise<Image | null> {
  if (!buf || buf.length === 0) return null;
  try {
    return await loadImage(buf);
  } catch {
    return null;
  }
}

/**
 * Render a formatted carousel: 1 cover slide (photo + headline overlay) followed
 * by one content slide per paragraph (black bg + wrapped text + embedded photo).
 * `photos[0]` is the cover photo; `photos[1..]` align with `paragraphs`.
 * Returns JPEG buffers in slide order.
 */
export async function renderCarouselSlides(input: {
  headline: string;
  paragraphs: string[];
  photos: (Buffer | null)[];
}): Promise<Buffer[]> {
  const fonts = ensureFonts();
  const out: Buffer[] = [];

  const coverPhoto = await toImage(input.photos[0] ?? null);
  {
    const canvas = createCanvas(W * SCALE, H * SCALE);
    const ctx = canvas.getContext("2d");
    ctx.scale(SCALE, SCALE);
    await drawCover(ctx, coverPhoto, input.headline, fonts);
    out.push(canvas.toBuffer("image/jpeg", 0.95));
  }

  for (let i = 0; i < input.paragraphs.length; i++) {
    const photo = await toImage(input.photos[i + 1] ?? null);
    const canvas = createCanvas(W * SCALE, H * SCALE);
    const ctx = canvas.getContext("2d");
    ctx.scale(SCALE, SCALE);
    await drawContent(ctx, photo, input.paragraphs[i], fonts);
    out.push(canvas.toBuffer("image/jpeg", 0.95));
  }

  return out;
}
