import Phaser from 'phaser';
import { COLORS, MAX_PLAYERS, PLAYER_COLORS, SCENES, TEX } from '../config';

export class BootScene extends Phaser.Scene {
  constructor() {
    super(SCENES.boot);
  }

  create(): void {
    const g = this.add.graphics();

    for (let i = 0; i < MAX_PLAYERS; i++) {
      g.clear();
      // boots
      g.fillStyle(0x4e342e);
      g.fillRect(10, 50, 9, 6);
      g.fillRect(21, 50, 9, 6);
      // body
      g.fillStyle(0x2e7d32);
      g.fillRoundedRect(8, 30, 24, 22, 6);
      // belt
      g.fillStyle(0x3e2723);
      g.fillRect(8, 42, 24, 3);
      // face
      g.fillStyle(0xffccbc);
      g.fillCircle(20, 25, 8);
      // beard
      g.fillStyle(0xffffff);
      g.fillTriangle(11, 26, 29, 26, 20, 42);
      // nose
      g.fillStyle(0xff8a80);
      g.fillCircle(20, 26, 3);
      // hat
      g.fillStyle(PLAYER_COLORS[i]);
      g.fillTriangle(9, 21, 31, 21, 22, 0);
      g.generateTexture(TEX.gnome(i), 40, 56);
    }

    // mower
    g.clear();
    g.fillStyle(0x212121);
    g.fillRect(30, 0, 3, 14); // handle
    g.fillRect(30, 0, 12, 3);
    g.fillStyle(0xd32f2f);
    g.fillRoundedRect(2, 10, 34, 12, 4);
    g.fillStyle(0x9e9e9e);
    g.fillRect(12, 6, 10, 5); // engine
    g.fillStyle(0x111111);
    g.fillCircle(8, 23, 5);
    g.fillCircle(30, 23, 5);
    g.generateTexture(TEX.mower, 44, 28);

    g.clear();
    g.fillStyle(0xffffff);
    g.fillRect(0, 0, 6, 6);
    g.generateTexture(TEX.spark, 6, 6);

    g.clear();
    g.fillStyle(COLORS.sand);
    g.fillRect(0, 0, 64, 16);
    g.fillStyle(0xd4a95c);
    for (let k = 0; k < 14; k++) g.fillRect((k * 23) % 62, (k * 7) % 14, 2, 2);
    g.generateTexture(TEX.sand, 64, 16);

    g.destroy();
    this.scene.start(SCENES.title);
  }
}
