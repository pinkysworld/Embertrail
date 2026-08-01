/**
 * Low-poly 3D character mesh builders for Embertrail.
 * Distinct silhouettes via simple primitives (boxes, capsules, cones, cylinders).
 * Materials are MeshStandardMaterial clones with dispose-friendly names.
 */
import * as THREE from "three";

export type CharacterMeshStyle =
  | "steelguard"
  | "seafarer"
  | "stonekin"
  | "shadowhand"
  | "trickster"
  | "hexweaver"
  | "wildcaller"
  | "magister"
  | "pathfinder"
  | "leafborn"
  | "grovekin"
  | "frostborn"
  | "npc_priest"
  | "npc_envoy"
  | "npc_merchant"
  | "npc_innkeep"
  | "npc_smith"
  | "npc_guard"
  | "enemy_wolf"
  | "enemy_orc"
  | "enemy_cultist"
  | "enemy_undead"
  | "enemy_cave_beast"
  | "enemy_frost_wight"
  | "enemy_ash_guardian"
  | "player_default";

const SKIN = 0xc4a882;
const SKIN_COOL = 0xb8a090;
const SKIN_PALE = 0xd4c4b0;
const SKIN_GREEN = 0x6a8a4a;
const BONE = 0x9aa08a;
const LEATHER = 0x5a4030;
const METAL = 0x6a7078;
const DARK = 0x2a2420;
const WOOD = 0x6b4a28;

interface BodyProps {
  height: number;
  torsoW: number;
  torsoD: number;
  torsoH: number;
  headR: number;
  legR: number;
  legH: number;
  armR: number;
  shoulderW: number;
  skin: number;
  bodyColor: number;
  accent: number;
  metalness?: number;
  roughness?: number;
}

function mat(
  color: number,
  name: string,
  roughness = 0.78,
  metalness = 0.08,
  extras?: Partial<THREE.MeshStandardMaterialParameters>
): THREE.MeshStandardMaterial {
  const m = new THREE.MeshStandardMaterial({
    color,
    roughness,
    metalness,
    ...extras,
  });
  m.name = name;
  m.userData.owned = true;
  return m;
}

function addMesh(
  parent: THREE.Object3D,
  geo: THREE.BufferGeometry,
  material: THREE.Material,
  x: number,
  y: number,
  z: number,
  sx = 1,
  sy = 1,
  sz = 1
): THREE.Mesh {
  const mesh = new THREE.Mesh(geo, material);
  mesh.position.set(x, y, z);
  if (sx !== 1 || sy !== 1 || sz !== 1) mesh.scale.set(sx, sy, sz);
  mesh.userData.ownedGeo = true;
  mesh.userData.ownedMat = true;
  mesh.userData.disposeMat = true;
  parent.add(mesh);
  return mesh;
}

function humanoidBase(props: BodyProps, matPrefix: string): THREE.Group {
  const g = new THREE.Group();
  const bodyM = mat(props.bodyColor, `${matPrefix}_body`, props.roughness ?? 0.78, props.metalness ?? 0.08);
  const skinM = mat(props.skin, `${matPrefix}_skin`, 0.72, 0.04);
  const accentM = mat(props.accent, `${matPrefix}_accent`, 0.7, 0.12);

  const footY = 0;
  const hipY = props.legH;
  const torsoMid = hipY + props.torsoH * 0.5;
  const shoulderY = hipY + props.torsoH * 0.82;
  const neckY = hipY + props.torsoH;
  const headY = neckY + props.headR * 0.95;

  // Legs
  const legGeo = new THREE.CylinderGeometry(props.legR * 0.85, props.legR, props.legH, 6);
  addMesh(g, legGeo, bodyM, -props.torsoW * 0.22, footY + props.legH * 0.5, 0);
  addMesh(g, legGeo.clone(), bodyM, props.torsoW * 0.22, footY + props.legH * 0.5, 0);

  // Boots
  const bootGeo = new THREE.BoxGeometry(props.legR * 2.2, props.legH * 0.18, props.legR * 2.8);
  const bootM = mat(DARK, `${matPrefix}_boot`, 0.9, 0.05);
  addMesh(g, bootGeo, bootM, -props.torsoW * 0.22, footY + props.legH * 0.09, 0.04);
  addMesh(g, bootGeo.clone(), bootM, props.torsoW * 0.22, footY + props.legH * 0.09, 0.04);

  // Torso
  const torsoGeo = new THREE.BoxGeometry(props.torsoW, props.torsoH, props.torsoD);
  addMesh(g, torsoGeo, bodyM, 0, torsoMid, 0);

  // Pelvis belt
  const beltGeo = new THREE.BoxGeometry(props.torsoW * 1.05, props.torsoH * 0.12, props.torsoD * 1.08);
  addMesh(g, beltGeo, accentM, 0, hipY + props.torsoH * 0.08, 0);

  // Shoulders block
  const shGeo = new THREE.BoxGeometry(props.shoulderW, props.torsoH * 0.18, props.torsoD * 1.05);
  addMesh(g, shGeo, bodyM, 0, shoulderY, 0);

  // Arms
  const armLen = props.torsoH * 0.72;
  const armGeo = new THREE.CylinderGeometry(props.armR * 0.85, props.armR, armLen, 5);
  const armL = addMesh(g, armGeo, skinM, -props.shoulderW * 0.48, shoulderY - armLen * 0.35, 0);
  armL.rotation.z = 0.18;
  const armR = addMesh(g, armGeo.clone(), skinM, props.shoulderW * 0.48, shoulderY - armLen * 0.35, 0);
  armR.rotation.z = -0.18;

  // Head
  const headGeo = new THREE.SphereGeometry(props.headR, 8, 6);
  addMesh(g, headGeo, skinM, 0, headY, 0);

  g.userData._metrics = {
    height: props.height,
    shoulderY,
    headY,
    neckY,
    hipY,
    torsoW: props.torsoW,
    torsoD: props.torsoD,
    torsoH: props.torsoH,
    headR: props.headR,
    armLen,
  };

  return g;
}

