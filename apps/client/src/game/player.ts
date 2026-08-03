import * as THREE from "three";

function isTouchDevice(): boolean {
  return (
    typeof window !== "undefined" &&
    ("ontouchstart" in window ||
      navigator.maxTouchPoints > 0 ||
      // iPadOS desktop mode still has touch
      /iPhone|iPad|iPod|Android/i.test(navigator.userAgent))
  );
}

export class PlayerController {
  position = new THREE.Vector3(0, 1.6, 10);
  yaw = 0;
  pitch = 0;
  velocity = new THREE.Vector3();
  private keys = new Set<string>();
  pointerLocked = false;
  speed = 5;

  /** Virtual stick axes in [-1, 1] (mobile) */
  stickX = 0;
  stickY = 0;

  /** True when device should use on-screen controls */
  readonly touchMode = isTouchDevice();

  private lookSensitivity = 0.0045;
  private lookActive = false;
  private lastLookX = 0;
  private lastLookY = 0;
  private lookPointerId: number | null = null;

  constructor(private dom: HTMLElement) {
    window.addEventListener("keydown", (e) => {
      this.keys.add(e.code);
      if (e.code === "KeyE") {
        const el = document.activeElement as HTMLElement | null;
        const tag = el?.tagName?.toLowerCase();
        if (tag === "input" || tag === "textarea" || tag === "select" || el?.isContentEditable) {
          return;
        }
        this.onInteract?.();
      }
    });
    window.addEventListener("keyup", (e) => this.keys.delete(e.code));

    // Desktop: pointer lock look
    if (!this.touchMode) {
      dom.addEventListener("click", () => {
        if (!this.pointerLocked && this.enabled) {
          try {
            dom.requestPointerLock();
          } catch {
            /* ignore */
          }
        }
      });
      document.addEventListener("pointerlockchange", () => {
        this.pointerLocked = document.pointerLockElement === dom;
      });
      document.addEventListener("mousemove", (e) => {
        if (!this.pointerLocked || !this.enabled) return;
        this.yaw -= e.movementX * 0.002;
        this.pitch -= e.movementY * 0.002;
        this.pitch = Math.max(-1.4, Math.min(1.4, this.pitch));
      });
    } else {
      // Mobile: drag on right half of canvas (or anywhere not on UI) to look
      dom.addEventListener(
        "touchstart",
        (e) => {
          if (!this.enabled) return;
          // Let multi-touch: prefer right-side finger for look
          for (let i = 0; i < e.changedTouches.length; i++) {
            const t = e.changedTouches[i];
            if (t.clientX > window.innerWidth * 0.42) {
              this.lookActive = true;
              this.lookPointerId = t.identifier;
              this.lastLookX = t.clientX;
              this.lastLookY = t.clientY;
              e.preventDefault();
              break;
            }
          }
        },
        { passive: false }
      );
      dom.addEventListener(
        "touchmove",
        (e) => {
          if (!this.lookActive || !this.enabled) return;
          for (let i = 0; i < e.changedTouches.length; i++) {
            const t = e.changedTouches[i];
            if (t.identifier !== this.lookPointerId) continue;
            const dx = t.clientX - this.lastLookX;
            const dy = t.clientY - this.lastLookY;
            this.lastLookX = t.clientX;
            this.lastLookY = t.clientY;
            this.yaw -= dx * this.lookSensitivity;
            this.pitch -= dy * this.lookSensitivity;
            this.pitch = Math.max(-1.4, Math.min(1.4, this.pitch));
            e.preventDefault();
            break;
          }
        },
        { passive: false }
      );
      const endLook = (e: TouchEvent) => {
        for (let i = 0; i < e.changedTouches.length; i++) {
          if (e.changedTouches[i].identifier === this.lookPointerId) {
            this.lookActive = false;
            this.lookPointerId = null;
          }
        }
      };
      dom.addEventListener("touchend", endLook);
      dom.addEventListener("touchcancel", endLook);
    }
  }

  onInteract?: () => void;

  enabled = true;

  setStick(x: number, y: number): void {
    // y: +1 forward (screen up), x: +1 right
    this.stickX = Math.max(-1, Math.min(1, x));
    this.stickY = Math.max(-1, Math.min(1, y));
  }

  clearStick(): void {
    this.stickX = 0;
    this.stickY = 0;
  }

  update(dt: number, blocked?: (x: number, z: number) => boolean): void {
    if (!this.enabled) return;
    const forward = new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
    const right = new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
    const move = new THREE.Vector3();

    if (this.keys.has("KeyW") || this.keys.has("ArrowUp")) move.add(forward);
    if (this.keys.has("KeyS") || this.keys.has("ArrowDown")) move.sub(forward);
    if (this.keys.has("KeyA") || this.keys.has("ArrowLeft")) move.sub(right);
    if (this.keys.has("KeyD") || this.keys.has("ArrowRight")) move.add(right);

    // Virtual stick: stickY > 0 = forward
    if (Math.abs(this.stickX) > 0.08 || Math.abs(this.stickY) > 0.08) {
      move.addScaledVector(forward, this.stickY);
      move.addScaledVector(right, this.stickX);
    }

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
