import { useState } from "react";
import { useLocation } from "wouter";
import omLogoUrl from "/antiq-logo.png";
import omIconUrl from "/antiq-square.png";
const ctaBgUrl = `${import.meta.env.BASE_URL.replace(/\/$/, "")}/cta-background.jpg`;
const ctaBg2Url = `${import.meta.env.BASE_URL.replace(/\/$/, "")}/cta-background-2.jpg`;
const CTA_BGS = [ctaBgUrl, ctaBg2Url];
function randomCtaBg() { return CTA_BGS[Math.random() < 0.5 ? 0 : 1]; }
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetInstagramCarousels,
  useGenerateInstagramCarousels,
  useGenerateInstagramFromUrl,
  useDeleteInstagramCarousel,
  useMarkInstagramCarouselAsPosted,
  
  useGenerateMarketSlideshow,
  useGetMarketSlideshows,
  useDeleteMarketSlideshow,
  useMarkMarketSlideshowAsPosted,
  getGetInstagramCarouselsQueryKey,
  getGetMarketSlideshowsQueryKey,
  getGetCctStatsQueryKey
} from "@workspace/api-client-react";
import { format } from "date-fns";
import { Download, Trash2, Loader2, Sparkles, Image as ImageIcon, ChevronLeft, ChevronRight, X, Instagram, CheckCheck, Copy, Check, Plus, Zap, Link2, ArrowLeft, BarChart3 } from "lucide-react";
import { MktSlidePreview, exportMktSlide, type MktSlideshow } from "@/components/slideshow-mkt-canvas";
import { useI18n, type Lang } from "@/lib/i18n";
import { StarRatingButton } from "@/components/star-rating";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
function playComplete() {
  try { new Audio(`${BASE}/complete.mp3`).play(); } catch {}
}

// ---------- Canvas-based slide export ----------

const OM_LOGO_PATH =
  "M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2zm0 2c4.418 0 8 3.582 8 8s-3.582 8-8 8-8-3.582-8-8 3.582-8 8-8zm-4.243 4.243l2.829 2.828-2.829 2.829 1.415 1.414 2.828-2.828 2.829 2.828 1.414-1.414-2.829-2.829 2.829-2.828-1.414-1.415-2.829 2.829-2.828-2.829z";

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function makeLogoWhite(logo: HTMLImageElement, w: number, h: number): HTMLCanvasElement {
  const offscreen = document.createElement("canvas");
  offscreen.width = w;
  offscreen.height = h;
  const octx = offscreen.getContext("2d")!;
  octx.drawImage(logo, 0, 0, w, h);
  octx.globalCompositeOperation = "source-atop";
  octx.fillStyle = "#ffffff";
  octx.fillRect(0, 0, w, h);
  return offscreen;
}


const ACCENT = "#C6FF4A";

function roundRectPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
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

function drawSparkle(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: string) {
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

// Draw a photo as a tilted "polaroid" card: white frame, rounded corners,
// soft shadow. The photo gives the slide personality instead of context.
function drawPolaroidImg(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
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
  // Card with shadow
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.55)";
  ctx.shadowBlur = 46;
  ctx.shadowOffsetY = 20;
  ctx.fillStyle = "#ffffff";
  roundRectPath(ctx, -frameW / 2, -frameH / 2, frameW, frameH, 18);
  ctx.fill();
  ctx.restore();
  // Photo (cover-cropped) inside frame
  const px = -frameW / 2 + pad;
  const py = -frameH / 2 + pad;
  const pAspect = img.naturalWidth / img.naturalHeight;
  const boxAspect = photoW / photoH;
  let sx = 0, sy = 0, sw = img.naturalWidth, sh = img.naturalHeight;
  if (pAspect > boxAspect) {
    sw = img.naturalHeight * boxAspect;
    sx = (img.naturalWidth - sw) / 2;
  } else {
    sh = img.naturalWidth / boxAspect;
    sy = (img.naturalHeight - sh) / 2;
  }
  ctx.save();
  roundRectPath(ctx, px, py, photoW, photoH, 8);
  ctx.clip();
  ctx.drawImage(img, sx, sy, sw, sh, px, py, photoW, photoH);
  ctx.restore();
  ctx.restore();
}

