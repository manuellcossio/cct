import { useState, useRef, useEffect, useCallback } from "react";
import omLogoUrl from "/antiq-logo.png";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetAds,
  useGenerateAd,
  useDeleteAd,
  useMarkAdAsPosted,
  getGetAdsQueryKey,
} from "@workspace/api-client-react";
import { format } from "date-fns";
import { Download, Trash2, Loader2, Sparkles, Megaphone, CheckCheck, X, Wand2, PenLine, Plus } from "lucide-react";
import { StarRatingButton } from "@/components/star-rating";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
const screenshotUrl = `${BASE}/ad-asset-screenshot.jpg`;
const desktopScreenshotUrl = `${BASE}/ad-asset-desktop.png`;

function adSeed(id: number | string): number {
  const s = String(id);
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function playComplete() {
  try { new Audio(`${BASE}/complete.mp3`).play(); } catch {}
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

function proxyUrl(url: string): string {
  return `${BASE}/api/cct/image-proxy?url=${encodeURIComponent(url)}`;
}

function makeLogoTinted(logo: HTMLImageElement, w: number, h: number, color: string): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const x = c.getContext("2d")!;
  x.drawImage(logo, 0, 0, w, h);
  x.globalCompositeOperation = "source-atop";
  x.fillStyle = color;
  x.fillRect(0, 0, w, h);
  return c;
}

const SANS = "Montserrat, Inter, -apple-system, 'Helvetica Neue', Arial, sans-serif";
const ACCENT = "'Libre Baskerville', Georgia, serif";

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
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

function drawPhone(
  ctx: CanvasRenderingContext2D,
  screenshot: HTMLImageElement,
  cx: number,
  topY: number,
  phoneW: number,
  isDark: boolean,
) {
  const phoneH = phoneW * 2.17;
  const cornerR = phoneW * 0.135;
  const bezel = phoneW * 0.025;
  const fx = cx - phoneW / 2;
  const fy = topY;

  ctx.save();

  ctx.shadowColor = isDark ? "rgba(0,0,0,0.8)" : "rgba(0,0,0,0.3)";
  ctx.shadowBlur = isDark ? 90 : 60;
  ctx.shadowOffsetY = isDark ? 30 : 18;
  ctx.fillStyle = isDark ? "#1a1a1c" : "#d2d2d7";
  roundRect(ctx, fx, fy, phoneW, phoneH, cornerR);
  ctx.fill();
  ctx.shadowColor = "transparent";

  const frameGrad = ctx.createLinearGradient(fx, fy, fx + phoneW, fy + phoneH);
  if (isDark) {
    frameGrad.addColorStop(0, "#3a3a3c");
    frameGrad.addColorStop(0.3, "#2c2c2e");
    frameGrad.addColorStop(0.7, "#1c1c1e");
    frameGrad.addColorStop(1, "#2c2c2e");
  } else {
    frameGrad.addColorStop(0, "#f0f0f2");
    frameGrad.addColorStop(0.3, "#e5e5ea");
    frameGrad.addColorStop(0.7, "#d8d8dc");
    frameGrad.addColorStop(1, "#e5e5ea");
  }
  ctx.fillStyle = frameGrad;
  roundRect(ctx, fx, fy, phoneW, phoneH, cornerR);
  ctx.fill();

  ctx.strokeStyle = isDark ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.6)";
  ctx.lineWidth = 1.5;
  roundRect(ctx, fx + 0.5, fy + 0.5, phoneW - 1, phoneH - 1, cornerR);
  ctx.stroke();

  ctx.strokeStyle = isDark ? "rgba(0,0,0,0.5)" : "rgba(0,0,0,0.12)";
  ctx.lineWidth = 1;
  roundRect(ctx, fx, fy, phoneW, phoneH, cornerR);
  ctx.stroke();

  const sx = fx + bezel;
  const sy = fy + bezel;
  const sw = phoneW - bezel * 2;
  const sh = phoneH - bezel * 2;
  const sr = cornerR - bezel;

  ctx.save();
  roundRect(ctx, sx, sy, sw, sh, sr);
  ctx.clip();

  ctx.fillStyle = "#000000";
  ctx.fillRect(sx, sy, sw, sh);

  const imgRatio = screenshot.naturalWidth / screenshot.naturalHeight;
  const screenRatio = sw / sh;
  let dw: number, dh: number, dx: number, dy: number;
  if (imgRatio > screenRatio) {
    dh = sh;
    dw = dh * imgRatio;
    dx = sx - (dw - sw) / 2;
    dy = sy;
  } else {
    dw = sw;
    dh = dw / imgRatio;
    dx = sx;
    dy = sy;
  }
  ctx.drawImage(screenshot, dx, dy, dw, dh);

  const diW = phoneW * 0.26;
  const diH = phoneW * 0.065;
  const diX = cx - diW / 2;
  const diY = sy + phoneW * 0.03;
  const diR = diH / 2;
  ctx.fillStyle = "#000000";
  roundRect(ctx, diX, diY, diW, diH, diR);
  ctx.fill();

  const camR = diH * 0.22;
  const camX = diX + diW - diH * 0.42;
  const camY = diY + diH / 2;
  const camGrad = ctx.createRadialGradient(camX, camY, 0, camX, camY, camR);
  camGrad.addColorStop(0, "#1a2a44");
  camGrad.addColorStop(0.6, "#0d1520");
  camGrad.addColorStop(1, "#111827");
  ctx.fillStyle = camGrad;
  ctx.beginPath();
  ctx.arc(camX, camY, camR, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,0.06)";
  ctx.lineWidth = 0.5;
  ctx.stroke();

  const homeW = phoneW * 0.28;
  const homeH = phoneW * 0.009;
  const homeX = cx - homeW / 2;
  const homeY = sy + sh - phoneW * 0.025;
  ctx.fillStyle = "rgba(255,255,255,0.5)";
  roundRect(ctx, homeX, homeY, homeW, homeH, homeH / 2);
  ctx.fill();

  ctx.restore();

  const btnW = 2;
  const btnR = 1;

  const powerY = fy + phoneH * 0.18;
  const powerH = phoneH * 0.1;
  ctx.fillStyle = isDark ? "#3a3a3c" : "#c8c8cc";
  roundRect(ctx, fx + phoneW - 0.5, powerY, btnW, powerH, btnR);
  ctx.fill();

  const vol1Y = fy + phoneH * 0.18;
  const vol1H = phoneH * 0.055;
  ctx.fillStyle = isDark ? "#3a3a3c" : "#c8c8cc";
  roundRect(ctx, fx - btnW + 0.5, vol1Y, btnW, vol1H, btnR);
  ctx.fill();

  const vol2Y = vol1Y + vol1H + phoneH * 0.015;
  ctx.fillStyle = isDark ? "#3a3a3c" : "#c8c8cc";
  roundRect(ctx, fx - btnW + 0.5, vol2Y, btnW, vol1H, btnR);
  ctx.fill();

  ctx.restore();
}

