import Phaser from 'phaser';
import { SCENES, TEX, TUNING, COLORS, GAME_WIDTH, GAME_HEIGHT } from '../config';
import type { GameOverData } from '../config';
import { playSfx } from '../audio';

export class GameScene extends Phaser.Scene {
  private player!: Phaser.Types.Physics.Arcade.SpriteWithDynamicBody;
  private enemies!: Phaser.Physics.Arcade.Group;
  private coins!: Phaser.Physics.Arcade.Group;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd!: Record<'W' | 'A' | 'S' | 'D', Phaser.Input.Keyboard.Key>;
  private score = 0;
  private elapsedMs = 0;
  private spawnTimerMs = 0;
  private coinTimerMs = 0;
  private dead = false;
  private hud!: Phaser.GameObjects.Text;
  private sparks!: Phaser.GameObjects.Particles.ParticleEmitter;

  constructor() { super(SCENES.game); }

  create(): void {
    // The scene restarts on every round, so reset all state here.
    this.score = 0;
    this.elapsedMs = 0;
    this.spawnTimerMs = TUNING.enemySpawnStartMs;
    this.coinTimerMs = TUNING.coinSpawnMs;
    this.dead = false;

    this.player = this.physics.add.sprite(GAME_WIDTH / 2, GAME_HEIGHT / 2, TEX.player) as Phaser.Types.Physics.Arcade.SpriteWithDynamicBody;
    this.player.setCollideWorldBounds(true);
    this.player.body.setCircle(14, 2, 2);

    this.enemies = this.physics.add.group();
    this.coins = this.physics.add.group();

    this.cursors = this.input.keyboard!.createCursorKeys();
    this.wasd = this.input.keyboard!.addKeys('W,A,S,D') as Record<'W' | 'A' | 'S' | 'D', Phaser.Input.Keyboard.Key>;

    this.hud = this.add.text(12, 10, '', { color: COLORS.text, fontSize: '20px' }).setDepth(10);

    this.sparks = this.add.particles(0, 0, TEX.spark, {
      speed: { min: 80, max: 260 },
      lifespan: 500,
      scale: { start: 1, end: 0 },
      emitting: false,
    });

    this.physics.add.overlap(this.player, this.enemies, () => this.onHit());
    this.physics.add.overlap(this.player, this.coins, (_p, c) => this.onCoin(c as Phaser.Physics.Arcade.Sprite));

    playSfx('start');
  }

  update(_time: number, delta: number): void {
    if (this.dead) return;

    // Movement input. Normalise so diagonals are not faster.
    const x = (this.cursors.right.isDown || this.wasd.D.isDown ? 1 : 0)
      - (this.cursors.left.isDown || this.wasd.A.isDown ? 1 : 0);
    let y = (this.cursors.down.isDown || this.wasd.S.isDown ? 1 : 0)
      - (this.cursors.up.isDown || this.wasd.W.isDown ? 1 : 0);
    let nx = x;
    const len = Math.hypot(x, y);
    if (len > 0) {
      nx = x / len;
      y = y / len;
    }
    this.player.setVelocity(nx * TUNING.playerSpeed, y * TUNING.playerSpeed);

    this.elapsedMs += delta;
    this.score += TUNING.survivalScorePerSec * delta / 1000;

    // Enemy spawning, interval shrinks as the round goes on.
    this.spawnTimerMs -= delta;
    if (this.spawnTimerMs <= 0) {
      this.spawnEnemy();
      this.spawnTimerMs = Math.max(
        TUNING.enemySpawnMinMs,
        TUNING.enemySpawnStartMs - TUNING.enemySpawnRampMs * this.elapsedMs / 1000,
      );
    }

    // Coin spawning.
    this.coinTimerMs -= delta;
    if (this.coinTimerMs <= 0) {
      this.spawnCoin();
      this.coinTimerMs = TUNING.coinSpawnMs;
    }

    // Remove enemies that have left well outside the play area.
    for (const obj of [...this.enemies.getChildren()]) {
      const enemy = obj as Phaser.Physics.Arcade.Sprite;
      if (
        enemy.x < -100 || enemy.x > GAME_WIDTH + 100 ||
        enemy.y < -100 || enemy.y > GAME_HEIGHT + 100
      ) {
        enemy.destroy();
      }
    }

    this.hud.setText(`Score ${Math.floor(this.score)}   Time ${(this.elapsedMs / 1000).toFixed(1)}s`);
  }

  private spawnEnemy(): void {
    // Pick an edge: 0 top, 1 right, 2 bottom, 3 left. Start 20px outside it.
    let x: number;
    let y: number;
    switch (Phaser.Math.Between(0, 3)) {
      case 0: x = Phaser.Math.Between(0, GAME_WIDTH); y = -20; break;
      case 1: x = GAME_WIDTH + 20; y = Phaser.Math.Between(0, GAME_HEIGHT); break;
      case 2: x = Phaser.Math.Between(0, GAME_WIDTH); y = GAME_HEIGHT + 20; break;
      default: x = -20; y = Phaser.Math.Between(0, GAME_HEIGHT); break;
    }

    const enemy = this.enemies.create(x, y, TEX.enemy) as Phaser.Physics.Arcade.Sprite;
    const angle = Phaser.Math.Angle.Between(x, y, this.player.x, this.player.y);
    const speed = Phaser.Math.Between(TUNING.enemySpeedMin, TUNING.enemySpeedMax);
    enemy.setVelocity(Math.cos(angle) * speed, Math.sin(angle) * speed);
    enemy.setRotation(angle + Math.PI / 2);
  }

  private spawnCoin(): void {
    const x = Phaser.Math.Between(40, GAME_WIDTH - 40);
    const y = Phaser.Math.Between(40, GAME_HEIGHT - 40);
    const coin = this.coins.create(x, y, TEX.coin) as Phaser.Physics.Arcade.Sprite;

    this.time.delayedCall(TUNING.coinLifetimeMs, () => coin.destroy());
    this.tweens.add({
      targets: coin,
      scale: 1.25,
      yoyo: true,
      repeat: -1,
      duration: 400,
    });
  }

  private onCoin(coin: Phaser.Physics.Arcade.Sprite): void {
    coin.destroy();
    this.score += TUNING.coinScore;
    playSfx('coin');
    this.sparks.explode(8, coin.x, coin.y);
  }

  private onHit(): void {
    if (this.dead) return;
    this.dead = true;

    this.player.setVelocity(0, 0);
    this.player.setTint(COLORS.enemy);
    this.physics.pause();
    playSfx('hit');
    this.cameras.main.shake(250, 0.01);
    this.sparks.explode(30, this.player.x, this.player.y);

    this.time.delayedCall(TUNING.hitToGameOverMs, () => this.scene.start(SCENES.gameOver, {
      score: Math.floor(this.score),
      secondsSurvived: Math.floor(this.elapsedMs / 1000),
    } satisfies GameOverData));
  }
}