async function drawCoverSlide(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  photoSrc: string,
  headline: string
) {
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";

  // Clean black canvas — the photo is a personality accent, not a background
  ctx.fillStyle = "#000000";
  ctx.fillRect(0, 0, W, H);

  // Playful decorations
  ctx.save();
  ctx.strokeStyle = "rgba(198,255,74,0.35)";
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.arc(W - 96, 210, 110, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();

  // antiq logo top-left — real PNG
  const logo = await loadImage(omLogoUrl);
  const logoH = 135;
  const logoW = (logo.naturalWidth / logo.naturalHeight) * logoH;
  const whiteLogo = makeLogoWhite(logo, logoW, logoH);
  ctx.drawImage(whiteLogo, 48, 12);

  // Tilted polaroid photo — only when a photo exists (images are optional)
  if (photoSrc) {
    try {
      const img = await loadImage(photoSrc);
      drawPolaroidImg(ctx, img, W / 2 + 14, 505, 700, 620, -3.2);
    } catch { /* photo optional in new design */ }
  }

  drawSparkle(ctx, W / 2 - 400, 235, 30, ACCENT);
  drawSparkle(ctx, W / 2 + 420, 810, 22, "rgba(255,255,255,0.9)");
  drawSparkle(ctx, W / 2 - 430, 860, 14, ACCENT);

  // Headline — bold, last line in accent color for a playful pop
  const maxWidth = W - 96;
  const fontSize = Math.min(104, Math.max(80, Math.floor(W * 0.096)));
  ctx.font = `900 ${fontSize}px Impact, 'Arial Black', 'Helvetica Neue', Arial, sans-serif`;
  ctx.textBaseline = "alphabetic";

  const words = headline.split(" ");
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

  const lineH = fontSize * 1.14;
  const totalH = lines.length * lineH;
  let textY = H - 64 - totalH + lineH;
  lines.forEach((line, i) => {
    ctx.fillStyle = i === lines.length - 1 ? ACCENT : "rgba(255,255,255,0.95)";
    ctx.fillText(line, 48, textY);
    textY += lineH;
  });
}

async function drawContentSlide(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  photoSrc: string,
  paragraph: string
) {
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.fillStyle = "#000000";
  ctx.fillRect(0, 0, W, H);

  const margin = 72;

  const hasPhoto = Boolean(photoSrc);
  const textZoneTop = H * 0.07;
  // Without a photo the text gets the whole slide to breathe
  const textZoneBottom = hasPhoto ? H * 0.47 : H * 0.8;
  const footerTop = H * 0.86;

  // Accent dash above the text — small, playful marker
  ctx.fillStyle = ACCENT;
  roundRectPath(ctx, margin, textZoneTop - 26, 76, 12, 6);
  ctx.fill();

  const maxTextWidth = W - margin * 2;
  const fontSize = 42;
  const lineH = fontSize * 1.6;
  ctx.font = `400 ${fontSize}px -apple-system, BlinkMacSystemFont, 'Helvetica Neue', Arial, sans-serif`;
  ctx.fillStyle = "rgba(255,255,255,0.96)";
  ctx.textBaseline = "top";

  const words = paragraph.split(" ");
  const paragraphLines: string[] = [];
  let current = "";
  for (const word of words) {
    const test = current ? `${current} ${word}` : word;
    if (ctx.measureText(test).width > maxTextWidth && current) {
      paragraphLines.push(current);
      current = word;
    } else {
      current = test;
    }
  }
  if (current) paragraphLines.push(current);

  const textBlockH = paragraphLines.length * lineH;
  const textAreaH = textZoneBottom - textZoneTop;
  const textStartY = textZoneTop + 18 + Math.max(0, (textAreaH - textBlockH) / 2 - 18);

  let ty = textStartY;
  for (const line of paragraphLines) {
    if (ty + lineH > textZoneBottom + 20) break;
    ctx.fillText(line, margin, ty);
    ty += lineH;
  }

  // Tilted polaroid photo — personality, not context; only when provided
  const tilt = paragraph.length % 2 === 0 ? 2.6 : -2.6;
  if (hasPhoto) {
    try {
      const img = await loadImage(photoSrc);
      drawPolaroidImg(ctx, img, W / 2 + (tilt > 0 ? -10 : 10), H * 0.665, 640, 380, tilt);
    } catch { /* photo optional */ }
    drawSparkle(ctx, tilt > 0 ? W - 140 : 140, H * 0.52, 22, ACCENT);
    drawSparkle(ctx, tilt > 0 ? 150 : W - 150, H * 0.81, 14, "rgba(255,255,255,0.85)");
  } else {
    drawSparkle(ctx, W - 140, H * 0.12, 22, ACCENT);
    drawSparkle(ctx, 140, H * 0.82, 14, "rgba(255,255,255,0.85)");
  }

  const footerH = H - footerTop;
  const logoH = 92;
  const logo = await loadImage(omLogoUrl);
  const logoW = (logo.naturalWidth / logo.naturalHeight) * logoH;
  const logoY = footerTop + (footerH - logoH) / 2;
  const whiteLogo2 = makeLogoWhite(logo, logoW, logoH);
  ctx.drawImage(whiteLogo2, margin, logoY);

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

async function drawMemeSlide(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  photoSrc: string
) {
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.fillStyle = "#000000";
  ctx.fillRect(0, 0, W, H);

  const margin = 72;
  const footerH = H * 0.14;
  const memeTop = margin;
  const memeBottom = H - footerH;
  const memeH = memeBottom - memeTop;
  const memeW = W - margin * 2;

  if (memeH > 60) {
    const img = await loadImage(photoSrc);
    const pAspect = img.naturalWidth / img.naturalHeight;
    const boxAspect = memeW / memeH;
    let pSrcX = 0, pSrcY = 0, pSrcW = img.naturalWidth, pSrcH = img.naturalHeight;
    if (pAspect > boxAspect) {
      pSrcW = img.naturalHeight * boxAspect;
      pSrcX = (img.naturalWidth - pSrcW) / 2;
    } else {
      pSrcH = img.naturalWidth / boxAspect;
      pSrcY = (img.naturalHeight - pSrcH) / 2;
    }
    ctx.save();
    ctx.beginPath();
    const radius = 16;
    ctx.moveTo(margin + radius, memeTop);
    ctx.lineTo(margin + memeW - radius, memeTop);
    ctx.quadraticCurveTo(margin + memeW, memeTop, margin + memeW, memeTop + radius);
    ctx.lineTo(margin + memeW, memeTop + memeH - radius);
    ctx.quadraticCurveTo(margin + memeW, memeTop + memeH, margin + memeW - radius, memeTop + memeH);
    ctx.lineTo(margin + radius, memeTop + memeH);
    ctx.quadraticCurveTo(margin, memeTop + memeH, margin, memeTop + memeH - radius);
    ctx.lineTo(margin, memeTop + radius);
    ctx.quadraticCurveTo(margin, memeTop, margin + radius, memeTop);
    ctx.clip();
    ctx.drawImage(img, pSrcX, pSrcY, pSrcW, pSrcH, margin, memeTop, memeW, memeH);
    ctx.restore();
  }

  const logoH = 56;
  const logo = await loadImage(omLogoUrl);
  const logoW = (logo.naturalWidth / logo.naturalHeight) * logoH;
  const footerTop = H - footerH;
  const logoY = footerTop + (footerH - logoH) / 2;
  const whiteLogo2 = makeLogoWhite(logo, logoW, logoH);
  ctx.drawImage(whiteLogo2, margin, logoY);

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

async function drawCtaSlide(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  bgUrl?: string,
  lang: Lang = "es"
) {
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";

  const bg = await loadImage(bgUrl ?? randomCtaBg());
  const bgAspect = bg.naturalWidth / bg.naturalHeight;
  const canvasAspect = W / H;
  let sx = 0, sy = 0, sw = bg.naturalWidth, sh = bg.naturalHeight;
  if (bgAspect > canvasAspect) {
    sw = bg.naturalHeight * canvasAspect;
    sx = (bg.naturalWidth - sw) / 2;
  } else {
    sh = bg.naturalWidth / canvasAspect;
    sy = (bg.naturalHeight - sh) / 2;
  }
  ctx.drawImage(bg, sx, sy, sw, sh, 0, 0, W, H);

  ctx.fillStyle = "rgba(0,0,0,0.7)";
  ctx.fillRect(0, 0, W, H);

  const margin = 80;

  ctx.textAlign = "center";
  ctx.textBaseline = "top";

  const mainFontSize = 72;
  ctx.font = `600 ${mainFontSize}px -apple-system, BlinkMacSystemFont, 'Helvetica Neue', Arial, sans-serif`;
  ctx.fillStyle = "#ffffff";

  const mainLineH = mainFontSize * 1.25;
  const mainStartY = H * 0.35;

  ctx.textAlign = "left";
  ctx.font = `800 ${mainFontSize}px -apple-system, BlinkMacSystemFont, 'Helvetica Neue', Arial, sans-serif`;
  const ctaLines = lang === "en"
    ? ["Engineering", "the future", "of music"]
    : ["Ingeniería para", "el futuro", "de la música"];
  ctx.fillText(ctaLines[0], margin, mainStartY);
  ctx.fillText(ctaLines[1], margin, mainStartY + mainLineH);
  ctx.fillText(ctaLines[2], margin, mainStartY + mainLineH * 2);

  let x4 = margin;
  const line4Parts = [
    { text: lang === "en" ? "at " : "en ", italic: false },
    { text: "antiq.", italic: true },
  ];
  for (const p of line4Parts) {
    ctx.font = `800 ${p.italic ? "italic " : ""}${mainFontSize}px -apple-system, BlinkMacSystemFont, 'Helvetica Neue', Arial, sans-serif`;
    ctx.fillText(p.text, x4, mainStartY + mainLineH * 3);
    x4 += ctx.measureText(p.text).width;
  }
  ctx.textAlign = "center";


  const logo = await loadImage(omLogoUrl);
  const logoH = 115;
  const logoW = (logo.naturalWidth / logo.naturalHeight) * logoH;
  const logoY = H - logoH - 100;
  const logoX = (W - logoW) / 2;
  const whiteLogo3 = makeLogoWhite(logo, logoW, logoH);
  ctx.drawImage(whiteLogo3, logoX, logoY);

  ctx.textAlign = "start";
}

async function exportSlideAsImage(
  type: "cover" | "content" | "cta" | "meme",
  photoSrc: string,
  headline: string,
  paragraph: string,
  filename: string,
  lang: Lang = "es"
) {
  const W = 1080;
  const H = 1350;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  if (type === "cover") {
    await drawCoverSlide(ctx, W, H, photoSrc, headline);
  } else if (type === "cta") {
    await drawCtaSlide(ctx, W, H, photoSrc || undefined, lang);
  } else if (type === "meme") {
    await drawMemeSlide(ctx, W, H, photoSrc);
  } else {
    await drawContentSlide(ctx, W, H, photoSrc, paragraph);
  }
  const url = canvas.toDataURL("image/jpeg", 0.97);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
}

// ---------- Slide Preview Components ----------

function CoverSlidePreview({ imageUrl, headline }: { imageUrl: string; headline: string }) {
  return (
    <div className="relative w-full aspect-[4/5] overflow-hidden bg-black">
      {/* Playful accent ring */}
      <div className="absolute rounded-full border-2" style={{ width: "26%", aspectRatio: "1", right: "-4%", top: "8%", borderColor: "rgba(198,255,74,0.35)" }} />
      {/* antiq logo */}
      <div className="absolute top-1 left-4 z-10">
        <img src={omLogoUrl} alt="antiq" className="h-16 w-auto" style={{ filter: "brightness(0) invert(1)" }} />
      </div>
      {/* Tilted polaroid photo — personality, not background; only when provided */}
      {imageUrl && (
        <div
          className="absolute bg-white rounded-md shadow-2xl box-border"
          style={{ width: "68.9%", top: "11.2%", left: "51.3%", transform: "translateX(-50%) rotate(-3.2deg)", padding: "3%", paddingBottom: "8.9%" }}
        >
          <img src={imageUrl} alt="Cover" crossOrigin="anonymous" className="w-full aspect-[700/620] object-cover rounded-sm" />
        </div>
      )}
      {/* Sparkles */}
      <div className="absolute" style={{ left: "10%", top: "15.5%", color: "#C6FF4A", fontSize: "1.4rem", lineHeight: 1, transform: "translate(-50%,-50%)" }}>✦</div>
      <div className="absolute" style={{ left: "88.9%", top: "60%", color: "rgba(255,255,255,0.9)", fontSize: "1rem", lineHeight: 1, transform: "translate(-50%,-50%)" }}>✦</div>
      <div className="absolute" style={{ left: "10.2%", top: "63.7%", color: "#C6FF4A", fontSize: "0.7rem", lineHeight: 1, transform: "translate(-50%,-50%)" }}>✦</div>
      {/* Headline — last word pops in accent */}
      <div className="absolute bottom-0 left-0 right-0 p-5">
        <p className="text-3xl leading-[1.1] uppercase tracking-tight" style={{ fontFamily: "Impact, 'Arial Black', sans-serif", color: "rgba(255,255,255,0.95)" }}>
          {(() => {
            // Approximate the canvas behavior (last wrapped LINE in accent):
            // color roughly the last third of the words.
            const w = headline.split(" ");
            const cut = Math.max(1, Math.round(w.length / 3));
            return (
              <>
                {w.slice(0, w.length - cut).join(" ")}{" "}
                <span style={{ color: "#C6FF4A" }}>{w.slice(w.length - cut).join(" ")}</span>
              </>
            );
          })()}
        </p>
      </div>
    </div>
  );
}

function ContentSlidePreview({ imageUrl, paragraph, compact = false }: { imageUrl: string; paragraph: string; compact?: boolean }) {
  // Mirror the canvas: tilt direction and accents flip on paragraph-length parity
  const tilt = paragraph.length % 2 === 0 ? 2.6 : -2.6;
  return (
    <div className="relative w-full aspect-[4/5] bg-black overflow-hidden">
      {/* Accent dash */}
      <div className="absolute rounded-full" style={{ left: compact ? "8%" : "7%", top: "4.5%", width: "7%", height: "0.9%", background: "#C6FF4A" }} />
      {/* Body text — expands to fill the slide when there is no photo */}
      <div
        className={`absolute top-0 left-0 right-0 flex items-start ${compact ? "px-3" : "px-6"}`}
        style={{ height: imageUrl ? "47%" : "80%", paddingTop: compact ? "9%" : "7%", paddingBottom: "2%" }}
      >
        <p
          className={`text-white overflow-hidden ${compact ? `text-[8px] leading-[1.55] ${imageUrl ? "line-clamp-7" : "line-clamp-[12]"}` : `text-sm leading-[1.6] tracking-wide ${imageUrl ? "line-clamp-[8]" : "line-clamp-[14]"}`}`}
        >
          {paragraph}
        </p>
      </div>
      {/* Tilted polaroid photo — only when provided */}
      {imageUrl && (
        <div
          className="absolute bg-white rounded-md shadow-2xl box-border"
          style={{
            width: "63.3%",
            top: "49.2%",
            left: tilt > 0 ? "49.1%" : "50.9%",
            transform: `translateX(-50%) rotate(${tilt}deg)`,
            padding: "3.2%",
            paddingBottom: "9.6%",
          }}
        >
          <img src={imageUrl} alt="Content" crossOrigin="anonymous" className="w-full aspect-[640/380] object-cover rounded-sm" />
        </div>
      )}
      {/* Sparkles — sides flip with tilt, matching the canvas */}
      {imageUrl ? (
        <>
          <div className="absolute" style={{ left: tilt > 0 ? "87%" : "13%", top: "52%", color: "#C6FF4A", fontSize: compact ? "0.7rem" : "1.1rem", lineHeight: 1, transform: "translate(-50%,-50%)" }}>✦</div>
          <div className="absolute" style={{ left: tilt > 0 ? "13.9%" : "86.1%", top: "81%", color: "rgba(255,255,255,0.85)", fontSize: compact ? "0.5rem" : "0.8rem", lineHeight: 1, transform: "translate(-50%,-50%)" }}>✦</div>
        </>
      ) : (
        <>
          <div className="absolute" style={{ left: "87%", top: "12%", color: "#C6FF4A", fontSize: compact ? "0.7rem" : "1.1rem", lineHeight: 1, transform: "translate(-50%,-50%)" }}>✦</div>
          <div className="absolute" style={{ left: "13%", top: "82%", color: "rgba(255,255,255,0.85)", fontSize: compact ? "0.5rem" : "0.8rem", lineHeight: 1, transform: "translate(-50%,-50%)" }}>✦</div>
        </>
      )}
      {/* Logo left + accent arrow right — bottom 14% */}
      <div
        className={`absolute bottom-0 left-0 right-0 flex items-center justify-between ${compact ? "px-3" : "px-6"}`}
        style={{ height: "14%" }}
      >
        <img src={omLogoUrl} alt="antiq" className={compact ? "h-6 w-auto" : "h-11 w-auto"} style={{ filter: "brightness(0) invert(1)" }} />
        <svg
          viewBox="0 0 32 24"
          fill="none"
          stroke="#C6FF4A"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={compact ? "h-3 w-4" : "h-5 w-7"}
        >
          <line x1="4" y1="12" x2="26" y2="12" />
          <polyline points="20 6 26 12 20 18" />
        </svg>
      </div>
    </div>
  );
}

function MemeSlidePreview({ imageUrl, compact = false }: { imageUrl: string; compact?: boolean }) {
  return (
    <div className="relative w-full aspect-[4/5] bg-black overflow-hidden">
      <div
        className={`absolute inset-0 flex items-center justify-center ${compact ? "p-3" : "p-6"}`}
        style={{ bottom: "14%" }}
      >
        <img
          src={imageUrl}
          alt="Meme"
          crossOrigin="anonymous"
          className="max-w-full max-h-full object-contain rounded"
        />
      </div>
      <div
        className={`absolute bottom-0 left-0 right-0 flex items-center justify-between ${compact ? "px-3" : "px-6"}`}
        style={{ height: "14%" }}
      >
        <img src={omLogoUrl} alt="antiq" className={compact ? "h-6 w-auto" : "h-11 w-auto"} style={{ filter: "brightness(0) invert(1)" }} />
        <svg
          viewBox="0 0 32 24"
          fill="none"
          stroke="#C6FF4A"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={compact ? "h-3 w-4" : "h-5 w-7"}
        >
          <line x1="4" y1="12" x2="26" y2="12" />
          <polyline points="20 6 26 12 20 18" />
        </svg>
      </div>
    </div>
  );
}

function CtaSlidePreview({ compact = false, bgUrl, lang = "es" }: { compact?: boolean; bgUrl?: string; lang?: Lang }) {
  const [bg] = useState(() => bgUrl ?? randomCtaBg());
  return (
    <div className="relative w-full aspect-[4/5] overflow-hidden bg-black">
      <img
        src={bg}
        alt="CTA Background"
        className="absolute inset-0 w-full h-full object-cover"
      />
      <div className="absolute inset-0" style={{ background: "rgba(0,0,0,0.7)" }} />
      <div className="absolute inset-0 flex flex-col items-center justify-center" style={{ padding: compact ? "8%" : "10%" }}>
        <div className="text-left flex-1 flex flex-col justify-center">
          <p
            className={`text-white font-extrabold leading-snug ${compact ? "text-[10px]" : "text-2xl"}`}
          >
            {lang === "en" ? (
              <>
                Engineering<br />
                the future<br />
                of music<br />
                at <span className="italic">antiq.</span>
              </>
            ) : (
              <>
                Ingeniería para<br />
                el futuro<br />
                de la música<br />
                en <span className="italic">antiq.</span>
              </>
            )}
          </p>
        </div>
        <img
          src={omLogoUrl}
          alt="antiq"
          className={compact ? "h-5 w-auto" : "h-12 w-auto"}
          style={{ filter: "brightness(0) invert(1)" }}
        />
      </div>
    </div>
  );
}

// ---------- Main Page ----------

export default function InstagramPage() {
  const { t, lang } = useI18n();
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();
  const { data, isLoading } = useGetInstagramCarousels();
  const generateMutation = useGenerateInstagramCarousels();
  const generateFromUrlMutation = useGenerateInstagramFromUrl();
  const deleteMutation = useDeleteInstagramCarousel();
  const postedMutation = useMarkInstagramCarouselAsPosted();

  const [lightboxData, setLightboxData] = useState<{ carousel: any; currentIndex: number } | null>(null);
  const [exportingId, setExportingId] = useState<number | null>(null);
  const [copiedCaptionId, setCopiedCaptionId] = useState<number | null>(null);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [wizardStep, setWizardStep] = useState<"choose" | "feed" | "mkt" | "photos">("choose");
  const [uploadPhotos, setUploadPhotos] = useState<string[]>([]);
  const [feedUrl, setFeedUrl] = useState("");
  const [marketIdsInput, setMarketIdsInput] = useState("");

  const { data: slideshowData } = useGetMarketSlideshows();
  const generateSlideshowMutation = useGenerateMarketSlideshow();
  const deleteSlideshowMutation = useDeleteMarketSlideshow();
  const postSlideshowMutation = useMarkMarketSlideshowAsPosted();
  const slideshows = (slideshowData?.slideshows ?? []) as unknown as MktSlideshow[];
  const [slideshowLightbox, setSlideshowLightbox] = useState<{ slideshow: MktSlideshow; index: number } | null>(null);
  const [exportingSlideshowId, setExportingSlideshowId] = useState<number | null>(null);
  const [copiedSlideshowCaptionId, setCopiedSlideshowCaptionId] = useState<number | null>(null);

  const handleSlideshowGenerate = () => {
    const ids = marketIdsInput
      .split(/[\s,]+/)
      .map(s => parseInt(s.trim(), 10))
      .filter(n => Number.isInteger(n) && n > 0);
    if (ids.length === 0) {
      toast.error(t("ig.slideshow.invalidId"));
      return;
    }
    setWizardOpen(false);
    setWizardStep("choose");
    setMarketIdsInput("");
    generateSlideshowMutation.mutate({ data: { marketIds: ids, lang } }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetMarketSlideshowsQueryKey() });
        playComplete();
        toast.success(t("ig.slideshow.generated"));
      },
      onError: () => toast.error(t("ig.slideshow.error")),
    });
  };

  const handleSlideshowDelete = (id: number) => {
    deleteSlideshowMutation.mutate({ id }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetMarketSlideshowsQueryKey() });
        toast.success(t("ig.slideshow.deleted"));
      },
    });
  };

  const handleSlideshowPosted = (id: number) => {
    postSlideshowMutation.mutate({ id }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetMarketSlideshowsQueryKey() });
        toast.success(t("common.movedToArchive"));
      },
    });
  };

  const handleSlideshowDownloadAll = async (s: MktSlideshow) => {
    setExportingSlideshowId(s.id);
    try {
      for (let i = 0; i < s.slides.length; i++) {
        await exportMktSlide(s.slides[i], `slideshow-${s.id}-${i + 1}-${s.slides[i].type}.jpg`, s.id, lang);
        await new Promise(r => setTimeout(r, 400));
      }
      toast.success(t("ig.imagesDownloaded", { count: s.slides.length }));
    } catch {
      toast.error(t("common.exportError"));
    } finally {
      setExportingSlideshowId(null);
    }
  };

  const carousels = data?.carousels || [];

  const [ctaBgMap] = useState<Record<number, string>>({});
  const getCtaBg = (id: number) => {
    if (!ctaBgMap[id]) ctaBgMap[id] = randomCtaBg();
    return ctaBgMap[id];
  };

  const isGenerating = generateMutation.isPending || generateFromUrlMutation.isPending;

  const handleAutoGen = () => {
    setWizardOpen(false);
    setWizardStep("choose");
    generateMutation.mutate({ data: { lang } }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetInstagramCarouselsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetCctStatsQueryKey() });
        playComplete();
        toast.success(t("ig.carousels.generated"));
      },
      onError: () => {
        toast.error(t("ig.carousels.error"));
      }
    });
  };

  const handlePhotosGenerate = () => {
    setWizardOpen(false);
    setWizardStep("choose");
    const photos = uploadPhotos;
    setUploadPhotos([]);
    generateMutation.mutate({ data: { lang, photos } }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetInstagramCarouselsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetCctStatsQueryKey() });
        playComplete();
        toast.success(t("ig.carousels.generated"));
      },
      onError: () => {
        toast.error(t("ig.carousels.error"));
      }
    });
  };

  const handlePhotoFiles = async (files: FileList | null) => {
    if (!files) return;
    const remaining = 4 - uploadPhotos.length;
    const list = Array.from(files).slice(0, Math.max(0, remaining));
    const read = (f: File) => new Promise<string>((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result));
      r.onerror = reject;
      r.readAsDataURL(f);
    });
    try {
      const urls = await Promise.all(list.map(read));
      setUploadPhotos((prev) => [...prev, ...urls].slice(0, 4));
    } catch {
      toast.error(t("common.exportError"));
    }
  };

  const handleFeedGenerate = () => {
    if (!feedUrl.trim()) return;
    setWizardOpen(false);
    setWizardStep("choose");
    generateFromUrlMutation.mutate({ data: { url: feedUrl.trim(), lang } }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetInstagramCarouselsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetCctStatsQueryKey() });
        playComplete();
        toast.success(t("ig.fromUrl.generated"));
        setFeedUrl("");
      },
      onError: () => {
        toast.error(t("ig.fromUrl.error"));
        setFeedUrl("");
      }
    });
  };

  const handleDelete = (id: number) => {
    deleteMutation.mutate({ id }, {
      onSuccess: () => {
        queryClient.setQueryData(getGetInstagramCarouselsQueryKey(), (old: any) => {
          if (!old) return old;
          return { ...old, carousels: old.carousels.filter((c: any) => c.id !== id) };
        });
        queryClient.invalidateQueries({ queryKey: getGetCctStatsQueryKey() });
        toast.success(t("ig.carousel.deleted"));
      }
    });
  };

  const handlePosted = (id: number) => {
    postedMutation.mutate({ id }, {
      onSuccess: () => {
        queryClient.setQueryData(getGetInstagramCarouselsQueryKey(), (old: any) => {
          if (!old) return old;
          return { ...old, carousels: old.carousels.filter((c: any) => c.id !== id) };
        });
        toast.success(t("common.movedToArchive"));
      },
      onError: () => {
        toast.error(t("common.archiveError"));
      }
    });
  };

  const getSliderParagraph = (carousel: any, slideIndex: number): string => {
    if (slideIndex === 1) return carousel.contentParagraph1 ?? "";
    if (slideIndex === 2) return carousel.contentParagraph2 ?? "";
    if (slideIndex === 3) return carousel.contentParagraph3 ?? "";
    return "";
  };

  const handleDownloadAll = async (carousel: any) => {
    const slides = [...carousel.slides];
    const totalDownloads = slides.length + 1;
    setExportingId(carousel.id);
    try {
      for (let i = 0; i < slides.length; i++) {
        const slide = slides[i];
        if (slide.type === "cover") {
          await exportSlideAsImage("cover", slide.imageUrl, carousel.headline, "", `carousel-${carousel.id}-cover.jpg`, lang);
        } else if (slide.type === "meme") {
          await exportSlideAsImage("meme", slide.imageUrl, "", "", `carousel-${carousel.id}-meme.jpg`, lang);
        } else {
          const contentIdx = slide.slideIndex;
          await exportSlideAsImage("content", slide.imageUrl, carousel.headline, getSliderParagraph(carousel, contentIdx), `carousel-${carousel.id}-slide${contentIdx}.jpg`, lang);
        }
        await new Promise(r => setTimeout(r, 400));
      }
      await exportSlideAsImage("cta", getCtaBg(carousel.id), "", "", `carousel-${carousel.id}-cta.jpg`, lang);
      toast.success(t("ig.imagesDownloaded", { count: totalDownloads }));
    } catch {
      toast.error(t("common.exportError"));
    } finally {
      setExportingId(null);
    }
  };

  const handleDownloadSingle = async (carousel: any, slideIndex: number) => {
    const slides = [...carousel.slides];
    const ctaIndex = slides.length;
    try {
      if (slideIndex === ctaIndex) {
        await exportSlideAsImage("cta", getCtaBg(carousel.id), "", "", `carousel-${carousel.id}-cta.jpg`, lang);
      } else {
        const slide = slides[slideIndex];
        if (!slide) return;
        if (slide.type === "cover") {
          await exportSlideAsImage("cover", slide.imageUrl, carousel.headline, "", `carousel-${carousel.id}-cover.jpg`, lang);
        } else if (slide.type === "meme") {
          await exportSlideAsImage("meme", slide.imageUrl, "", "", `carousel-${carousel.id}-meme.jpg`, lang);
        } else {
          await exportSlideAsImage("content", slide.imageUrl, carousel.headline, getSliderParagraph(carousel, slide.slideIndex), `carousel-${carousel.id}-slide${slide.slideIndex}.jpg`, lang);
        }
      }
    } catch {
      toast.error(t("common.exportError"));
    }
  };

  return (
    <div className="p-4 md:p-12 w-full animate-in fade-in duration-700 ease-out">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12 border-b border-border/50 pb-8">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <Instagram className="w-6 h-6 text-muted-foreground" />
            <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">Instagram</h1>
          </div>
        </div>
        <button
          onClick={() => { setWizardStep("choose"); setWizardOpen(true); }}
          disabled={isGenerating}
          className="h-10 w-10 rounded-full bg-white text-black flex items-center justify-center hover:bg-white/90 active:scale-[0.93] transition-all disabled:opacity-50 disabled:pointer-events-none cursor-pointer"
          data-testid="button-generate-instagram"
        >
          {isGenerating ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <Plus className="h-5 w-5" strokeWidth={2} />
          )}
        </button>
      </header>
      {isGenerating && (
        <div className="mb-8 md:mb-12 p-6 md:p-10 rounded-2xl border border-primary/20 bg-primary/5 flex flex-col items-center justify-center text-center space-y-5 backdrop-blur-sm">
          <Loader2 className="h-10 w-10 text-primary animate-spin" />
          <div className="space-y-1">
            <div className="font-medium text-lg">
              {generateFromUrlMutation.isPending ? t("ig.loading.fromUrl") : t("ig.loading.carousel")}
            </div>
            <div className="text-sm text-muted-foreground">{t("ig.loading.takesMinutes")}</div>
          </div>
        </div>
      )}
      {generateSlideshowMutation.isPending && (
        <div className="mb-8 md:mb-12 p-6 md:p-10 rounded-2xl border border-primary/20 bg-primary/5 flex flex-col items-center justify-center text-center space-y-5 backdrop-blur-sm">
          <Loader2 className="h-10 w-10 text-primary animate-spin" />
          <div className="space-y-1">
            <div className="font-medium text-lg">{t("ig.loading.slideshow")}</div>
            <div className="text-sm text-muted-foreground">{t("ig.loading.slideshowHint")}</div>
          </div>
        </div>
      )}
      {/* Market Slideshows section — placed ABOVE carousels so it's immediately visible */}
      {slideshows.length > 0 && (
        <div className="mb-16">
          <div className="flex items-center gap-3 mb-6">
            <BarChart3 className="w-5 h-5 text-primary" />
            <h2 className="text-xl font-semibold tracking-tight">Slideshows MKT</h2>
            <span className="text-xs text-muted-foreground">({slideshows.length})</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5 md:gap-8">
            {slideshows.map((s) => {
              const cover = s.slides.find(sl => sl.type === "cover") ?? s.slides[0];
              return (
                <div key={s.id} className="group relative flex flex-col rounded-2xl border border-border/50 bg-card/20 overflow-hidden hover:border-border transition-all duration-300">
                  <div
                    className="cursor-pointer"
                    onClick={() => setSlideshowLightbox({ slideshow: s, index: 0 })}
                  >
                    <MktSlidePreview slide={cover} variantIndex={s.id} lang={lang} />
                  </div>
                  <div className="p-4 space-y-3">
                    <div className="text-sm font-medium leading-snug uppercase tracking-tight line-clamp-2">
                      {s.coverHeadline}
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      {s.marketIds.length} {s.marketIds.length === 1 ? t("ig.market") : t("ig.markets")} · {format(new Date(s.createdAt), "d MMM, HH:mm")}
                    </div>
                    {s.caption && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          navigator.clipboard.writeText(s.caption ?? "");
                          setCopiedSlideshowCaptionId(s.id);
                          setTimeout(() => setCopiedSlideshowCaptionId(null), 1500);
                          toast.success(t("ig.captionCopied"));
                        }}
                        className="w-full text-left text-xs text-muted-foreground/80 bg-white/[0.02] border border-white/[0.05] rounded-lg p-3 hover:bg-white/[0.04] transition-colors cursor-pointer line-clamp-3"
                      >
                        {copiedSlideshowCaptionId === s.id ? (
                          <span className="flex items-center gap-1 text-green-400"><Check className="h-3 w-3" /> {t("common.copied")}</span>
                        ) : s.caption}
                      </button>
                    )}
                    <div className="flex items-center gap-2 pt-1">
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1 h-8 text-xs"
                        onClick={() => handleSlideshowDownloadAll(s)}
                        disabled={exportingSlideshowId === s.id}
                      >
                        {exportingSlideshowId === s.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Download className="h-3 w-3 mr-1" />}
                        {exportingSlideshowId === s.id ? "" : t("ig.download", { count: s.slides.length })}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 px-2"
                        onClick={() => handleSlideshowPosted(s.id)}
                        title={t("common.markPosted")}
                      >
                        <CheckCheck className="h-3 w-3" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 px-2 hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/30"
                        onClick={() => handleSlideshowDelete(s.id)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 md:gap-8">
          {[1, 2, 3].map(i => (
            <div key={i} className="aspect-[4/5] bg-card/20 animate-pulse rounded-2xl border border-border/50" />
          ))}
        </div>
      ) : carousels.length === 0 && !isGenerating ? (
        <div className="flex flex-col items-center justify-center py-16 md:py-32 text-center space-y-4">
          <p className="text-muted-foreground">{t("ig.empty")}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5 md:gap-8">
          {carousels.map((carousel) => {
            const allSlides = [...carousel.slides];
            const coverSlide = allSlides.find((s: any) => s.type === "cover");
            const contentSlides = allSlides.filter((s: any) => s.type === "content");
            const memeSlide = allSlides.find((s: any) => s.type === "meme");
            const slide1 = contentSlides[0];
            const slide2 = contentSlides[1];

            return (
              <div key={carousel.id} className="group relative flex flex-col rounded-2xl border border-border/50 bg-card/20 overflow-hidden hover:border-border transition-all duration-300">
                {/* Cover */}
                <div
                  className="cursor-pointer"
                  onClick={() => setLightboxData({ carousel, currentIndex: 0 })}
                >
                  {coverSlide ? (
                    <CoverSlidePreview imageUrl={coverSlide.imageUrl} headline={carousel.headline} />
                  ) : (
                    <div className="aspect-[4/5] flex items-center justify-center bg-black">
                      <ImageIcon className="h-8 w-8 text-muted-foreground/30" />
                    </div>
                  )}
                </div>

                {/* Sub slides */}
                <div className={`grid ${memeSlide ? "grid-cols-3" : "grid-cols-2"} gap-px bg-border/30`}>
                  {slide1 && (
                    <div
                      className="relative cursor-pointer group/slide overflow-hidden"
                      onClick={() => setLightboxData({ carousel, currentIndex: allSlides.indexOf(slide1) })}
                    >
                      <ContentSlidePreview imageUrl={slide1.imageUrl} paragraph={carousel.contentParagraph1 ?? ""} compact />
                    </div>
                  )}
                  {slide2 && (
                    <div
                      className="relative cursor-pointer group/slide overflow-hidden"
                      onClick={() => setLightboxData({ carousel, currentIndex: allSlides.indexOf(slide2) })}
                    >
                      <ContentSlidePreview imageUrl={slide2.imageUrl} paragraph={carousel.contentParagraph2 ?? ""} compact />
                    </div>
                  )}
                  {memeSlide && (
                    <div
                      className="relative cursor-pointer group/slide overflow-hidden"
                      onClick={() => setLightboxData({ carousel, currentIndex: allSlides.indexOf(memeSlide) })}
                    >
                      <MemeSlidePreview imageUrl={memeSlide.imageUrl} compact />
                    </div>
                  )}
                </div>

                {/* Caption */}
                {carousel.caption && (
                  <div className="px-5 pt-4 pb-2">
                    <div className="relative group/caption">
                      <div className="text-xs text-muted-foreground leading-relaxed pr-8 whitespace-pre-line">
                        {carousel.caption}
                      </div>
                      <button
                        className="absolute top-0 right-0 p-1 rounded text-muted-foreground hover:text-foreground hover:bg-accent transition-colors cursor-pointer"
                        onClick={async () => {
                          try {
                            await navigator.clipboard.writeText(carousel.caption!);
                            setCopiedCaptionId(carousel.id);
                            toast.success(t("ig.captionCopied"));
                            setTimeout(() => setCopiedCaptionId(null), 2000);
                          } catch {
                            toast.error(t("ig.copyFailed"));
                          }
                        }}
                      >
                        {copiedCaptionId === carousel.id ? (
                          <Check className="h-3.5 w-3.5 text-green-500" />
                        ) : (
                          <Copy className="h-3.5 w-3.5" />
                        )}
                      </button>
                    </div>
                  </div>
                )}

                {/* Actions */}
                <div className="p-5 flex items-center justify-between gap-2 flex-wrap bg-card/10">
                  <span className="text-xs text-muted-foreground font-mono">
                    {format(new Date(carousel.createdAt), "MMM d")}
                  </span>
                  <div className="flex items-center gap-1">
                    <StarRatingButton type="ig" id={carousel.id} />
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 rounded-full text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                      onClick={() => handleDelete(carousel.id)}
                      disabled={deleteMutation.isPending}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-xs text-muted-foreground hover:text-green-500 hover:bg-green-500/10 h-8 px-3 rounded-full gap-1.5"
                      onClick={() => handlePosted(carousel.id)}
                      disabled={postedMutation.isPending}
                    >
                      <CheckCheck className="h-3.5 w-3.5" />
                      Posted
                    </Button>
                    <Button
                      variant="secondary"
                      size="icon"
                      className="h-8 w-8 rounded-full bg-primary text-primary-foreground hover:bg-primary/90"
                      onClick={() => handleDownloadAll(carousel)}
                      disabled={exportingId === carousel.id}
                    >
                      {exportingId === carousel.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Download className="h-3.5 w-3.5" />
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
      {/* Slideshow Lightbox */}
      <Dialog open={!!slideshowLightbox} onOpenChange={(open) => !open && setSlideshowLightbox(null)}>
        <DialogContent className="max-w-[100vw] max-h-[100vh] w-screen h-screen p-0 m-0 bg-black/98 border-none flex flex-col items-center justify-center [&>button]:hidden">
          <DialogTitle className="sr-only">Slideshow Preview</DialogTitle>
          {slideshowLightbox && (() => {
            const { slideshow, index } = slideshowLightbox;
            const total = slideshow.slides.length;
            const slide = slideshow.slides[index];
            return (
              <>
                <div className="absolute top-6 right-6 z-50">
                  <button
                    onClick={() => setSlideshowLightbox(null)}
                    className="bg-white/10 hover:bg-white/20 p-3 rounded-full text-white transition-colors cursor-pointer"
                  >
                    <X className="h-6 w-6" />
                  </button>
                </div>
                <div className="relative w-full max-w-md mx-auto h-full flex items-center justify-center p-4 md:p-8">
                  <div className="w-full rounded-lg overflow-hidden shadow-2xl">
                    <MktSlidePreview slide={slide} variantIndex={slideshow.id} lang={lang} />
                  </div>
                  {index > 0 && (
                    <button
                      className="absolute left-2 top-1/2 -translate-y-1/2 bg-white/10 p-3 rounded-full text-white hover:bg-white/20 transition-colors"
                      onClick={() => setSlideshowLightbox({ ...slideshowLightbox, index: index - 1 })}
                    >
                      <ChevronLeft className="h-6 w-6" />
                    </button>
                  )}
                  {index < total - 1 && (
                    <button
                      className="absolute right-2 top-1/2 -translate-y-1/2 bg-white/10 p-3 rounded-full text-white hover:bg-white/20 transition-colors"
                      onClick={() => setSlideshowLightbox({ ...slideshowLightbox, index: index + 1 })}
                    >
                      <ChevronRight className="h-6 w-6" />
                    </button>
                  )}
                </div>
                <div className="absolute bottom-12 flex flex-col items-center gap-5">
                  <button
                    className="p-3.5 rounded-full bg-white/15 hover:bg-white/25 text-white backdrop-blur-sm transition-all cursor-pointer border border-white/10"
                    onClick={() => exportMktSlide(slide, `slideshow-${slideshow.id}-${index + 1}-${slide.type}.jpg`, slideshow.id, lang)}
                  >
                    <Download className="h-5 w-5" />
                  </button>
                  <div className="flex items-center gap-2">
                    {Array.from({ length: total }).map((_, i) => (
                      <div
                        key={i}
                        className={`h-1.5 rounded-full transition-all cursor-pointer ${i === index ? "w-8 bg-white" : "w-2 bg-white/30"}`}
                        onClick={() => setSlideshowLightbox({ ...slideshowLightbox, index: i })}
                      />
                    ))}
                  </div>
                </div>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>
      {/* Wizard Dialog */}
      <Dialog open={wizardOpen} onOpenChange={(open) => { if (!open) { setWizardOpen(false); setWizardStep("choose"); setFeedUrl(""); setMarketIdsInput(""); setUploadPhotos([]); } }}>
        <DialogContent className="max-w-sm p-0 bg-[#0a0a0a] border-border/40 rounded-2xl overflow-hidden [&>button]:hidden">
          <DialogTitle className="sr-only">{t("ig.wizard.title")}</DialogTitle>
          {wizardStep === "choose" ? (
            <div className="p-4 md:p-6 space-y-3">
              <p className="text-xs text-muted-foreground uppercase tracking-widest mb-4 font-medium">{t("ig.wizard.newCarousel")}</p>
              <button
                onClick={handleAutoGen}
                className="w-full flex items-center gap-4 p-4 rounded-xl bg-white/[0.03] border border-white/[0.06] hover:bg-white/[0.06] transition-all cursor-pointer group"
              >
                <div className="h-10 w-10 rounded-full bg-white/[0.06] flex items-center justify-center shrink-0">
                  <Zap className="h-4 w-4 text-white/60 group-hover:text-white/80 transition-colors" />
                </div>
                <div className="text-left">
                  <div className="text-sm font-medium">Auto Gen</div>
                  <div className="text-xs text-muted-foreground mt-0.5">{t("ig.wizard.autoGenDesc")}</div>
                </div>
              </button>
              <button
                onClick={() => setWizardStep("photos")}
                className="w-full flex items-center gap-4 p-4 rounded-xl bg-white/[0.03] border border-white/[0.06] hover:bg-white/[0.06] transition-all cursor-pointer group"
              >
                <div className="h-10 w-10 rounded-full bg-white/[0.06] flex items-center justify-center shrink-0">
                  <ImageIcon className="h-4 w-4 text-white/60 group-hover:text-white/80 transition-colors" />
                </div>
                <div className="text-left">
                  <div className="text-sm font-medium">{lang === "en" ? "With your photos" : "Con tus fotos"}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">{lang === "en" ? "Upload up to 4 photos for the slides" : "Sube hasta 4 fotos para las slides"}</div>
                </div>
              </button>
              <button
                onClick={() => setWizardStep("feed")}
                className="w-full flex items-center gap-4 p-4 rounded-xl bg-white/[0.03] border border-white/[0.06] hover:bg-white/[0.06] transition-all cursor-pointer group"
              >
                <div className="h-10 w-10 rounded-full bg-white/[0.06] flex items-center justify-center shrink-0">
                  <Link2 className="h-4 w-4 text-white/60 group-hover:text-white/80 transition-colors" />
                </div>
                <div className="text-left">
                  <div className="text-sm font-medium">Feed</div>
                  <div className="text-xs text-muted-foreground mt-0.5">{t("ig.wizard.feedDesc")}</div>
                </div>
              </button>
              <button
                onClick={() => { setWizardOpen(false); setWizardStep("choose"); navigate("/engine/cct"); }}
                className="w-full flex items-center gap-4 p-4 rounded-xl bg-white/[0.03] border border-white/[0.06] hover:bg-white/[0.06] transition-all cursor-pointer group"
              >
                <div className="h-10 w-10 rounded-full bg-white/[0.06] flex items-center justify-center shrink-0 overflow-hidden">
                  <img src={omIconUrl} alt="CCT" className="w-full h-full object-cover scale-[1.6]" />
                </div>
                <div className="text-left">
                  <div className="text-sm font-medium">CCT</div>
                  <div className="text-xs text-muted-foreground mt-0.5">{t("ig.wizard.cctDesc")}</div>
                </div>
              </button>
              <button
                onClick={() => setWizardStep("mkt")}
                className="w-full flex items-center gap-4 p-4 rounded-xl bg-white/[0.03] border border-white/[0.06] hover:bg-white/[0.06] transition-all cursor-pointer group"
              >
                <div className="h-10 w-10 rounded-full bg-white/[0.06] flex items-center justify-center shrink-0">
                  <BarChart3 className="h-4 w-4 text-white/60 group-hover:text-white/80 transition-colors" />
                </div>
                <div className="text-left">
                  <div className="text-sm font-medium">Slideshow MKT</div>
                  <div className="text-xs text-muted-foreground mt-0.5">{t("ig.wizard.mktDesc")}</div>
                </div>
              </button>
            </div>
          ) : wizardStep === "photos" ? (
            <div className="p-4 md:p-6">
              <button
                onClick={() => setWizardStep("choose")}
                className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors mb-5 cursor-pointer"
              >
                <ArrowLeft className="h-3 w-3" />
                {t("ig.back")}
              </button>
              <p className="text-xs text-muted-foreground uppercase tracking-widest mb-4 font-medium">
                {lang === "en" ? "Your photos (optional)" : "Tus fotos (opcional)"}
              </p>
              <label className="block w-full border border-dashed border-white/[0.15] rounded-xl p-6 text-center cursor-pointer hover:border-white/30 hover:bg-white/[0.02] transition-colors">
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={(e) => { handlePhotoFiles(e.target.files); e.target.value = ""; }}
                />
                <ImageIcon className="h-5 w-5 mx-auto mb-2 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">
                  {lang === "en" ? "Tap to upload (max 4)" : "Toca para subir (máx. 4)"}
                </span>
              </label>
              {uploadPhotos.length > 0 && (
                <div className="grid grid-cols-4 gap-2 mt-3">
                  {uploadPhotos.map((src, i) => (
                    <div key={i} className="relative aspect-square rounded-lg overflow-hidden border border-white/[0.1]">
                      <img src={src} alt={`Foto ${i + 1}`} className="w-full h-full object-cover" />
                      <button
                        onClick={() => setUploadPhotos((prev) => prev.filter((_, j) => j !== i))}
                        className="absolute top-1 right-1 h-5 w-5 rounded-full bg-black/70 flex items-center justify-center hover:bg-black cursor-pointer"
                      >
                        <X className="h-3 w-3 text-white" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <p className="text-[11px] text-muted-foreground/70 mt-3">
                {lang === "en"
                  ? "Order: 1st photo = cover, then slides. Generate without photos for text-only slides."
                  : "Orden: 1ª foto = portada, luego slides. Genera sin fotos para slides solo de texto."}
              </p>
              <button
                onClick={handlePhotosGenerate}
                className="w-full mt-3 py-3 rounded-xl bg-white text-black text-sm font-medium hover:bg-white/90 active:scale-[0.98] transition-all cursor-pointer"
              >
                {lang === "en" ? "Generate carousel" : "Generar carrusel"}
              </button>
            </div>
          ) : wizardStep === "mkt" ? (
            <div className="p-4 md:p-6">
              <button
                onClick={() => setWizardStep("choose")}
                className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors mb-5 cursor-pointer"
              >
                <ArrowLeft className="h-3 w-3" />
                {t("ig.back")}
              </button>
              <p className="text-xs text-muted-foreground uppercase tracking-widest mb-4 font-medium">{t("ig.wizard.marketIds")}</p>
              <input
                type="text"
                value={marketIdsInput}
                onChange={(e) => setMarketIdsInput(e.target.value)}
                placeholder="552, 892, 812, 872"
                className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-white/20 transition-colors"
                autoFocus
                onKeyDown={(e) => e.key === "Enter" && handleSlideshowGenerate()}
              />
              <p className="text-[11px] text-muted-foreground/70 mt-2">{t("ig.wizard.marketIdsHint")}</p>
              <button
                onClick={handleSlideshowGenerate}
                disabled={!marketIdsInput.trim()}
                className="w-full mt-3 py-3 rounded-xl bg-white text-black text-sm font-medium hover:bg-white/90 active:scale-[0.98] transition-all disabled:opacity-30 disabled:pointer-events-none cursor-pointer"
              >
                {t("ig.wizard.generateSlideshow")}
              </button>
            </div>
          ) : (
            <div className="p-4 md:p-6">
              <button
                onClick={() => setWizardStep("choose")}
                className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors mb-5 cursor-pointer"
              >
                <ArrowLeft className="h-3 w-3" />
                {t("ig.back")}
              </button>
              <p className="text-xs text-muted-foreground uppercase tracking-widest mb-4 font-medium">{t("ig.wizard.newsLink")}</p>
              <input
                type="url"
                value={feedUrl}
                onChange={(e) => setFeedUrl(e.target.value)}
                placeholder="https://..."
                className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-white/20 transition-colors"
                autoFocus
                onKeyDown={(e) => e.key === "Enter" && handleFeedGenerate()}
              />
              <button
                onClick={handleFeedGenerate}
                disabled={!feedUrl.trim()}
                className="w-full mt-3 py-3 rounded-xl bg-white text-black text-sm font-medium hover:bg-white/90 active:scale-[0.98] transition-all disabled:opacity-30 disabled:pointer-events-none cursor-pointer"
              >
                {t("ig.wizard.generateCarousel")}
              </button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Lightbox */}
      <Dialog open={!!lightboxData} onOpenChange={(open) => !open && setLightboxData(null)}>
        <DialogContent className="max-w-[100vw] max-h-[100vh] w-screen h-screen p-0 m-0 bg-black/98 border-none flex flex-col items-center justify-center [&>button]:hidden">
          <DialogTitle className="sr-only">Slide Preview</DialogTitle>
          {lightboxData && (() => {
            const { carousel, currentIndex } = lightboxData;
            const allSlides = [...carousel.slides];
            const totalSlides = allSlides.length + 1;
            const isCtaSlide = currentIndex === allSlides.length;
            const slide = isCtaSlide ? null : allSlides[currentIndex];

            return (
              <>
                <div className="absolute top-6 right-6 z-50">
                  <button
                    onClick={() => setLightboxData(null)}
                    className="bg-white/10 hover:bg-white/20 p-3 rounded-full text-white transition-colors cursor-pointer"
                  >
                    <X className="h-6 w-6" />
                  </button>
                </div>

                <div className="relative w-full max-w-md mx-auto h-full flex items-center justify-center p-4 md:p-8">
                  <div className="w-full rounded-lg overflow-hidden shadow-2xl">
                    {isCtaSlide ? (
                      <CtaSlidePreview bgUrl={getCtaBg(carousel.id)} lang={lang} />
                    ) : slide?.type === "cover" ? (
                      <CoverSlidePreview imageUrl={slide?.imageUrl ?? ""} headline={carousel.headline} />
                    ) : slide?.type === "meme" ? (
                      <MemeSlidePreview imageUrl={slide?.imageUrl ?? ""} />
                    ) : (
                      <ContentSlidePreview
                        imageUrl={slide?.imageUrl ?? ""}
                        paragraph={getSliderParagraph(carousel, slide?.slideIndex ?? 0)}
                      />
                    )}
                  </div>

                  {currentIndex > 0 && (
                    <button
                      className="absolute left-2 top-1/2 -translate-y-1/2 bg-white/10 p-3 rounded-full text-white hover:bg-white/20 transition-colors"
                      onClick={() => setLightboxData({ ...lightboxData, currentIndex: currentIndex - 1 })}
                    >
                      <ChevronLeft className="h-6 w-6" />
                    </button>
                  )}
                  {currentIndex < totalSlides - 1 && (
                    <button
                      className="absolute right-2 top-1/2 -translate-y-1/2 bg-white/10 p-3 rounded-full text-white hover:bg-white/20 transition-colors"
                      onClick={() => setLightboxData({ ...lightboxData, currentIndex: currentIndex + 1 })}
                    >
                      <ChevronRight className="h-6 w-6" />
                    </button>
                  )}
                </div>

                <div className="absolute bottom-12 flex flex-col items-center gap-5">
                  <button
                    className="p-3.5 rounded-full bg-white/15 hover:bg-white/25 text-white backdrop-blur-sm transition-all cursor-pointer border border-white/10"
                    onClick={() => handleDownloadSingle(carousel, currentIndex)}
                  >
                    <Download className="h-5 w-5" />
                  </button>
                  <div className="flex items-center gap-2">
                    {Array.from({ length: totalSlides }).map((_, i) => (
                      <div
                        key={i}
                        className={`h-1.5 rounded-full transition-all cursor-pointer ${i === currentIndex ? "w-8 bg-white" : "w-2 bg-white/30"}`}
                        onClick={() => setLightboxData({ ...lightboxData, currentIndex: i })}
                      />
                    ))}
                  </div>
                </div>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
}
