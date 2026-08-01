import * as THREE from "three";

const STYLE =
  "1990s German CRPG remaster aesthetic, painterly but readable in-game, muted earth and cold northern light, mud frost timber stone iron, subtle wear and grime, seamless tileable texture, no anime, no text, no logos";

/** Procedural fallback textures until imagegen assets are wired */
function makeCanvasTexture(
  paint: (ctx: CanvasRenderingContext2D, size: number) => void,
  size = 256
): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const ctx = c.getContext("2d")!;
  paint(ctx, size);
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

function noiseFill(
  ctx: CanvasRenderingContext2D,
  size: number,
  base: string,
  speck: string,
  density = 4000
): void {
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, size, size);
  for (let i = 0; i < density; i++) {
    ctx.fillStyle = speck;
    ctx.globalAlpha = 0.08 + Math.random() * 0.22;
    ctx.fillRect(
      Math.random() * size,
      Math.random() * size,
      1 + Math.random() * 3,
      1 + Math.random() * 3
    );
  }
  ctx.globalAlpha = 1;
}

/** Soft blotches for organic variation */
function blotches(
  ctx: CanvasRenderingContext2D,
  size: number,
  color: string,
  count: number,
  rMin: number,
  rMax: number,
  alpha = 0.12
): void {
  for (let i = 0; i < count; i++) {
    const r = rMin + Math.random() * (rMax - rMin);
    ctx.fillStyle = color;
    ctx.globalAlpha = alpha * (0.5 + Math.random() * 0.5);
    ctx.beginPath();
    ctx.ellipse(
      Math.random() * size,
      Math.random() * size,
      r,
      r * (0.6 + Math.random() * 0.6),
      Math.random() * Math.PI,
      0,
      Math.PI * 2
    );
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function hash2(x: number, y: number): number {
  const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return n - Math.floor(n);
}

const cache = new Map<string, THREE.MeshStandardMaterial>();

/** Ground / large surfaces need higher UV repeat */
const LARGE_REPEAT = new Set([
  "snow",
  "grass",
  "mud",
  "dirt",
  "cobble",
  "flagstone",
  "water",
  "lava_ash",
  "ember_ash",
  "moss_stone",
  "gravel",
  "iron_floor",
  "sand",
  "reed",
  "dock_planks",
]);

/** Material IDs with procedural fallbacks; PNG override at textures/{id}.png */
export const MATERIAL_IDS = [
  // Core (wired by world / content today)
  "cobble",
  "dirt",
  "snow",
  "mud",
  "grass",
  "planks",
  "flagstone",
  "stone",
  "timber",
  "bark",
  "dwarf_stone",
  "cult",
  "ice",
  // Extended (roofs, props, richer biomes — safe if missing PNG)
  "roof_tiles",
  "roof_tile",
  "slate_roof",
  "thatch",
  "reed",
  "metal",
  "leather",
  "cloth",
  "canvas_sail",
  "water",
  "lava_ash",
  "ember_ash",
  "brick_red",
  "brick",
  "moss_stone",
  "gravel",
  "iron_floor",
  // Production prop / shore kit
  "rope",
  "sand",
  "frost_window",
  "glass",
  "dock_planks",
] as const;

export type MaterialId = (typeof MATERIAL_IDS)[number];

/** Respect Vite base (`/Embertrail/` on GitHub Pages) */
const TEX_BASE = `${import.meta.env.BASE_URL}textures/`;

export function getMaterial(id: string): THREE.MeshStandardMaterial {
  if (cache.has(id)) return cache.get(id)!;

  const loader = new THREE.TextureLoader();
  const url = `${TEX_BASE}${id}.png`;

  const mat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: roughnessFor(id),
    metalness: metalnessFor(id),
  });

  mat.map = procedural(id);
  const rep = LARGE_REPEAT.has(id) ? 10 : 4;
  mat.map.repeat.set(rep, rep);
  mat.needsUpdate = true;

  loader.load(
    url,
    (tex) => {
      tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
      tex.repeat.copy(mat.map!.repeat);
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.anisotropy = 4;
      mat.map = tex;
      mat.needsUpdate = true;
    },
    undefined,
    () => {
      /* keep procedural */
    }
  );

  cache.set(id, mat);
  return mat;
}