function drawMacbook(
  ctx: CanvasRenderingContext2D,
  screenshot: HTMLImageElement,
  cx: number,
  topY: number,
  macW: number,
  isDark: boolean,
) {
  const bezel = macW * 0.012;
  const topBezel = macW * 0.028;
  const botBezel = macW * 0.018;
  const screenW = macW - bezel * 2;
  const screenH = screenW * 0.625;
  const lidW = macW;
  const lidH = screenH + topBezel + botBezel;
  const cornerR = macW * 0.018;
  const fx = cx - lidW / 2;
  const fy = topY;

  ctx.save();

  ctx.shadowColor = isDark ? "rgba(0,0,0,0.95)" : "rgba(0,0,0,0.4)";
  ctx.shadowBlur = isDark ? 100 : 70;
  ctx.shadowOffsetY = isDark ? 35 : 20;

  const lidGrad = ctx.createLinearGradient(fx, fy, fx, fy + lidH);
  if (isDark) {
    lidGrad.addColorStop(0, "#333336");
    lidGrad.addColorStop(0.02, "#2a2a2c");
    lidGrad.addColorStop(0.5, "#1c1c1e");
    lidGrad.addColorStop(1, "#232325");
  } else {
    lidGrad.addColorStop(0, "#e8e8ed");
    lidGrad.addColorStop(0.02, "#e0e0e5");
    lidGrad.addColorStop(0.5, "#d4d4d9");
    lidGrad.addColorStop(1, "#dcdce1");
  }
  ctx.fillStyle = lidGrad;
  roundRect(ctx, fx, fy, lidW, lidH, cornerR);
  ctx.fill();
  ctx.shadowColor = "transparent";

  const edgeGrad = ctx.createLinearGradient(fx, fy, fx + lidW, fy);
  if (isDark) {
    edgeGrad.addColorStop(0, "rgba(255,255,255,0.06)");
    edgeGrad.addColorStop(0.5, "rgba(255,255,255,0.02)");
    edgeGrad.addColorStop(1, "rgba(255,255,255,0.06)");
  } else {
    edgeGrad.addColorStop(0, "rgba(255,255,255,0.7)");
    edgeGrad.addColorStop(0.5, "rgba(255,255,255,0.3)");
    edgeGrad.addColorStop(1, "rgba(255,255,255,0.7)");
  }
  ctx.strokeStyle = edgeGrad;
  ctx.lineWidth = 1.5;
  roundRect(ctx, fx + 0.5, fy + 0.5, lidW - 1, lidH - 1, cornerR);
  ctx.stroke();

  ctx.strokeStyle = isDark ? "rgba(0,0,0,0.6)" : "rgba(0,0,0,0.15)";
  ctx.lineWidth = 1;
  roundRect(ctx, fx, fy, lidW, lidH, cornerR);
  ctx.stroke();

  const sx = fx + bezel;
  const sy = fy + topBezel;
  const sw = screenW;
  const sh = screenH;
  const sr = macW * 0.004;

  ctx.fillStyle = "#000000";
  roundRect(ctx, sx - 1, sy - 1, sw + 2, sh + 2, sr + 1);
  ctx.fill();

  ctx.save();
  roundRect(ctx, sx, sy, sw, sh, sr);
  ctx.clip();

  const imgRatio = screenshot.naturalWidth / screenshot.naturalHeight;
  const screenRatio = sw / sh;
  let dw: number, dh: number, dx: number, dy: number;
  if (imgRatio > screenRatio) {
    dh = sh;
    dw = dh * imgRatio;
    dx = sx + (sw - dw) / 2;
    dy = sy;
  } else {
    dw = sw;
    dh = dw / imgRatio;
    dx = sx;
    dy = sy;
  }
  ctx.drawImage(screenshot, dx, dy, dw, dh);

  const glare = ctx.createLinearGradient(sx, sy, sx + sw * 0.7, sy + sh);
  glare.addColorStop(0, "rgba(255,255,255,0.03)");
  glare.addColorStop(0.5, "rgba(255,255,255,0)");
  glare.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = glare;
  ctx.fillRect(sx, sy, sw, sh);

  ctx.restore();

  const camR = macW * 0.0035;
  const camX = cx;
  const camY = fy + topBezel * 0.45;
  ctx.fillStyle = isDark ? "#0a0a0c" : "#2c2c30";
  ctx.beginPath();
  ctx.arc(camX, camY, camR + 1, 0, Math.PI * 2);
  ctx.fill();
  const camGrad = ctx.createRadialGradient(camX - camR * 0.3, camY - camR * 0.3, 0, camX, camY, camR);
  camGrad.addColorStop(0, "#1e3050");
  camGrad.addColorStop(0.5, "#0d1520");
  camGrad.addColorStop(1, "#080c12");
  ctx.fillStyle = camGrad;
  ctx.beginPath();
  ctx.arc(camX, camY, camR, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,0.08)";
  ctx.lineWidth = 0.5;
  ctx.stroke();

  const baseH = macW * 0.008;
  const bw = macW * 1.05;
  const baseX = cx - bw / 2;
  const baseY = fy + lidH;

  const baseGrad = ctx.createLinearGradient(baseX, baseY, baseX, baseY + baseH);
  if (isDark) {
    baseGrad.addColorStop(0, "#48484a");
    baseGrad.addColorStop(0.3, "#3a3a3c");
    baseGrad.addColorStop(1, "#28282a");
  } else {
    baseGrad.addColorStop(0, "#d0d0d4");
    baseGrad.addColorStop(0.3, "#c0c0c4");
    baseGrad.addColorStop(1, "#b8b8bc");
  }
  ctx.fillStyle = baseGrad;
  ctx.beginPath();
  ctx.moveTo(baseX + 2, baseY);
  ctx.lineTo(baseX + bw - 2, baseY);
  ctx.quadraticCurveTo(baseX + bw, baseY, baseX + bw - macW * 0.015, baseY + baseH);
  ctx.lineTo(baseX + macW * 0.015, baseY + baseH);
  ctx.quadraticCurveTo(baseX, baseY, baseX + 2, baseY);
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = isDark ? "rgba(255,255,255,0.05)" : "rgba(255,255,255,0.4)";
  ctx.lineWidth = 0.5;
  ctx.beginPath();
  ctx.moveTo(baseX + 2, baseY + 0.5);
  ctx.lineTo(baseX + bw - 2, baseY + 0.5);
  ctx.stroke();

  const notchW = macW * 0.12;
  const notchH = macW * 0.003;
  const notchX = cx - notchW / 2;
  ctx.fillStyle = isDark ? "#58585a" : "#a8a8ac";
  roundRect(ctx, notchX, baseY - notchH * 0.5, notchW, notchH, notchH / 2);
  ctx.fill();

  ctx.restore();
}

interface HeadlineLayout {
  totalHeight: number;
}

