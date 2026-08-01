/**
 * Tactical combat board for Embertrail — Three.js overlay scene.
 * Renders a grid from CombatState; party (blue) vs enemies (red, shape by type).
 * Works with an external WebGLRenderer via render().
 */
import * as THREE from "three";
import type { CombatState, Combatant } from "@embertrail/shared";

const TILE = 1;
const ACTIVE_COLOR = 0xffd54a;
const SELECT_COLOR = 0xe53935;
const PARTY_COLOR = 0x4a7ab8;
const PARTY_ACCENT = 0x7eb0e0;
const ENEMY_BASE = 0xa63d3d;
const TILE_A = 0x5a6b52;
const TILE_B = 0x4a5844;
const BLOCKED_COLOR = 0x2a2e2c;
const DEAD_OPACITY = 0.28;

export type CombatPick = { x: number; y: number };

export class CombatScene {
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(42, 1, 0.1, 200);

  /** Currently highlighted target (red ring); null = none */
  selectedId: string | null = null;

  private root = new THREE.Group();
  private board = new THREE.Group();
  private units = new THREE.Group();
  private markers = new THREE.Group();
  private groundPlane: THREE.Mesh | null = null;
  private raycaster = new THREE.Raycaster();
  private ndc = new THREE.Vector2();
  private state: CombatState | null = null;
  private unitMeshes = new Map<string, THREE.Group>();
  private width = 10;
  private height = 8;

  // Reusable geometries / materials (freed in dispose)
  private geos = {
    tile: new THREE.BoxGeometry(TILE * 0.98, 0.12, TILE * 0.98),
    blocked: new THREE.BoxGeometry(TILE * 0.96, 0.55, TILE * 0.96),
    capsule: new THREE.CapsuleGeometry(0.22, 0.55, 4, 8),
    sphereS: new THREE.SphereGeometry(0.18, 8, 8),
    sphereTiny: new THREE.SphereGeometry(0.1, 6, 6),
    shoulder: new THREE.BoxGeometry(0.55, 0.14, 0.22),
    barBg: new THREE.BoxGeometry(0.7, 0.06, 0.06),
    barFg: new THREE.BoxGeometry(0.68, 0.04, 0.05),
    cone: new THREE.ConeGeometry(0.32, 0.9, 6),
    cylLeg: new THREE.CylinderGeometry(0.05, 0.06, 0.45, 5),
    boxTorso: new THREE.BoxGeometry(0.28, 0.45, 0.16),
    ringActive: new THREE.TorusGeometry(0.42, 0.08, 8, 28),
    ringSelect: new THREE.TorusGeometry(0.48, 0.06, 8, 28),
  };

  private mats = {
    tileA: mat(TILE_A, 0.92),
    tileB: mat(TILE_B, 0.92),
    blocked: mat(BLOCKED_COLOR, 0.95, 0.15),
    rim: mat(0x1e2420, 0.9),
    partyBody: mat(PARTY_COLOR, 0.65, 0.1),
    partyHead: mat(PARTY_ACCENT, 0.55),
    enemyFallback: mat(ENEMY_BASE, 0.7),
    barBg: new THREE.MeshBasicMaterial({ color: 0x111111 }),
    barParty: new THREE.MeshBasicMaterial({ color: 0x4caf50 }),
    barEnemy: new THREE.MeshBasicMaterial({ color: 0xc62828 }),
    activeRing: ringMat(ACTIVE_COLOR),
    selectRing: ringMat(SELECT_COLOR),
    plane: new THREE.MeshBasicMaterial({ visible: false, side: THREE.DoubleSide }),
  };

  // Orbit
  private orbitEnabled = false;
  private orbitEl: HTMLElement | null = null;
  private orbitYaw = Math.PI / 4;
  private orbitPitch = Math.PI / 3.2; // ~56° from horizontal
  private orbitDist = 14;
  private dragging = false;
  private lastPointer = { x: 0, y: 0 };
  private onPointerDown: ((e: PointerEvent) => void) | null = null;
  private onPointerMove: ((e: PointerEvent) => void) | null = null;
  private onPointerUp: ((e: PointerEvent) => void) | null = null;
  private onWheel: ((e: WheelEvent) => void) | null = null;

  private hemi: THREE.HemisphereLight;
  private dir: THREE.DirectionalLight;

