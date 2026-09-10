import omLogoUrl from "/antiq-logo.png";
import ctaBgTv from "@assets/__1778995188209.jpeg";
import ctaBgNuke from "@assets/__(1)_1778995203556.jpeg";
import ctaLogoUrl from "@assets/transparent_icon_1778995534201.png";
import type { Lang } from "@/lib/i18n";

const CTA_BACKGROUNDS = [ctaBgTv, ctaBgNuke];

export type MktSlideOption = { label: string; percentage: number };
export type MktSlide = {
  type: "cover" | "market" | "cta";
  marketId?: number;
  question?: string;
  imageData?: string;
  isBinary?: boolean;
  chancePercent?: number;
  changePercent?: number;
  changeDirection?: "up" | "down" | "flat";
  options?: MktSlideOption[];
  headline?: string;
  accentWord?: string;
};

export type MktSlideshow = {
  id: number;
  marketIds: number[];
  coverHeadline: string;
  coverAccentWord?: string | null;
  caption?: string | null;
  posted: boolean;
  createdAt: string;
  slides: MktSlide[];
};

const ACCENT_GREEN = "#16c060";
const YES_GREEN = "#16c060";
const NO_RED = "#e0413a";

function imgSrc(data?: string) {
  if (!data) return "";
  if (data.startsWith("data:") || data.startsWith("http")) return data;
  return `data:image/jpeg;base64,${data}`;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function drawCover(ctx: CanvasRenderingContext2D, img: HTMLImageElement | null, W: number, H: number) {
  ctx.fillStyle = "#0a0a0a";
  ctx.fillRect(0, 0, W, H);
  if (img) {
    const imgAspect = img.naturalWidth / img.naturalHeight;
    const cAspect = W / H;
    let sx = 0, sy = 0, sw = img.naturalWidth, sh = img.naturalHeight;
    if (imgAspect > cAspect) {
      sw = img.naturalHeight * cAspect;
      sx = (img.naturalWidth - sw) / 2;
    } else {
      sh = img.naturalWidth / cAspect;
      sy = (img.naturalHeight - sh) / 2;
    }
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, W, H);
  }
  // Heavy dark gradient bottom for text legibility
  ctx.fillStyle = "rgba(0,0,0,0.55)";
  ctx.fillRect(0, 0, W, H);
  const g = ctx.createLinearGradient(0, H * 0.25, 0, H);
  g.addColorStop(0, "rgba(0,0,0,0.15)");
  g.addColorStop(0.55, "rgba(0,0,0,0.72)");
  g.addColorStop(1, "rgba(0,0,0,0.97)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  // Subtle film grain — small noise tile scaled up for a soft, clean texture
  drawGrain(ctx, W, H);
}

function drawGrain(ctx: CanvasRenderingContext2D, W: number, H: number) {
  const tileW = 220;
  const tileH = Math.round((tileW * H) / W);
  const oc = document.createElement("canvas");
  oc.width = tileW;
  oc.height = tileH;
  const octx = oc.getContext("2d");
  if (!octx) return;
  const imgData = octx.createImageData(tileW, tileH);
  const data = imgData.data;
  for (let i = 0; i < data.length; i += 4) {
    const v = (Math.random() * 255) | 0;
    data[i] = v;
    data[i + 1] = v;
    data[i + 2] = v;
    data[i + 3] = 28;
  }
  octx.putImageData(imgData, 0, 0);
  ctx.save();
  ctx.globalCompositeOperation = "overlay";
  ctx.globalAlpha = 0.55;
  (ctx as CanvasRenderingContext2D & { imageSmoothingEnabled: boolean }).imageSmoothingEnabled = true;
  ctx.drawImage(oc, 0, 0, W, H);
  ctx.restore();
}

function whitenLogo(logo: HTMLImageElement, w: number, h: number) {
  const oc = document.createElement("canvas");
  oc.width = w; oc.height = h;
  const octx = oc.getContext("2d")!;
  octx.drawImage(logo, 0, 0, w, h);
  octx.globalCompositeOperation = "source-atop";
  octx.fillStyle = "#ffffff";
  octx.fillRect(0, 0, w, h);
  return oc;
}

async function drawLogoTopLeft(ctx: CanvasRenderingContext2D, scale = 1) {
  const logo = await loadImage(omLogoUrl);
  const aspect = logo.naturalWidth / logo.naturalHeight;
  const h = 135 * scale;
  const w = h * aspect;
  const wl = whitenLogo(logo, w, h);
  ctx.drawImage(wl, 48, 12);
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const test = current ? `${current} ${word}` : word;
    if (ctx.measureText(test).width <= maxWidth) {
      current = test;
    } else {
      if (current) lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines;
}

function roundedRectPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.min(r, h / 2, w / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.lineTo(x + w - rr, y);
  ctx.arcTo(x + w, y, x + w, y + rr, rr);
  ctx.lineTo(x + w, y + h - rr);
  ctx.arcTo(x + w, y + h, x + w - rr, y + h, rr);
  ctx.lineTo(x + rr, y + h);
  ctx.arcTo(x, y + h, x, y + h - rr, rr);
  ctx.lineTo(x, y + rr);
  ctx.arcTo(x, y, x + rr, y, rr);
  ctx.closePath();
}

// Modern outcome pill: dark glassy background + colored side bar + label + percentage.
function drawOutcomePill(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number,
  accentColor: string, label: string, percent: number,
) {
  // Glassy background
  ctx.save();
  roundedRectPath(ctx, x, y, w, h, 22);
  ctx.fillStyle = "rgba(255,255,255,0.10)";
  ctx.fill();
  // Subtle border
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = "rgba(255,255,255,0.22)";
  ctx.stroke();
  ctx.restore();

  // Accent dot on the left
  const dotR = 14;
  const dotX = x + 30;
  const dotY = y + h / 2;
  ctx.fillStyle = accentColor;
  ctx.beginPath();
  ctx.arc(dotX, dotY, dotR, 0, Math.PI * 2);
  ctx.fill();

  // Label (left)
  ctx.fillStyle = "#ffffff";
  ctx.font = `800 38px Inter, "Helvetica Neue", Helvetica, Arial, sans-serif`;
  ctx.textBaseline = "middle";
  ctx.textAlign = "start";
  ctx.fillText(label, dotX + dotR + 18, dotY + 1);

  // Percent (right)
  ctx.fillStyle = "#ffffff";
  ctx.font = `900 44px Inter, "Helvetica Neue", Helvetica, Arial, sans-serif`;
  ctx.textAlign = "end";
  ctx.fillText(`${percent.toFixed(0)}%`, x + w - 28, dotY + 1);
  ctx.textAlign = "start";
  ctx.textBaseline = "alphabetic";
}

// Solid color pill — bold filled background, label on left + percentage on right.
function drawSolidPill(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number,
  bgColor: string, label: string, percent: number,
) {
  ctx.save();
  roundedRectPath(ctx, x, y, w, h, h / 2);
  ctx.fillStyle = bgColor;
  ctx.fill();
  ctx.restore();

  const midY = y + h / 2;
  ctx.fillStyle = "#ffffff";
  ctx.textBaseline = "middle";

  // Label on the left
  ctx.font = `900 44px Inter, "Helvetica Neue", Helvetica, Arial, sans-serif`;
  ctx.textAlign = "start";
  ctx.fillText(label, x + 36, midY + 1);

  // Percentage on the right
  ctx.font = `900 44px Inter, "Helvetica Neue", Helvetica, Arial, sans-serif`;
  ctx.textAlign = "end";
  ctx.fillText(`${percent.toFixed(0)}%`, x + w - 32, midY + 1);

  ctx.textAlign = "start";
  ctx.textBaseline = "alphabetic";
}

// Normalize common binary outcome labels to the active language
function translateOptionLabel(label: string, lang: Lang = "es"): string {
  const t = (label ?? "").trim();
  const key = t.toLowerCase();
  if (lang === "en") {
    const map: Record<string, string> = {
      "sí": "Yes",
      "si": "Yes",
      "no": "No",
      "true": "Yes",
      "false": "No",
    };
    return map[key] ?? t;
  }
  const map: Record<string, string> = {
    "yes": "Sí",
    "no": "No",
    "true": "Sí",
    "false": "No",
  };
  return map[key] ?? t;
}

async function drawCoverSlide(ctx: CanvasRenderingContext2D, W: number, H: number, slide: MktSlide, lang: Lang = "es") {
  const img = slide.imageData ? await loadImage(imgSrc(slide.imageData)).catch(() => null) : null;
  drawCover(ctx, img, W, H);
  await drawLogoTopLeft(ctx);

  // Headline — big bold, with green accent word
  const headline = (slide.headline ?? "").toUpperCase();
  const accent = (slide.accentWord ?? "").toUpperCase().trim();
  const fontPx = 92;
  ctx.font = `900 ${fontPx}px Inter, "Helvetica Neue", Helvetica, Arial, sans-serif`;
  ctx.textBaseline = "alphabetic";
  const maxW = W - 96;
  const lines = wrapText(ctx, headline, maxW);
  const lineHeight = fontPx * 1.02;
  const startY = H - 220 - (lines.length - 1) * lineHeight;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const y = startY + i * lineHeight;
    let x = 48;
    const tokens = line.split(" ");
    for (let t = 0; t < tokens.length; t++) {
      const token = tokens[t];
      const isAccent = accent && token.replace(/[^A-ZÁÉÍÓÚÑ]/g, "") === accent;
      ctx.fillStyle = isAccent ? ACCENT_GREEN : "#ffffff";
      ctx.fillText(token, x, y);
      const wTok = ctx.measureText(token + " ").width;
      x += wTok;
    }
  }

  // Swipe indicator — minimal, bottom-right
  drawSwipeIndicator(ctx, W - 48, H - 110, lang);
}

function drawSwipeIndicator(ctx: CanvasRenderingContext2D, rightX: number, y: number, lang: Lang = "es") {
  const label = lang === "en" ? "SWIPE" : "DESLIZA";
  const fontPx = 26;
  ctx.font = `800 ${fontPx}px Inter, "Helvetica Neue", Helvetica, Arial, sans-serif`;
  ctx.textBaseline = "middle";
  ctx.textAlign = "start";
  const textW = ctx.measureText(label).width;
  const arrowGap = 14;
  const arrowLen = 38;
  // Right-anchor: total block width = text + gap + arrow; start x so the chevron ends at rightX
  const x = rightX - (textW + arrowGap + arrowLen);
  // Text
  ctx.fillStyle = "#ffffff";
  ctx.fillText(label, x, y);
  // Arrow line + chevron
  const ax = x + textW + arrowGap;
  const ay = y;
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 3;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(ax, ay);
  ctx.lineTo(ax + arrowLen, ay);
  ctx.stroke();
  // Chevron head
  ctx.beginPath();
  ctx.moveTo(ax + arrowLen - 10, ay - 8);
  ctx.lineTo(ax + arrowLen, ay);
  ctx.lineTo(ax + arrowLen - 10, ay + 8);
  ctx.stroke();
  ctx.textBaseline = "alphabetic";
}

async function drawMarketSlide(ctx: CanvasRenderingContext2D, W: number, H: number, slide: MktSlide, lang: Lang = "es") {
  const img = slide.imageData ? await loadImage(imgSrc(slide.imageData)).catch(() => null) : null;
  drawCover(ctx, img, W, H);
  await drawLogoTopLeft(ctx);

  const question = (slide.question ?? "").toUpperCase();
  const fontPx = 78;
  ctx.font = `900 ${fontPx}px Inter, "Helvetica Neue", Helvetica, Arial, sans-serif`;
  ctx.fillStyle = "#ffffff";
  ctx.textBaseline = "alphabetic";
  const maxW = W - 96;
  const lines = wrapText(ctx, question, maxW);
  const lineHeight = fontPx * 1.02;

  if (slide.isBinary) {
    // Question on top half; big probability + Sí/No pills on bottom
    const startY = H - 520 - (lines.length - 1) * lineHeight;
    for (let i = 0; i < lines.length; i++) {
      ctx.fillText(lines[i], 48, startY + i * lineHeight);
    }

    // Big probability number with PROBABILIDAD label + change indicator
    const chance = slide.chancePercent ?? 0;
    const change = slide.changePercent ?? 0;
    const dir = slide.changeDirection ?? "flat";
    const chanceY = H - 330;
    ctx.font = `900 120px Inter, "Helvetica Neue", Helvetica, Arial, sans-serif`;
    ctx.fillStyle = "#ffffff";
    ctx.fillText(`${chance.toFixed(0)}%`, 48, chanceY);
    const pctW = ctx.measureText(`${chance.toFixed(0)}%`).width;

    ctx.font = `800 24px Inter, "Helvetica Neue", Helvetica, Arial, sans-serif`;
    ctx.fillStyle = "rgba(255,255,255,0.65)";
    ctx.fillText(lang === "en" ? "PROBABILITY" : "PROBABILIDAD", 48 + pctW + 20, chanceY - 56);

    if (dir !== "flat" && change > 0) {
      ctx.font = `800 28px Inter, "Helvetica Neue", Helvetica, Arial, sans-serif`;
      ctx.fillStyle = dir === "up" ? YES_GREEN : NO_RED;
      const arrow = dir === "up" ? "▲" : "▼";
      ctx.fillText(`${arrow} ${change.toFixed(1)} pts`, 48 + pctW + 20, chanceY - 18);
    }

    // Sí / No solid pills — bold green and red, label + percentage
    const pillW = (W - 48 * 2 - 24) / 2;
    const pillH = 104;
    const pillY = H - 170;
    const yesPct = chance;
    const noPct = Math.max(0, 100 - chance);
    const yesLabel = lang === "en" ? "Yes" : "Sí";
    drawSolidPill(ctx, 48, pillY, pillW, pillH, YES_GREEN, yesLabel, yesPct);
    drawSolidPill(ctx, 48 + pillW + 24, pillY, pillW, pillH, NO_RED, "No", noPct);
  } else {
    // Multi-option: question + horizontal bars showing each percentage
    const opts = (slide.options ?? []).slice(0, 5);
    const rowH = 80;
    const rowGap = 14;
    const listH = opts.length * (rowH + rowGap) - rowGap;
    const startY = H - listH - 180 - (lines.length - 1) * lineHeight;
    for (let i = 0; i < lines.length; i++) {
      ctx.fillText(lines[i], 48, startY + i * lineHeight);
    }

    // Same glassy pill style as Sí/No — minimal, just label + %. Leader gets green dot.
    const sortedIdx = [...opts.keys()].sort((a, b) => opts[b].percentage - opts[a].percentage);
    const leaderIdx = sortedIdx[0];

    let oy = H - listH - 80;
    const pillW = W - 96;
    for (let i = 0; i < opts.length; i++) {
      const o = opts[i];
      const label = translateOptionLabel(o.label, lang);
      const accent = i === leaderIdx ? YES_GREEN : "rgba(255,255,255,0.55)";
      drawOutcomePill(ctx, 48, oy, pillW, rowH, accent, label, o.percentage);
      oy += rowH + rowGap;
    }
  }
}

async function drawCtaSlide(ctx: CanvasRenderingContext2D, W: number, H: number, variantIndex = 0, lang: Lang = "es") {
  // Photo background — alternates per slideshow so two consecutive ones don't match
  const bgUrl = CTA_BACKGROUNDS[Math.abs(variantIndex) % CTA_BACKGROUNDS.length];
  const bg = await loadImage(bgUrl).catch(() => null);
  if (bg) {
    // Cover-fit the photo to the canvas
    const ar = bg.naturalWidth / bg.naturalHeight;
    const canvasAr = W / H;
    let sx = 0, sy = 0, sw = bg.naturalWidth, sh = bg.naturalHeight;
    if (ar > canvasAr) {
      sw = bg.naturalHeight * canvasAr;
      sx = (bg.naturalWidth - sw) / 2;
    } else {
      sh = bg.naturalWidth / canvasAr;
      sy = (bg.naturalHeight - sh) / 2;
    }
    ctx.drawImage(bg, sx, sy, sw, sh, 0, 0, W, H);
  } else {
    ctx.fillStyle = "#000000";
    ctx.fillRect(0, 0, W, H);
  }
  // Dark overlay so the text reads cleanly
  ctx.fillStyle = "rgba(0,0,0,0.55)";
  ctx.fillRect(0, 0, W, H);
  // Vignette
  const g = ctx.createRadialGradient(W / 2, H / 2, 100, W / 2, H / 2, Math.max(W, H));
  g.addColorStop(0, "rgba(0,0,0,0)");
  g.addColorStop(1, "rgba(0,0,0,0.55)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  // Title — match the font style of the normal carousels' final slide:
  // sans-serif, extra-bold, mixed case, left-aligned, snug line-height, italic accent
  const fontPx = 84;
  const lh = Math.round(fontPx * 1.18);
  ctx.fillStyle = "#ffffff";
  ctx.textAlign = "start";
  ctx.textBaseline = "alphabetic";
  const padding = 96;
  const tokens = lang === "en"
    ? [
        { text: "Discover what the", italic: false },
        { text: "odds are", italic: false },
        { text: "saying on", italic: false },
        { text: "antiq.", italic: true },
      ]
    : [
        { text: "Descubre lo que", italic: false },
        { text: "dicen las", italic: false },
        { text: "probabilidades en", italic: false },
        { text: "antiq.", italic: true },
      ];
  const totalH = tokens.length * lh;
  let y = (H - totalH) / 2 + lh;
  for (const tok of tokens) {
    ctx.font = `${tok.italic ? "italic " : ""}800 ${fontPx}px Inter, "Helvetica Neue", Helvetica, Arial, sans-serif`;
    ctx.fillText(tok.text, padding, y);
    y += lh;
  }

  // Logo — centered at the top
  const ctaLogo = await loadImage(ctaLogoUrl).catch(() => null);
  if (ctaLogo) {
    const ar = ctaLogo.naturalWidth / ctaLogo.naturalHeight;
    const logoH = 160;
    const logoW = logoH * ar;
    ctx.drawImage(ctaLogo, (W - logoW) / 2, 90, logoW, logoH);
  }
}

export async function renderSlideToCanvas(slide: MktSlide, canvas: HTMLCanvasElement, variantIndex = 0, lang: Lang = "es") {
  const W = canvas.width;
  const H = canvas.height;
  const ctx = canvas.getContext("2d")!;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  if (slide.type === "cover") await drawCoverSlide(ctx, W, H, slide, lang);
  else if (slide.type === "market") await drawMarketSlide(ctx, W, H, slide, lang);
  else await drawCtaSlide(ctx, W, H, variantIndex, lang);
}

export async function exportMktSlide(slide: MktSlide, filename: string, variantIndex = 0, lang: Lang = "es") {
  const W = 1080;
  const H = 1350;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  await renderSlideToCanvas(slide, canvas, variantIndex, lang);
  const url = canvas.toDataURL("image/jpeg", 0.97);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
}

// ---------- Preview React component (renders to <canvas>) ----------

import { useEffect, useRef } from "react";

export function MktSlidePreview({ slide, className = "", variantIndex = 0, lang = "es" }: { slide: MktSlide; className?: string; variantIndex?: number; lang?: Lang }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    c.width = 1080;
    c.height = 1350;
    renderSlideToCanvas(slide, c, variantIndex, lang).catch((err) => {
      console.error("[MktSlidePreview] render failed:", err);
    });
  }, [slide, variantIndex, lang]);
  return (
    <div className={`relative w-full aspect-[4/5] overflow-hidden bg-black ${className}`}>
      <canvas ref={ref} className="absolute inset-0 w-full h-full" />
    </div>
  );
}
