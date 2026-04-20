import type { Band } from "./bands.state.svelte";
1;
export type LCHA = [
  lightness: number,
  chroma: number,
  hue: number,
  alpha: number,
];

export function lchaToRgba(L: number, C: number, H: number, A = 1) {
  // Convert hue to radians
  const hRad = (H * Math.PI) / 180;

  // LCH → Lab
  const a = C * Math.cos(hRad);
  const b = C * Math.sin(hRad);

  // Lab → XYZ
  const refX = 95.047;
  const refY = 100.0;
  const refZ = 108.883;

  let y = (L + 16) / 116;
  let x = a / 500 + y;
  let z = y - b / 200;

  const f = (t: number) =>
    t ** 3 > 0.008856 ? t ** 3 : (t - 16 / 116) / 7.787;

  x = refX * f(x);
  y = refY * f(y);
  z = refZ * f(z);

  // XYZ → linear RGB
  x /= 100;
  y /= 100;
  z /= 100;

  let r = x * 3.2406 + y * -1.5372 + z * -0.4986;

  let g = x * -0.9689 + y * 1.8758 + z * 0.0415;

  let b2 = x * 0.0557 + y * -0.204 + z * 1.057;

  // gamma correction
  const gamma = (u: number) =>
    u <= 0.0031308 ? 12.92 * u : 1.055 * Math.pow(u, 1 / 2.4) - 0.055;

  r = gamma(r);
  g = gamma(g);
  b2 = gamma(b2);

  // clamp and convert to 0–255
  const clamp = (v: number) => Math.min(255, Math.max(0, Math.round(v * 255)));

  return rgbaToHex(clamp(r), clamp(g), clamp(b2), A);
}

export function oklchaToRgba(l: number, c: number, h: number, a = 1) {
  const hr = (h * Math.PI) / 180;

  const A = c * Math.cos(hr);
  const B = c * Math.sin(hr);

  // OKLab → LMS
  const l_ = l + 0.3963377774 * A + 0.2158037573 * B;
  const m_ = l - 0.1055613458 * A - 0.0638541728 * B;
  const s_ = l - 0.0894841775 * A - 1.291485548 * B;

  const l3 = l_ ** 3;
  const m3 = m_ ** 3;
  const s3 = s_ ** 3;

  // LMS → linear RGB
  let r = +4.0767416621 * l3 - 3.3077115913 * m3 + 0.2309699292 * s3;
  let g = -1.2684380046 * l3 + 2.6097574011 * m3 - 0.3413193965 * s3;
  let b = -0.0041960863 * l3 - 0.7034186147 * m3 + 1.707614701 * s3;

  // linear → gamma corrected
  const gamma = (v: number) =>
    v <= 0.0031308 ? 12.92 * v : 1.055 * Math.pow(v, 1 / 2.4) - 0.055;

  r = gamma(r);
  g = gamma(g);
  b = gamma(b);

  return rgbaToHex(
    Math.round(Math.min(Math.max(0, r), 1) * 255),
    Math.round(Math.min(Math.max(0, g), 1) * 255),
    Math.round(Math.min(Math.max(0, b), 1) * 255),
    a,
  );
}

function rgbaToHex(r: number, g: number, b: number, a = 1) {
  const toHex = (v: number) => Math.round(v).toString(16).padStart(2, "0");

  const alpha = Math.round(a * 255);

  return "#" + toHex(r) + toHex(g) + toHex(b) + toHex(alpha);
}

export function hexRgbaToLcha(hex: string): [number, number, number, number] {
  const normalizedHex = hex.startsWith("#") ? hex.slice(1) : hex;
  const rgbaHex =
    normalizedHex.length === 6 ? `${normalizedHex}ff` : normalizedHex;

  const r = parseInt(rgbaHex.slice(0, 2), 16);
  const g = parseInt(rgbaHex.slice(2, 4), 16);
  const b = parseInt(rgbaHex.slice(4, 6), 16);
  const a = parseInt(rgbaHex.slice(6, 8), 16);

  const srgbToLinear = (u: number) =>
    u <= 0.04045 ? u / 12.92 : ((u + 0.055) / 1.055) ** 2.4;

  const rLinear = srgbToLinear(r / 255);
  const gLinear = srgbToLinear(g / 255);
  const bLinear = srgbToLinear(b / 255);

  // linear RGB -> XYZ (D65)
  const x = (rLinear * 0.4124 + gLinear * 0.3576 + bLinear * 0.1805) * 100;
  const y = (rLinear * 0.2126 + gLinear * 0.7152 + bLinear * 0.0722) * 100;
  const z = (rLinear * 0.0193 + gLinear * 0.1192 + bLinear * 0.9505) * 100;

  // XYZ -> Lab
  const refX = 95.047;
  const refY = 100.0;
  const refZ = 108.883;

  const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);

  const fx = f(x / refX);
  const fy = f(y / refY);
  const fz = f(z / refZ);

  const L = 116 * fy - 16;
  const aLab = 500 * (fx - fy);
  const bLab = 200 * (fy - fz);

  // Lab -> LCH
  const C = Math.sqrt(aLab ** 2 + bLab ** 2);
  let H = (Math.atan2(bLab, aLab) * 180) / Math.PI;

  if (H < 0) H += 360;

  return [L, C, H, a / 255];
}

type SquareCoord = { cross: number; axis: number };

export function interpolatePoints(
  fromF: SquareCoord,
  toF: SquareCoord,
): SquareCoord[] {
  const from = { axis: Math.floor(fromF.axis), cross: Math.floor(fromF.cross) };
  const to = { axis: Math.floor(toF.axis), cross: Math.floor(toF.cross) };

  if (from.axis === to.axis && from.cross === to.cross) {
    return [from];
  }

  const coordinates: SquareCoord[] = [];
  const deltaX = Math.abs(to.axis - from.axis);
  const deltaY = Math.abs(to.cross - from.cross);
  const stepX = from.axis < to.axis ? 1 : -1;
  const stepY = from.cross < to.cross ? 1 : -1;

  let currentX = from.axis;
  let currentY = from.cross;
  let error = deltaX - deltaY;

  while (true) {
    coordinates.push({ axis: currentX, cross: currentY });

    if (currentX === to.axis && currentY === to.cross) {
      break;
    }

    const doubledError = error * 2;

    if (doubledError > -deltaY) {
      error -= deltaY;
      currentX += stepX;
    }

    if (doubledError < deltaX) {
      error += deltaX;
      currentY += stepY;
    }
  }

  return coordinates;
}

export function pickImageFile(): Promise<File> {
  return new Promise((resolve, reject) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";

    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) reject(new Error("No file selected"));
      else resolve(file);
    };

    input.click();
  });
}

export function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);

    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };

    img.onerror = reject;
    img.src = url;
  });
}

export function imageToBand(img: HTMLImageElement): Band {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");

  if (!ctx) throw new Error("Canvas context unavailable");

  canvas.width = img.width;
  canvas.height = img.height;

  ctx.drawImage(img, 0, 0);

  const { data, width, height } = ctx.getImageData(
    0,
    0,
    canvas.width,
    canvas.height,
  );

  const band: Band = [];

  let i = 0;

  for (let y = 0; y < height; y++) {
    const row: (string | null)[] = [];

    for (let x = 0; x < width; x++) {
      const r = data[i++]!;
      const g = data[i++]!;
      const b = data[i++]!;
      const a = data[i++]!;

      if (a === 0) {
        row.push(null);
      } else {
        console.log(r, g, b, a);
        row.push(rgbaToHex(r, g, b, a / 255));
      }
    }

    band.push(row);
  }

  return band;
}