/** Clone material with independent UV repeat (for paths / roofs) */
export function getMaterialTiled(id: string, repeatX: number, repeatY = repeatX): THREE.MeshStandardMaterial {
  const base = getMaterial(id);
  const mat = base.clone();
  if (base.map) {
    mat.map = base.map.clone();
    mat.map.wrapS = mat.map.wrapT = THREE.RepeatWrapping;
    mat.map.repeat.set(repeatX, repeatY);
    mat.map.needsUpdate = true;
  }
  return mat;
}

function roughnessFor(id: string): number {
  switch (id) {
    case "ice":
    case "snow":
      return 0.35;
    case "water":
      return 0.12;
    case "metal":
    case "iron_floor":
      return 0.42;
    case "dwarf_stone":
    case "flagstone":
    case "stone":
    case "cobble":
    case "brick":
    case "brick_red":
    case "moss_stone":
    case "roof_tiles":
    case "roof_tile":
    case "slate_roof":
    case "gravel":
      return 0.9;
    case "frost_window":
    case "glass":
      return 0.2;
    case "planks":
    case "timber":
    case "bark":
    case "thatch":
    case "reed":
    case "leather":
    case "cloth":
    case "canvas_sail":
    case "dock_planks":
    case "rope":
    case "sand":
      return 0.82;
    case "cult":
    case "lava_ash":
    case "ember_ash":
      return 0.75;
    default:
      return 0.85;
  }
}

function metalnessFor(id: string): number {
  switch (id) {
    case "metal":
    case "iron_floor":
      return 0.72;
    case "ice":
    case "water":
      return 0.22;
    case "frost_window":
    case "glass":
      return 0.35;
    case "dwarf_stone":
      return 0.12;
    case "cult":
    case "lava_ash":
    case "ember_ash":
      return 0.08;
    case "roof_tiles":
    case "roof_tile":
    case "slate_roof":
      return 0.06;
    default:
      return 0.04;
  }
}

