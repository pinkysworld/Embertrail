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
    ctx.globalAlpha = 0.08 + Math.random() * 0.2;
    ctx.fillRect(Math.random() * size, Math.random() * size, 1 + Math.random() * 3, 1 + Math.random() * 3);
  }
  ctx.globalAlpha = 1;
}

const cache = new Map<string, THREE.MeshStandardMaterial>();

export function getMaterial(id: string): THREE.MeshStandardMaterial {
  if (cache.has(id)) return cache.get(id)!;

  // Try loading processed imagegen texture
  const loader = new THREE.TextureLoader();
  const url = `/textures/${id}.png`;
  let map: THREE.Texture | null = null;

  const mat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.85,
    metalness: 0.05,
  });

  // Procedural base immediately
  mat.map = procedural(id);
  mat.map.repeat.set(id === "snow" || id === "grass" ? 8 : 4, id === "snow" || id === "grass" ? 8 : 4);
  mat.needsUpdate = true;

  loader.load(
    url,
    (tex) => {
      tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
      tex.repeat.copy(mat.map!.repeat);
      tex.colorSpace = THREE.SRGBColorSpace;
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

function procedural(id: string): THREE.CanvasTexture {
  switch (id) {
    case "cobble":
      return makeCanvasTexture((ctx, s) => {
        noiseFill(ctx, s, "#6a6358", "#3a3530");
        for (let y = 0; y < s; y += 32) {
          for (let x = 0; x < s; x += 32) {
            ctx.strokeStyle = "#4a453c";
            ctx.strokeRect(x + 2, y + 2, 28, 28);
            ctx.fillStyle = `rgb(${90 + Math.random() * 30},${85 + Math.random() * 25},${75 + Math.random() * 20})`;
            ctx.fillRect(x + 4, y + 4, 24, 24);
          }
        }
      });
    case "dirt":
      return makeCanvasTexture((ctx, s) => noiseFill(ctx, s, "#5c4a32", "#3a2a1a", 6000));
    case "snow":
      return makeCanvasTexture((ctx, s) => noiseFill(ctx, s, "#d8e0e8", "#a8b0b8", 3000));
    case "mud":
      return makeCanvasTexture((ctx, s) => noiseFill(ctx, s, "#3d2e1f", "#2a1f14", 5000));
    case "grass":
      return makeCanvasTexture((ctx, s) => {
        noiseFill(ctx, s, "#3d5a3a", "#2a4028", 5000);
        ctx.strokeStyle = "#4a6b42";
        for (let i = 0; i < 800; i++) {
          const x = Math.random() * s;
          const y = Math.random() * s;
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.lineTo(x + 1, y - 4 - Math.random() * 4);
          ctx.stroke();
        }
      });
    case "planks":
      return makeCanvasTexture((ctx, s) => {
        noiseFill(ctx, s, "#6b4f32", "#3a2a1a");
        for (let y = 0; y < s; y += 28) {
          ctx.fillStyle = y % 56 === 0 ? "#5a4228" : "#735532";
          ctx.fillRect(0, y, s, 26);
          ctx.strokeStyle = "#2a1f14";
          ctx.strokeRect(0, y, s, 26);
        }
      });
    case "flagstone":
      return makeCanvasTexture((ctx, s) => {
        noiseFill(ctx, s, "#5a5854", "#2e2c28");
        for (let i = 0; i < 40; i++) {
          ctx.strokeStyle = "#3a3834";
          ctx.strokeRect(Math.random() * s, Math.random() * s, 40 + Math.random() * 40, 30 + Math.random() * 30);
        }
      });
    case "stone":
      return makeCanvasTexture((ctx, s) => noiseFill(ctx, s, "#6e6a62", "#3a3834", 4500));
    case "timber":
      return makeCanvasTexture((ctx, s) => {
        noiseFill(ctx, s, "#7a5a38", "#3a2818");
        ctx.fillStyle = "#c4b49a";
        for (let y = 20; y < s; y += 48) {
          for (let x = 16; x < s; x += 40) {
            ctx.fillRect(x, y, 18, 22);
          }
        }
      });
    case "bark":
      return makeCanvasTexture((ctx, s) => noiseFill(ctx, s, "#4a3a28", "#2a2018", 7000));
    case "dwarf_stone":
      return makeCanvasTexture((ctx, s) => {
        noiseFill(ctx, s, "#5a5550", "#2a2824");
        ctx.strokeStyle = "#8a8070";
        for (let y = 0; y < s; y += 24) {
          for (let x = 0; x < s; x += 24) {
            ctx.strokeRect(x + 1, y + 1, 22, 22);
          }
        }
      });
    case "cult":
      return makeCanvasTexture((ctx, s) => {
        noiseFill(ctx, s, "#3a2828", "#1a1010", 4000);
        ctx.strokeStyle = "#8b2e2e";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(s / 2, s / 2, 40, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(s / 2, s / 2 - 50);
        ctx.lineTo(s / 2, s / 2 + 50);
        ctx.moveTo(s / 2 - 40, s / 2 + 20);
        ctx.lineTo(s / 2 + 40, s / 2 + 20);
        ctx.stroke();
      });
    case "ice":
      return makeCanvasTexture((ctx, s) => {
        noiseFill(ctx, s, "#8ab0c8", "#d0e8f0", 2500);
        ctx.strokeStyle = "rgba(255,255,255,0.3)";
        for (let i = 0; i < 30; i++) {
          ctx.beginPath();
          ctx.moveTo(Math.random() * s, Math.random() * s);
          ctx.lineTo(Math.random() * s, Math.random() * s);
          ctx.stroke();
        }
      });
    default:
      return makeCanvasTexture((ctx, s) => noiseFill(ctx, s, "#555", "#222"));
  }
}

export const TEXTURE_PROMPT_STYLE = STYLE;