function drawHeadlineWithAccent(
  ctx: CanvasRenderingContext2D,
  headline: string,
  accentWord: string | null,
  centerX: number,
  centerY: number,
  fontSize: number,
  textColor: string,
  accentColor: string,
  maxW: number,
): HeadlineLayout {
  const boldFont = `900 ${fontSize}px ${SANS}`;
  const accentFont = `italic 700 ${Math.round(fontSize * 1.12)}px ${ACCENT}`;
  const lineH = fontSize * 1.18;

  const words = headline.split(" ");
  ctx.font = boldFont;
  const spW = ctx.measureText(" ").width;

  const lines: Array<Array<{ text: string; isAccent: boolean }>> = [];
  let curLine: Array<{ text: string; isAccent: boolean }> = [];
  let curW = 0;

  for (const word of words) {
    const clean = word.toLowerCase().replace(/[.,!?¡¿]/g, "");
    const isAcc = accentWord ? clean === accentWord.toLowerCase().replace(/[.,!?¡¿]/g, "") : false;
    ctx.font = isAcc ? accentFont : boldFont;
    const ww = ctx.measureText(word).width;
    const test = curLine.length > 0 ? curW + spW + ww : ww;

    if (test > maxW && curLine.length > 0) {
      lines.push(curLine);
      curLine = [{ text: word, isAccent: isAcc }];
      curW = ww;
    } else {
      curLine.push({ text: word, isAccent: isAcc });
      curW = test;
    }
  }
  if (curLine.length > 0) lines.push(curLine);

  const totalH = lines.length * lineH;
  let drawY = centerY - totalH / 2;

  for (const line of lines) {
    const measurements: number[] = [];
    let lineWidth = 0;
    for (let i = 0; i < line.length; i++) {
      ctx.font = line[i].isAccent ? accentFont : boldFont;
      const m = ctx.measureText(line[i].text).width;
      measurements.push(m);
      lineWidth += m;
      if (i < line.length - 1) lineWidth += spW;
    }

    let dx = centerX - lineWidth / 2;
    for (let i = 0; i < line.length; i++) {
      ctx.font = line[i].isAccent ? accentFont : boldFont;
      ctx.fillStyle = line[i].isAccent ? accentColor : textColor;
      ctx.textAlign = "left";
      ctx.textBaseline = "top";
      ctx.fillText(line[i].text, dx, drawY);
      dx += measurements[i] + spW;
    }
    drawY += lineH;
  }

  return { totalHeight: totalH };
}

function drawHeadlineLeft(
  ctx: CanvasRenderingContext2D,
  headline: string,
  accentWord: string | null,
  x: number,
  centerY: number,
  fontSize: number,
  textColor: string,
  accentColor: string,
  maxW: number,
): HeadlineLayout {
  const boldFont = `900 ${fontSize}px ${SANS}`;
  const accentFont = `italic 700 ${Math.round(fontSize * 1.04)}px ${ACCENT}`;
  const lineH = fontSize * 1.06;

  const words = headline.split(" ");
  ctx.font = boldFont;
  const spW = ctx.measureText(" ").width;

  const lines: Array<Array<{ text: string; isAccent: boolean }>> = [];
  let curLine: Array<{ text: string; isAccent: boolean }> = [];
  let curW = 0;

  for (const word of words) {
    const clean = word.toLowerCase().replace(/[.,!?¡¿]/g, "");
    const isAcc = accentWord ? clean === accentWord.toLowerCase().replace(/[.,!?¡¿]/g, "") : false;
    ctx.font = isAcc ? accentFont : boldFont;
    const ww = ctx.measureText(word).width;
    const test = curLine.length > 0 ? curW + spW + ww : ww;

    if (test > maxW && curLine.length > 0) {
      lines.push(curLine);
      curLine = [{ text: word, isAccent: isAcc }];
      curW = ww;
    } else {
      curLine.push({ text: word, isAccent: isAcc });
      curW = test;
    }
  }
  if (curLine.length > 0) lines.push(curLine);

  const totalH = lines.length * lineH;
  let drawY = centerY - totalH / 2;

  for (const line of lines) {
    let dx = x;
    for (let i = 0; i < line.length; i++) {
      ctx.font = line[i].isAccent ? accentFont : boldFont;
      ctx.fillStyle = line[i].isAccent ? accentColor : textColor;
      ctx.textAlign = "left";
      ctx.textBaseline = "top";
      ctx.fillText(line[i].text, dx, drawY);
      dx += ctx.measureText(line[i].text).width + spW;
    }
    drawY += lineH;
  }

  return { totalHeight: totalH };
}

function drawSubheadline(
  ctx: CanvasRenderingContext2D,
  text: string,
  cx: number,
  y: number,
  fontSize: number,
  color: string,
  maxW: number,
  italic = false,
  align: "center" | "left" = "center",
) {
  ctx.font = italic ? `italic 700 ${Math.round(fontSize * 1.05)}px ${ACCENT}` : `500 ${fontSize}px ${SANS}`;
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.textBaseline = "top";

  const words = text.split(" ");
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const test = cur ? `${cur} ${w}` : w;
    if (ctx.measureText(test).width > maxW && cur) {
      lines.push(cur);
      cur = w;
    } else {
      cur = test;
    }
  }
  if (cur) lines.push(cur);

  const lh = fontSize * 1.5;
  lines.forEach((line, i) => {
    ctx.fillText(line, cx, y + i * lh);
  });

  return lines.length * lh;
}

