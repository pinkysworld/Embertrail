import * as THREE from "three";

export class PlayerController {
  position = new THREE.Vector3(0, 1.6, 10);
  yaw = 0;
  pitch = 0;
  velocity = new THREE.Vector3();
  private keys = new Set<string>();
  pointerLocked = false;
  speed = 5;

  constructor(private dom: HTMLElement) {
    window.addEventListener("keydown", (e) => {
      this.keys.add(e.code);
      if (e.code === "KeyE") this.onInteract?.();
    });
    window.addEventListener("keyup", (e) => this.keys.delete(e.code));
    dom.addEventListener("click", () => {
      if (!this.pointerLocked) dom.requestPointerLock();
    });
    document.addEventListener("pointerlockchange", () => {
      this.pointerLocked = document.pointerLockElement === dom;
    });
    document.addEventListener("mousemove", (e) => {
      if (!this.pointerLocked) return;
      this.yaw -= e.movementX * 0.002;
      this.pitch -= e.movementY * 0.002;
      this.pitch = Math.max(-1.4, Math.min(1.4, this.pitch));
    });
  }

  onInteract?: () => void;

  enabled = true;

  update(dt: number, blocked?: (x: number, z: number) => boolean): void {
    if (!this.enabled) return;
    const forward = new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
    const right = new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
    const move = new THREE.Vector3();
    if (this.keys.has("KeyW") || this.keys.has("ArrowUp")) move.add(forward);
    if (this.keys.has("KeyS") || this.keys.has("ArrowDown")) move.sub(forward);
    if (this.keys.has("KeyA") || this.keys.has("ArrowLeft")) move.sub(right);
    if (this.keys.has("KeyD") || this.keys.has("ArrowRight")) move.add(right);
    if (move.lengthSq() > 0) {
      move.normalize().multiplyScalar(this.speed * dt);
      const nx = this.position.x + move.x;
      const nz = this.position.z + move.z;
      if (!blocked || !blocked(nx, this.position.z)) this.position.x = nx;
      if (!blocked || !blocked(this.position.x, nz)) this.position.z = nz;
    }
  }

  applyToCamera(camera: THREE.PerspectiveCamera): void {
    camera.position.copy(this.position);
    camera.rotation.order = "YXZ";
    camera.rotation.y = this.yaw;
    camera.rotation.x = this.pitch;
  }
}