function procedural(id: string): THREE.CanvasTexture {
  switch (id) {
    case "cobble":
      return makeCanvasTexture((ctx, s) => {
        noiseFill(ctx, s, "#5c564c", "#2e2a24", 3500);
        blotches(ctx, s, "#4a453c", 20, 8, 28, 0.15);
        const cell = 28;
        for (let y = 0; y < s; y += cell) {
          for (let x = 0; x < s; x += cell) {
            const ox = (y / cell) % 2 === 0 ? 0 : cell * 0.5;
            const px = (x + ox) % s;
            const jx = (hash2(px, y) - 0.5) * 4;
            const jy = (hash2(y, px) - 0.5) * 4;
            const shade = 70 + hash2(px + 1, y + 2) * 45;
            ctx.fillStyle = `rgb(${shade + 8},${shade},${shade - 12})`;
            const rw = 20 + hash2(px, y + 3) * 6;
            const rh = 18 + hash2(px + 4, y) * 6;
            ctx.fillRect(px + 3 + jx, y + 3 + jy, rw, rh);
            ctx.strokeStyle = "rgba(30,28,24,0.55)";
            ctx.lineWidth = 1.5;
            ctx.strokeRect(px + 3 + jx, y + 3 + jy, rw, rh);
            // highlight edge
            ctx.strokeStyle = "rgba(180,170,150,0.12)";
            ctx.beginPath();
            ctx.moveTo(px + 4 + jx, y + 4 + jy + rh);
            ctx.lineTo(px + 4 + jx, y + 4 + jy);
            ctx.lineTo(px + 4 + jx + rw, y + 4 + jy);
            ctx.stroke();
          }
        }
      });

    case "dirt":
      return makeCanvasTexture((ctx, s) => {
        noiseFill(ctx, s, "#5c4a32", "#3a2a1a", 7000);
        blotches(ctx, s, "#6a5438", 30, 6, 22, 0.18);
        blotches(ctx, s, "#2a1c10", 18, 4, 14, 0.14);
        // small pebbles
        for (let i = 0; i < 120; i++) {
          ctx.fillStyle = `rgb(${80 + Math.random() * 40},${70 + Math.random() * 30},${50 + Math.random() * 20})`;
          ctx.globalAlpha = 0.35;
          ctx.beginPath();
          ctx.arc(Math.random() * s, Math.random() * s, 1 + Math.random() * 2.5, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.globalAlpha = 1;
      });

    case "snow":
      return makeCanvasTexture((ctx, s) => {
        noiseFill(ctx, s, "#d8e0e8", "#a8b0b8", 2800);
        blotches(ctx, s, "#ffffff", 25, 10, 40, 0.2);
        blotches(ctx, s, "#9aa8b4", 15, 6, 20, 0.12);
        // crystalline flecks
        ctx.fillStyle = "rgba(255,255,255,0.5)";
        for (let i = 0; i < 200; i++) {
          ctx.fillRect(Math.random() * s, Math.random() * s, 1, 1);
        }
      });

    case "mud":
      return makeCanvasTexture((ctx, s) => {
        noiseFill(ctx, s, "#3d2e1f", "#2a1f14", 5500);
        blotches(ctx, s, "#4a3828", 28, 8, 30, 0.2);
        blotches(ctx, s, "#1a120c", 20, 5, 18, 0.18);
        // wet sheen streaks
        ctx.strokeStyle = "rgba(70,55,40,0.25)";
        ctx.lineWidth = 3;
        for (let i = 0; i < 40; i++) {
          ctx.beginPath();
          const x = Math.random() * s;
          const y = Math.random() * s;
          ctx.moveTo(x, y);
          ctx.quadraticCurveTo(x + 20, y + 10, x + 8 + Math.random() * 30, y + 25 + Math.random() * 20);
          ctx.stroke();
        }
      });

    case "grass":
      return makeCanvasTexture((ctx, s) => {
        noiseFill(ctx, s, "#3a5538", "#2a4028", 4500);
        blotches(ctx, s, "#4a6b40", 20, 8, 24, 0.15);
        blotches(ctx, s, "#2a3820", 12, 6, 16, 0.12);
        for (let i = 0; i < 1200; i++) {
          const x = Math.random() * s;
          const y = Math.random() * s;
          const g = 70 + Math.random() * 50;
          ctx.strokeStyle = `rgb(${40 + Math.random() * 30},${g},${30 + Math.random() * 20})`;
          ctx.globalAlpha = 0.35 + Math.random() * 0.4;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.lineTo(x + (Math.random() - 0.5) * 3, y - 3 - Math.random() * 6);
          ctx.stroke();
        }
        ctx.globalAlpha = 1;
        // dry patches
        blotches(ctx, s, "#6a6040", 8, 10, 22, 0.1);
      });

    case "planks":
      return makeCanvasTexture((ctx, s) => {
        noiseFill(ctx, s, "#6b4f32", "#3a2a1a", 2000);
        const plankH = 32;
        for (let y = 0; y < s; y += plankH) {
          const warm = 90 + hash2(0, y) * 35;
          ctx.fillStyle = `rgb(${warm},${warm * 0.72},${warm * 0.42})`;
          ctx.fillRect(0, y, s, plankH - 2);
          // grain lines
          ctx.strokeStyle = "rgba(40,25,12,0.2)";
          ctx.lineWidth = 1;
          for (let g = 0; g < 6; g++) {
            const gy = y + 4 + g * 4 + hash2(g, y) * 3;
            ctx.beginPath();
            ctx.moveTo(0, gy);
            for (let x = 0; x < s; x += 16) {
              ctx.lineTo(x, gy + (hash2(x, gy) - 0.5) * 2);
            }
            ctx.stroke();
          }
          // knots
          if (hash2(y, 7) > 0.55) {
            const kx = hash2(y, 9) * s;
            const ky = y + plankH * 0.45;
            ctx.fillStyle = "rgba(50,30,15,0.45)";
            ctx.beginPath();
            ctx.ellipse(kx, ky, 4, 3, 0, 0, Math.PI * 2);
            ctx.fill();
          }
          // seam
          ctx.fillStyle = "#1a120a";
          ctx.fillRect(0, y + plankH - 2, s, 2);
          // nail dots
          ctx.fillStyle = "rgba(30,30,30,0.5)";
          ctx.fillRect(8, y + plankH * 0.5, 2, 2);
          ctx.fillRect(s - 10, y + plankH * 0.5, 2, 2);
        }
      });

    case "flagstone":
      return makeCanvasTexture((ctx, s) => {
        noiseFill(ctx, s, "#56544f", "#2e2c28", 4000);
        blotches(ctx, s, "#6a6860", 15, 10, 30, 0.12);
        // irregular slabs
        let y = 4;
        while (y < s - 8) {
          let x = 4;
          const rowH = 28 + hash2(0, y) * 24;
          while (x < s - 8) {
            const rw = 32 + hash2(x, y) * 36;
            const rh = rowH - 4 - hash2(x + 1, y) * 6;
            const shade = 75 + hash2(x, y + 1) * 40;
            ctx.fillStyle = `rgb(${shade},${shade - 2},${shade - 8})`;
            ctx.fillRect(x, y, Math.min(rw, s - x - 4), Math.min(rh, s - y - 4));
            ctx.strokeStyle = "rgba(25,24,22,0.65)";
            ctx.lineWidth = 2;
            ctx.strokeRect(x, y, Math.min(rw, s - x - 4), Math.min(rh, s - y - 4));
            x += rw + 3;
          }
          y += rowH + 2;
        }
      });

    case "stone":
      return makeCanvasTexture((ctx, s) => {
        noiseFill(ctx, s, "#6e6a62", "#3a3834", 5000);
        blotches(ctx, s, "#8a8680", 18, 6, 20, 0.1);
        blotches(ctx, s, "#4a4844", 14, 5, 16, 0.12);
        // block courses
        const bh = 36;
        const bw = 48;
        for (let row = 0; row < s / bh; row++) {
          const off = row % 2 === 0 ? 0 : bw / 2;
          for (let col = -1; col < s / bw + 1; col++) {
            const x = col * bw + off;
            const y = row * bh;
            ctx.strokeStyle = "rgba(40,38,34,0.5)";
            ctx.lineWidth = 2;
            ctx.strokeRect(x + 1, y + 1, bw - 2, bh - 2);
            // mortar highlight
            ctx.strokeStyle = "rgba(160,155,145,0.08)";
            ctx.strokeRect(x + 2, y + 2, bw - 4, bh - 4);
          }
        }
      });

    case "timber":
      return makeCanvasTexture((ctx, s) => {
        // half-timber: plaster panels + dark beams
        noiseFill(ctx, s, "#c4b49a", "#a09078", 2500);
        blotches(ctx, s, "#d0c4a8", 12, 8, 24, 0.12);
        blotches(ctx, s, "#8a7a60", 10, 4, 14, 0.1);
        const beam = "#3a2818";
        ctx.fillStyle = beam;
        // vertical beams
        for (let x = 0; x < s; x += 64) {
          ctx.fillRect(x, 0, 10, s);
          ctx.fillRect(x + 54, 0, 10, s);
        }
        // horizontal beams
        for (let y = 0; y < s; y += 64) {
          ctx.fillRect(0, y, s, 10);
          ctx.fillRect(0, y + 54, s, 8);
        }
        // diagonal braces
        ctx.strokeStyle = beam;
        ctx.lineWidth = 8;
        for (let y = 0; y < s; y += 64) {
          for (let x = 0; x < s; x += 64) {
            if (hash2(x, y) > 0.4) {
              ctx.beginPath();
              ctx.moveTo(x + 10, y + 10);
              ctx.lineTo(x + 54, y + 54);
              ctx.stroke();
            }
          }
        }
        // wood grain on beams
        ctx.strokeStyle = "rgba(80,55,30,0.25)";
        ctx.lineWidth = 1;
        for (let i = 0; i < 40; i++) {
          const x = Math.floor(Math.random() * 4) * 64 + 2;
          ctx.beginPath();
          ctx.moveTo(x + 3, 0);
          ctx.lineTo(x + 3 + Math.random() * 2, s);
          ctx.stroke();
        }
      });

    case "bark":
      return makeCanvasTexture((ctx, s) => {
        noiseFill(ctx, s, "#4a3a28", "#2a2018", 6000);
        blotches(ctx, s, "#5a4830", 20, 5, 18, 0.15);
        // vertical bark ridges
        for (let x = 0; x < s; x += 6 + Math.random() * 8) {
          ctx.strokeStyle = `rgba(${30 + Math.random() * 30},${20 + Math.random() * 20},${10},0.45)`;
          ctx.lineWidth = 2 + Math.random() * 3;
          ctx.beginPath();
          ctx.moveTo(x, 0);
          for (let y = 0; y < s; y += 12) {
            ctx.lineTo(x + (Math.random() - 0.5) * 6, y);
          }
          ctx.stroke();
        }
        // moss flecks
        ctx.fillStyle = "rgba(50,80,40,0.2)";
        for (let i = 0; i < 80; i++) {
          ctx.fillRect(Math.random() * s, Math.random() * s, 3, 2);
        }
      });

    case "dwarf_stone":
      return makeCanvasTexture((ctx, s) => {
        noiseFill(ctx, s, "#5a5550", "#2a2824", 4200);
        blotches(ctx, s, "#706860", 12, 6, 18, 0.1);
        const cell = 24;
        for (let y = 0; y < s; y += cell) {
          for (let x = 0; x < s; x += cell) {
            const shade = 80 + hash2(x, y) * 30;
            ctx.fillStyle = `rgb(${shade},${shade - 4},${shade - 10})`;
            ctx.fillRect(x + 2, y + 2, cell - 4, cell - 4);
            ctx.strokeStyle = "#8a8070";
            ctx.lineWidth = 1.5;
            ctx.strokeRect(x + 1, y + 1, cell - 2, cell - 2);
            // carved corner mark
            if (hash2(x + 3, y + 3) > 0.7) {
              ctx.strokeStyle = "rgba(180,160,120,0.25)";
              ctx.strokeRect(x + 6, y + 6, cell - 12, cell - 12);
            }
          }
        }
        // rune-like flecks
        ctx.fillStyle = "rgba(200,170,100,0.12)";
        for (let i = 0; i < 30; i++) {
          const x = Math.random() * s;
          const y = Math.random() * s;
          ctx.fillRect(x, y, 2, 6);
          ctx.fillRect(x - 2, y + 2, 6, 2);
        }
      });

    case "cult":
      return makeCanvasTexture((ctx, s) => {
        noiseFill(ctx, s, "#2e1c1c", "#140c0c", 4500);
        blotches(ctx, s, "#4a2020", 18, 8, 28, 0.18);
        blotches(ctx, s, "#1a0808", 14, 6, 20, 0.15);
        // dried blood streaks
        ctx.strokeStyle = "rgba(100,20,20,0.35)";
        ctx.lineWidth = 2;
        for (let i = 0; i < 25; i++) {
          ctx.beginPath();
          const x = Math.random() * s;
          ctx.moveTo(x, Math.random() * s * 0.3);
          ctx.quadraticCurveTo(x + 10, s * 0.5, x + (Math.random() - 0.5) * 20, s * 0.7 + Math.random() * 40);
          ctx.stroke();
        }
        // ritual sigil
        ctx.strokeStyle = "#8b2e2e";
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(s / 2, s / 2, 48, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(s / 2, s / 2, 28, 0, Math.PI * 2);
        ctx.stroke();
        // inverted triangle
        ctx.beginPath();
        ctx.moveTo(s / 2, s / 2 + 38);
        ctx.lineTo(s / 2 - 34, s / 2 - 22);
        ctx.lineTo(s / 2 + 34, s / 2 - 22);
        ctx.closePath();
        ctx.stroke();
        // radial scratches
        for (let i = 0; i < 8; i++) {
          const a = (i / 8) * Math.PI * 2;
          ctx.beginPath();
          ctx.moveTo(s / 2 + Math.cos(a) * 52, s / 2 + Math.sin(a) * 52);
          ctx.lineTo(s / 2 + Math.cos(a) * 70, s / 2 + Math.sin(a) * 70);
          ctx.stroke();
        }
      });

    case "ice":
      return makeCanvasTexture((ctx, s) => {
        // deep blue-green ice base
        const grad = ctx.createLinearGradient(0, 0, s, s);
        grad.addColorStop(0, "#6a98b0");
        grad.addColorStop(0.4, "#8ab0c8");
        grad.addColorStop(0.7, "#a8c8d8");
        grad.addColorStop(1, "#7aa0b8");
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, s, s);
        noiseFill(ctx, s, "rgba(200,230,240,0.15)", "rgba(40,70,90,0.2)", 2000);
        blotches(ctx, s, "#d0e8f0", 20, 8, 30, 0.15);
        blotches(ctx, s, "#4a7088", 12, 5, 16, 0.12);
        // cracks
        ctx.strokeStyle = "rgba(255,255,255,0.35)";
        ctx.lineWidth = 1;
        for (let i = 0; i < 40; i++) {
          ctx.beginPath();
          let x = Math.random() * s;
          let y = Math.random() * s;
          ctx.moveTo(x, y);
          for (let j = 0; j < 4; j++) {
            x += (Math.random() - 0.5) * 40;
            y += (Math.random() - 0.5) * 40;
            ctx.lineTo(x, y);
          }
          ctx.stroke();
        }
        // bright crystalline veins
        ctx.strokeStyle = "rgba(220,245,255,0.45)";
        ctx.lineWidth = 1.5;
        for (let i = 0; i < 12; i++) {
          ctx.beginPath();
          ctx.moveTo(Math.random() * s, Math.random() * s);
          ctx.lineTo(Math.random() * s, Math.random() * s);
          ctx.stroke();
        }
      });

    case "roof_tiles":
      return makeCanvasTexture((ctx, s) => {
        noiseFill(ctx, s, "#4a4038", "#2a2420", 2800);
        const rowH = 14;
        for (let y = 0; y < s; y += rowH) {
          const off = (y / rowH) % 2 === 0 ? 0 : 12;
          for (let x = -12; x < s + 12; x += 24) {
            const shade = 55 + hash2(x + 3, y + 1) * 35;
            ctx.fillStyle = `rgb(${shade + 12},${shade - 4},${shade - 14})`;
            ctx.beginPath();
            ctx.moveTo(x + off, y + 2);
            ctx.lineTo(x + off + 11, y + 2);
            ctx.lineTo(x + off + 11, y + rowH - 2);
            ctx.lineTo(x + off + 5.5, y + rowH + 2);
            ctx.lineTo(x + off, y + rowH - 2);
            ctx.closePath();
            ctx.fill();
            ctx.strokeStyle = "rgba(20,16,12,0.45)";
            ctx.lineWidth = 1;
            ctx.stroke();
          }
        }
        blotches(ctx, s, "#6a5848", 10, 4, 14, 0.1);
        // frost rim flecks
        ctx.fillStyle = "rgba(200,210,220,0.08)";
        for (let i = 0; i < 60; i++) {
          ctx.fillRect(Math.random() * s, Math.random() * s, 2, 1);
        }
      });

    case "thatch":
      return makeCanvasTexture((ctx, s) => {
        noiseFill(ctx, s, "#8a7040", "#5a4828", 3500);
        blotches(ctx, s, "#a08850", 18, 6, 20, 0.14);
        blotches(ctx, s, "#3a3018", 12, 4, 14, 0.12);
        for (let i = 0; i < 900; i++) {
          const x = Math.random() * s;
          const y = Math.random() * s;
          const warm = 90 + Math.random() * 50;
          ctx.strokeStyle = `rgba(${warm},${warm * 0.75},${warm * 0.35},${0.25 + Math.random() * 0.35})`;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.lineTo(x + (Math.random() - 0.5) * 4, y + 8 + Math.random() * 14);
          ctx.stroke();
        }
        // binding rows
        ctx.strokeStyle = "rgba(40,30,15,0.35)";
        ctx.lineWidth = 2;
        for (let y = 16; y < s; y += 28) {
          ctx.beginPath();
          ctx.moveTo(0, y);
          for (let x = 0; x < s; x += 20) {
            ctx.lineTo(x, y + (hash2(x, y) - 0.5) * 4);
          }
          ctx.stroke();
        }
      });

    case "metal":
      return makeCanvasTexture((ctx, s) => {
        noiseFill(ctx, s, "#6a6a70", "#3a3a40", 4000);
        blotches(ctx, s, "#8a8a92", 14, 6, 22, 0.12);
        blotches(ctx, s, "#2a2a30", 12, 4, 16, 0.14);
        // brushed streaks
        ctx.strokeStyle = "rgba(180,180,190,0.12)";
        ctx.lineWidth = 1;
        for (let i = 0; i < 80; i++) {
          const y = Math.random() * s;
          ctx.beginPath();
          ctx.moveTo(0, y);
          ctx.lineTo(s, y + (Math.random() - 0.5) * 6);
          ctx.stroke();
        }
        // rust blotches
        blotches(ctx, s, "#6a3a22", 10, 4, 18, 0.16);
        // rivet dots
        for (let y = 20; y < s; y += 40) {
          for (let x = 20; x < s; x += 40) {
            ctx.fillStyle = "rgba(30,30,34,0.55)";
            ctx.beginPath();
            ctx.arc(x, y, 2.5, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = "rgba(160,160,170,0.2)";
            ctx.beginPath();
            ctx.arc(x - 0.5, y - 0.5, 1, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      });

    case "leather":
      return makeCanvasTexture((ctx, s) => {
        noiseFill(ctx, s, "#5a3a24", "#3a2414", 5000);
        blotches(ctx, s, "#6a4830", 22, 6, 24, 0.16);
        blotches(ctx, s, "#2a180c", 14, 4, 14, 0.12);
        // grain pores
        for (let i = 0; i < 400; i++) {
          ctx.fillStyle = `rgba(${20 + Math.random() * 30},${10 + Math.random() * 15},5,0.2)`;
          ctx.fillRect(Math.random() * s, Math.random() * s, 1 + Math.random() * 2, 1);
        }
        // worn crease
        ctx.strokeStyle = "rgba(20,12,6,0.25)";
        ctx.lineWidth = 2;
        for (let i = 0; i < 12; i++) {
          ctx.beginPath();
          let x = Math.random() * s;
          let y = Math.random() * s;
          ctx.moveTo(x, y);
          for (let j = 0; j < 5; j++) {
            x += 10 + Math.random() * 20;
            y += (Math.random() - 0.5) * 16;
            ctx.lineTo(x, y);
          }
          ctx.stroke();
        }
      });

    case "cloth":
      return makeCanvasTexture((ctx, s) => {
        noiseFill(ctx, s, "#6b4040", "#4a2828", 3000);
        blotches(ctx, s, "#7a5050", 16, 8, 28, 0.12);
        // weave grid
        ctx.strokeStyle = "rgba(40,20,20,0.15)";
        ctx.lineWidth = 1;
        for (let i = 0; i < s; i += 4) {
          ctx.beginPath();
          ctx.moveTo(i, 0);
          ctx.lineTo(i, s);
          ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(0, i);
          ctx.lineTo(s, i);
          ctx.stroke();
        }
        // faded dye patches
        blotches(ctx, s, "#8a6060", 8, 12, 30, 0.1);
        blotches(ctx, s, "#3a2020", 6, 8, 20, 0.1);
        // fray nicks
        for (let i = 0; i < 40; i++) {
          ctx.strokeStyle = "rgba(200,170,140,0.12)";
          ctx.beginPath();
          const x = Math.random() * s;
          const y = Math.random() * s;
          ctx.moveTo(x, y);
          ctx.lineTo(x + 4, y + 1);
          ctx.stroke();
        }
      });

    case "water":
      return makeCanvasTexture((ctx, s) => {
        const grad = ctx.createLinearGradient(0, 0, s, s);
        grad.addColorStop(0, "#2a4a58");
        grad.addColorStop(0.35, "#3a6070");
        grad.addColorStop(0.7, "#2e5060");
        grad.addColorStop(1, "#1a3848");
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, s, s);
        blotches(ctx, s, "#4a7888", 18, 10, 36, 0.14);
        blotches(ctx, s, "#1a3040", 14, 8, 28, 0.12);
        // soft ripples
        ctx.strokeStyle = "rgba(180,210,220,0.12)";
        ctx.lineWidth = 1.5;
        for (let i = 0; i < 30; i++) {
          const y = Math.random() * s;
          ctx.beginPath();
          ctx.moveTo(0, y);
          for (let x = 0; x < s; x += 16) {
            ctx.lineTo(x, y + Math.sin(x * 0.08 + i) * 4);
          }
          ctx.stroke();
        }
        // cold highlight flecks
        ctx.fillStyle = "rgba(220,235,240,0.15)";
        for (let i = 0; i < 50; i++) {
          ctx.fillRect(Math.random() * s, Math.random() * s, 2, 1);
        }
      });

    case "lava_ash":
      return makeCanvasTexture((ctx, s) => {
        noiseFill(ctx, s, "#2a2220", "#141010", 5500);
        blotches(ctx, s, "#3a2a24", 22, 6, 24, 0.16);
        blotches(ctx, s, "#1a1210", 16, 5, 18, 0.14);
        // ember cracks
        ctx.strokeStyle = "rgba(180,60,20,0.35)";
        ctx.lineWidth = 1.5;
        for (let i = 0; i < 28; i++) {
          ctx.beginPath();
          let x = Math.random() * s;
          let y = Math.random() * s;
          ctx.moveTo(x, y);
          for (let j = 0; j < 5; j++) {
            x += (Math.random() - 0.5) * 28;
            y += (Math.random() - 0.5) * 28;
            ctx.lineTo(x, y);
          }
          ctx.stroke();
        }
        // ash flecks
        for (let i = 0; i < 200; i++) {
          const g = 40 + Math.random() * 50;
          ctx.fillStyle = `rgba(${g},${g - 5},${g - 10},0.35)`;
          ctx.fillRect(Math.random() * s, Math.random() * s, 1 + Math.random() * 2, 1);
        }
        // dull ember dots
        for (let i = 0; i < 40; i++) {
          ctx.fillStyle = `rgba(${160 + Math.random() * 60},${40 + Math.random() * 40},10,0.25)`;
          ctx.beginPath();
          ctx.arc(Math.random() * s, Math.random() * s, 1 + Math.random() * 2, 0, Math.PI * 2);
          ctx.fill();
        }
      });

    case "brick_red":
      return makeCanvasTexture((ctx, s) => {
        noiseFill(ctx, s, "#6a3a32", "#3a2018", 3500);
        const bh = 20;
        const bw = 40;
        for (let row = 0; row < s / bh; row++) {
          const off = row % 2 === 0 ? 0 : bw / 2;
          for (let col = -1; col < s / bw + 1; col++) {
            const x = col * bw + off;
            const y = row * bh;
            const r = 90 + hash2(x, y) * 40;
            const g = 40 + hash2(x + 1, y) * 25;
            const b = 32 + hash2(x, y + 2) * 18;
            ctx.fillStyle = `rgb(${r},${g},${b})`;
            ctx.fillRect(x + 1, y + 1, bw - 3, bh - 3);
            ctx.strokeStyle = "rgba(200,180,150,0.18)";
            ctx.lineWidth = 1.5;
            ctx.strokeRect(x + 1, y + 1, bw - 3, bh - 3);
          }
        }
        blotches(ctx, s, "#2a1814", 10, 4, 14, 0.1);
        // soot / frost
        blotches(ctx, s, "#8a8880", 6, 6, 16, 0.08);
      });

    case "moss_stone":
      return makeCanvasTexture((ctx, s) => {
        noiseFill(ctx, s, "#5a564e", "#2e2c28", 4200);
        blotches(ctx, s, "#6a6860", 14, 8, 24, 0.12);
        // irregular blocks like stone
        const bh = 36;
        const bw = 48;
        for (let row = 0; row < s / bh; row++) {
          const off = row % 2 === 0 ? 0 : bw / 2;
          for (let col = -1; col < s / bw + 1; col++) {
            const x = col * bw + off;
            const y = row * bh;
            ctx.strokeStyle = "rgba(35,40,30,0.45)";
            ctx.lineWidth = 2;
            ctx.strokeRect(x + 1, y + 1, bw - 2, bh - 2);
          }
        }
        // moss patches
        blotches(ctx, s, "#3a5a30", 28, 6, 22, 0.22);
        blotches(ctx, s, "#2a4828", 16, 4, 14, 0.16);
        blotches(ctx, s, "#6a8040", 10, 3, 10, 0.1);
        // damp streaks
        ctx.strokeStyle = "rgba(40,60,40,0.2)";
        ctx.lineWidth = 2;
        for (let i = 0; i < 20; i++) {
          const x = Math.random() * s;
          ctx.beginPath();
          ctx.moveTo(x, 0);
          ctx.quadraticCurveTo(x + 8, s * 0.5, x - 4, s);
          ctx.stroke();
        }
      });

    default:
      return makeCanvasTexture((ctx, s) => noiseFill(ctx, s, "#555555", "#222222"));
  }
}

export const TEXTURE_PROMPT_STYLE = STYLE;
