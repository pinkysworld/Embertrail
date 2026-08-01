import * as THREE from "three";
import { TOWNS, DUNGEONS, type TownDef, type DungeonRoomDef } from "@embertrail/content";
import { getMaterial, getMaterialTiled } from "./materials";

export interface Interactable {
  id: string;
  position: THREE.Vector3;
  radius: number;
  kind: string;
}

type SceneMode = "town" | "dungeon";

export class WorldScene {
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(70, 1, 0.1, 250);
  root = new THREE.Group();
  interactables: Interactable[] = [];

  private sky: THREE.Mesh | null = null;
  private hemi: THREE.HemisphereLight;
  private dir: THREE.DirectionalLight;
  private amb: THREE.AmbientLight;
  private timeOfDay = 0.38;
  private mode: SceneMode = "town";
  private windowMats: THREE.MeshStandardMaterial[] = [];
  private lanternLights: THREE.PointLight[] = [];
  private fillLights: THREE.Light[] = [];

  constructor() {
    this.scene.add(this.root);
    this.scene.fog = new THREE.FogExp2(0x8a9aaa, 0.022);

    this.hemi = new THREE.HemisphereLight(0xb0c4de, 0x3d2e1f, 0.65);
    this.dir = new THREE.DirectionalLight(0xffe6c8, 0.95);
    this.dir.position.set(24, 42, 14);
    this.dir.castShadow = false;
    this.amb = new THREE.AmbientLight(0x6a7a8a, 0.22);

    this.scene.add(this.hemi, this.dir, this.amb);
    this.camera.position.set(0, 1.6, 10);
    this.ensureSky();
    this.setTimeOfDay(this.timeOfDay);
  }

