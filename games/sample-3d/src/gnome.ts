// src/gnome.ts
import * as THREE from 'three';
import { COLORS, type GnomeModel, type PlayerState, TUNING } from './config';

/** Limb targets while airborne (radians). Left leg +, right leg -, arms both up. */
const LEG_AIR_LEFT = 0.5;
const LEG_AIR_RIGHT = -0.3;
const ARM_AIR = -2.4;

/** hatColor/shirtColor let bots look different from the player. */
export function createGnome(hatColor: number = COLORS.gnomeHat, shirtColor: number = COLORS.gnomeShirt): GnomeModel {
  const object = new THREE.Group();
  const rig = new THREE.Group();
  object.add(rig);

  const materials = new Map<number, THREE.MeshStandardMaterial>();
  const mat = (color: number): THREE.MeshStandardMaterial => {
    let m = materials.get(color);
    if (!m) {
      m = new THREE.MeshStandardMaterial({ color, roughness: 0.8 });
      materials.set(color, m);
    }
    return m;
  };
  const mesh = (geometry: THREE.BufferGeometry, color: number): THREE.Mesh => {
    const m = new THREE.Mesh(geometry, mat(color));
    m.castShadow = true;
    return m;
  };

  // Left is +x, right is -x (right = (-cos a, 0, sin a) at yaw 0).
  const makeLeg = (x: number): THREE.Group => {
    const pivot = new THREE.Group();
    pivot.position.set(x, 0.3, 0);
    const pants = mesh(new THREE.BoxGeometry(0.14, 0.3, 0.14), COLORS.gnomePants);
    pants.position.y = -0.15;
    const boot = mesh(new THREE.BoxGeometry(0.16, 0.08, 0.22), COLORS.mowerDark);
    boot.position.set(0, -0.28, 0.03);
    pivot.add(pants, boot);
    rig.add(pivot);
    return pivot;
  };
  const makeArm = (x: number): THREE.Group => {
    const pivot = new THREE.Group();
    pivot.position.set(x, 0.62, 0);
    const sleeve = mesh(new THREE.BoxGeometry(0.1, 0.3, 0.1), shirtColor);
    sleeve.position.y = -0.15;
    const hand = mesh(new THREE.SphereGeometry(0.06), COLORS.gnomeSkin);
    hand.position.y = -0.32;
    pivot.add(sleeve, hand);
    rig.add(pivot);
    return pivot;
  };

  const legL = makeLeg(0.1);
  const legR = makeLeg(-0.1);
  const armL = makeArm(0.27);
  const armR = makeArm(-0.27);

  const body = mesh(new THREE.CylinderGeometry(0.18, 0.24, 0.38, 12), shirtColor);
  body.position.y = 0.48;
  const belt = mesh(new THREE.CylinderGeometry(0.235, 0.235, 0.05), COLORS.mowerDark);
  belt.position.y = 0.36;

  const head = mesh(new THREE.SphereGeometry(0.17), COLORS.gnomeSkin);
  head.position.y = 0.8;
  const nose = mesh(new THREE.SphereGeometry(0.05), COLORS.gnomeSkin);
  nose.position.set(0, 0.8, 0.17);
  const eyeL = mesh(new THREE.SphereGeometry(0.025), 0x111111);
  eyeL.position.set(0.06, 0.86, 0.15);
  const eyeR = mesh(new THREE.SphereGeometry(0.025), 0x111111);
  eyeR.position.set(-0.06, 0.86, 0.15);

  const beard = mesh(new THREE.ConeGeometry(0.17, 0.32, 12), COLORS.gnomeBeard);
  beard.rotation.x = Math.PI;
  beard.position.set(0, 0.62, 0.07);

  const hat = mesh(new THREE.ConeGeometry(0.2, 0.5, 16), hatColor);
  hat.position.set(0, 1.12, -0.02);
  hat.rotation.x = -0.15;

  rig.add(body, belt, head, nose, eyeL, eyeR, beard, hat);

  let dead = false;
  let phase = 0;
  const smooth = (rate: number, dt: number): number => 1 - Math.exp(-rate * dt);
  const lerp = (a: number, b: number, k: number): number => a + (b - a) * k;

  return {
    object,
    update(p: PlayerState, dt: number) {
      object.position.copy(p.position);
      object.rotation.y = p.facing;

      if (dead) {
        const k = smooth(12, dt);
        rig.rotation.x = lerp(rig.rotation.x, -Math.PI / 2, k);
        rig.scale.y = lerp(rig.scale.y, 0.25, k);
        return;
      }

      const speed = Math.hypot(p.velocity.x, p.velocity.z);
      const k = smooth(15, dt);

      if (p.grounded) {
        phase += dt * speed * 2.2;
        const amt = 0.8 * Math.min(1, speed / TUNING.moveSpeed);
        const s = Math.sin(phase);
        legL.rotation.x = s * amt;
        legR.rotation.x = -s * amt;
        armL.rotation.x = -s * amt * 0.8;
        armR.rotation.x = s * amt * 0.8;
        rig.position.y = Math.abs(s) * 0.06 * amt;
      } else {
        legL.rotation.x = lerp(legL.rotation.x, LEG_AIR_LEFT, k);
        legR.rotation.x = lerp(legR.rotation.x, LEG_AIR_RIGHT, k);
        armL.rotation.x = lerp(armL.rotation.x, ARM_AIR, k);
        armR.rotation.x = lerp(armR.rotation.x, ARM_AIR, k);
        rig.position.y = lerp(rig.position.y, 0, k);
      }

      // Squash and stretch: scale.y targets, x and z keep the volume roughly constant.
      const targetY = p.grounded ? 1 : p.velocity.y > 0 ? 1.12 : 0.96;
      const targetXZ = 1 / Math.sqrt(targetY);
      rig.scale.y = lerp(rig.scale.y, targetY, k);
      rig.scale.x = lerp(rig.scale.x, targetXZ, k);
      rig.scale.z = lerp(rig.scale.z, targetXZ, k);
    },
    setDead(d: boolean) {
      dead = d;
      if (!d) {
        rig.rotation.x = 0;
        rig.scale.set(1, 1, 1);
        rig.position.y = 0;
      }
    },
  };
}