function defaultProps(overrides: Partial<BodyProps> = {}): BodyProps {
  // Default adult ≈ 1.7: legs 0.72 + torso 0.56 + head stack ≈ 0.42 → ~1.7
  return {
    height: 1.7,
    torsoW: 0.38,
    torsoD: 0.22,
    torsoH: 0.56,
    headR: 0.15,
    legR: 0.07,
    legH: 0.72,
    armR: 0.055,
    shoulderW: 0.48,
    skin: SKIN,
    bodyColor: 0x4a6078,
    accent: 0x3a4a58,
    ...overrides,
  };
}

function addHelmet(g: THREE.Group, color: number, prefix: string, openFace = true): void {
  const m = (g.userData._metrics ?? {}) as { headY: number; headR: number };
  const headY = m.headY ?? 1.45;
  const headR = m.headR ?? 0.14;
  const helmM = mat(color, `${prefix}_helm`, 0.45, 0.55);
  const helm = addMesh(
    g,
    new THREE.SphereGeometry(headR * 1.15, 8, 6, 0, Math.PI * 2, 0, Math.PI * 0.55),
    helmM,
    0,
    headY + headR * 0.15,
    0
  );
  helm.rotation.x = 0.05;
  // Brim / brow
  addMesh(
    g,
    new THREE.CylinderGeometry(headR * 1.2, headR * 1.25, headR * 0.18, 8),
    helmM,
    0,
    headY + headR * 0.05,
    0
  );
  if (!openFace) {
    addMesh(
      g,
      new THREE.BoxGeometry(headR * 1.1, headR * 0.7, headR * 0.35),
      helmM,
      0,
      headY - headR * 0.15,
      headR * 0.55
    );
  }
}

function addPauldrons(g: THREE.Group, color: number, prefix: string, bulk = 1): void {
  const m = (g.userData._metrics ?? {}) as { shoulderY: number; shoulderW?: number; torsoW: number };
  const y = m.shoulderY ?? 1.2;
  const w = (m.torsoW ?? 0.38) * 0.55 * bulk;
  const pauldronM = mat(color, `${prefix}_pauldron`, 0.5, 0.45);
  const geo = new THREE.BoxGeometry(w, w * 0.55, w * 0.85);
  addMesh(g, geo, pauldronM, -((m.torsoW ?? 0.38) * 0.55 + w * 0.35), y + 0.02, 0);
  addMesh(g, geo.clone(), pauldronM, (m.torsoW ?? 0.38) * 0.55 + w * 0.35, y + 0.02, 0);
}

function addHood(g: THREE.Group, color: number, prefix: string, tall = 1): void {
  const m = (g.userData._metrics ?? {}) as { headY: number; headR: number; neckY: number };
  const headY = m.headY ?? 1.45;
  const headR = m.headR ?? 0.14;
  const hoodM = mat(color, `${prefix}_hood`, 0.88, 0.04);
  // Cone hood
  addMesh(
    g,
    new THREE.ConeGeometry(headR * 1.55, headR * 1.8 * tall, 6),
    hoodM,
    0,
    headY + headR * 0.55 * tall,
    -headR * 0.1
  );
  // Cowl around neck
  addMesh(
    g,
    new THREE.CylinderGeometry(headR * 1.35, headR * 1.6, headR * 0.7, 6),
    hoodM,
    0,
    (m.neckY ?? headY - headR) + headR * 0.1,
    0
  );
}

function addRobe(g: THREE.Group, color: number, prefix: string, flare = 1.15): void {
  const m = (g.userData._metrics ?? {}) as { hipY: number; torsoH: number; torsoW: number };
  const hipY = m.hipY ?? 0.62;
  const h = (m.torsoH ?? 0.52) * 1.15 + hipY * 0.35;
  const robeM = mat(color, `${prefix}_robe`, 0.9, 0.03);
  const topR = (m.torsoW ?? 0.38) * 0.55;
  const botR = topR * flare;
  addMesh(g, new THREE.CylinderGeometry(botR, topR, h, 8), robeM, 0, hipY * 0.35 + h * 0.5, 0);
}

function addStaff(g: THREE.Group, color: number, prefix: string, glow?: number): void {
  const m = (g.userData._metrics ?? {}) as { shoulderY: number; torsoW: number; height: number };
  const staffM = mat(color, `${prefix}_staff`, 0.75, 0.1);
  const h = (m.height ?? 1.7) * 1.05;
  const x = (m.torsoW ?? 0.38) * 0.85;
  addMesh(g, new THREE.CylinderGeometry(0.025, 0.035, h, 5), staffM, x, h * 0.48, 0.08);
  const topM = glow
    ? mat(glow, `${prefix}_orb`, 0.4, 0.2, {
        emissive: new THREE.Color(glow).multiplyScalar(0.45),
        emissiveIntensity: 0.7,
      })
    : mat(color, `${prefix}_finial`, 0.5, 0.3);
  addMesh(g, new THREE.SphereGeometry(0.07, 6, 5), topM, x, h * 0.95, 0.08);
}

function addBow(g: THREE.Group, color: number, prefix: string): void {
  const m = (g.userData._metrics ?? {}) as { shoulderY: number; torsoW: number };
  const bowM = mat(color, `${prefix}_bow`, 0.7, 0.15);
  const x = -((m.torsoW ?? 0.38) * 0.7);
  const y = (m.shoulderY ?? 1.2) - 0.15;
  // Arc approximated by two tilted cylinders + grip
  const limb = new THREE.CylinderGeometry(0.018, 0.022, 0.55, 5);
  const upper = addMesh(g, limb, bowM, x, y + 0.28, 0.12);
  upper.rotation.z = 0.55;
  upper.rotation.y = 0.2;
  const lower = addMesh(g, limb.clone(), bowM, x, y - 0.28, 0.12);
  lower.rotation.z = -0.55;
  lower.rotation.y = 0.2;
  addMesh(g, new THREE.CylinderGeometry(0.02, 0.02, 0.12, 5), bowM, x, y, 0.1);
  // String
  const stringM = mat(0xddd8c8, `${prefix}_string`, 0.5, 0.0);
  addMesh(g, new THREE.CylinderGeometry(0.008, 0.008, 0.85, 4), stringM, x + 0.08, y, 0.18);
}