  /**
   * @param enableOrbit - when true, call attachOrbit(element) so the player can drag-orbit
   */
  constructor(enableOrbit = false) {
    this.orbitEnabled = enableOrbit;
    this.scene.background = new THREE.Color(0x1a2228);
    this.scene.fog = new THREE.FogExp2(0x1a2228, 0.035);
    this.scene.add(this.root);
    this.root.add(this.board, this.units, this.markers);

    this.hemi = new THREE.HemisphereLight(0xc8d8e8, 0x3a3020, 0.75);
    this.dir = new THREE.DirectionalLight(0xffe8cc, 0.95);
    this.dir.position.set(8, 18, 6);
    this.scene.add(this.hemi, this.dir);
    this.scene.add(new THREE.AmbientLight(0x405060, 0.35));

    this.placeCamera();
  }

  /** Resize camera aspect for the combat viewport. */
  mount(width: number, height: number): void {
    this.camera.aspect = Math.max(1, width) / Math.max(1, height);
    this.camera.updateProjectionMatrix();
    this.placeCamera();
  }

  /**
   * Bind pointer drag + wheel zoom on a DOM element (typically the canvas).
   * Safe to call multiple times; rebinding replaces previous listeners.
   */
  attachOrbit(element: HTMLElement): void {
    this.detachOrbit();
    this.orbitEl = element;
    this.orbitEnabled = true;

    this.onPointerDown = (e: PointerEvent) => {
      if (e.button !== 0 && e.button !== 2) return;
      this.dragging = true;
      this.lastPointer.x = e.clientX;
      this.lastPointer.y = e.clientY;
      try {
        element.setPointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
    };
    this.onPointerMove = (e: PointerEvent) => {
      if (!this.dragging) return;
      const dx = e.clientX - this.lastPointer.x;
      const dy = e.clientY - this.lastPointer.y;
      this.lastPointer.x = e.clientX;
      this.lastPointer.y = e.clientY;
      this.orbitYaw -= dx * 0.008;
      this.orbitPitch = THREE.MathUtils.clamp(this.orbitPitch + dy * 0.006, 0.35, 1.35);
      this.placeCamera();
    };
    this.onPointerUp = (e: PointerEvent) => {
      this.dragging = false;
      try {
        element.releasePointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
    };
    this.onWheel = (e: WheelEvent) => {
      e.preventDefault();
      this.orbitDist = THREE.MathUtils.clamp(this.orbitDist + e.deltaY * 0.012, 6, 32);
      this.placeCamera();
    };

    element.addEventListener("pointerdown", this.onPointerDown);
    element.addEventListener("pointermove", this.onPointerMove);
    element.addEventListener("pointerup", this.onPointerUp);
    element.addEventListener("pointercancel", this.onPointerUp);
    element.addEventListener("wheel", this.onWheel, { passive: false });
    element.addEventListener("contextmenu", preventDefault);
  }

  detachOrbit(): void {
    const el = this.orbitEl;
    if (!el) return;
    if (this.onPointerDown) el.removeEventListener("pointerdown", this.onPointerDown);
    if (this.onPointerMove) el.removeEventListener("pointermove", this.onPointerMove);
    if (this.onPointerUp) {
      el.removeEventListener("pointerup", this.onPointerUp);
      el.removeEventListener("pointercancel", this.onPointerUp);
    }
    if (this.onWheel) el.removeEventListener("wheel", this.onWheel);
    el.removeEventListener("contextmenu", preventDefault);
    this.orbitEl = null;
    this.onPointerDown = this.onPointerMove = this.onPointerUp = this.onWheel = null;
  }

  /** Set (or clear) the selected target for the red ring. */
  setSelected(id: string | null): void {
    this.selectedId = id;
    this.refreshMarkers();
  }

  /**
   * Rebuild/update the board and combatant meshes from CombatState.
   * Board geometry is rebuilt only when dimensions / blocked set change.
   */
  setState(combat: CombatState): void {
    const boardChanged =
      !this.state ||
      this.state.width !== combat.width ||
      this.state.height !== combat.height ||
      !sameBlocked(this.state.blocked, combat.blocked);

    this.state = combat;
    this.width = combat.width;
    this.height = combat.height;

    if (boardChanged) {
      this.buildBoard(combat);
      this.fitOrbitToBoard();
      this.placeCamera();
    }

    this.syncUnits(combat);
    this.refreshMarkers();
  }

  /** Render this combat scene with its camera through the given renderer. */
  render(renderer: THREE.WebGLRenderer): void {
    renderer.render(this.scene, this.camera);
  }

  /**
   * Raycast the ground plane using NDC coordinates in [-1, 1].
   * Returns combat tile coords or null if miss / out of bounds.
   */
  pickTile(ndcX: number, ndcY: number): CombatPick | null {
    if (!this.groundPlane) return null;
    this.ndc.set(ndcX, ndcY);
    this.raycaster.setFromCamera(this.ndc, this.camera);
    const hits = this.raycaster.intersectObject(this.groundPlane, false);
    if (!hits.length) return null;
    const p = hits[0].point;
    const { x, y } = this.worldToTile(p.x, p.z);
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) return null;
    return { x, y };
  }

  /**
   * Pick a living combatant under NDC (for target selection).
   * Returns combatant id or null.
   */
  pickCombatant(ndcX: number, ndcY: number): string | null {
    if (!this.unitMeshes.size) return null;
    this.ndc.set(ndcX, ndcY);
    this.raycaster.setFromCamera(this.ndc, this.camera);
    const objects: THREE.Object3D[] = [];
    for (const g of this.unitMeshes.values()) {
      g.traverse((o) => {
        if ((o as THREE.Mesh).isMesh) objects.push(o);
      });
    }
    const hits = this.raycaster.intersectObjects(objects, false);
    for (const h of hits) {
      let o: THREE.Object3D | null = h.object;
      while (o) {
        if (typeof o.userData.combatantId === "string") {
          const id = o.userData.combatantId as string;
          const c = this.state?.combatants.find((u) => u.id === id);
          if (c && c.life > 0) return id;
          break;
        }
        o = o.parent;
      }
    }
    return null;
  }

  dispose(): void {
    this.detachOrbit();
    this.clearChildren(this.board);
    this.clearChildren(this.units);
    this.clearChildren(this.markers);
    this.unitMeshes.clear();
    this.groundPlane = null;
    this.state = null;

    for (const g of Object.values(this.geos)) g.dispose();
    for (const m of Object.values(this.mats)) m.dispose();
  }

  // ── internals ──────────────────────────────────────────────

  private placeCamera(): void {
    const pitch = this.orbitPitch;
    const yaw = this.orbitYaw;
    const d = this.orbitDist;
    const y = Math.sin(pitch) * d;
    const r = Math.cos(pitch) * d;
    this.camera.position.set(Math.sin(yaw) * r, y, Math.cos(yaw) * r);
    this.camera.lookAt(0, 0.2, 0);
    this.camera.updateProjectionMatrix();
  }

  private fitOrbitToBoard(): void {
    const span = Math.max(this.width, this.height) * TILE;
    this.orbitDist = THREE.MathUtils.clamp(span * 1.35 + 4, 8, 28);
  }

  private tileToWorld(tx: number, ty: number): { x: number; z: number } {
    return {
      x: (tx - this.width / 2 + 0.5) * TILE,
      z: (ty - this.height / 2 + 0.5) * TILE,
    };
  }

  private worldToTile(wx: number, wz: number): { x: number; y: number } {
    return {
      x: Math.floor(wx / TILE + this.width / 2),
      y: Math.floor(wz / TILE + this.height / 2),
    };
  }

  private buildBoard(combat: CombatState): void {
    this.clearChildren(this.board);
    this.groundPlane = null;

    const blocked = new Set(combat.blocked.map((b) => `${b.x},${b.y}`));

    for (let y = 0; y < combat.height; y++) {
      for (let x = 0; x < combat.width; x++) {
        const { x: wx, z: wz } = this.tileToWorld(x, y);
        const isBlocked = blocked.has(`${x},${y}`);
        const checker = (x + y) % 2 === 0;
        if (isBlocked) {
          const m = new THREE.Mesh(this.geos.blocked, this.mats.blocked);
          m.position.set(wx, 0.28, wz);
          m.userData.tile = { x, y, blocked: true };
          this.board.add(m);
        } else {
          const m = new THREE.Mesh(
            this.geos.tile,
            checker ? this.mats.tileA : this.mats.tileB
          );
          m.position.set(wx, 0.06, wz);
          m.userData.tile = { x, y, blocked: false };
          this.board.add(m);
        }
      }
    }

    // Invisible raycast plane at tile surface
    const planeGeo = new THREE.PlaneGeometry(combat.width * TILE, combat.height * TILE);
    const plane = new THREE.Mesh(planeGeo, this.mats.plane);
    plane.rotation.x = -Math.PI / 2;
    plane.position.y = 0.12;
    plane.userData.ownedGeo = true;
    this.board.add(plane);
    this.groundPlane = plane;

    // Soft edge rim
    const rimGeo = new THREE.BoxGeometry(
      combat.width * TILE + 0.4,
      0.08,
      combat.height * TILE + 0.4
    );
    const rim = new THREE.Mesh(rimGeo, this.mats.rim);
    rim.position.y = -0.02;
    rim.userData.ownedGeo = true;
    this.board.add(rim);
  }

  private syncUnits(combat: CombatState): void {
    const ids = new Set(combat.combatants.map((c) => c.id));

    for (const [id, g] of this.unitMeshes) {
      if (!ids.has(id)) {
        this.units.remove(g);
        disposeOwned(g);
        this.unitMeshes.delete(id);
      }
    }

    for (const c of combat.combatants) {
      let g = this.unitMeshes.get(c.id);
      if (!g) {
        g = this.createUnitMesh(c);
        this.unitMeshes.set(c.id, g);
        this.units.add(g);
      }

      const { x, z } = this.tileToWorld(c.x, c.y);
      g.position.set(x, 0, z);
      g.userData.combatantId = c.id;

      const dead = c.life <= 0;
      g.traverse((o) => {
        const mesh = o as THREE.Mesh;
        if (!mesh.isMesh) return;
        // Skip shared life-bar materials
        if (mesh.name === "lifebar" || mesh.name === "lifebar-bg") {
          mesh.visible = !dead;
          return;
        }
        const material = mesh.material;
        const apply = (m: THREE.Material) => {
          if (m.userData?.owned || mesh.userData.ownedMat) {
            m.transparent = true;
            m.opacity = dead ? DEAD_OPACITY : 1;
            m.depthWrite = !dead;
          }
        };
        if (Array.isArray(material)) material.forEach(apply);
        else apply(material);
      });

      this.updateLifeBar(g, c);
    }
  }

  private createUnitMesh(c: Combatant): THREE.Group {
    const g = new THREE.Group();
    g.userData.combatantId = c.id;

    if (c.side === "party") {
      g.add(this.makePartyFigure());
    } else {
      g.add(this.makeEnemyFigure(c.enemyType ?? "wolf"));
    }

    const barBg = new THREE.Mesh(this.geos.barBg, this.mats.barBg);
    barBg.position.set(0, 1.55, 0);
    barBg.name = "lifebar-bg";
    g.add(barBg);

    const barFg = new THREE.Mesh(
      this.geos.barFg,
      c.side === "party" ? this.mats.barParty : this.mats.barEnemy
    );
    barFg.position.set(0, 1.55, 0.01);
    barFg.name = "lifebar";
    g.add(barFg);

    this.updateLifeBar(g, c);
    return g;
  }

  private updateLifeBar(g: THREE.Group, c: Combatant): void {
    const bar = g.getObjectByName("lifebar") as THREE.Mesh | undefined;
    if (!bar) return;
    const ratio = c.lifeMax > 0 ? THREE.MathUtils.clamp(c.life / c.lifeMax, 0, 1) : 0;
    bar.scale.x = Math.max(0.02, ratio);
    bar.position.x = -0.34 * (1 - ratio);
  }

  private makePartyFigure(): THREE.Group {
    const g = new THREE.Group();
    // Per-unit material clones so dead fade does not affect allies
    const bodyMat = this.mats.partyBody.clone();
    const headMat = this.mats.partyHead.clone();
    bodyMat.userData.owned = true;
    headMat.userData.owned = true;
    const body = new THREE.Mesh(this.geos.capsule, bodyMat);
    body.position.y = 0.55;
    body.userData.ownedMat = true;
    const head = new THREE.Mesh(this.geos.sphereS, headMat);
    head.position.y = 1.15;
    head.userData.ownedMat = true;
    const shoulder = new THREE.Mesh(this.geos.shoulder, bodyMat);
    shoulder.position.y = 0.85;
    g.add(body, head, shoulder);
    return g;
  }

  private makeEnemyFigure(enemyType: string): THREE.Group {
    const g = new THREE.Group();
    const type = enemyType.toLowerCase();

    if (type === "wolf") {
      g.add(this.quadruped(0x6b4a3a, 0.85, 0.35));
    } else if (type === "orc_raider") {
      g.add(this.bulkyHumanoid(0x5a7a3a, 1.15, 0.32));
    } else if (type === "cultist") {
      g.add(this.hoodedFigure(0x3a2a4a, 1.2));
    } else if (type === "cave_beast") {
      g.add(this.quadruped(0x4a3a2a, 1.05, 0.48));
    } else if (type === "undead") {
      g.add(this.skeletalFigure(0x9aa08a));
    } else if (type === "frost_wight") {
      g.add(this.hoodedFigure(0x7ab0c8, 1.35, 0xb0e0ff));
    } else if (type === "ash_guardian") {
      g.add(this.guardianBlock(0x4a4038, 1.5));
    } else {
      const em = this.mats.enemyFallback.clone();
      em.userData.owned = true;
      const body = new THREE.Mesh(this.geos.capsule, em);
      body.position.y = 0.5;
      body.userData.ownedMat = true;
      g.add(body);
    }
    return g;
  }

  private quadruped(color: number, length: number, height: number): THREE.Group {
    const g = new THREE.Group();
    const m = ownedMat(color, 0.75);
    const bodyGeo = new THREE.CapsuleGeometry(height * 0.55, length * 0.55, 4, 8);
    const body = new THREE.Mesh(bodyGeo, m);
    body.rotation.z = Math.PI / 2;
    body.position.set(0, height * 0.7, 0);
    body.userData.ownedGeo = true;
    body.userData.ownedMat = true;

    const headGeo = new THREE.SphereGeometry(height * 0.4, 6, 6);
    const head = new THREE.Mesh(headGeo, m);
    head.position.set(0, height * 0.85, length * 0.35);
    head.userData.ownedGeo = true;

    const legGeo = new THREE.CylinderGeometry(0.05, 0.06, height * 0.7, 5);
    for (const [lx, lz] of [
      [-0.18, 0.2],
      [0.18, 0.2],
      [-0.18, -0.22],
      [0.18, -0.22],
    ] as const) {
      const leg = new THREE.Mesh(legGeo, m);
      leg.position.set(lx, height * 0.35, lz * length * 0.6);
      leg.userData.ownedGeo = true;
      g.add(leg);
    }
    g.add(body, head);
    return g;
  }

  private bulkyHumanoid(color: number, h: number, r: number): THREE.Group {
    const g = new THREE.Group();
    const m = ownedMat(color, 0.7);
    const bodyGeo = new THREE.CapsuleGeometry(r, h * 0.45, 4, 8);
    const body = new THREE.Mesh(bodyGeo, m);
    body.position.y = h * 0.45;
    body.userData.ownedGeo = true;
    body.userData.ownedMat = true;

    const headGeo = new THREE.SphereGeometry(r * 0.7, 7, 7);
    const head = new THREE.Mesh(headGeo, m);
    head.position.y = h * 0.95;
    head.userData.ownedGeo = true;

    const armsGeo = new THREE.BoxGeometry(r * 2.6, r * 0.55, r * 0.7);
    const arms = new THREE.Mesh(armsGeo, m);
    arms.position.y = h * 0.65;
    arms.userData.ownedGeo = true;

    g.add(body, head, arms);
    return g;
  }

  private hoodedFigure(color: number, h: number, glow?: number): THREE.Group {
    const g = new THREE.Group();
    const m = ownedMat(color, 0.8);
    const bodyGeo = new THREE.ConeGeometry(0.32, h * 0.85, 6);
    const body = new THREE.Mesh(bodyGeo, m);
    body.position.y = h * 0.42;
    body.userData.ownedGeo = true;
    body.userData.ownedMat = true;

    const headMat = new THREE.MeshStandardMaterial({
      color: glow ?? 0x2a1a1a,
      emissive: glow ? new THREE.Color(glow).multiplyScalar(0.25) : new THREE.Color(0x000000),
      roughness: 0.5,
    });
    const head = new THREE.Mesh(this.geos.sphereS, headMat);
    head.position.y = h * 0.78;
    head.userData.ownedMat = true;
    head.scale.setScalar(0.9);

    g.add(body, head);
    return g;
  }

  private skeletalFigure(color: number): THREE.Group {
    const g = new THREE.Group();
    const m = ownedMat(color, 0.55, 0.15);
    const torso = new THREE.Mesh(this.geos.boxTorso, m);
    torso.position.y = 0.65;
    torso.userData.ownedMat = true;

    const head = new THREE.Mesh(this.geos.sphereS, m);
    head.position.y = 1.05;
    head.scale.setScalar(0.78);

    const legL = new THREE.Mesh(this.geos.cylLeg, m);
    legL.position.set(-0.08, 0.25, 0);
    const legR = new THREE.Mesh(this.geos.cylLeg, m);
    legR.position.set(0.08, 0.25, 0);

    g.add(torso, head, legL, legR);
    return g;
  }

  private guardianBlock(color: number, h: number): THREE.Group {
    const g = new THREE.Group();
    const m = ownedMat(color, 0.85, 0.2);
    const bodyGeo = new THREE.BoxGeometry(0.7, h * 0.7, 0.45);
    const body = new THREE.Mesh(bodyGeo, m);
    body.position.y = h * 0.4;
    body.userData.ownedGeo = true;
    body.userData.ownedMat = true;

    const headGeo = new THREE.BoxGeometry(0.4, 0.35, 0.35);
    const head = new THREE.Mesh(headGeo, m);
    head.position.y = h * 0.9;
    head.userData.ownedGeo = true;

    const glowMat = new THREE.MeshStandardMaterial({
      color: 0xff6622,
      emissive: 0xff4400,
      emissiveIntensity: 0.6,
    });
    const glow = new THREE.Mesh(this.geos.sphereTiny, glowMat);
    glow.position.set(0, h * 0.9, 0.2);
    glow.userData.ownedMat = true;

    g.add(body, head, glow);
    return g;
  }

  private refreshMarkers(): void {
    this.clearChildren(this.markers);
    if (!this.state) return;

    const active = this.state.combatants.find((c) => c.id === this.state!.activeId);
    if (active && active.life > 0) {
      const { x, z } = this.tileToWorld(active.x, active.y);
      const ring = new THREE.Mesh(this.geos.ringActive, this.mats.activeRing);
      ring.rotation.x = -Math.PI / 2;
      ring.position.set(x, 0.14, z);
      this.markers.add(ring);
    }

    if (this.selectedId) {
      const sel = this.state.combatants.find((c) => c.id === this.selectedId);
      if (sel && sel.life > 0) {
        const { x, z } = this.tileToWorld(sel.x, sel.y);
        const ring = new THREE.Mesh(this.geos.ringSelect, this.mats.selectRing);
        ring.rotation.x = -Math.PI / 2;
        ring.position.set(x, 0.16, z);
        this.markers.add(ring);
      }
    }
  }

  private clearChildren(g: THREE.Group): void {
    while (g.children.length) {
      const o = g.children.pop()!;
      disposeOwned(o);
    }
  }
}

// ── helpers ──────────────────────────────────────────────────

function mat(color: number, roughness = 0.85, metalness = 0.05): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness });
}

