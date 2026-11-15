import Phaser from 'phaser';
import { COLORS, EVENTS, GAME_HEIGHT, GAME_WIDTH, PLAYER_CSS, SCENES, TEX, type MeetData } from '../config';
import { nextEvent } from '../meet';
import { playSfx } from '../audio';

/** After each event: placings for that event, then the running totals. SPACE / click continues. */
export class ResultsScene extends Phaser.Scene {
  constructor() {
    super(SCENES.results);
  }

  create(data: MeetData): void {
    const meet = data.meet;
    const result = meet.history[meet.history.length - 1];
    const ev = EVENTS[meet.eventIndex];
    const cx = GAME_WIDTH / 2;
    this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x1b5e20).setOrigin(0, 0);
    this.add.text(cx, 50, `${ev.title}: results`, { fontFamily: 'Arial Black, Arial', fontSize: '44px', color: COLORS.accent, stroke: '#000', strokeThickness: 8 }).setOrigin(0.5);

    const order = meet.players.map((p) => p.index).sort((a, b) => result.places[a] - result.places[b]);
    order.forEach((i, row) => {
      const y = 130 + row * 62;
      const p = meet.players[i];
      this.add.image(cx - 330, y + 22, TEX.gnome(i)).setOrigin(0.5, 1).setScale(0.8);
      const t = this.add.text(cx - 300, y, `${ordinal(result.places[i])}  ${p.name}`, { fontFamily: 'Arial Black, Arial', fontSize: '28px', color: PLAYER_CSS[i], stroke: '#000', strokeThickness: 5 });
      const r = this.add.text(cx + 140, y, result.display[i], { fontFamily: 'Arial Black, Arial', fontSize: '28px', color: '#ffffff' });
      const pts = this.add.text(cx + 330, y, `+${result.points[i]}`, { fontFamily: 'Arial Black, Arial', fontSize: '28px', color: COLORS.accent }).setOrigin(1, 0);
      [t, r, pts].forEach((o) => {
        o.setAlpha(0);
        this.tweens.add({ targets: o, alpha: 1, delay: 250 * (meet.players.length - row), duration: 250 });
      });
    });

    this.add.text(cx, 400, 'Standings', { fontFamily: 'Arial Black, Arial', fontSize: '30px', color: '#ffffff' }).setOrigin(0.5);
    const standing = meet.players.map((p) => p.index).sort((a, b) => meet.totals[b] - meet.totals[a]);
    const max = Math.max(1, ...meet.totals);
    standing.forEach((i, row) => {
      const y = 440 + row * 44;
      this.add.text(cx - 330, y, meet.players[i].name, { fontFamily: 'Arial Black, Arial', fontSize: '22px', color: PLAYER_CSS[i], stroke: '#000', strokeThickness: 4 });
      const w = Math.max(2, (meet.totals[i] / max) * 330);
      const bar = this.add.rectangle(cx - 100, y + 4, w, 26, Phaser.Display.Color.HexStringToColor(PLAYER_CSS[i]).color).setOrigin(0, 0).setScale(0, 1);
      this.tweens.add({ targets: bar, scaleX: 1, duration: 700, delay: 1200 });
      this.add.text(cx + 330, y, `${meet.totals[i]} pts`, { fontFamily: 'Arial Black, Arial', fontSize: '22px', color: '#ffffff' }).setOrigin(1, 0);
    });

    const last = meet.eventIndex >= EVENTS.length - 1;
    const prompt = this.add
      .text(cx, GAME_HEIGHT - 36, last ? 'SPACE: to the podium!' : `SPACE: next event (${EVENTS[meet.eventIndex + 1].title})`, { fontFamily: 'Arial Black, Arial', fontSize: '26px', color: COLORS.accent, stroke: '#000', strokeThickness: 6 })
      .setOrigin(0.5)
      .setAlpha(0);
    playSfx('cheer');

    // Short delay so frantic tapping from the event does not skip the screen.
    this.time.delayedCall(1500, () => {
      prompt.setAlpha(1);
      const go = (): void => nextEvent(this, meet);
      this.input.keyboard!.once('keydown-SPACE', go);
      this.input.keyboard!.once('keydown-ENTER', go);
      this.input.once('pointerdown', go);
    });
  }
}

export function ordinal(n: number): string {
  return n === 1 ? '1st' : n === 2 ? '2nd' : n === 3 ? '3rd' : `${n}th`;
}
