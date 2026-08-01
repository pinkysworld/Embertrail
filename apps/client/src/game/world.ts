import * as THREE from "three";
import { TOWNS, DUNGEONS, type TownDef, type DungeonRoomDef } from "@embertrail/content";
import { getMaterial } from "./materials";

export interface Interactable {
  id: string;
  position: THREE.Vector3;
  radius: number;
  kind: string;
}

export class WorldScene {
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(70, 1, 0.1, 200);
  root = new THREE.Group();
  interactables: Interactable[] = [];
  private sky: THREE.Mesh | null = null;
  private hemi: THREE.HemisphereLight;
  private dir: THREE.DirectionalLight;

  constructor() {
    this.scene.add(this.root);
    this.scene.fog = new THREE.FogExp2(0x8a9aaa, 0.025);
    this.hemi = new THREE.HemisphereLight(0xb0c4de, 0x3d2e1f, 0.7);
    this.dir = new THREE.DirectionalLight(0xffe6c8, 0.9);
    this.dir.position.set(20, 40, 10);
    this.scene.add(this.hemi, this.dir);
    this.camera.position.set(0, 1.6, 10);
  }

  setSize(w: number, h: number): void {
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  clear(): void {
    while (this.root.children.length) {
      const o = this.root.children.pop()!;
      o.traverse((c) => {
        if ((c as THREE.Mesh).geometry) (c as THREE.Mesh).geometry.dispose();
      });
    }
    this.interactables = [];
  }

  loadTown(townId: string): TownDef {
    this.clear();
    const town = TOWNS[townId] ?? TOWNS.rimeport;
    this.scene.background = new THREE.Color(0x87a0b5);
    this.scene.fog = new THREE.FogExp2(0x8a9aaa, 0.022);

    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(80, 80),
      getMaterial(town.ground === "cobble" ? "cobble" : town.ground === "grass" ? "grass" : town.ground === "mud" ? "mud" : "flagstone")
    );
    ground.rotation.x = -Math.PI / 2;
    this.root.add(ground);

    // Boundary walls feel
    const wallMat = getMaterial("stone");
    for (const [x, z, w, d] of [
      [0, -22, 50, 2],
      [0, 22, 50, 2],
      [-22, 0, 2, 50],
      [22, 0, 2, 50],
    ] as const) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, 3, d), wallMat);
      m.position.set(x, 1.5, z);
      this.root.add(m);
    }

    for (const b of town.buildings) {
      const mat = getMaterial(b.texture);
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(b.w, b.h, b.d), mat);
      mesh.position.set(b.x, b.h / 2, b.z);
      mesh.userData.buildingId = b.id;
      this.root.add(mesh);
      // Roof
      const roof = new THREE.Mesh(
        new THREE.BoxGeometry(b.w + 0.4, 0.4, b.d + 0.4),
        getMaterial("planks")
      );
      roof.position.set(b.x, b.h + 0.2, b.z);
      this.root.add(roof);

      if (b.interact) {
        this.interactables.push({
          id: b.interact,
          position: new THREE.Vector3(b.x, 1, b.z + b.d / 2 + 0.5),
          radius: 2.5,
          kind: b.interact.startsWith("npc") ? "npc" : b.interact,
        });
      }
    }

    for (const npc of town.npcs) {
      const body = new THREE.Mesh(
        new THREE.CapsuleGeometry(0.35, 0.9, 4, 8),
        new THREE.MeshStandardMaterial({ color: npcColor(npc.kind), roughness: 0.7 })
      );
      body.position.set(npc.x, 1.1, npc.z);
      this.root.add(body);
      this.interactables.push({
        id: npc.id,
        position: new THREE.Vector3(npc.x, 1, npc.z),
        radius: 2.2,
        kind: "npc",
      });
    }

    // Torch lights
    for (const b of town.buildings.slice(0, 3)) {
      const light = new THREE.PointLight(0xffaa66, 1.2, 12);
      light.position.set(b.x, 3, b.z);
      this.root.add(light);
    }

    return town;
  }

  loadDungeonRoom(dungeonId: string, roomId: string): DungeonRoomDef {
    this.clear();
    const dungeon = DUNGEONS[dungeonId];
    const room = dungeon?.rooms.find((r) => r.id === roomId) ?? dungeon?.rooms[0];
    if (!room) throw new Error("no room");

    this.scene.background = new THREE.Color(0x0a0a0c);
    this.scene.fog = new THREE.FogExp2(0x1a1510, 0.04);

    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(room.width, room.depth),
      getMaterial(room.floorTexture)
    );
    floor.rotation.x = -Math.PI / 2;
    this.root.add(floor);

    const wallMat = getMaterial(room.wallTexture);
    const hw = room.width / 2;
    const hd = room.depth / 2;
    const h = 4;
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

    for (const enc of room.encounters) {
      for (let i = 0; i < enc.count; i++) {
        const e = new THREE.Mesh(
          new THREE.CapsuleGeometry(0.4, 0.8, 4, 8),
          new THREE.MeshStandardMaterial({ color: 0x6b2e2e, roughness: 0.8 })
        );
        e.position.set(enc.x + i * 1.2, 1, enc.z);
        e.userData.enemy = enc.type;
        this.root.add(e);
      }
      this.interactables.push({
        id: `encounter_${enc.type}`,
        position: new THREE.Vector3(enc.x, 1, enc.z),
        radius: 3,
        kind: "encounter",
      });
    }

    for (const f of room.features) {
      const color =
        f.kind === "exit" ? 0x4a7c59 : f.kind === "boss" ? 0xb8860b : f.kind === "greed" ? 0xd4af37 : 0x666;
      const m = new THREE.Mesh(
        new THREE.BoxGeometry(1.2, 1.2, 1.2),
        new THREE.MeshStandardMaterial({ color, roughness: 0.5, metalness: 0.3 })
      );
      m.position.set(f.x, 0.6, f.z);
      this.root.add(m);
      this.interactables.push({
        id: f.id,
        position: new THREE.Vector3(f.x, 1, f.z),
        radius: 2.2,
        kind: f.kind,
      });
    }

    const light = new THREE.PointLight(0xffcc88, 1.5, 20);
    light.position.set(0, 3, 0);
    this.root.add(light);
    this.root.add(new THREE.AmbientLight(0x334455, 0.4));

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
    default:
      return 0x888;
  }
}