  setSize(w: number, h: number): void {
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  clear(): void {
    const disposedMats = new Set<THREE.Material>();
    while (this.root.children.length) {
      const o = this.root.children.pop()!;
      o.traverse((c) => {
        const mesh = c as THREE.Mesh;
        if (mesh.geometry) mesh.geometry.dispose();
        // Dispose only local (non-cached) materials, once each
        if (mesh.userData?.disposeMat && mesh.material) {
          const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
          for (const m of mats) {
            if (!disposedMats.has(m)) {
              disposedMats.add(m);
              m.dispose();
            }
          }
        }
      });
    }
    this.interactables = [];
    this.windowMats = [];
    this.lanternLights = [];
    this.fillLights = [];
  }

  /**
   * Day/night cycle. t in [0,1]: 0 = midnight, 0.25 = dawn, 0.5 = noon, 0.75 = dusk.
   * Affects sky, fog, hemisphere/directional lights, window glow, and lanterns.
   */
  setTimeOfDay(t: number): void {
    this.timeOfDay = ((t % 1) + 1) % 1;
    if (this.mode !== "town") return;

    // Sun height: peak at noon (0.5), negative at night
    const sunElev = Math.sin((this.timeOfDay - 0.25) * Math.PI * 2);
    const day = THREE.MathUtils.clamp(sunElev, 0, 1);
    const night = 1 - day;

    // Near horizon boost for dawn/dusk warmth
    const horizon = Math.exp(-Math.pow((this.timeOfDay - 0.25) * 8, 2)) +
      Math.exp(-Math.pow((this.timeOfDay - 0.75) * 8, 2));

    const skyDay = new THREE.Color(0x7e9bb0);
    const skyNoon = new THREE.Color(0x8eb0c8);
    const skyDusk = new THREE.Color(0xc47848);
    const skyNight = new THREE.Color(0x070b14);

    const sky = new THREE.Color().copy(skyNight).lerp(skyDay, day);
    if (day > 0.55) sky.lerp(skyNoon, (day - 0.55) / 0.45);
    sky.lerp(skyDusk, THREE.MathUtils.clamp(horizon * night * 2.2, 0, 0.85));

    this.scene.background = sky.clone();
    if (this.sky) {
      (this.sky.material as THREE.MeshBasicMaterial).color.copy(sky);
    }

    const fogCol = sky.clone().multiplyScalar(0.85 + day * 0.1);
    this.scene.fog = new THREE.FogExp2(fogCol.getHex(), 0.018 + night * 0.012);

    this.hemi.color.set(day > 0.15 ? 0xb0c4de : 0x1a2840);
    this.hemi.groundColor.set(day > 0.15 ? 0x3d2e1f : 0x0a0806);
    this.hemi.intensity = 0.25 + day * 0.55;

    this.dir.color.set(horizon > 0.25 ? 0xffb070 : 0xffe6c8);
    if (night > 0.7) this.dir.color.set(0x4466aa);
    this.dir.intensity = 0.08 + day * 1.05;
    const az = this.timeOfDay * Math.PI * 2;
    this.dir.position.set(Math.cos(az) * 40, 8 + day * 40, Math.sin(az) * 30);

    this.amb.color.set(day > 0.2 ? 0x6a7a8a : 0x1a2230);
    this.amb.intensity = 0.12 + day * 0.18;

    // Windows glow at night
    const winGlow = Math.pow(night, 1.4) * 1.6;
    for (const m of this.windowMats) {
      m.emissiveIntensity = winGlow;
      m.color.set(night > 0.5 ? 0x1a1410 : 0x2a3548);
    }

    // Street lanterns
    for (const L of this.lanternLights) {
      L.intensity = 0.15 + night * 1.35;
      L.distance = 10 + night * 6;
    }
  }

  loadTown(townId: string): TownDef {
    this.clear();
    this.mode = "town";
    const town = TOWNS[townId] ?? TOWNS.rimeport;
    this.ensureSky();
    if (this.sky) this.sky.visible = true;

    const groundId =
      town.ground === "cobble"
        ? "cobble"
        : town.ground === "grass"
          ? "grass"
          : town.ground === "mud"
            ? "mud"
            : town.ground === "snow"
              ? "snow"
              : "flagstone";

    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(90, 90),
      getMaterialTiled(groundId, 14, 14)
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = 0;
    ground.userData.disposeMat = true;
    this.root.add(ground);

    // Soft outer ring (slightly different ground)
    const rimId = groundId === "cobble" ? "dirt" : groundId === "grass" ? "dirt" : "stone";
    const rim = new THREE.Mesh(
      new THREE.RingGeometry(38, 48, 48),
      getMaterialTiled(rimId, 6, 2)
    );
    rim.rotation.x = -Math.PI / 2;
    rim.position.y = 0.01;
    rim.userData.disposeMat = true;
    this.root.add(rim);

    // Boundary walls
    const wallMat = getMaterial("stone");
    for (const [x, z, w, d] of [
      [0, -24, 52, 2.2],
      [0, 24, 52, 2.2],
      [-24, 0, 2.2, 52],
      [24, 0, 2.2, 52],
    ] as const) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, 3.2, d), wallMat);
      m.position.set(x, 1.6, z);
      this.root.add(m);
      // wall cap
      const cap = new THREE.Mesh(
        new THREE.BoxGeometry(w + 0.3, 0.35, d + 0.3),
        getMaterial("flagstone")
      );
      cap.position.set(x, 3.35, z);
      this.root.add(cap);
    }

    // Paths from origin toward each building
    this.addTownPaths(town);

    // Buildings
    for (const b of town.buildings) {
      this.addBuilding(b);
      if (b.interact) {
        this.interactables.push({
          id: b.interact,
          position: new THREE.Vector3(b.x, 1, b.z + b.d / 2 + 0.5),
          radius: 2.5,
          kind: b.interact.startsWith("npc") ? "npc" : b.interact,
        });
      }
    }

    // Decorative props scattered near buildings
    this.addTownProps(town);

    // NPCs
    for (const npc of town.npcs) {
      this.addNpc(npc.x, npc.z, npc.kind);
      this.interactables.push({
        id: npc.id,
        position: new THREE.Vector3(npc.x, 1, npc.z),
        radius: 2.2,
        kind: "npc",
      });
    }

    // Lantern posts along main approaches
    const lanternSpots: Array<[number, number]> = [
      [-4, 8],
      [4, 8],
      [-12, 0],
      [12, 0],
      [0, -12],
      [-6, -2],
      [6, 4],
    ];
    for (const [lx, lz] of lanternSpots) {
      this.addLanternPost(lx, lz);
    }

    this.setTimeOfDay(this.timeOfDay);
    return town;
  }

  loadDungeonRoom(dungeonId: string, roomId: string): DungeonRoomDef {
    this.clear();
    this.mode = "dungeon";
    if (this.sky) this.sky.visible = false;

    const dungeon = DUNGEONS[dungeonId];
    const room = dungeon?.rooms.find((r) => r.id === roomId) ?? dungeon?.rooms[0];
    if (!room) throw new Error("no room");

    const theme = dungeonLightTheme(room.wallTexture);
    this.scene.background = new THREE.Color(theme.bg);
    this.scene.fog = new THREE.FogExp2(theme.fog, 0.045);

    // Dim global lights for dungeons
    this.hemi.intensity = 0.08;
    this.hemi.color.set(theme.hemi);
    this.hemi.groundColor.set(0x050403);
    this.dir.intensity = 0.05;
    this.amb.intensity = 0.12;
    this.amb.color.set(theme.amb);

    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(room.width, room.depth),
      getMaterialTiled(room.floorTexture, 6, 6)
    );
    floor.rotation.x = -Math.PI / 2;
    floor.userData.disposeMat = true;
    this.root.add(floor);

    // Ceiling
    const ceil = new THREE.Mesh(
      new THREE.PlaneGeometry(room.width, room.depth),
      getMaterialTiled(room.wallTexture, 5, 5)
    );
    ceil.rotation.x = Math.PI / 2;
    ceil.position.y = 4.2;
    ceil.userData.disposeMat = true;
    this.root.add(ceil);

    const wallMat = getMaterial(room.wallTexture);
    const hw = room.width / 2;
    const hd = room.depth / 2;
    const h = 4.2;
    const walls = [
      [0, hd, room.width, 1],
      [0, -hd, room.width, 1],
      [hw, 0, 1, room.depth],
      [-hw, 0, 1, room.depth],
    ] as const;
    for (const [x, z, w, d] of walls) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), wallMat);
      m.position.set(x, h / 2, z);
      this.root.add(m);
    }

    // Interior pillars for larger rooms
    if (room.width >= 18) {
      const pillarMat = getMaterial(room.wallTexture);
      const offsets = [
        [-room.width * 0.22, -room.depth * 0.22],
        [room.width * 0.22, -room.depth * 0.22],
        [-room.width * 0.22, room.depth * 0.22],
        [room.width * 0.22, room.depth * 0.22],
      ];
      for (const [px, pz] of offsets) {
        const pillar = new THREE.Mesh(
          new THREE.BoxGeometry(1.1, h, 1.1),
          pillarMat
        );
        pillar.position.set(px, h / 2, pz);
        this.root.add(pillar);
      }
    }

    // Torches along walls
    const torchY = 2.4;
    const margin = 1.2;
    const torchPositions: Array<[number, number, number]> = [
      [-hw + margin, torchY, -hd * 0.5],
      [hw - margin, torchY, -hd * 0.5],
      [-hw + margin, torchY, hd * 0.5],
      [hw - margin, torchY, hd * 0.5],
      [0, torchY, -hd + margin],
      [0, torchY, hd - margin],
    ];
    if (room.width >= 20) {
      torchPositions.push([-hw + margin, torchY, 0], [hw - margin, torchY, 0]);
    }
    for (const [tx, ty, tz] of torchPositions) {
      this.addTorch(tx, ty, tz, theme.torch);
    }

    // Encounters
    for (const enc of room.encounters) {
      for (let i = 0; i < enc.count; i++) {
        const e = new THREE.Mesh(
          new THREE.CapsuleGeometry(0.4, 0.85, 4, 8),
          this.localMat({ color: enemyColor(enc.type), roughness: 0.82, metalness: 0.1 })
        );
        e.position.set(enc.x + i * 1.25, 1.05, enc.z);
        e.userData.enemy = enc.type;
        e.userData.disposeMat = true;
        this.root.add(e);
      }
      this.interactables.push({
        id: `encounter_${enc.type}`,
        position: new THREE.Vector3(enc.x, 1, enc.z),
        radius: 3,
        kind: "encounter",
      });
    }

    // Features
    for (const f of room.features) {
      this.addFeature(f.x, f.z, f.kind);
      this.interactables.push({
        id: f.id,
        position: new THREE.Vector3(f.x, 1, f.z),
        radius: 2.2,
        kind: f.kind,
      });
    }

    // Ambient fill by theme
    const fill = new THREE.PointLight(theme.torch, 0.35, Math.max(room.width, room.depth) * 1.2);
    fill.position.set(0, 3.2, 0);
    this.root.add(fill);
    this.fillLights.push(fill);

    return room;
  }

  nearestInteractable(pos: THREE.Vector3): Interactable | null {
    let best: Interactable | null = null;
    let bestD = Infinity;
    for (const i of this.interactables) {
      const d = pos.distanceTo(i.position);
      if (d < i.radius && d < bestD) {
        best = i;
        bestD = d;
      }
    }
    return best;
  }

  // ── private builders ──────────────────────────────────────────────

  private ensureSky(): void {
    if (this.sky) return;
    const geo = new THREE.SphereGeometry(120, 28, 18);
    const mat = new THREE.MeshBasicMaterial({
      side: THREE.BackSide,
      color: 0x7e9bb0,
      depthWrite: false,
      fog: false,
    });
    this.sky = new THREE.Mesh(geo, mat);
    this.sky.name = "skyDome";
    this.scene.add(this.sky);
  }

  private localMat(params: THREE.MeshStandardMaterialParameters): THREE.MeshStandardMaterial {
    return new THREE.MeshStandardMaterial(params);
  }

  private addBuilding(b: {
    id: string;
    x: number;
    z: number;
    w: number;
    d: number;
    h: number;
    texture: string;
  }): void {
    // Slight height variance for visual interest (stable per building id)
    const hJitter = 0.85 + (hashStr(b.id) % 30) / 100;
    const h = b.h * hJitter;
    const bodyMat = getMaterial(b.texture);

    const body = new THREE.Mesh(new THREE.BoxGeometry(b.w, h, b.d), bodyMat);
    body.position.set(b.x, h / 2, b.z);
    body.userData.buildingId = b.id;
    this.root.add(body);

    // Peaked pyramid roof (4-sided cone aligned to box)
    const roofH = Math.max(1.0, Math.min(b.w, b.d) * 0.42 + 0.4);
    const roofR = Math.hypot(b.w, b.d) * 0.52;
    const roofMat = getMaterial(b.texture === "bark" ? "bark" : b.texture === "ice" ? "ice" : "planks");
    const roof = new THREE.Mesh(new THREE.ConeGeometry(roofR, roofH, 4), roofMat);
    roof.rotation.y = Math.PI / 4;
    roof.position.set(b.x, h + roofH / 2 - 0.05, b.z);
    this.root.add(roof);

    // Eave slab under roof
    const eave = new THREE.Mesh(
      new THREE.BoxGeometry(b.w + 0.45, 0.18, b.d + 0.45),
      getMaterial("planks")
    );
    eave.position.set(b.x, h + 0.05, b.z);
    this.root.add(eave);

    // Door (front face +Z)
    const doorW = Math.min(1.2, b.w * 0.35);
    const doorH = Math.min(2.0, h * 0.55);
    const doorMat = this.localMat({ color: 0x1e120a, roughness: 0.92, metalness: 0.05 });
    const door = new THREE.Mesh(new THREE.BoxGeometry(doorW, doorH, 0.12), doorMat);
    door.position.set(b.x, doorH / 2 + 0.02, b.z + b.d / 2 + 0.04);
    door.userData.disposeMat = true;
    this.root.add(door);

    // Door frame
    const frameMat = this.localMat({ color: 0x3a2a18, roughness: 0.85 });
    const frameL = new THREE.Mesh(new THREE.BoxGeometry(0.12, doorH + 0.15, 0.14), frameMat);
    frameL.position.set(b.x - doorW / 2 - 0.05, doorH / 2, b.z + b.d / 2 + 0.05);
    frameL.userData.disposeMat = true;
    this.root.add(frameL);
    const frameR = frameL.clone();
    frameR.position.x = b.x + doorW / 2 + 0.05;
    this.root.add(frameR);

    // Windows — emissive at night
    const winMat = this.localMat({
      color: 0x1a2030,
      emissive: 0xffa040,
      emissiveIntensity: 0,
      roughness: 0.35,
      metalness: 0.15,
    });
    this.windowMats.push(winMat);

    const winW = Math.min(0.7, b.w * 0.18);
    const winH = Math.min(0.85, h * 0.28);
    const winY = h * 0.55;
    const places: Array<[number, number, number]> = [];

    // Front windows flanking door
    if (b.w > 3) {
      places.push([b.x - b.w * 0.28, winY, b.z + b.d / 2 + 0.04]);
      places.push([b.x + b.w * 0.28, winY, b.z + b.d / 2 + 0.04]);
    } else {
      places.push([b.x + b.w * 0.28, winY, b.z + b.d / 2 + 0.04]);
    }
    // Side windows
    if (b.d > 3.5) {
      places.push([b.x + b.w / 2 + 0.04, winY, b.z]);
      places.push([b.x - b.w / 2 - 0.04, winY, b.z]);
    }
    // Upper floor if tall
    if (h > 4.5) {
      places.push([b.x - b.w * 0.2, h * 0.78, b.z + b.d / 2 + 0.04]);
      places.push([b.x + b.w * 0.2, h * 0.78, b.z + b.d / 2 + 0.04]);
    }

    for (const [wx, wy, wz] of places) {
      const isSide = Math.abs(wx - b.x) > b.w * 0.4;
      const win = new THREE.Mesh(
        new THREE.BoxGeometry(isSide ? 0.1 : winW, winH, isSide ? winW : 0.1),
        winMat
      );
      win.position.set(wx, wy, wz);
      win.userData.disposeMat = true;
      this.root.add(win);

      // frame
      const fw = isSide ? 0.12 : winW + 0.12;
      const fd = isSide ? winW + 0.12 : 0.12;
      const frm = new THREE.Mesh(
        new THREE.BoxGeometry(fw, winH + 0.12, fd),
        frameMat
      );
      frm.position.set(wx, wy, wz - (isSide ? 0 : 0.02));
      if (isSide) frm.position.x -= Math.sign(wx - b.x) * 0.02;
      frm.userData.disposeMat = true;
      this.root.add(frm);
    }

    // Chimney for larger houses
    if (h >= 3.5 && b.w >= 5) {
      const ch = new THREE.Mesh(
        new THREE.BoxGeometry(0.7, 1.4, 0.7),
        getMaterial("stone")
      );
      ch.position.set(b.x + b.w * 0.28, h + roofH * 0.35, b.z - b.d * 0.15);
      this.root.add(ch);
    }
  }

  private addTownPaths(town: TownDef): void {
    const pathMatId = town.ground === "cobble" ? "cobble" : town.ground === "mud" ? "mud" : "dirt";
    const pathMat = getMaterialTiled(pathMatId, 2, 8);

    // Cross roads through center
    const mainNS = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.04, 40), pathMat);
    mainNS.position.set(0, 0.02, 0);
    mainNS.userData.disposeMat = true;
    this.root.add(mainNS);

    const mainEW = new THREE.Mesh(
      new THREE.BoxGeometry(40, 0.04, 2.2),
      getMaterialTiled(pathMatId, 8, 2)
    );
    mainEW.position.set(0, 0.02, 0);
    mainEW.userData.disposeMat = true;
    this.root.add(mainEW);

    // Spurs to each building
    for (const b of town.buildings) {
      const dx = b.x;
      const dz = b.z;
      const len = Math.hypot(dx, dz);
      if (len < 2) continue;
      const spur = new THREE.Mesh(
        new THREE.BoxGeometry(1.5, 0.035, len * 0.55),
        getMaterialTiled(pathMatId, 1.5, len * 0.4)
      );
      spur.position.set(dx * 0.45, 0.025, dz * 0.45);
      spur.rotation.y = Math.atan2(dx, dz);
      spur.userData.disposeMat = true;
      this.root.add(spur);
    }
  }

  private addTownProps(town: TownDef): void {
    let seed = 1;
    for (const b of town.buildings) {
      // Barrels near corners
      const side = seed % 2 === 0 ? 1 : -1;
      this.addBarrel(b.x + (b.w / 2 + 0.7) * side, b.z + b.d * 0.3);
      if (b.w > 5) this.addBarrel(b.x - b.w / 2 - 0.6, b.z - b.d * 0.2, true);

      // Crates
      this.addCrate(b.x + b.w * 0.35, b.z + b.d / 2 + 1.1);
      if (seed % 3 === 0) {
        this.addCrate(b.x - b.w * 0.2, b.z + b.d / 2 + 1.4, 0.7);
      }

      // Market-ish stalls near market / timber buildings
      if (b.id.includes("market") || b.texture === "timber") {
        this.addMarketStall(b.x, b.z + b.d / 2 + 2.2);
      }
      seed++;
    }

    // A few free props near spawn plaza
    this.addBarrel(2.5, 6);
    this.addBarrel(3.1, 6.4, true);
    this.addCrate(-3, 7);
    this.addCrate(-2.3, 7.5, 0.65);
  }

  private addBarrel(x: number, z: number, tipped = false): void {
    const mat = getMaterial("planks");
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.36, 0.72, 10), mat);
    const bandMat = this.localMat({ color: 0x2a2a2e, roughness: 0.6, metalness: 0.55 });
    const band1 = new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.03, 6, 12), bandMat);
    band1.rotation.x = Math.PI / 2;
    band1.position.y = 0.18;
    const band2 = band1.clone();
    band2.position.y = -0.18;
    const g = new THREE.Group();
    g.add(body, band1, band2);
    if (tipped) {
      g.rotation.z = Math.PI / 2;
      g.position.set(x, 0.34, z);
    } else {
      g.position.set(x, 0.36, z);
    }
    band1.userData.disposeMat = true;
    this.root.add(g);
  }

  private addCrate(x: number, z: number, scale = 0.85): void {
    const mat = getMaterial("planks");
    const box = new THREE.Mesh(new THREE.BoxGeometry(0.7 * scale, 0.65 * scale, 0.7 * scale), mat);
    box.position.set(x, 0.32 * scale, z);
    box.rotation.y = hashStr(`${x},${z}`) * 0.01;
    this.root.add(box);
    // lid seam
    const seam = new THREE.Mesh(
      new THREE.BoxGeometry(0.72 * scale, 0.04, 0.72 * scale),
      this.localMat({ color: 0x3a2818, roughness: 0.9 })
    );
    seam.position.set(x, 0.62 * scale, z);
    seam.userData.disposeMat = true;
    this.root.add(seam);
  }

  private addMarketStall(x: number, z: number): void {
    const posts = getMaterial("planks");
    for (const [ox, oz] of [
      [-0.9, -0.5],
      [0.9, -0.5],
      [-0.9, 0.5],
      [0.9, 0.5],
    ] as const) {
      const p = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, 1.6, 6), posts);
      p.position.set(x + ox, 0.8, z + oz);
      this.root.add(p);
    }
    const roof = new THREE.Mesh(
      new THREE.BoxGeometry(2.2, 0.08, 1.4),
      this.localMat({ color: 0x6b3030, roughness: 0.85 })
    );
    roof.position.set(x, 1.65, z);
    roof.rotation.z = 0.08;
    roof.userData.disposeMat = true;
    this.root.add(roof);
    const table = new THREE.Mesh(
      new THREE.BoxGeometry(1.8, 0.1, 0.8),
      getMaterial("planks")
    );
    table.position.set(x, 0.85, z);
    this.root.add(table);
  }

  private addLanternPost(x: number, z: number): void {
    const poleMat = this.localMat({ color: 0x2a2420, roughness: 0.7, metalness: 0.35 });
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.1, 3.0, 6), poleMat);
    pole.position.set(x, 1.5, z);
    pole.userData.disposeMat = true;
    this.root.add(pole);

    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.07, 0.07), poleMat);
    arm.position.set(x + 0.25, 2.85, z);
    arm.userData.disposeMat = true;
    this.root.add(arm);

    const lampMat = this.localMat({
      color: 0xcc8844,
      emissive: 0xff9944,
      emissiveIntensity: 0.6,
      roughness: 0.4,
    });
    this.windowMats.push(lampMat);
    const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.35, 0.28), lampMat);
    lamp.position.set(x + 0.48, 2.7, z);
    lamp.userData.disposeMat = true;
    this.root.add(lamp);

    const light = new THREE.PointLight(0xffaa66, 0.4, 12);
    light.position.set(x + 0.48, 2.7, z);
    this.root.add(light);
    this.lanternLights.push(light);
  }

  private addNpc(x: number, z: number, kind: string): void {
    const body = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.35, 0.9, 4, 8),
      this.localMat({ color: npcColor(kind), roughness: 0.72, metalness: 0.05 })
    );
    body.position.set(x, 1.1, z);
    body.userData.disposeMat = true;
    this.root.add(body);

    // Simple head
    const head = new THREE.Mesh(
      new THREE.SphereGeometry(0.22, 10, 8),
      this.localMat({ color: 0xc4a882, roughness: 0.75 })
    );
    head.position.set(x, 1.85, z);
    head.userData.disposeMat = true;
    this.root.add(head);

    // Shoulder cloak hint
    const cloak = new THREE.Mesh(
      new THREE.BoxGeometry(0.75, 0.35, 0.4),
      this.localMat({ color: npcCloak(kind), roughness: 0.85 })
    );
    cloak.position.set(x, 1.45, z);
    cloak.userData.disposeMat = true;
    this.root.add(cloak);
  }

  private addTorch(x: number, y: number, z: number, color: number): void {
    const bracket = new THREE.Mesh(
      new THREE.CylinderGeometry(0.05, 0.07, 0.45, 6),
      this.localMat({ color: 0x2a2018, roughness: 0.8, metalness: 0.3 })
    );
    bracket.position.set(x, y - 0.15, z);
    bracket.userData.disposeMat = true;
    this.root.add(bracket);

    // Flame cone (simple emissive)
    const flameMat = this.localMat({
      color: 0xff6622,
      emissive: color,
      emissiveIntensity: 1.8,
      roughness: 1,
      transparent: true,
      opacity: 0.92,
      depthWrite: false,
    });
    const flame = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.42, 6), flameMat);
    flame.position.set(x, y + 0.28, z);
    flame.userData.disposeMat = true;
    this.root.add(flame);

    // Inner brighter core
    const core = new THREE.Mesh(
      new THREE.ConeGeometry(0.06, 0.22, 5),
      this.localMat({
        color: 0xffeeaa,
        emissive: 0xffcc66,
        emissiveIntensity: 2,
        transparent: true,
        opacity: 0.85,
        depthWrite: false,
      })
    );
    core.position.set(x, y + 0.2, z);
    core.userData.disposeMat = true;
    this.root.add(core);

    const light = new THREE.PointLight(color, 1.35, 13);
    light.position.set(x, y + 0.3, z);
    this.root.add(light);
    this.fillLights.push(light);
  }

  private addFeature(x: number, z: number, kind: string): void {
    let mesh: THREE.Mesh;
    switch (kind) {
      case "exit":
        mesh = new THREE.Mesh(
          new THREE.BoxGeometry(1.6, 2.2, 0.4),
          this.localMat({ color: 0x4a7c59, emissive: 0x1a3a28, emissiveIntensity: 0.4, roughness: 0.6 })
        );
        mesh.position.set(x, 1.1, z);
        break;
      case "boss":
        mesh = new THREE.Mesh(
          new THREE.CylinderGeometry(0.7, 0.9, 1.1, 6),
          this.localMat({ color: 0xb8860b, emissive: 0x5a3a00, emissiveIntensity: 0.35, metalness: 0.45, roughness: 0.4 })
        );
        mesh.position.set(x, 0.55, z);
        break;
      case "greed":
        mesh = new THREE.Mesh(
          new THREE.SphereGeometry(0.55, 10, 8),
          this.localMat({ color: 0xd4af37, emissive: 0x665200, emissiveIntensity: 0.45, metalness: 0.7, roughness: 0.3 })
        );
        mesh.position.set(x, 0.55, z);
        break;
      case "chest":
        mesh = new THREE.Mesh(
          new THREE.BoxGeometry(1.1, 0.7, 0.75),
          this.localMat({ color: 0x6b4423, roughness: 0.75, metalness: 0.15 })
        );
        mesh.position.set(x, 0.35, z);
        break;
      case "door":
        mesh = new THREE.Mesh(
          new THREE.BoxGeometry(1.4, 2.4, 0.35),
          this.localMat({ color: 0x4a4038, roughness: 0.8, metalness: 0.1 })
        );
        mesh.position.set(x, 1.2, z);
        break;
      case "puzzle":
        mesh = new THREE.Mesh(
          new THREE.OctahedronGeometry(0.65, 0),
          this.localMat({ color: 0x6688aa, emissive: 0x224466, emissiveIntensity: 0.5, metalness: 0.4, roughness: 0.35 })
        );
        mesh.position.set(x, 0.75, z);
        break;
      default:
        mesh = new THREE.Mesh(
          new THREE.BoxGeometry(1.0, 1.0, 1.0),
          this.localMat({ color: 0x666666, roughness: 0.7 })
        );
        mesh.position.set(x, 0.5, z);
    }
    mesh.userData.disposeMat = true;
    this.root.add(mesh);
  }
}