function addAxe(g: THREE.Group, color: number, prefix: string): void {
  const m = (g.userData._metrics ?? {}) as { shoulderY: number; torsoW: number };
  const woodM = mat(WOOD, `${prefix}_haft`, 0.8, 0.05);
  const bladeM = mat(color, `${prefix}_blade`, 0.4, 0.65);
  const x = (m.torsoW ?? 0.38) * 0.75;
  const y = (m.shoulderY ?? 1.2) - 0.35;
  addMesh(g, new THREE.CylinderGeometry(0.025, 0.03, 0.85, 5), woodM, x, y, 0.12);
  // Axe head
  const blade = addMesh(g, new THREE.BoxGeometry(0.28, 0.18, 0.06), bladeM, x + 0.12, y + 0.35, 0.12);
  blade.rotation.z = -0.2;
  addMesh(g, new THREE.BoxGeometry(0.12, 0.22, 0.05), bladeM, x - 0.02, y + 0.35, 0.12);
}

function addSword(g: THREE.Group, color: number, prefix: string): void {
  const m = (g.userData._metrics ?? {}) as { hipY: number; torsoW: number };
  const metalM = mat(color, `${prefix}_sword`, 0.35, 0.7);
  const woodM = mat(WOOD, `${prefix}_grip`, 0.75, 0.1);
  const x = (m.torsoW ?? 0.38) * 0.55;
  const y = (m.hipY ?? 0.62) + 0.15;
  addMesh(g, new THREE.BoxGeometry(0.06, 0.55, 0.04), metalM, x, y + 0.2, 0.12);
  addMesh(g, new THREE.BoxGeometry(0.18, 0.04, 0.06), metalM, x, y - 0.05, 0.12);
  addMesh(g, new THREE.CylinderGeometry(0.03, 0.035, 0.16, 5), woodM, x, y - 0.14, 0.12);
}

function addShield(g: THREE.Group, color: number, prefix: string): void {
  const m = (g.userData._metrics ?? {}) as { shoulderY: number; torsoW: number };
  const shieldM = mat(color, `${prefix}_shield`, 0.55, 0.35);
  const x = -((m.torsoW ?? 0.38) * 0.7);
  const y = (m.shoulderY ?? 1.2) - 0.25;
  addMesh(g, new THREE.CylinderGeometry(0.2, 0.22, 0.06, 8), shieldM, x, y, 0.15).rotation.z =
    Math.PI / 2;
  addMesh(g, new THREE.BoxGeometry(0.08, 0.08, 0.08), mat(METAL, `${prefix}_boss`, 0.4, 0.7), x, y, 0.2);
}

function addCape(g: THREE.Group, color: number, prefix: string): void {
  const m = (g.userData._metrics ?? {}) as { shoulderY: number; torsoW: number; hipY: number };
  const capeM = mat(color, `${prefix}_cape`, 0.92, 0.02);
  const h = ((m.shoulderY ?? 1.2) - (m.hipY ?? 0.4)) * 1.15;
  addMesh(
    g,
    new THREE.BoxGeometry((m.torsoW ?? 0.38) * 1.1, h, 0.06),
    capeM,
    0,
    (m.shoulderY ?? 1.2) - h * 0.45,
    -((m as { torsoD?: number }).torsoD ?? 0.22) * 0.7 - 0.04
  );
}

function addDagger(g: THREE.Group, prefix: string): void {
  const m = (g.userData._metrics ?? {}) as { hipY: number; torsoW: number };
  const metalM = mat(METAL, `${prefix}_dagger`, 0.35, 0.7);
  const x = (m.torsoW ?? 0.38) * 0.45;
  const y = (m.hipY ?? 0.62) + 0.05;
  addMesh(g, new THREE.BoxGeometry(0.04, 0.28, 0.03), metalM, x, y, 0.14);
}

function addHammer(g: THREE.Group, prefix: string): void {
  const m = (g.userData._metrics ?? {}) as { shoulderY: number; torsoW: number };
  const woodM = mat(WOOD, `${prefix}_haft`, 0.8, 0.05);
  const headM = mat(METAL, `${prefix}_hammer`, 0.45, 0.6);
  const x = (m.torsoW ?? 0.38) * 0.7;
  const y = (m.shoulderY ?? 1.0) - 0.4;
  addMesh(g, new THREE.CylinderGeometry(0.03, 0.035, 0.7, 5), woodM, x, y, 0.1);
  addMesh(g, new THREE.BoxGeometry(0.22, 0.16, 0.14), headM, x, y + 0.32, 0.1);
}

function addQuiver(g: THREE.Group, prefix: string): void {
  const m = (g.userData._metrics ?? {}) as { shoulderY: number; torsoW: number };
  const quiverM = mat(LEATHER, `${prefix}_quiver`, 0.85, 0.05);
  addMesh(
    g,
    new THREE.CylinderGeometry(0.05, 0.06, 0.4, 6),
    quiverM,
    (m.torsoW ?? 0.38) * 0.45,
    (m.shoulderY ?? 1.2) - 0.25,
    -0.14
  );
}

function buildSteelguard(opts?: { scale?: number; color?: number }): THREE.Group {
  const bodyColor = opts?.color ?? 0x5a6a78;
  const g = humanoidBase(
    defaultProps({
      torsoW: 0.44,
      torsoD: 0.26,
      shoulderW: 0.58,
      bodyColor,
      accent: METAL,
      metalness: 0.25,
      roughness: 0.55,
    }),
    "steelguard"
  );
  addPauldrons(g, METAL, "steelguard", 1.15);
  addHelmet(g, 0x707880, "steelguard");
  addSword(g, 0x9aa0a8, "steelguard");
  addShield(g, 0x4a5560, "steelguard");
  addCape(g, 0x3a4a68, "steelguard");
  return g;
}

