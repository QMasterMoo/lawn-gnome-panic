import Phaser from 'phaser';
import { SCENES, GAME_WIDTH, COLORS, type GameOverData } from '../config';
import { getHighScore, submitScore } from '../storage';

export class GameOverScene extends Phaser.Scene {
  private result: GameOverData = { score: 0, secondsSurvived: 0 };
  private isNewHigh = false;

  constructor() { super(SCENES.gameOver); }

  init(data: GameOverData): void {
    this.result = data;
    this.isNewHigh = submitScore(data.score);
  }

  create(): void {
    const cx = GAME_WIDTH / 2;

    this.add.text(cx, 180, 'GAME OVER', { color: '#ff5252', fontSize: '56px' }).setOrigin(0.5);
    this.add.text(cx, 260, `Score ${this.result.score}`, { color: COLORS.text, fontSize: '32px' }).setOrigin(0.5);
    this.add.text(cx, 305, `Survived ${this.result.secondsSurvived}s`, { color: COLORS.text, fontSize: '22px' }).setOrigin(0.5);

    if (this.isNewHigh) {
      const banner = this.add.text(cx, 350, 'NEW HIGH SCORE!', { color: COLORS.accent, fontSize: '26px' }).setOrigin(0.5);
      this.tweens.add({ targets: banner, scale: 1.15, yoyo: true, repeat: -1, duration: 500 });
    } else {
      this.add.text(cx, 350, `High score: ${getHighScore()}`, { color: COLORS.text, fontSize: '22px' }).setOrigin(0.5);
    }

    this.add.text(cx, 440, 'SPACE / click: play again    ESC: title', { color: COLORS.text, fontSize: '20px' }).setOrigin(0.5);

    // Ignore input briefly so a held key does not skip this screen.
    this.time.delayedCall(400, () => {
      const play = () => this.scene.start(SCENES.game);
      this.input.keyboard!.once('keydown-SPACE', play);
      this.input.once('pointerdown', play);
      this.input.keyboard!.once('keydown-ESC', () => this.scene.start(SCENES.title));
    });
  }
}