function dungeonLightTheme(wallTexture: string): {
  bg: number;
  fog: number;
  torch: number;
  hemi: number;
  amb: number;
} {
  switch (wallTexture) {
    case "ice":
      return { bg: 0x060c14, fog: 0x0a1828, torch: 0x66bbee, hemi: 0x223344, amb: 0x152030 };
    case "cult":
      return { bg: 0x0c0606, fog: 0x1a0a0a, torch: 0xff3344, hemi: 0x331818, amb: 0x220c0c };
    case "dwarf_stone":
      return { bg: 0x0a0908, fog: 0x1a1510, torch: 0xffaa55, hemi: 0x2a2218, amb: 0x1a1410 };
    default:
      return { bg: 0x0a0a0c, fog: 0x1a1510, torch: 0xffcc88, hemi: 0x223344, amb: 0x151820 };
  }
}

function npcColor(kind: string): number {
  switch (kind) {
    case "priest":
      return 0xc4b49a;
    case "envoy":
      return 0x6b8f71;
    case "merchant":
      return 0xb8860b;
    case "innkeep":
      return 0x8b5a2b;
    case "smith":
      return 0x6a6a70;
    case "guard":
      return 0x4a5560;
    default:
      return 0x888888;
  }
}

function npcCloak(kind: string): number {
  switch (kind) {
    case "priest":
      return 0x5a4a68;
    case "envoy":
      return 0x2f4a32;
    case "merchant":
      return 0x6a4020;
    case "innkeep":
      return 0x4a3020;
    case "smith":
      return 0x3a3a40;
    default:
      return 0x3a3a3a;
  }
}

function enemyColor(type: string): number {
  if (type.includes("cult")) return 0x5a1a1a;
  if (type.includes("frost") || type.includes("ice")) return 0x6a8aaa;
  if (type.includes("undead")) return 0x6a7060;
  if (type.includes("orc")) return 0x3a5a2a;
  if (type.includes("ash") || type.includes("guardian")) return 0x4a3030;
  return 0x6b2e2e;
}

function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}