async function drawAd(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  headline: string,
  subheadline: string,
  accentWord: string | null,
  style: string,
  backgroundImageUrl: string | null,
  bgColor: string | null = null,
  seed: number = 0,
) {
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";

  headline = headline.replace(/\*/g, "");
  subheadline = subheadline.replace(/\*/g, "");

  const logo = await loadImage(omLogoUrl);
  const logoH = 118;
  const logoW = (logo.naturalWidth / logo.naturalHeight) * logoH;
  const cx = W / 2;
  const textMaxW = W - 160;
  const isSquare = H <= W * 1.3;

  const isLight = (hex: string) => {
    const c = hex.replace("#", "");
    const r = parseInt(c.substring(0, 2), 16);
    const g = parseInt(c.substring(2, 4), 16);
    const b = parseInt(c.substring(4, 6), 16);
    return (r * 299 + g * 587 + b * 114) / 1000 > 140;
  };

  const hasBgImage = !!backgroundImageUrl;

  const drawBgImage = async () => {
    if (!backgroundImageUrl) return;
    try {
      const src = backgroundImageUrl.startsWith("data:") ? backgroundImageUrl : proxyUrl(backgroundImageUrl);
      const bgImg = await loadImage(src);
      const iR = bgImg.naturalWidth / bgImg.naturalHeight;
      const cR = W / H;
      let dw: number, dh: number, dx: number, dy: number;
      if (iR > cR) { dh = H; dw = dh * iR; dx = -(dw - W) / 2; dy = 0; }
      else { dw = W; dh = dw / iR; dx = 0; dy = -(dh - H) / 2; }
      ctx.drawImage(bgImg, dx, dy, dw, dh);
      ctx.fillStyle = "rgba(0,0,0,0.55)";
      ctx.fillRect(0, 0, W, H);
      const tg = ctx.createLinearGradient(0, 0, 0, H * 0.4);
      tg.addColorStop(0, "rgba(0,0,0,0.6)"); tg.addColorStop(1, "transparent");
      ctx.fillStyle = tg; ctx.fillRect(0, 0, W, H * 0.4);
      const bg = ctx.createLinearGradient(0, H * 0.65, 0, H);
      bg.addColorStop(0, "transparent"); bg.addColorStop(1, "rgba(0,0,0,0.7)");
      ctx.fillStyle = bg; ctx.fillRect(0, H * 0.65, W, H * 0.35);
    } catch {}
  };

  if (style === "mockup-dark") {
    if (bgColor) {
      ctx.fillStyle = bgColor;
      ctx.fillRect(0, 0, W, H);
    } else {
      const grd = ctx.createLinearGradient(0, 0, 0, H);
      grd.addColorStop(0, "#111111"); grd.addColorStop(0.5, "#0a0a0a"); grd.addColorStop(1, "#000000");
      ctx.fillStyle = grd; ctx.fillRect(0, 0, W, H);
    }
    if (hasBgImage) await drawBgImage();

    const textOnLight = hasBgImage ? false : (bgColor ? isLight(bgColor) : false);
    const fg = textOnLight ? "#1d1d1f" : "#ffffff";
    const fgSub = textOnLight ? "rgba(0,0,0,0.25)" : "rgba(255,255,255,0.25)";
    const fgSubText = textOnLight ? "rgba(0,0,0,0.4)" : "rgba(255,255,255,0.4)";
    const logoColor = textOnLight ? "#1d1d1f" : "#ffffff";

    const tintedLogo = makeLogoTinted(logo, Math.round(logoW * 2), Math.round(logoH * 2), logoColor);
    ctx.globalAlpha = 0.9;
    ctx.drawImage(tintedLogo, cx - logoW / 2, 90, logoW, logoH);
    ctx.globalAlpha = 1;

    ctx.font = `400 26px ${SANS}`;
    ctx.fillStyle = fgSub;
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillText("★★★★★", cx, 175);
    ctx.font = `400 18px ${SANS}`;
    ctx.fillStyle = fgSubText;
    ctx.fillText("+1000 usuarios", cx, 215);

    const headY = isSquare ? Math.round(H * 0.2) : 480;
    const headResult = drawHeadlineWithAccent(ctx, headline, accentWord, cx, headY, isSquare ? 80 : 96, fg, fg, textMaxW);

    const subBottom = subheadline
      ? headY + headResult.totalHeight / 2 + 30 + drawSubheadline(ctx, subheadline, cx, headY + headResult.totalHeight / 2 + 30, 32, fgSubText, textMaxW - 60)
      : headY + headResult.totalHeight / 2;

    try {
      const useDesktop = seed % 2 === 0;
      if (useDesktop) {
        const desktopScreenshot = await loadImage(desktopScreenshotUrl);
        const macTopY = Math.max(subBottom + 40, isSquare ? H * 0.42 : H * 0.52);
        const macW = Math.min(W * 0.88, (H - macTopY - 40) / 0.62);
        drawMacbook(ctx, desktopScreenshot, cx, macTopY, macW, !textOnLight);
      } else {
        const screenshot = await loadImage(screenshotUrl);
        const phoneTopY = Math.max(subBottom + 40, isSquare ? H * 0.4 : H * 0.48);
        const phoneW = Math.min(W * 0.68, (H - phoneTopY - 40) / 2.17);
        drawPhone(ctx, screenshot, cx, phoneTopY, phoneW, !textOnLight);
      }
    } catch {}

  } else if (style === "mockup-light") {
    ctx.fillStyle = "#f5f5f7";
    ctx.fillRect(0, 0, W, H);
    if (hasBgImage) await drawBgImage();

    const onDark = hasBgImage;
    const fg = onDark ? "#ffffff" : "#1d1d1f";
    const fgSub = onDark ? "rgba(255,255,255,0.25)" : "rgba(0,0,0,0.15)";
    const fgSubText = onDark ? "rgba(255,255,255,0.4)" : "rgba(0,0,0,0.25)";
    const accentClr = onDark ? "#ffffff" : "#2563eb";
    const logoColor = onDark ? "#ffffff" : "#1d1d1f";

    const tintedLogo = makeLogoTinted(logo, Math.round(logoW * 2), Math.round(logoH * 2), logoColor);
    ctx.drawImage(tintedLogo, cx - logoW / 2, 90, logoW, logoH);

    ctx.font = `400 26px ${SANS}`;
    ctx.fillStyle = fgSub;
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillText("★★★★★", cx, 175);
    ctx.font = `400 18px ${SANS}`;
    ctx.fillStyle = fgSubText;
    ctx.fillText("+1000 usuarios", cx, 215);

    const headY = isSquare ? Math.round(H * 0.2) : 480;
    const headResult = drawHeadlineWithAccent(ctx, headline, accentWord, cx, headY, isSquare ? 82 : 100, fg, accentClr, textMaxW);

    const subBottom = subheadline
      ? headY + headResult.totalHeight / 2 + 30 + drawSubheadline(ctx, subheadline, cx, headY + headResult.totalHeight / 2 + 30, 30, fgSubText, textMaxW - 60)
      : headY + headResult.totalHeight / 2;

    try {
      const useDesktop = seed % 2 === 0;
      if (useDesktop) {
        const desktopScreenshot = await loadImage(desktopScreenshotUrl);
        const macTopY = Math.max(subBottom + 40, isSquare ? H * 0.42 : H * 0.52);
        const macW = Math.min(W * 0.88, (H - macTopY - 40) / 0.62);
        drawMacbook(ctx, desktopScreenshot, cx, macTopY, macW, onDark);
      } else {
        const screenshot = await loadImage(screenshotUrl);
        const phoneTopY = Math.max(subBottom + 40, isSquare ? H * 0.4 : H * 0.48);
        const phoneW = Math.min(W * 0.66, (H - phoneTopY - 40) / 2.17);
        drawPhone(ctx, screenshot, cx, phoneTopY, phoneW, onDark);
      }
    } catch {}

  } else if (style === "center" || style === "photo-bg") {
    ctx.fillStyle = "#0a0a0a";
    ctx.fillRect(0, 0, W, H);
    if (hasBgImage) await drawBgImage();

    const whiteLogo = makeLogoTinted(logo, Math.round(logoW * 2), Math.round(logoH * 2), "#ffffff");
    ctx.globalAlpha = 0.9;
    ctx.drawImage(whiteLogo, cx - logoW / 2, 100, logoW, logoH);
    ctx.globalAlpha = 1;

    const headY = H * 0.48;
    const headResult = drawHeadlineWithAccent(ctx, headline, accentWord, cx, headY, 100, "#ffffff", "#ffffff", textMaxW);

    if (subheadline) {
      const subY = headY + headResult.totalHeight / 2 + 40;
      drawSubheadline(ctx, subheadline, cx, subY, 38, "rgba(255,255,255,0.75)", textMaxW - 40, true);
    }

  } else if (style === "emotion") {
    ctx.fillStyle = "#0a0a0a";
    ctx.fillRect(0, 0, W, H);

    if (hasBgImage && backgroundImageUrl) {
      try {
        const src = backgroundImageUrl.startsWith("data:") ? backgroundImageUrl : proxyUrl(backgroundImageUrl);
        const bgImg = await loadImage(src);
        const iR = bgImg.naturalWidth / bgImg.naturalHeight;
        const cR = W / H;
        let dw: number, dh: number, dx: number, dy: number;
        if (iR > cR) { dh = H; dw = dh * iR; dx = -(dw - W) / 2; dy = 0; }
        else { dw = W; dh = dw / iR; dx = 0; dy = -(dh - H) / 2; }
        ctx.drawImage(bgImg, dx, dy, dw, dh);
      } catch {}

      ctx.fillStyle = "rgba(6,8,10,0.30)";
      ctx.fillRect(0, 0, W, H);

      const tg = ctx.createLinearGradient(0, 0, 0, H * 0.32);
      tg.addColorStop(0, "rgba(0,0,0,0.55)"); tg.addColorStop(1, "transparent");
      ctx.fillStyle = tg; ctx.fillRect(0, 0, W, H * 0.32);

      const bgr = ctx.createLinearGradient(0, H * 0.30, 0, H);
      bgr.addColorStop(0, "transparent");
      bgr.addColorStop(0.55, "rgba(0,0,0,0.45)");
      bgr.addColorStop(1, "rgba(0,0,0,0.88)");
      ctx.fillStyle = bgr; ctx.fillRect(0, H * 0.30, W, H * 0.70);

      const vg = ctx.createRadialGradient(W / 2, H / 2, H * 0.2, W / 2, H / 2, H * 0.78);
      vg.addColorStop(0, "transparent"); vg.addColorStop(1, "rgba(0,0,0,0.38)");
      ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);
    } else {
      const grd = ctx.createLinearGradient(0, 0, W, H);
      grd.addColorStop(0, "#1b1b22"); grd.addColorStop(0.55, "#0d0d11"); grd.addColorStop(1, "#000000");
      ctx.fillStyle = grd; ctx.fillRect(0, 0, W, H);
    }

    const LM = 96;

    const eLogoH = 150;
    const eLogoW = (logo.naturalWidth / logo.naturalHeight) * eLogoH;
    const whiteLogo = makeLogoTinted(logo, Math.round(eLogoW * 2), Math.round(eLogoH * 2), "#ffffff");
    const lockTop = 72;
    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,0.5)";
    ctx.shadowBlur = 26;
    ctx.shadowOffsetY = 2;
    ctx.globalAlpha = 1;
    ctx.drawImage(whiteLogo, cx - eLogoW / 2, lockTop, eLogoW, eLogoH);

    ctx.textAlign = "center";
    ctx.textBaseline = "alphabetic";

    const starsY = lockTop + eLogoH + 40;
    ctx.shadowBlur = 16;
    ctx.fillStyle = "#ffc863";
    ctx.font = "400 42px 'Montserrat', sans-serif";
    ctx.fillText("★ ★ ★ ★ ★", cx, starsY);

    ctx.fillStyle = "rgba(255,255,255,0.94)";
    ctx.font = "700 30px 'Montserrat', sans-serif";
    ctx.letterSpacing = "2px";
    ctx.fillText("+1500 USUARIOS ACTIVOS", cx, starsY + 46);
    ctx.letterSpacing = "0px";
    ctx.restore();

    const eMaxW = W - LM - 110;
    const hLen = headline.length;
    const eFont = hLen > 34 ? 96 : hLen > 22 ? 116 : 138;
    const headCenterY = H * 0.6;

    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,0.45)";
    ctx.shadowBlur = 30;
    ctx.shadowOffsetY = 2;
    const headRes = drawHeadlineLeft(ctx, headline, accentWord, LM, headCenterY, eFont, "#ffffff", "#ffffff", eMaxW);
    ctx.restore();

    if (subheadline) {
      const subY = headCenterY + headRes.totalHeight / 2 + 36;
      ctx.save();
      ctx.shadowColor = "rgba(0,0,0,0.5)";
      ctx.shadowBlur = 18;
      ctx.shadowOffsetY = 1;
      drawSubheadline(ctx, subheadline, LM, subY, 36, "rgba(255,255,255,0.82)", eMaxW - 30, false, "left");
      ctx.restore();
    }

    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,0.5)";
    ctx.shadowBlur = 16;
    ctx.shadowOffsetY = 1;
    ctx.textAlign = "center";
    ctx.textBaseline = "alphabetic";
    ctx.fillStyle = "rgba(255,255,255,0.94)";
    ctx.font = "700 30px 'Montserrat', sans-serif";
    ctx.letterSpacing = "2px";
    ctx.fillText("ANTIQ.XYZ", cx, H - 78);
    ctx.letterSpacing = "0px";
    ctx.restore();

  }
}