function buildSeafarer(opts?: { scale?: number; color?: number }): THREE.Group {
  const bodyColor = opts?.color ?? 0x3a5a68;
  const g = humanoidBase(
    defaultProps({
      torsoW: 0.46,
      torsoD: 0.28,
      torsoH: 0.58,
      shoulderW: 0.56,
      legH: 0.68,
      bodyColor,
      accent: 0x8a5a30,
      skin: 0xb89070,
    }),
    "seafarer"
  );
  addPauldrons(g, 0x4a4038, "seafarer", 1.05);
  // Fur collar
  const m = g.userData._metrics as { shoulderY: number; torsoW: number };
  addMesh(
    g,
    new THREE.TorusGeometry(0.16, 0.06, 5, 10),
    mat(0x8a7060, "seafarer_fur", 0.95, 0.02),
    0,
    m.shoulderY + 0.06,
    0
  ).rotation.x = Math.PI / 2;
  addAxe(g, METAL, "seafarer");
  return g;
}

function buildStonekin(opts?: { scale?: number; color?: number }): THREE.Group {
  const bodyColor = opts?.color ?? 0x6a6a70;
  const g = humanoidBase(
    defaultProps({
      height: 1.25,
      torsoW: 0.52,
      torsoD: 0.34,
      torsoH: 0.5,
      headR: 0.16,
      legH: 0.48,
      legR: 0.095,
      armR: 0.07,
      shoulderW: 0.64,
      bodyColor,
      accent: 0x8a7a50,
      skin: 0xb8a090,
      metalness: 0.15,
      roughness: 0.85,
    }),
    "stonekin"
  );
  addPauldrons(g, 0x5a5850, "stonekin", 1.2);
  addHelmet(g, 0x7a7868, "stonekin", false);
  addHammer(g, "stonekin");
  // Beard block
  const metrics = g.userData._metrics as { headY: number; headR: number };
  addMesh(
    g,
    new THREE.BoxGeometry(0.16, 0.14, 0.08),
    mat(0x8a8070, "stonekin_beard", 0.9, 0.02),
    0,
    metrics.headY - metrics.headR * 0.55,
    metrics.headR * 0.7
  );
  return g;
}

function buildShadowhand(opts?: { scale?: number; color?: number }): THREE.Group {
  const bodyColor = opts?.color ?? 0x2a2830;
  const g = humanoidBase(
    defaultProps({
      torsoW: 0.32,
      torsoD: 0.18,
      torsoH: 0.52,
      shoulderW: 0.4,
      legH: 0.74,
      headR: 0.13,
      bodyColor,
      accent: 0x1a1820,
      skin: SKIN_COOL,
    }),
    "shadowhand"
  );
  addHood(g, 0x1e1c24, "shadowhand", 0.85);
  addCape(g, 0x18161c, "shadowhand");
  addDagger(g, "shadowhand");
  return g;
}

function buildTrickster(opts?: { scale?: number; color?: number }): THREE.Group {
  const bodyColor = opts?.color ?? 0x6a3a58;
  const g = humanoidBase(
    defaultProps({
      torsoW: 0.34,
      torsoD: 0.2,
      shoulderW: 0.42,
      legH: 0.72,
      bodyColor,
      accent: 0xc4a030,
      skin: SKIN,
    }),
    "trickster"
  );
  // Pointed hat
  const m = g.userData._metrics as { headY: number; headR: number };
  addMesh(
    g,
    new THREE.ConeGeometry(m.headR * 1.2, m.headR * 2.2, 6),
    mat(0x7a2a4a, "trickster_hat", 0.85, 0.05),
    0,
    m.headY + m.headR * 1.2,
    0
  );
  // Feather
  addMesh(
    g,
    new THREE.ConeGeometry(0.02, 0.22, 4),
    mat(0xd4c040, "trickster_feather", 0.6, 0.05),
    m.headR * 0.6,
    m.headY + m.headR * 1.6,
    0
  ).rotation.z = -0.6;
  addDagger(g, "trickster");
  return g;
}

function buildCaster(
  style: "hexweaver" | "wildcaller" | "magister",
  opts?: { scale?: number; color?: number }
): THREE.Group {
  const palettes = {
    hexweaver: { body: 0x4a2a58, accent: 0x8a40a0, orb: 0xc060e0, skin: SKIN_PALE },
    wildcaller: { body: 0x3a5a38, accent: 0x6a8a40, orb: 0x70c050, skin: 0xb8a070 },
    magister: { body: 0x2a3a68, accent: 0x4a70b0, orb: 0x60a0ff, skin: SKIN_PALE },
  } as const;
  const p = palettes[style];
  const bodyColor = opts?.color ?? p.body;
  const g = humanoidBase(
    defaultProps({
      torsoW: 0.36,
      torsoD: 0.22,
      torsoH: 0.56,
      shoulderW: 0.44,
      legH: 0.68,
      bodyColor,
      accent: p.accent,
      skin: p.skin,
    }),
    style
  );
  addRobe(g, bodyColor, style, style === "magister" ? 1.25 : 1.12);
  addHood(g, p.accent, style, style === "hexweaver" ? 1.15 : 0.95);
  addStaff(g, WOOD, style, p.orb);
  if (style === "magister") addCape(g, 0x1a2850, style);
  return g;
}

function buildPathfinder(opts?: { scale?: number; color?: number }): THREE.Group {
  const bodyColor = opts?.color ?? 0x4a5a40;
  const g = humanoidBase(
    defaultProps({
      torsoW: 0.36,
      torsoD: 0.2,
      shoulderW: 0.44,
      legH: 0.74,
      bodyColor,
      accent: LEATHER,
      skin: 0xb89870,
    }),
    "pathfinder"
  );
  addHood(g, 0x3a4a30, "pathfinder", 0.9);
  addBow(g, WOOD, "pathfinder");
  addQuiver(g, "pathfinder");
  return g;
}

