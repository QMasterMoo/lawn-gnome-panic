import Phaser from 'phaser';
import { COLORS, EVENTS, GAME_HEIGHT, GAME_WIDTH, KEYSETS, MAX_PLAYERS, PLAYER_CSS, SCENES, TEX, type Difficulty } from '../config';
import { createMeet, startCurrentEvent } from '../meet';
import { playSfx } from '../audio';

const DIFFS: Difficulty[] = ['easy', 'normal', 'hard'];

export class TitleScene extends Phaser.Scene {
  private humans = 1;
  private diff = 1;
  private rows: Phaser.GameObjects.Text[] = [];
  private diffText!: Phaser.GameObjects.Text;

  constructor() {
    super(SCENES.title);
  }

  create(): void {
    this.rows = [];
    const cx = GAME_WIDTH / 2;
    this.add.text(cx, 60, 'GNOMYLPICS', { fontFamily: 'Arial Black, Arial', fontSize: '84px', color: COLORS.accent, stroke: '#000', strokeThickness: 10 }).setOrigin(0.5);
    this.add.text(cx, 122, 'The Gnome Olympics: three events, four gnomes, one podium', { fontFamily: 'Arial', fontSize: '22px', color: '#ffffff' }).setOrigin(0.5);

    for (let i = 0; i < MAX_PLAYERS; i++) {
      this.add.image(cx - 330 + i * 40, 205, TEX.gnome(i)).setOrigin(0.5, 1).setScale(1.2);
    }
    this.add.text(cx - 160, 160, EVENTS.map((e, k) => `${k + 1}. ${e.title}`).join('\n'), { fontFamily: 'Arial', fontSize: '20px', color: '#ffffff', lineSpacing: 4 });

    this.add.text(cx, 245, 'Players (press 1-4, or click a lane)', { fontFamily: 'Arial Black, Arial', fontSize: '22px', color: COLORS.accent }).setOrigin(0.5);
    for (let i = 0; i < MAX_PLAYERS; i++) {
      const row = this.add
        .text(cx, 290 + i * 42, '', { fontFamily: 'Arial Black, Arial', fontSize: '24px', color: PLAYER_CSS[i], stroke: '#000', strokeThickness: 5 })
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true })
        .on('pointerdown', () => this.setHumans(i + 1));
      this.rows.push(row);
    }

    this.diffText = this.add
      .text(cx, 480, '', { fontFamily: 'Arial Black, Arial', fontSize: '24px', color: '#ffffff', stroke: '#000', strokeThickness: 5 })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => this.cycleDiff());

    const start = this.add
      .text(cx, 570, 'PRESS SPACE TO START', { fontFamily: 'Arial Black, Arial', fontSize: '36px', color: COLORS.accent, stroke: '#000', strokeThickness: 8 })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => this.begin());
    this.tweens.add({ targets: start, alpha: 0.45, yoyo: true, repeat: -1, duration: 600 });

    this.add
      .text(cx, GAME_HEIGHT - 40, 'Every event uses only your two keys. Most points after three events wins (5 / 3 / 2 / 1 per event).', { fontFamily: 'Arial', fontSize: '18px', color: '#e0e0e0' })
      .setOrigin(0.5);

    const kb = this.input.keyboard!;
    kb.on('keydown', (e: KeyboardEvent) => {
      if (e.key >= '1' && e.key <= '4' && !e.code.startsWith('Numpad')) this.setHumans(Number(e.key));
      else if (e.code === 'KeyE') this.setDiff(0);
      else if (e.code === 'KeyN') this.setDiff(1);
      else if (e.code === 'KeyH') this.setDiff(2);
      else if (e.code === 'Space' || e.code === 'Enter') this.begin();
    });
    this.refresh();
  }

  private setHumans(n: number): void {
    this.humans = n;
    playSfx('tap');
    this.refresh();
  }

  private setDiff(d: number): void {
    this.diff = d;
    playSfx('tap');
    this.refresh();
  }

  private cycleDiff(): void {
    this.setDiff((this.diff + 1) % DIFFS.length);
  }

  private refresh(): void {
    this.rows.forEach((row, i) => {
      const human = i < this.humans;
      row.setText(human ? `P${i + 1}: HUMAN   keys ${KEYSETS[i].labels[0]} / ${KEYSETS[i].labels[1]}` : `P${i + 1}: CPU`);
      row.setAlpha(human ? 1 : 0.6);
    });
    this.diffText.setText(`CPU difficulty: ${DIFFS[this.diff].toUpperCase()}   (E / N / H)`);
  }

  private begin(): void {
    playSfx('go');
    startCurrentEvent(this, createMeet(this.humans, DIFFS[this.diff]));
  }
}
