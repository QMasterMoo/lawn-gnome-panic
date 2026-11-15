import Phaser from 'phaser';
import { COLORS, EVENTS, GAME_HEIGHT, GAME_WIDTH, PLAYER_CSS, SCENES, TEX, type MeetData } from '../config';
import { rankPlaces } from '../meet';
import { ordinal } from './ResultsScene';
import { playSfx } from '../audio';

/** The podium: most points wins. Ties share a step. */
export class FinalScene extends Phaser.Scene {
  constructor() {
    super(SCENES.final);
  }

  create(data: MeetData): void {
    const meet = data.meet;
    const cx = GAME_WIDTH / 2;
    this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x0d47a1).setOrigin(0, 0);
    const places = rankPlaces(meet.totals, true);
    const winners = meet.players.filter((p) => places[p.index] === 1).map((p) => p.name);
    this.add.text(cx, 60, `${winners.join(' & ')} ${winners.length > 1 ? 'WIN' : 'WINS'}!`, { fontFamily: 'Arial Black, Arial', fontSize: '60px', color: COLORS.accent, stroke: '#000', strokeThickness: 10 }).setOrigin(0.5);

    const stepX = [cx, cx - 200, cx + 200, cx + 400];
    const stepH = [200, 140, 100, 50];
    const used = new Map<number, number>();
    meet.players
      .map((p) => p.index)
      .sort((a, b) => places[a] - places[b])
      .forEach((i) => {
        const place = places[i];
        const k = used.get(place) ?? 0;
        used.set(place, k + 1);
        const x = stepX[Math.min(place - 1, 3)] + k * 50;
        const h = stepH[Math.min(place - 1, 3)];
        const groundY = 520;
        this.add.rectangle(x, groundY, 150, h, 0xeeeeee).setOrigin(0.5, 1).setStrokeStyle(4, 0x000000);
        this.add.text(x, groundY - h / 2, ordinal(place), { fontFamily: 'Arial Black, Arial', fontSize: '34px', color: '#333333' }).setOrigin(0.5);
        const g = this.add.image(x, groundY - h, TEX.gnome(i)).setOrigin(0.5, 1).setScale(2);
        if (place === 1) this.tweens.add({ targets: g, y: g.y - 30, yoyo: true, repeat: -1, duration: 350, ease: 'Quad.easeOut' });
        this.add.text(x, groundY + 12, `${meet.players[i].name}\n${meet.totals[i]} pts`, { fontFamily: 'Arial Black, Arial', fontSize: '20px', color: PLAYER_CSS[i], align: 'center', stroke: '#000', strokeThickness: 4 }).setOrigin(0.5, 0);
      });

    const lines = meet.history.map((r, e) => `${EVENTS[e].title}: ` + meet.players.map((p) => `${p.name} ${r.display[p.index]}`).join(' · '));
    this.add.text(cx, 610, lines.join('\n'), { fontFamily: 'Arial', fontSize: '15px', color: '#ffffff', align: 'center' }).setOrigin(0.5, 0);
    playSfx('cheer');

    this.time.delayedCall(1500, () => {
      this.add.text(cx, 130, 'SPACE: new meet', { fontFamily: 'Arial Black, Arial', fontSize: '24px', color: '#ffffff' }).setOrigin(0.5);
      const go = (): void => {
        this.scene.start(SCENES.title);
      };
      this.input.keyboard!.once('keydown-SPACE', go);
      this.input.once('pointerdown', go);
    });
  }
}