function buildElfLine(
  style: "leafborn" | "grovekin" | "frostborn",
  opts?: { scale?: number; color?: number }
): THREE.Group {
  const palettes = {
    leafborn: { body: 0x5a7a58, accent: 0xa0c060, skin: 0xd0c0a8 },
    grovekin: { body: 0x3a5a48, accent: 0x2a4030, skin: 0xc0b098 },
    frostborn: { body: 0x5a7088, accent: 0xa0c8e0, skin: 0xd8e0e8 },
  } as const;
  const p = palettes[style];
  const bodyColor = opts?.color ?? p.body;
  const g = humanoidBase(
    defaultProps({
      height: 1.9,
      torsoW: 0.3,
      torsoD: 0.18,
      torsoH: 0.58,
      headR: 0.13,
      legH: 0.82,
      legR: 0.055,
      armR: 0.045,
      shoulderW: 0.38,
      bodyColor,
      accent: p.accent,
      skin: p.skin,
    }),
    style
  );
  // Tall slender ears
  const metrics = g.userData._metrics as { headY: number; headR: number };
  const earM = mat(p.skin, `${style}_ear`, 0.7, 0.04);
  const earGeo = new THREE.ConeGeometry(0.025, 0.12, 4);
  const earL = addMesh(g, earGeo, earM, -metrics.headR * 0.85, metrics.headY + 0.04, 0);
  earL.rotation.z = 0.5;
  const earR = addMesh(g, earGeo.clone(), earM, metrics.headR * 0.85, metrics.headY + 0.04, 0);
  earR.rotation.z = -0.5;

  if (style === "frostborn") {
    addHood(g, 0x7088a0, style, 1.0);
    addStaff(g, 0x88aacc, style, 0xa0d8ff);
    addCape(g, 0x405868, style);
  } else if (style === "leafborn") {
    addBow(g, WOOD, style);
    addQuiver(g, style);
    // Leaf crown
    addMesh(
      g,
      new THREE.TorusGeometry(metrics.headR * 0.95, 0.02, 4, 10),
      mat(p.accent, `${style}_crown`, 0.7, 0.1),
      0,
      metrics.headY + metrics.headR * 0.7,
      0
    ).rotation.x = Math.PI / 2;
  } else {
    // grovekin — hood + bow
    addHood(g, 0x2a4030, style, 0.85);
    addBow(g, 0x4a3820, style);
    addQuiver(g, style);
  }
  return g;
}

function buildNpc(kind: CharacterMeshStyle, opts?: { scale?: number; color?: number }): THREE.Group {
  const palettes: Record<string, { body: number; accent: number; skin: number }> = {
    npc_priest: { body: 0xc4b49a, accent: 0x5a4a68, skin: SKIN_PALE },
    npc_envoy: { body: 0x6b8f71, accent: 0x2f4a32, skin: SKIN },
    npc_merchant: { body: 0xb8860b, accent: 0x6a4020, skin: 0xc4a070 },
    npc_innkeep: { body: 0x8b5a2b, accent: 0x4a3020, skin: 0xb89068 },
    npc_smith: { body: 0x6a6a70, accent: 0x3a3a40, skin: 0xa88868 },
    npc_guard: { body: 0x4a5560, accent: METAL, skin: SKIN },
  };
  const p = palettes[kind] ?? { body: 0x888888, accent: 0x555555, skin: SKIN };
  const bodyColor = opts?.color ?? p.body;
  const g = humanoidBase(
    defaultProps({
      torsoW: kind === "npc_smith" || kind === "npc_guard" ? 0.42 : 0.36,
      shoulderW: kind === "npc_guard" ? 0.52 : 0.44,
      bodyColor,
      accent: p.accent,
      skin: p.skin,
      metalness: kind === "npc_smith" || kind === "npc_guard" ? 0.2 : 0.05,
    }),
    kind
  );
  addRobe(g, bodyColor, kind, kind === "npc_priest" ? 1.2 : 1.08);
  if (kind === "npc_priest") {
    addHood(g, p.accent, kind, 0.7);
    addStaff(g, WOOD, kind, 0xe8d080);
  } else if (kind === "npc_envoy") {
    addCape(g, p.accent, kind);
  } else if (kind === "npc_merchant") {
    // Coin pouch
    const m = g.userData._metrics as { hipY: number; torsoW: number };
    addMesh(
      g,
      new THREE.SphereGeometry(0.08, 6, 5),
      mat(0xd4af37, "npc_merchant_pouch", 0.4, 0.5),
      m.torsoW * 0.45,
      m.hipY + 0.1,
      0.12
    );
  } else if (kind === "npc_innkeep") {
    // Apron
    const m = g.userData._metrics as { hipY: number; torsoH: number; torsoW: number };
    addMesh(
      g,
      new THREE.BoxGeometry(m.torsoW * 0.85, m.torsoH * 0.7, 0.04),
      mat(0xd8c8a8, "npc_innkeep_apron", 0.9, 0.02),
      0,
      m.hipY + m.torsoH * 0.35,
      0.14
    );
  } else if (kind === "npc_smith") {
    addPauldrons(g, 0x4a4a50, kind, 0.9);
    addHammer(g, kind);
  } else if (kind === "npc_guard") {
    addHelmet(g, METAL, kind);
    addPauldrons(g, METAL, kind, 1.0);
    addSword(g, 0x8a9098, kind);
  }
  return g;
}

function buildWolf(opts?: { scale?: number; color?: number }): THREE.Group {
  const g = new THREE.Group();
  const color = opts?.color ?? 0x6b4a3a;
  const bodyM = mat(color, "enemy_wolf_body", 0.8, 0.05);
  const darkM = mat(0x3a2818, "enemy_wolf_dark", 0.85, 0.04);

  const length = 0.9;
  const height = 0.38;
  const body = addMesh(
    g,
    new THREE.CapsuleGeometry(height * 0.5, length * 0.5, 3, 6),
    bodyM,
    0,
    height * 0.72,
    0
  );
  body.rotation.z = Math.PI / 2;

  addMesh(g, new THREE.SphereGeometry(height * 0.42, 6, 5), bodyM, 0, height * 0.9, length * 0.38);
  // Snout
  addMesh(
    g,
    new THREE.BoxGeometry(0.12, 0.1, 0.18),
    darkM,
    0,
    height * 0.82,
    length * 0.52
  );
  // Ears
  const earGeo = new THREE.ConeGeometry(0.04, 0.1, 4);
  addMesh(g, earGeo, darkM, -0.08, height * 1.15, length * 0.32);
  addMesh(g, earGeo.clone(), darkM, 0.08, height * 1.15, length * 0.32);
  // Tail
  const tail = addMesh(
    g,
    new THREE.CylinderGeometry(0.02, 0.05, 0.35, 5),
    bodyM,
    0,
    height * 0.85,
    -length * 0.4
  );
  tail.rotation.x = 0.6;

  const legGeo = new THREE.CylinderGeometry(0.04, 0.05, height * 0.7, 5);
  for (const [lx, lz] of [
    [-0.14, 0.22],
    [0.14, 0.22],
    [-0.14, -0.24],
    [0.14, -0.24],
  ] as const) {
    addMesh(g, legGeo.clone(), darkM, lx, height * 0.32, lz);
  }
  return g;
}

