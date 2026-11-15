import Phaser from 'phaser';
import { COLORS, EVENTS, GAME_WIDTH, HEADER_H, LANE_H, PLAYER_CSS, TEX, type MeetState, type PlayerSlot } from './config';
import { playSfx } from './audio';

/** Top y of lane i. */
export function laneTop(i: number): number {
  return HEADER_H + i * LANE_H;
}

/** Ground line y of lane i: where gnome feet stand (gnome sprites use origin (0.5, 1)). */
export function laneGround(i: number): number {
  return laneTop(i) + LANE_H - 28;
}

/** Header bar with the event title (left), meet progress (right) and an optional hint line. Returns the hint text. */
export function drawHeader(scene: Phaser.Scene, meet: MeetState, hint: string): Phaser.GameObjects.Text {
  const ev = EVENTS[meet.eventIndex];
  scene.add.rectangle(0, 0, GAME_WIDTH, HEADER_H, COLORS.header).setOrigin(0, 0).setDepth(50);
  scene.add.text(20, 12, ev.title, { fontFamily: 'Arial Black, Arial', fontSize: '30px', color: COLORS.accent }).setDepth(51);
  scene.add
    .text(GAME_WIDTH - 20, 14, `Event ${meet.eventIndex + 1} of ${EVENTS.length}`, { fontFamily: 'Arial', fontSize: '18px', color: '#bbbbbb' })
    .setOrigin(1, 0)
    .setDepth(51);
  return scene.add.text(20, 50, hint, { fontFamily: 'Arial', fontSize: '17px', color: COLORS.text }).setDepth(51);
}

/**
 * Grass background for lane i, a divider line, and a name tag at the left ("P1  A / D" or "CPU Gnorbert").
 * Draw this first; event-specific scenery (track, sand pit, field markers) goes on top at depth >= 1.
 */
export function drawLane(scene: Phaser.Scene, player: PlayerSlot): void {
  const top = laneTop(player.index);
  scene.add.rectangle(0, top, GAME_WIDTH, LANE_H, player.index % 2 ? COLORS.grass : COLORS.grassDark).setOrigin(0, 0).setDepth(0);
  scene.add.rectangle(0, top, GAME_WIDTH, 2, 0x000000, 0.35).setOrigin(0, 0).setDepth(0);
  const keys = player.cpu ? '' : `  ${player.keyLabels[0]} / ${player.keyLabels[1]}`;
  scene.add
    .text(10, top + 6, player.name + keys, {
      fontFamily: 'Arial Black, Arial', fontSize: '16px', color: PLAYER_CSS[player.index], stroke: '#000000', strokeThickness: 4,
    })
    .setDepth(40);
}

/** The player's gnome at (x, ground of its lane), origin at its feet, depth 10. */
export function addGnome(scene: Phaser.Scene, player: PlayerSlot, x: number): Phaser.GameObjects.Image {
  return scene.add.image(x, laneGround(player.index), TEX.gnome(player.index)).setOrigin(0.5, 1).setDepth(10);
}

/**
 * A floating text in lane i (e.g. "STUMBLE!", "PERFECT", "12.40 m") that rises and fades. Centered at x.
 */
export function laneMessage(scene: Phaser.Scene, laneIndex: number, x: number, text: string, color = '#ffffff'): void {
  const t = scene.add
    .text(x, laneTop(laneIndex) + 40, text, { fontFamily: 'Arial Black, Arial', fontSize: '22px', color, stroke: '#000000', strokeThickness: 5 })
    .setOrigin(0.5)
    .setDepth(60);
  scene.tweens.add({ targets: t, y: t.y - 30, alpha: 0, duration: 900, ease: 'Cubic.easeIn', onComplete: () => t.destroy() });
}

/** A fixed result label at the right end of lane i ("8.42 s", "FOUL"). Returns it so it can be updated. */
export function laneResult(scene: Phaser.Scene, laneIndex: number, text: string): Phaser.GameObjects.Text {
  return scene.add
    .text(GAME_WIDTH - 16, laneTop(laneIndex) + 8, text, {
      fontFamily: 'Arial Black, Arial', fontSize: '24px', color: '#ffffff', stroke: '#000000', strokeThickness: 5,
    })
    .setOrigin(1, 0)
    .setDepth(60);
}

/** Big "3, 2, 1, GO!" in the middle of the screen, then calls onGo. */
export function countdown(scene: Phaser.Scene, onGo: () => void): void {
  const t = scene.add
    .text(GAME_WIDTH / 2, HEADER_H + 2 * LANE_H, '', { fontFamily: 'Arial Black, Arial', fontSize: '110px', color: COLORS.accent, stroke: '#000000', strokeThickness: 10 })
    .setOrigin(0.5)
    .setDepth(100);
  const steps = ['3', '2', '1', 'GO!'];
  steps.forEach((s, k) => {
    scene.time.delayedCall(700 * k + 400, () => {
      t.setText(s).setScale(1.4).setAlpha(1);
      scene.tweens.add({ targets: t, scale: 1, duration: 250 });
      playSfx(s === 'GO!' ? 'go' : 'beep');
      if (s === 'GO!') {
        onGo();
        scene.tweens.add({ targets: t, alpha: 0, delay: 400, duration: 300 });
      }
    });
  });
}

/** Small dust puff at (x, y). */
export function dust(scene: Phaser.Scene, x: number, y: number, count = 6, tint = 0xd7ccc8): void {
  for (let k = 0; k < count; k++) {
    const p = scene.add.image(x, y, TEX.spark).setTint(tint).setDepth(9);
    scene.tweens.add({
      targets: p,
      x: x + Phaser.Math.Between(-24, 8),
      y: y - Phaser.Math.Between(4, 22),
      alpha: 0,
      scale: Phaser.Math.FloatBetween(1, 2.2),
      duration: Phaser.Math.Between(300, 600),
      onComplete: () => p.destroy(),
    });
  }
}