async function exportAd(
  headline: string,
  subheadline: string,
  accentWord: string | null,
  style: string,
  backgroundImageUrl: string | null,
  filename: string,
  bgColor: string | null = null,
  imageData: string | null = null,
  seed: number = 0,
  format: string = "story",
) {
  try {
    await document.fonts.load("900 48px 'Montserrat'");
    await document.fonts.load("italic 700 48px 'Libre Baskerville'");
  } catch {}
  const W = 1080;
  const H = format === "post" ? 1080 : 1920;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;
  const bgSrc = imageData || backgroundImageUrl;
  await drawAd(ctx, W, H, headline, subheadline, accentWord, style, bgSrc, bgColor, seed);
  const url = canvas.toDataURL("image/jpeg", 0.97);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
}

function AdCanvas({ headline, subheadline, accentWord, style, backgroundImageUrl, imageData, bgColor, seed, format = "story" }: {
  headline: string;
  subheadline: string;
  accentWord: string | null;
  style: string;
  backgroundImageUrl: string | null;
  imageData?: string | null;
  bgColor: string | null;
  seed: number;
  format?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const keyRef = useRef("");
  const [ready, setReady] = useState(false);

  const bgSrc = imageData || backgroundImageUrl;

  const key = `${headline}|${subheadline}|${accentWord}|${style}|${bgSrc}|${bgColor}|${format}`;

  const draw = useCallback(async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    try {
      await document.fonts.load("900 48px 'Montserrat'");
      await document.fonts.load("italic 700 48px 'Libre Baskerville'");
    } catch {}
    const W = 1080;
    const H = format === "post" ? 1080 : 1920;
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext("2d")!;
    try {
      await drawAd(ctx, W, H, headline, subheadline, accentWord, style, bgSrc, bgColor, seed);
    } catch {}
    setReady(true);
  }, [headline, subheadline, accentWord, style, bgSrc, bgColor, seed, format]);

  useEffect(() => {
    if (keyRef.current !== key) {
      keyRef.current = key;
      setReady(false);
      draw();
    }
  }, [key, draw]);

  return (
    <div className={`w-full relative ${format === "post" ? "aspect-square" : "aspect-[9/16]"}`}>
      <canvas
        ref={canvasRef}
        style={{ width: "100%", height: "100%", display: "block", objectFit: "contain", opacity: ready ? 1 : 0, transition: "opacity 0.3s ease" }}
        className="rounded-lg"
      />
      {!ready && (
        <div className="absolute inset-0 flex items-center justify-center bg-card/20 rounded-lg">
          <Loader2 className="h-5 w-5 text-muted-foreground animate-spin" />
        </div>
      )}
    </div>
  );
}

