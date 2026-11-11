import Phaser from 'phaser';
import { SCENES, GAME_WIDTH, GAME_HEIGHT, COLORS } from '../config';
import { getHighScore } from '../storage';

export class TitleScene extends Phaser.Scene {
  constructor() { super(SCENES.title); }

  create(): void {
    const cx = GAME_WIDTH / 2;

    this.add.text(cx, 200, 'SAMPLE DODGE', { color: COLORS.accent, fontSize: '56px' }).setOrigin(0.5);
    this.add.text(cx, 290, 'Arrows / WASD to move. Dodge red, grab gold.', { color: COLORS.text, fontSize: '20px' }).setOrigin(0.5);
    this.add.text(cx, 330, `High score: ${getHighScore()}`, { color: COLORS.text, fontSize: '20px' }).setOrigin(0.5);

    const prompt = this.add.text(cx, 420, 'Press SPACE or click to start', { color: COLORS.text, fontSize: '24px' }).setOrigin(0.5);
    this.tweens.add({ targets: prompt, alpha: 0.3, yoyo: true, repeat: -1, duration: 600 });

    const start = () => this.scene.start(SCENES.game);
    this.input.keyboard!.once('keydown-SPACE', start);
    this.input.once('pointerdown', start);
  }
}