function buildCaveBeast(opts?: { scale?: number; color?: number }): THREE.Group {
  const g = new THREE.Group();
  const color = opts?.color ?? 0x4a3a2a;
  const bodyM = mat(color, "enemy_cave_beast_body", 0.85, 0.08);
  const darkM = mat(0x2a1a10, "enemy_cave_beast_dark", 0.9, 0.05);

  const length = 1.1;
  const height = 0.52;
  const body = addMesh(
    g,
    new THREE.CapsuleGeometry(height * 0.55, length * 0.45, 3, 6),
    bodyM,
    0,
    height * 0.75,
    0
  );
  body.rotation.z = Math.PI / 2;

  addMesh(g, new THREE.SphereGeometry(height * 0.48, 6, 5), bodyM, 0, height * 0.95, length * 0.35);
  // Tusks
  const tuskM = mat(0xe8e0d0, "enemy_cave_beast_tusk", 0.4, 0.15);
  const tusk = addMesh(g, new THREE.ConeGeometry(0.03, 0.16, 4), tuskM, -0.1, height * 0.75, length * 0.5);
  tusk.rotation.x = Math.PI / 2;
  const tusk2 = addMesh(g, new THREE.ConeGeometry(0.03, 0.16, 4), tuskM, 0.1, height * 0.75, length * 0.5);
  tusk2.rotation.x = Math.PI / 2;

  // Hump
  addMesh(g, new THREE.SphereGeometry(0.2, 6, 5), darkM, 0, height * 1.15, -0.05);

  const legGeo = new THREE.CylinderGeometry(0.06, 0.08, height * 0.75, 5);
  for (const [lx, lz] of [
    [-0.2, 0.28],
    [0.2, 0.28],
    [-0.2, -0.3],
    [0.2, -0.3],
  ] as const) {
    addMesh(g, legGeo.clone(), darkM, lx, height * 0.35, lz);
  }
  return g;
}

function buildOrc(opts?: { scale?: number; color?: number }): THREE.Group {
  const bodyColor = opts?.color ?? 0x5a7a3a;
  const g = humanoidBase(
    defaultProps({
      height: 1.8,
      torsoW: 0.52,
      torsoD: 0.3,
      torsoH: 0.58,
      headR: 0.16,
      legH: 0.7,
      legR: 0.09,
      armR: 0.08,
      shoulderW: 0.66,
      bodyColor,
      accent: 0x3a4a28,
      skin: SKIN_GREEN,
      roughness: 0.8,
    }),
    "enemy_orc"
  );
  addPauldrons(g, 0x4a4030, "enemy_orc", 1.25);
  addAxe(g, METAL, "enemy_orc");
  // Tusks
  const m = g.userData._metrics as { headY: number; headR: number };
  const tuskM = mat(0xe8e0d0, "enemy_orc_tusk", 0.45, 0.1);
  const tL = addMesh(g, new THREE.ConeGeometry(0.025, 0.1, 4), tuskM, -0.05, m.headY - m.headR * 0.4, m.headR * 0.75);
  tL.rotation.x = 0.9;
  const tR = addMesh(g, new THREE.ConeGeometry(0.025, 0.1, 4), tuskM, 0.05, m.headY - m.headR * 0.4, m.headR * 0.75);
  tR.rotation.x = 0.9;
  return g;
}

function buildCultist(opts?: { scale?: number; color?: number }): THREE.Group {
  const color = opts?.color ?? 0x3a2a4a;
  const g = new THREE.Group();
  const robeM = mat(color, "enemy_cultist_robe", 0.88, 0.04);
  const hoodM = mat(0x2a1a30, "enemy_cultist_hood", 0.9, 0.03);
  const faceM = mat(0x1a1018, "enemy_cultist_face", 0.6, 0.05, {
    emissive: new THREE.Color(0x440022),
    emissiveIntensity: 0.35,
  });

  // Robe body — cone silhouette
  addMesh(g, new THREE.ConeGeometry(0.34, 1.15, 6), robeM, 0, 0.58, 0);
  // Hood cone head
  addMesh(g, new THREE.ConeGeometry(0.22, 0.45, 6), hoodM, 0, 1.35, 0);
  // Face void
  addMesh(g, new THREE.SphereGeometry(0.12, 6, 5), faceM, 0, 1.18, 0.1);
  // Arms tucked
  addMesh(g, new THREE.BoxGeometry(0.55, 0.12, 0.14), robeM, 0, 0.85, 0.12);
  // Ritual staff
  const staffM = mat(WOOD, "enemy_cultist_staff", 0.75, 0.1);
  const orbM = mat(0xff3344, "enemy_cultist_orb", 0.4, 0.2, {
    emissive: new THREE.Color(0xff3344).multiplyScalar(0.5),
    emissiveIntensity: 0.8,
  });
  addMesh(g, new THREE.CylinderGeometry(0.025, 0.035, 1.45, 5), staffM, 0.32, 0.72, 0.08);
  addMesh(g, new THREE.SphereGeometry(0.08, 6, 5), orbM, 0.32, 1.48, 0.08);
  return g;
}