function ownedMat(color: number, roughness = 0.85, metalness = 0.05): THREE.MeshStandardMaterial {
  const m = mat(color, roughness, metalness);
  m.userData.owned = true;
  return m;
}

function ringMat(color: number): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color,
    emissive: new THREE.Color(color).multiplyScalar(0.45),
    roughness: 0.4,
    metalness: 0.2,
    transparent: true,
    opacity: 0.9,
  });
}

function preventDefault(e: Event): void {
  e.preventDefault();
}

function sameBlocked(
  a: Array<{ x: number; y: number }>,
  b: Array<{ x: number; y: number }>
): boolean {
  if (a.length !== b.length) return false;
  const sa = new Set(a.map((p) => `${p.x},${p.y}`));
  return b.every((p) => sa.has(`${p.x},${p.y}`));
}

/** Dispose geometries/materials tagged as owned; leave shared pool alone. */
function disposeOwned(obj: THREE.Object3D): void {
  obj.traverse((c) => {
    const mesh = c as THREE.Mesh;
    if (!mesh.isMesh) return;
    if (mesh.userData.ownedGeo && mesh.geometry) {
      mesh.geometry.dispose();
    }
    const material = mesh.material;
    const freeMat = (m: THREE.Material) => {
      if (mesh.userData.ownedMat || m.userData?.owned) m.dispose();
    };
    if (Array.isArray(material)) material.forEach(freeMat);
    else if (material) freeMat(material);
  });
}
