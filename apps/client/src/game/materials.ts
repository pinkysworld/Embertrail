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
const LARGE_REPEAT = new Set(["snow", "grass", "mud", "dirt", "cobble", "flagstone"]);

export function getMaterial(id: string): THREE.MeshStandardMaterial {
  if (cache.has(id)) return cache.get(id)!;

  const loader = new THREE.TextureLoader();
  const url = `/textures/${id}.png`;

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
    case "dwarf_stone":
    case "flagstone":
    case "stone":
    case "cobble":
      return 0.9;
    case "planks":
    case "timber":
    case "bark":
      return 0.82;
    case "cult":
      return 0.75;
    default:
      return 0.85;
  }
}

function metalnessFor(id: string): number {
  switch (id) {
    case "ice":
      return 0.25;
    case "dwarf_stone":
      return 0.12;
    case "cult":
      return 0.08;
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

    default:
      return makeCanvasTexture((ctx, s) => noiseFill(ctx, s, "#555555", "#222222"));
  }
}

export const TEXTURE_PROMPT_STYLE = STYLE;