export default function AdGenPage() {
  const { t, lang } = useI18n();
  const queryClient = useQueryClient();
  const { data, isLoading } = useGetAds();
  const generateMutation = useGenerateAd();
  const deleteMutation = useDeleteAd();
  const postedMutation = useMarkAdAsPosted();

  const [lightboxAd, setLightboxAd] = useState<any | null>(null);
  const [exportingId, setExportingId] = useState<number | null>(null);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [wizardStep, setWizardStep] = useState<"choose" | "design">("choose");
  const [customText, setCustomText] = useState("");
  const [designStyle, setDesignStyle] = useState<"mockup-dark" | "mockup-light" | "center" | "emotion">("mockup-dark");
  const [adFormat, setAdFormat] = useState<"story" | "post">("story");
  const [addBgImage, setAddBgImage] = useState(false);
  const [customBgColor, setCustomBgColor] = useState<string | null>("#000000");
  const [addCustomSub, setAddCustomSub] = useState(false);
  const [customSubtitle, setCustomSubtitle] = useState("");

  const ads = data?.ads || [];

  const [queueCount, setQueueCount] = useState(0);
  const queueRef = useRef<Array<{ data: any }>>([]);
  const processingRef = useRef(false);

  const processQueue = useCallback(async () => {
    if (processingRef.current) return;
    processingRef.current = true;
    try {
      while (queueRef.current.length > 0) {
        const payload = queueRef.current.shift()!;
        try {
          await generateMutation.mutateAsync(payload);
          queryClient.invalidateQueries({ queryKey: getGetAdsQueryKey() });
          playComplete();
          toast.success(t("ad.generated"));
        } catch {
          toast.error(t("ad.generateError"));
        } finally {
          setQueueCount((c) => Math.max(0, c - 1));
        }
      }
    } finally {
      processingRef.current = false;
    }
  }, [generateMutation, queryClient, t]);

  const enqueue = useCallback((payload: { data: any }) => {
    queueRef.current.push(payload);
    setQueueCount((c) => c + 1);
    void processQueue();
  }, [processQueue]);

  const handleGenerate = (custom?: { headline: string }) => {
    const payload = custom ? { data: { customHeadline: custom.headline, format: adFormat, lang } } : { data: { format: adFormat, lang } };
    enqueue(payload);
  };

  const handleAutoGen = () => {
    setWizardOpen(false);
    setWizardStep("choose");
    handleGenerate();
  };

  const handleDesignSubmit = () => {
    if (!customText.trim()) return;
    setWizardOpen(false);
    setWizardStep("choose");
    const payload = {
      data: {
        customHeadline: customText.trim(),
        customSubheadline: (addCustomSub && customSubtitle.trim()) ? customSubtitle.trim() : undefined,
        noSubheadline: !addCustomSub ? true : undefined,
        style: designStyle as any,
        format: adFormat,
        addBackgroundImage: designStyle === "emotion" ? true : addBgImage,
        bgColor: (designStyle === "mockup-dark" && !addBgImage && customBgColor) ? customBgColor : undefined,
        lang,
      },
    };
    enqueue(payload);
    setCustomText("");
    setDesignStyle("mockup-dark");
    setAdFormat("story");
    setAddBgImage(false);
    setCustomBgColor("#000000");
    setAddCustomSub(false);
    setCustomSubtitle("");
  };

  const handleDelete = (id: number) => {
    deleteMutation.mutate({ id }, {
      onSuccess: () => {
        queryClient.setQueryData(getGetAdsQueryKey(), (old: any) => {
          if (!old) return old;
          return { ...old, ads: old.ads.filter((a: any) => a.id !== id) };
        });
        toast.success(t("ad.deleted"));
      },
      onError: () => {
        toast.error(t("ad.deleteError"));
      },
    });
  };

  const handlePosted = (id: number) => {
    postedMutation.mutate({ id }, {
      onSuccess: () => {
        queryClient.setQueryData(getGetAdsQueryKey(), (old: any) => {
          if (!old) return old;
          return { ...old, ads: old.ads.filter((a: any) => a.id !== id) };
        });
        toast.success(t("ad.markedPosted"));
      },
      onError: () => {
        toast.error(t("ad.markError"));
      },
    });
  };

  const handleDownload = async (ad: any) => {
    setExportingId(ad.id);
    try {
      await exportAd(
        ad.headline,
        ad.subheadline ?? "",
        ad.accentWord ?? null,
        ad.style,
        ad.backgroundImageUrl ?? null,
        `ad-${ad.id}.jpg`,
        ad.bgColor ?? null,
        ad.imageData ?? null,
        adSeed(ad.id),
        (ad as any).format ?? "story",
      );
      toast.success(t("common.imageDownloaded"));
    } catch {
      toast.error(t("common.exportError"));
    } finally {
      setExportingId(null);
    }
  };

  return (
    <div className="p-4 md:p-12 w-full animate-in fade-in duration-700 ease-out">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-8 md:mb-12 border-b border-border/50 pb-5 md:pb-8">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <Megaphone className="w-6 h-6 text-muted-foreground" />
            <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">v0.1.8.8.2</h1>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {queueCount > 0 && (
            <span className="flex items-center gap-2 text-xs text-muted-foreground tabular-nums">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              {lang === "es" ? `Generando ${queueCount}` : `Generating ${queueCount}`}
            </span>
          )}
          <button
            onClick={() => { setWizardStep("choose"); setWizardOpen(true); }}
            className="h-10 w-10 rounded-full bg-white text-black flex items-center justify-center hover:bg-white/90 active:scale-[0.93] transition-all cursor-pointer"
          >
            <Plus className={`h-5 w-5 transition-transform duration-300 ${wizardOpen ? "rotate-45" : ""}`} strokeWidth={2} />
          </button>
        </div>
      </header>
      <Dialog open={wizardOpen} onOpenChange={(open) => { if (!open) { setWizardOpen(false); setWizardStep("choose"); setCustomText(""); } }}>
        <DialogContent className="max-w-[95vw] sm:max-w-[380px] max-h-[90dvh] overflow-y-auto p-0 bg-card/95 backdrop-blur-2xl border-border/20 rounded-[28px] shadow-2xl shadow-black/40 [&>button]:hidden [--tw-enter-translate-x:0]! [--tw-enter-translate-y:0]! [--tw-exit-translate-x:0]! [--tw-exit-translate-y:0]!">
          <DialogTitle className="sr-only">{t("ad.wizard.title")}</DialogTitle>

          {wizardStep === "choose" && (
            <div className="p-5 md:p-7 space-y-3">
              <h3 className="text-[15px] font-semibold tracking-tight text-center pb-1">{t("ad.wizard.new")}</h3>
              <button
                onClick={handleAutoGen}
                className="w-full flex items-center gap-3.5 p-3.5 rounded-2xl bg-white/[0.04] hover:bg-white/[0.08] transition-all text-left cursor-pointer group"
              >
                <div className="h-9 w-9 rounded-xl bg-white/[0.06] flex items-center justify-center shrink-0 group-hover:bg-white/[0.1] transition-colors">
                  <Wand2 className="h-4 w-4 text-muted-foreground" />
                </div>
                <span className="font-medium text-[13px]">Auto Gen</span>
              </button>
              <button
                onClick={() => setWizardStep("design")}
                className="w-full flex items-center gap-3.5 p-3.5 rounded-2xl bg-white/[0.04] hover:bg-white/[0.08] transition-all text-left cursor-pointer group"
              >
                <div className="h-9 w-9 rounded-xl bg-white/[0.06] flex items-center justify-center shrink-0 group-hover:bg-white/[0.1] transition-colors">
                  <PenLine className="h-4 w-4 text-muted-foreground" />
                </div>
                <span className="font-medium text-[13px]">Design</span>
              </button>
            </div>
          )}

          {wizardStep === "design" && (
            <div className="p-5 md:p-7 space-y-5">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setWizardStep("choose")}
                  className="text-muted-foreground/60 hover:text-foreground transition-colors cursor-pointer"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
                </button>
                <h3 className="text-[15px] font-semibold tracking-tight">Design</h3>
              </div>
              <div className="space-y-2">
                <label className="text-[11px] font-medium text-muted-foreground/50 uppercase tracking-widest">{t("ad.field.text")}</label>
                <input
                  type="text"
                  value={customText}
                  onChange={(e) => setCustomText(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleDesignSubmit()}
                  placeholder={t("ad.field.textPlaceholder")}
                  autoFocus
                  className="w-full px-4 py-3 rounded-2xl border border-white/[0.06] bg-white/[0.03] text-sm placeholder:text-muted-foreground/30 focus:outline-none focus:ring-1 focus:ring-white/10 focus:border-white/10 transition-all"
                  maxLength={50}
                />
                <p className="text-[10px] text-muted-foreground/30 text-right tabular-nums">{customText.length}/50</p>
              </div>

              <div className="space-y-2.5">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={addCustomSub}
                    onChange={(e) => setAddCustomSub(e.target.checked)}
                    className="w-4 h-4 rounded-md accent-primary"
                  />
                  <span className="text-[13px] font-medium">{t("ad.field.subtitle")}</span>
                </label>
                {addCustomSub && (
                  <input
                    type="text"
                    value={customSubtitle}
                    onChange={(e) => setCustomSubtitle(e.target.value)}
                    placeholder={t("ad.field.subtitlePlaceholder")}
                    className="w-full px-4 py-3 rounded-2xl border border-white/[0.06] bg-white/[0.03] text-sm placeholder:text-muted-foreground/30 focus:outline-none focus:ring-1 focus:ring-white/10 focus:border-white/10 transition-all"
                    maxLength={60}
                  />
                )}
              </div>

              <div className="space-y-2.5">
                <label className="text-[11px] font-medium text-muted-foreground/50 uppercase tracking-widest">Template</label>
                <div className="grid grid-cols-2 gap-2">
                  {([
                    { value: "mockup-dark" as const, label: "Mockup Dark" },
                    { value: "mockup-light" as const, label: "Mockup Light" },
                    { value: "center" as const, label: "Center" },
                    { value: "emotion" as const, label: "Emotion" },
                  ]).map((t) => (
                    <button
                      key={t.value}
                      onClick={() => setDesignStyle(t.value)}
                      className={`py-2.5 rounded-xl text-[12px] font-medium transition-all cursor-pointer ${
                        designStyle === t.value
                          ? "bg-white text-black"
                          : "bg-white/[0.04] text-muted-foreground hover:bg-white/[0.08]"
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2.5">
                <label className="text-[11px] font-medium text-muted-foreground/50 uppercase tracking-widest">{lang === "es" ? "Formato" : "Format"}</label>
                <div className="grid grid-cols-2 gap-2">
                  {([
                    { value: "story" as const, label: "9:16 (Story)" },
                    { value: "post" as const, label: lang === "es" ? "1:1 (Post)" : "1:1 (Post)" },
                  ]).map((f) => (
                    <button
                      key={f.value}
                      onClick={() => setAdFormat(f.value)}
                      className={`py-2.5 rounded-xl text-[12px] font-medium transition-all cursor-pointer ${
                        adFormat === f.value
                          ? "bg-white text-black"
                          : "bg-white/[0.04] text-muted-foreground hover:bg-white/[0.08]"
                      }`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>

              {designStyle === "emotion" ? (
                <p className="text-[12px] text-muted-foreground/60 leading-relaxed">
                  {t("ad.field.emotionHint")}
                </p>
              ) : (
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={addBgImage}
                    onChange={(e) => setAddBgImage(e.target.checked)}
                    className="w-4 h-4 rounded-md accent-primary"
                  />
                  <span className="text-[13px] font-medium">{t("ad.field.bgImage")}</span>
                </label>
              )}

              {designStyle === "mockup-dark" && !addBgImage && (
                <div className="space-y-2.5">
                  <label className="text-[11px] font-medium text-muted-foreground/50 uppercase tracking-widest">{t("ad.field.bgColor")}</label>
                  <div className="flex items-center gap-2.5 flex-wrap">
                    {([
                      { value: "#000000", label: t("ad.color.black") },
                      { value: "#f5f5f7", label: t("ad.color.white") },
                      { value: "#1a3a5c", label: t("ad.color.blue") },
                      { value: "#4a1942", label: t("ad.color.purple") },
                      { value: "#1b4332", label: t("ad.color.green") },
                      { value: "#7f1d1d", label: t("ad.color.red") },
                      { value: "#78350f", label: t("ad.color.amber") },
                      { value: "#334155", label: t("ad.color.slate") },
                    ]).map((opt) => {
                      const selected = customBgColor === opt.value;
                      return (
                        <button
                          key={opt.value}
                          title={opt.label}
                          onClick={() => setCustomBgColor(opt.value)}
                          className={`w-8 h-8 rounded-full border-[1.5px] transition-all cursor-pointer ${
                            selected
                              ? "border-white/60 ring-[1.5px] ring-white/20 ring-offset-1 ring-offset-background scale-110"
                              : "border-white/[0.08] hover:border-white/20 hover:scale-105"
                          }`}
                          style={{ backgroundColor: opt.value }}
                        />
                      );
                    })}
                    <label
                      title={t("ad.field.customColor")}
                      className={`relative w-8 h-8 rounded-full border-[1.5px] transition-all cursor-pointer overflow-hidden ${
                        customBgColor && !["#000000","#f5f5f7","#1a3a5c","#4a1942","#1b4332","#7f1d1d","#78350f","#334155"].includes(customBgColor)
                          ? "border-white/60 ring-[1.5px] ring-white/20 ring-offset-1 ring-offset-background scale-110"
                          : "border-white/[0.08] hover:border-white/20 hover:scale-105"
                      }`}
                      style={{
                        background: customBgColor && !["#000000","#f5f5f7","#1a3a5c","#4a1942","#1b4332","#7f1d1d","#78350f","#334155"].includes(customBgColor)
                          ? customBgColor
                          : "conic-gradient(red, yellow, lime, aqua, blue, magenta, red)",
                      }}
                    >
                      <input
                        type="color"
                        value={customBgColor || "#000000"}
                        onChange={(e) => setCustomBgColor(e.target.value)}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                      />
                    </label>
                  </div>
                </div>
              )}

              <button
                onClick={handleDesignSubmit}
                disabled={!customText.trim()}
                className="w-full h-11 rounded-2xl bg-white text-black text-[13px] font-medium hover:bg-white/90 active:scale-[0.98] transition-all disabled:opacity-40 disabled:pointer-events-none cursor-pointer"
              >
                Start Gen
              </button>
            </div>
          )}
        </DialogContent>
      </Dialog>
      {isLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-6">
          {[1, 2, 3].map(i => (
            <div key={i} className="aspect-[9/16] bg-card/20 animate-pulse rounded-2xl border border-border/50" />
          ))}
        </div>
      ) : ads.length === 0 && queueCount === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 md:py-32 text-center space-y-4">
          <Megaphone className="h-12 w-12 text-muted-foreground/30" />
          <p className="text-muted-foreground">{t("ad.empty")}</p>
          <p className="text-sm text-muted-foreground/60">{t("ad.emptyHint")}</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-6">
          {Array.from({ length: queueCount }).map((_, i) => (
            <div key={`queue-${i}`} className="aspect-[9/16] rounded-2xl border border-primary/20 bg-primary/5 flex flex-col items-center justify-center gap-3 animate-pulse">
              <Loader2 className="h-7 w-7 text-primary animate-spin" />
              <span className="text-xs text-muted-foreground">{lang === "es" ? "Generando…" : "Generating…"}</span>
            </div>
          ))}
          {ads.map((ad) => (
            <div key={ad.id} className="group flex flex-col rounded-2xl border border-border/50 bg-card/20 overflow-hidden hover:border-border transition-all duration-300">
              <div
                className="cursor-pointer"
                onClick={() => setLightboxAd(ad)}
              >
                <AdCanvas
                  headline={ad.headline}
                  subheadline={ad.subheadline ?? ""}
                  accentWord={ad.accentWord ?? null}
                  style={ad.style}
                  backgroundImageUrl={ad.backgroundImageUrl ?? null}
                  imageData={(ad as any).imageData ?? null}
                  bgColor={(ad as any).bgColor ?? null}
                  seed={adSeed(ad.id)}
                  format={(ad as any).format ?? "story"}
                />
              </div>

              <div className="p-3 flex flex-wrap items-center justify-between gap-2 bg-card/10">
                <div className="flex flex-col gap-0.5">
                  <span className="text-xs text-muted-foreground font-mono">
                    {format(new Date(ad.createdAt), "MMM d")}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <StarRatingButton type="ad" id={ad.id} size="sm" />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 rounded-full text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                    onClick={() => handleDelete(ad.id)}
                    disabled={deleteMutation.isPending}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-xs text-muted-foreground hover:text-green-500 hover:bg-green-500/10 h-7 px-2 rounded-full gap-1"
                    onClick={() => handlePosted(ad.id)}
                    disabled={postedMutation.isPending}
                  >
                    <CheckCheck className="h-3 w-3" />
                    Posted
                  </Button>
                  <Button
                    variant="secondary"
                    size="icon"
                    className="h-7 w-7 rounded-full bg-primary text-primary-foreground hover:bg-primary/90"
                    onClick={() => handleDownload(ad)}
                    disabled={exportingId === ad.id}
                  >
                    {exportingId === ad.id ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Download className="h-3 w-3" />
                    )}
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      <Dialog open={!!lightboxAd} onOpenChange={(open) => !open && setLightboxAd(null)}>
        <DialogContent className="max-w-[100vw] max-h-[100vh] w-screen h-screen p-0 m-0 bg-black/98 border-none flex flex-col items-center justify-center [&>button]:hidden">
          <DialogTitle className="sr-only">Ad Preview</DialogTitle>
          {lightboxAd && (
            <>
              <div className="absolute top-6 right-6 z-50">
                <button
                  onClick={() => setLightboxAd(null)}
                  className="bg-white/10 hover:bg-white/20 p-3 rounded-full text-white transition-colors cursor-pointer"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>
              <div className="relative h-full flex items-center justify-center p-4 md:p-8">
                <div className={`h-full max-h-[85vh] max-w-full rounded-lg overflow-hidden shadow-2xl ${(lightboxAd.format ?? "story") === "post" ? "aspect-square" : "aspect-[9/16]"}`}>
                  <AdCanvas
                    headline={lightboxAd.headline}
                    subheadline={lightboxAd.subheadline ?? ""}
                    accentWord={lightboxAd.accentWord ?? null}
                    style={lightboxAd.style}
                    backgroundImageUrl={lightboxAd.backgroundImageUrl ?? null}
                    imageData={lightboxAd.imageData ?? null}
                    bgColor={lightboxAd.bgColor ?? null}
                    seed={adSeed(lightboxAd.id)}
                    format={lightboxAd.format ?? "story"}
                  />
                </div>
              </div>
              <div className="absolute bottom-12 flex items-center gap-4">
                <button
                  className="p-3.5 rounded-full bg-white/15 hover:bg-white/25 text-white backdrop-blur-sm transition-all cursor-pointer border border-white/10"
                  onClick={() => handleDownload(lightboxAd)}
                >
                  <Download className="h-5 w-5" />
                </button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
