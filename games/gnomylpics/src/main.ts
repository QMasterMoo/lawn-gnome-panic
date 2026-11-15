import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, COLORS } from './config';
import { BootScene } from './scenes/BootScene';
import { TitleScene } from './scenes/TitleScene';
import { DashScene } from './scenes/DashScene';
import { TripleJumpScene } from './scenes/TripleJumpScene';
import { MowerTossScene } from './scenes/MowerTossScene';
import { ResultsScene } from './scenes/ResultsScene';
import { FinalScene } from './scenes/FinalScene';

new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  backgroundColor: COLORS.background,
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  scene: [BootScene, TitleScene, DashScene, TripleJumpScene, MowerTossScene, ResultsScene, FinalScene],
});