function buildUndead(opts?: { scale?: number; color?: number }): THREE.Group {
  const color = opts?.color ?? BONE;
  const g = new THREE.Group();
  const boneM = mat(color, "enemy_undead_bone", 0.55, 0.12);
  const darkM = mat(0x3a3830, "enemy_undead_dark", 0.8, 0.05);

  // Thin legs
  addMesh(g, new THREE.CylinderGeometry(0.04, 0.05, 0.5, 5), boneM, -0.1, 0.25, 0);
  addMesh(g, new THREE.CylinderGeometry(0.04, 0.05, 0.5, 5), boneM, 0.1, 0.25, 0);
  // Ribcage torso
  addMesh(g, new THREE.BoxGeometry(0.28, 0.42, 0.16), boneM, 0, 0.72, 0);
  // Rib lines
  for (let i = 0; i < 3; i++) {
    addMesh(
      g,
      new THREE.BoxGeometry(0.3, 0.03, 0.18),
      darkM,
      0,
      0.6 + i * 0.1,
      0.02
    );
  }
  // Skull
  addMesh(g, new THREE.SphereGeometry(0.13, 7, 6), boneM, 0, 1.12, 0);
  // Eye sockets glow
  const eyeM = mat(0x44ff66, "enemy_undead_eye", 0.3, 0.1, {
    emissive: new THREE.Color(0x22aa44),
    emissiveIntensity: 0.8,
  });
  addMesh(g, new THREE.SphereGeometry(0.03, 4, 4), eyeM, -0.05, 1.14, 0.1);
  addMesh(g, new THREE.SphereGeometry(0.03, 4, 4), eyeM, 0.05, 1.14, 0.1);
  // Thin arms
  const arm = addMesh(g, new THREE.CylinderGeometry(0.035, 0.04, 0.4, 5), boneM, -0.22, 0.75, 0);
  arm.rotation.z = 0.35;
  const armR = addMesh(g, new THREE.CylinderGeometry(0.035, 0.04, 0.4, 5), boneM, 0.22, 0.75, 0);
  armR.rotation.z = -0.35;
  // Tattered cloth
  addMesh(g, new THREE.BoxGeometry(0.32, 0.2, 0.05), darkM, 0, 0.55, -0.1);
  return g;
}

function buildFrostWight(opts?: { scale?: number; color?: number }): THREE.Group {
  const color = opts?.color ?? 0x7ab0c8;
  const g = new THREE.Group();
  const robeM = mat(color, "enemy_frost_wight_robe", 0.55, 0.15, {
    emissive: new THREE.Color(0x206080),
    emissiveIntensity: 0.2,
  });
  const iceM = mat(0xb0e0ff, "enemy_frost_wight_ice", 0.3, 0.25, {
    emissive: new THREE.Color(0x80c0ff),
    emissiveIntensity: 0.55,
  });

  addMesh(g, new THREE.ConeGeometry(0.36, 1.3, 6), robeM, 0, 0.65, 0);
  addMesh(g, new THREE.ConeGeometry(0.24, 0.5, 6), robeM, 0, 1.45, 0);
  addMesh(g, new THREE.SphereGeometry(0.14, 7, 6), iceM, 0, 1.28, 0.08);
  // Ice spikes on shoulders
  const spike = new THREE.ConeGeometry(0.06, 0.22, 4);
  addMesh(g, spike, iceM, -0.22, 1.05, 0);
  addMesh(g, spike.clone(), iceM, 0.22, 1.05, 0);
  // Arms
  addMesh(g, new THREE.BoxGeometry(0.6, 0.1, 0.12), robeM, 0, 0.95, 0.1);
  // Frost staff
  addMesh(g, new THREE.CylinderGeometry(0.025, 0.03, 1.4, 5), iceM, 0.35, 0.7, 0.1);
  addMesh(g, new THREE.OctahedronGeometry(0.1, 0), iceM, 0.35, 1.45, 0.1);
  return g;
}

function buildAshGuardian(opts?: { scale?: number; color?: number }): THREE.Group {
  const color = opts?.color ?? 0x4a4038;
  const g = new THREE.Group();
  const stoneM = mat(color, "enemy_ash_guardian_stone", 0.9, 0.2);
  const glowM = mat(0xff6622, "enemy_ash_guardian_glow", 0.4, 0.1, {
    emissive: new THREE.Color(0xff4400),
    emissiveIntensity: 0.75,
  });

  // Blocky golem body
  addMesh(g, new THREE.BoxGeometry(0.75, 0.9, 0.5), stoneM, 0, 0.7, 0);
  // Legs as blocks
  addMesh(g, new THREE.BoxGeometry(0.28, 0.4, 0.28), stoneM, -0.18, 0.2, 0);
  addMesh(g, new THREE.BoxGeometry(0.28, 0.4, 0.28), stoneM, 0.18, 0.2, 0);
  // Arms
  addMesh(g, new THREE.BoxGeometry(0.22, 0.7, 0.22), stoneM, -0.52, 0.65, 0);
  addMesh(g, new THREE.BoxGeometry(0.22, 0.7, 0.22), stoneM, 0.52, 0.65, 0);
  // Fists
  addMesh(g, new THREE.BoxGeometry(0.28, 0.22, 0.28), stoneM, -0.52, 0.28, 0.05);
  addMesh(g, new THREE.BoxGeometry(0.28, 0.22, 0.28), stoneM, 0.52, 0.28, 0.05);
  // Head cube
  addMesh(g, new THREE.BoxGeometry(0.42, 0.38, 0.38), stoneM, 0, 1.35, 0);
  // Ember eyes + core
  addMesh(g, new THREE.SphereGeometry(0.06, 5, 4), glowM, -0.1, 1.38, 0.18);
  addMesh(g, new THREE.SphereGeometry(0.06, 5, 4), glowM, 0.1, 1.38, 0.18);
  addMesh(g, new THREE.SphereGeometry(0.1, 6, 5), glowM, 0, 0.75, 0.22);
  // Shoulder blocks
  addMesh(g, new THREE.BoxGeometry(0.3, 0.2, 0.3), stoneM, -0.4, 1.15, 0);
  addMesh(g, new THREE.BoxGeometry(0.3, 0.2, 0.3), stoneM, 0.4, 1.15, 0);
  return g;
}

function buildPlayerDefault(opts?: { scale?: number; color?: number }): THREE.Group {
  const bodyColor = opts?.color ?? 0x4a7ab8;
  const g = humanoidBase(
    defaultProps({
      bodyColor,
      accent: 0x7eb0e0,
      skin: SKIN,
    }),
    "player_default"
  );
  addPauldrons(g, 0x5a80a8, "player_default", 0.9);
  return g;
}

function applyScale(g: THREE.Group, scale?: number): void {
  if (scale != null && scale !== 1) g.scale.setScalar(scale);
}

function finalize(g: THREE.Group, style: CharacterMeshStyle, opts?: { scale?: number }): THREE.Group {
  g.userData.style = style;
  // Strip internal metrics from userData surface (keep style only for consumers)
  delete g.userData._metrics;
  applyScale(g, opts?.scale);
  return g;
}

/** Create a low-poly character mesh for the given style. Feet at y=0, adult ~1.7 tall. */
export function createCharacterMesh(
  style: CharacterMeshStyle,
  options?: { scale?: number; color?: number }
): THREE.Group {
  let g: THREE.Group;
  switch (style) {
    case "steelguard":
      g = buildSteelguard(options);
      break;
    case "seafarer":
      g = buildSeafarer(options);
      break;
    case "stonekin":
      g = buildStonekin(options);
      break;
    case "shadowhand":
      g = buildShadowhand(options);
      break;
    case "trickster":
      g = buildTrickster(options);
      break;
    case "hexweaver":
    case "wildcaller":
    case "magister":
      g = buildCaster(style, options);
      break;
    case "pathfinder":
      g = buildPathfinder(options);
      break;
    case "leafborn":
    case "grovekin":
    case "frostborn":
      g = buildElfLine(style, options);
      break;
    case "npc_priest":
    case "npc_envoy":
    case "npc_merchant":
    case "npc_innkeep":
    case "npc_smith":
    case "npc_guard":
      g = buildNpc(style, options);
      break;
    case "enemy_wolf":
      g = buildWolf(options);
      break;
    case "enemy_orc":
      g = buildOrc(options);
      break;
    case "enemy_cultist":
      g = buildCultist(options);
      break;
    case "enemy_undead":
      g = buildUndead(options);
      break;
    case "enemy_cave_beast":
      g = buildCaveBeast(options);
      break;
    case "enemy_frost_wight":
      g = buildFrostWight(options);
      break;
    case "enemy_ash_guardian":
      g = buildAshGuardian(options);
      break;
    case "player_default":
    default:
      g = buildPlayerDefault(options);
      break;
  }
  return finalize(g, style === undefined ? "player_default" : style, options);
}

const ARCHETYPE_STYLES = new Set<string>([
  "steelguard",
  "seafarer",
  "stonekin",
  "shadowhand",
  "trickster",
  "hexweaver",
  "wildcaller",
  "magister",
  "pathfinder",
  "leafborn",
  "grovekin",
  "frostborn",
]);

/** Party combat / avatar figure from archetype id (and optional gender for slight proportion tweak). */
export function createPartyAvatar(archetype: string, gender?: "m" | "f"): THREE.Group {
  const id = (archetype || "player_default").toLowerCase();
  const style: CharacterMeshStyle = ARCHETYPE_STYLES.has(id)
    ? (id as CharacterMeshStyle)
    : "player_default";
  const scale = gender === "f" ? 0.94 : gender === "m" ? 1.0 : 1.0;
  // Stonekin already short; elven line stays tall
  const g = createCharacterMesh(style, { scale });
  if (gender === "f" && style !== "stonekin") {
    // Slightly narrower shoulders via scale on X only for non-stonekin
    g.scale.x *= 0.95;
  }
  return g;
}

const ENEMY_TYPE_MAP: Record<string, CharacterMeshStyle> = {
  wolf: "enemy_wolf",
  orc: "enemy_orc",
  orc_raider: "enemy_orc",
  cultist: "enemy_cultist",
  undead: "enemy_undead",
  cave_beast: "enemy_cave_beast",
  frost_wight: "enemy_frost_wight",
  ash_guardian: "enemy_ash_guardian",
};

/** Enemy mesh from content/combat enemy type string. */
export function createEnemyMesh(enemyType: string): THREE.Group {
  const key = (enemyType || "wolf").toLowerCase();
  let style = ENEMY_TYPE_MAP[key];
  if (!style) {
    if (key.includes("orc")) style = "enemy_orc";
    else if (key.includes("cult")) style = "enemy_cultist";
    else if (key.includes("undead")) style = "enemy_undead";
    else if (key.includes("frost") || key.includes("wight") || key.includes("ice"))
      style = "enemy_frost_wight";
    else if (key.includes("ash") || key.includes("guardian")) style = "enemy_ash_guardian";
    else if (key.includes("cave") || key.includes("beast")) style = "enemy_cave_beast";
    else if (key.includes("wolf")) style = "enemy_wolf";
    else style = "enemy_wolf";
  }
  return createCharacterMesh(style);
}

const NPC_KIND_MAP: Record<string, CharacterMeshStyle> = {
  priest: "npc_priest",
  envoy: "npc_envoy",
  merchant: "npc_merchant",
  innkeep: "npc_innkeep",
  smith: "npc_smith",
  guard: "npc_guard",
  npc_priest: "npc_priest",
  npc_envoy: "npc_envoy",
  npc_merchant: "npc_merchant",
  npc_innkeep: "npc_innkeep",
  npc_smith: "npc_smith",
  npc_guard: "npc_guard",
};

/** Town NPC mesh from kind string (priest, merchant, …). */
export function createNpcMesh(kind: string): THREE.Group {
  const key = (kind || "").toLowerCase().replace(/^npc_/, "");
  const style = NPC_KIND_MAP[key] ?? NPC_KIND_MAP[`npc_${key}`] ?? "npc_merchant";
  return createCharacterMesh(style);
}
