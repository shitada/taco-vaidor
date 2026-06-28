/*
 * Taco-Vaidor — gameplay
 * A faithful browser port of the original pygame game (test06.py):
 * octopus invaders, giant-squid bosses, life potions, 7 stages,
 * procedural BGM and synth SFX. Rendered on a 2D canvas and driven by a
 * fixed 60 Hz simulation step so frame-based movement matches the original.
 */
(function () {
  "use strict";

  /* ------------------------------------------------------------------ */
  /* Constants (ported 1:1 from test06.py)                              */
  /* ------------------------------------------------------------------ */
  const WIDTH = 800;
  const HEIGHT = 600;
  const STEP_MS = 1000 / 60; // fixed simulation timestep
  const MARGIN_X = 24;

  const PLAYER_SPEED = 6;
  const PLAYER_COOLDOWN = 220;
  const PLAYER_LIVES = 3;
  const PLAYER_LIVES_MAX = 99;

  const ENEMY_ROWS = 4;
  const ENEMY_COLS = 8;
  const ENEMY_X_SPACING = 70;
  const ENEMY_Y_SPACING = 60;
  const ENEMY_START_Y = 80;
  const ENEMY_DROP = 24;
  const ENEMY_BASE_SPEED = 1.0;

  const PLAYER_BULLET_SPEED = -10;
  const ENEMY_FIRE_BASE = 0.01;

  const POTIONS_PER_STAGE = 3;
  const POTION_SPAWN_RANGE_REGULAR = [6000, 24000];
  const POTION_SPAWN_RANGE_BOSS = [5000, 20000];
  const POTION_FALL_SPEED = 1.6;
  const POTION_SPAWN_MARGIN_X = 40;

  const DIFFICULTY = {
    easy: { enemy_speed_mul: 1.0, enemy_bullet_speed: 5, boss_hp: 80, fire_mul: 1.0 },
    medium: { enemy_speed_mul: 1.4, enemy_bullet_speed: 6, boss_hp: 130, fire_mul: 1.2 },
    difficult: { enemy_speed_mul: 1.8, enemy_bullet_speed: 7, boss_hp: 180, fire_mul: 1.4 },
    insane: { enemy_speed_mul: 2.3, enemy_bullet_speed: 8, boss_hp: 260, fire_mul: 1.7 },
  };

  const STAGES = [
    { bg: "forest", diff: "easy", boss: false },
    { bg: "forest", diff: "easy", boss: true },
    { bg: "urban", diff: "medium", boss: false },
    { bg: "urban", diff: "medium", boss: true },
    { bg: "universe", diff: "difficult", boss: false },
    { bg: "universe", diff: "difficult", boss: true },
    { bg: "doraemon", diff: "insane", boss: "double" },
  ];

  /* ------------------------------------------------------------------ */
  /* Small helpers                                                      */
  /* ------------------------------------------------------------------ */
  const clamp01 = (x) => Math.max(0, Math.min(1, x));
  const randInt = (lo, hi) => Math.floor(Math.random() * (hi - lo + 1)) + lo;
  const rgb = (r, g, b) => `rgb(${r},${g},${b})`;

  function overlap(a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  }

  function roundRectPath(g, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    g.beginPath();
    g.moveTo(x + r, y);
    g.arcTo(x + w, y, x + w, y + h, r);
    g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r);
    g.arcTo(x, y, x + w, y, r);
    g.closePath();
  }
  const fillRoundRect = (g, x, y, w, h, r, c) => {
    g.fillStyle = c;
    roundRectPath(g, x, y, w, h, r);
    g.fill();
  };
  const strokeRoundRect = (g, x, y, w, h, r, c, lw) => {
    g.strokeStyle = c;
    g.lineWidth = lw;
    roundRectPath(g, x, y, w, h, r);
    g.stroke();
  };
  const fillCircle = (g, cx, cy, r, c) => {
    g.fillStyle = c;
    g.beginPath();
    g.arc(cx, cy, r, 0, Math.PI * 2);
    g.fill();
  };
  const fillEllipse = (g, x, y, w, h, c) => {
    g.fillStyle = c;
    g.beginPath();
    g.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, 0, 0, Math.PI * 2);
    g.fill();
  };
  const strokeEllipse = (g, x, y, w, h, c, lw) => {
    g.strokeStyle = c;
    g.lineWidth = lw;
    g.beginPath();
    g.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, 0, 0, Math.PI * 2);
    g.stroke();
  };
  const fillPoly = (g, pts, c) => {
    g.fillStyle = c;
    g.beginPath();
    g.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]);
    g.closePath();
    g.fill();
  };
  const strokePoly = (g, pts, c, lw) => {
    g.strokeStyle = c;
    g.lineWidth = lw;
    g.beginPath();
    g.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]);
    g.closePath();
    g.stroke();
  };

  /* ------------------------------------------------------------------ */
  /* Pre-rendered sprite images (created once, like pygame Surfaces)    */
  /* ------------------------------------------------------------------ */
  const sprites = {};

  function makeCanvas(w, h) {
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    return c;
  }

  function buildSprites() {
    // Player — cucumber (green ellipse 60x26)
    let c = makeCanvas(60, 26);
    let g = c.getContext("2d");
    fillEllipse(g, 0, 0, 60, 26, rgb(40, 160, 60));
    sprites.player = c;

    // Octopus enemy (50x50)
    c = makeCanvas(50, 50);
    g = c.getContext("2d");
    fillCircle(g, 25, 20, 18, rgb(210, 90, 180));
    fillCircle(g, 18, 18, 5, "rgb(255,255,255)");
    fillCircle(g, 32, 18, 5, "rgb(255,255,255)");
    fillCircle(g, 18, 18, 2, "rgb(0,0,0)");
    fillCircle(g, 32, 18, 2, "rgb(0,0,0)");
    for (let i = 0; i < 6; i++) {
      const tx = 6 + i * 7;
      fillRoundRect(g, tx, 34, 6, 12, 3, rgb(200, 80, 170));
    }
    sprites.octopus = c;

    // Giant squid boss (160x160)
    c = makeCanvas(160, 160);
    g = c.getContext("2d");
    const mantle = rgb(40, 160, 150);
    const shadow = rgb(20, 120, 110);
    const tent = rgb(30, 140, 130);
    const pts = [
      [80, 10],
      [30, 70],
      [130, 70],
    ];
    fillPoly(g, pts, mantle);
    strokePoly(g, pts, shadow, 3);
    fillEllipse(g, 40, 55, 80, 45, mantle);
    strokeEllipse(g, 40, 55, 80, 45, shadow, 3);
    fillCircle(g, 60, 75, 8, "rgb(255,255,255)");
    fillCircle(g, 100, 75, 8, "rgb(255,255,255)");
    fillCircle(g, 60, 75, 3, "rgb(0,0,0)");
    fillCircle(g, 100, 75, 3, "rgb(0,0,0)");
    for (let i = 0; i < 6; i++) {
      const x = 38 + i * 14;
      fillRoundRect(g, x, 96, 10, 48, 4, tent);
    }
    sprites.boss = c;

    // Life potion (22x30)
    c = makeCanvas(22, 30);
    g = c.getContext("2d");
    fillRoundRect(g, 4, 6, 14, 20, 6, rgb(180, 220, 255));
    strokeRoundRect(g, 4, 6, 14, 20, 6, rgb(120, 180, 220), 2);
    fillRoundRect(g, 7, 0, 8, 6, 2, rgb(200, 170, 90));
    fillPoly(
      g,
      [
        [11, 12],
        [7, 15],
        [11, 20],
        [15, 15],
      ],
      rgb(240, 70, 90)
    );
    fillCircle(g, 9, 13, 3, rgb(240, 70, 90));
    fillCircle(g, 13, 13, 3, rgb(240, 70, 90));
    sprites.potion = c;
  }

  /* ------------------------------------------------------------------ */
  /* Backgrounds                                                        */
  /* ------------------------------------------------------------------ */
  let bgObjects = [];
  let stars = [];

  function genBgObjects() {
    const arr = [];
    for (let i = 0; i < 40; i++) {
      const lit = [];
      for (let w = 0; w < 5; w++) lit.push(Math.random() < 0.25);
      arr.push({
        x: randInt(0, WIDTH),
        y: randInt(0, HEIGHT),
        w: 20,
        h: 80,
        lit,
      });
    }
    return arr;
  }

  function genStars() {
    const arr = [];
    for (let i = 0; i < 120; i++) {
      arr.push({
        x: randInt(0, WIDTH - 1),
        y: randInt(0, HEIGHT - 1),
        r: Math.random() < 0.5 ? 1 : 2,
      });
    }
    return arr;
  }

  function drawBackground(g, kind) {
    if (kind === "forest") {
      g.fillStyle = rgb(50, 120, 50);
      g.fillRect(0, 0, WIDTH, HEIGHT);
      for (const r of bgObjects) {
        g.fillStyle = rgb(80, 50, 30);
        g.fillRect(r.x, r.y, 8, r.h); // trunk
        fillCircle(g, r.x + r.w / 2, r.y, 20, rgb(20, 90, 20)); // foliage
      }
    } else if (kind === "urban") {
      g.fillStyle = rgb(30, 30, 60);
      g.fillRect(0, 0, WIDTH, HEIGHT);
      for (const r of bgObjects) {
        g.fillStyle = rgb(60, 20, 80);
        g.fillRect(r.x, r.y, r.w, r.h);
        for (let wi = 0; wi < r.lit.length; wi++) {
          if (r.lit[wi]) {
            g.fillStyle = rgb(255, 230, 160);
            g.fillRect(r.x + 4, r.y + 4 + wi * 16, 6, 8);
          }
        }
      }
    } else if (kind === "universe") {
      g.fillStyle = rgb(10, 10, 20);
      g.fillRect(0, 0, WIDTH, HEIGHT);
      g.fillStyle = rgb(220, 220, 255);
      for (const s of stars) {
        g.beginPath();
        g.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        g.fill();
      }
    } else if (kind === "doraemon") {
      g.fillStyle = rgb(100, 180, 255);
      g.fillRect(0, 0, WIDTH, HEIGHT);
      g.fillStyle = rgb(230, 200, 150);
      g.fillRect(140, 120, 520, 360);
      g.fillStyle = rgb(170, 120, 80);
      g.fillRect(140, 120, 520, 20);
      g.fillStyle = rgb(200, 70, 70);
      g.fillRect(360, 210, 80, 220);
      fillCircle(g, 400, 260, 8, "rgb(255,255,255)");
    } else {
      g.fillStyle = "rgb(0,0,0)";
      g.fillRect(0, 0, WIDTH, HEIGHT);
    }
  }

  /* ------------------------------------------------------------------ */
  /* Entities                                                           */
  /* ------------------------------------------------------------------ */
  function makeBullet(cx, cy, vy, color, w, h, vx) {
    w = w || 4;
    h = h || 12;
    vx = vx || 0;
    return { x: cx - w / 2, y: cy - h / 2, w, h, vx, vy, color, dead: false };
  }

  function updateBullet(b) {
    b.x += b.vx;
    b.y += b.vy;
    const cx = b.x + b.w / 2;
    const cy = b.y + b.h / 2;
    if (!(-60 < cx && cx < WIDTH + 60 && -60 < cy && cy < HEIGHT + 60)) b.dead = true;
  }

  function createEnemies() {
    const arr = [];
    const startX = (WIDTH - (ENEMY_COLS - 1) * ENEMY_X_SPACING) / 2;
    for (let row = 0; row < ENEMY_ROWS; row++) {
      for (let col = 0; col < ENEMY_COLS; col++) {
        const cx = startX + col * ENEMY_X_SPACING;
        const cy = ENEMY_START_Y + row * ENEMY_Y_SPACING;
        arr.push({ x: cx - 25, y: cy - 25, w: 50, h: 50, col, dead: false });
      }
    }
    return arr;
  }

  // Classic invader formation movement.
  function makeFormation(group, speedMul) {
    return {
      group,
      direction: 1,
      baseSpeed: ENEMY_BASE_SPEED * speedMul,
      drop: ENEMY_DROP,
      totalInitial: group.length,
      currentSpeed() {
        if (this.totalInitial === 0) return this.baseSpeed;
        const progress = 1.0 - this.group.length / this.totalInitial;
        return this.baseSpeed + 2.0 * progress;
      },
      boundaries() {
        if (this.group.length === 0) return null;
        let left = Infinity,
          right = -Infinity,
          bottom = -Infinity;
        for (const s of this.group) {
          left = Math.min(left, s.x);
          right = Math.max(right, s.x + s.w);
          bottom = Math.max(bottom, s.y + s.h);
        }
        return [left, right, bottom];
      },
      update() {
        if (this.group.length === 0) return;
        const speed = this.currentSpeed();
        for (const e of this.group) e.x += this.direction * speed;
        const b = this.boundaries();
        if (b) {
          const [left, right] = b;
          if (left <= MARGIN_X || right >= WIDTH - MARGIN_X) {
            for (const e of this.group) e.y += this.drop;
            this.direction *= -1;
            GameAudio.play("step");
          }
        }
      },
    };
  }

  function makeBoss(diff, x) {
    const cx = x == null ? WIDTH / 2 : x;
    const hp = DIFFICULTY[diff].boss_hp;
    return {
      x: cx - 80,
      y: 60,
      w: 160,
      h: 160,
      diff,
      hp,
      maxHp: hp,
      t: 0,
      aimCd: 0,
      spreadCd: 1000,
      dead: false,
      update(dt) {
        this.t += dt / 1000;
        const center = WIDTH / 2 + Math.sin(this.t * 0.9) * (WIDTH / 2 - 120);
        this.x = center - 80;
        this.aimCd = Math.max(0, this.aimCd - dt);
        this.spreadCd = Math.max(0, this.spreadCd - dt);
      },
      shoot(out, playerPos) {
        const spd = DIFFICULTY[this.diff].enemy_bullet_speed;
        const cx = this.x + 80;
        const cy = this.y + 80;
        if (this.aimCd === 0) {
          const ang = Math.atan2(playerPos[1] - cy, playerPos[0] - cx);
          for (const off of [-0.1, 0.1]) {
            const vx = Math.cos(ang + off) * spd;
            const vy = Math.sin(ang + off) * spd;
            out.push(makeBullet(cx, cy + 16, vy, rgb(255, 120, 120), 6, 12, vx));
          }
          this.aimCd = 1200;
        }
        if (this.spreadCd === 0) {
          for (let i = 0; i < 6; i++) {
            const a = (i * Math.PI) / 3;
            const vx = Math.cos(a) * (spd - 1);
            const vy = Math.sin(a) * (spd - 1);
            out.push(makeBullet(cx, cy + 12, vy, rgb(255, 180, 120), 6, 10, vx));
          }
          this.spreadCd = 2800;
        }
      },
    };
  }

  function makePotion(cx, cy) {
    return { x: cx - 11, y: cy - 15, w: 22, h: 30, vy: POTION_FALL_SPEED, dead: false };
  }

  /* ------------------------------------------------------------------ */
  /* Game state                                                         */
  /* ------------------------------------------------------------------ */
  let canvas, ctx;
  let player, bullets, enemyBullets, enemies, bosses, potions;
  let formation, level, score, lives, state;
  let stageElapsedMs, potionSchedule, nextPotionIdx;
  let running = false;
  let lastNonzeroVol = 0.5;
  const keys = {};

  function resetGame() {
    player = { x: WIDTH / 2 - 30, y: HEIGHT - 30 - 26, w: 60, h: 26, cooldown: 0 };
    bullets = [];
    enemyBullets = [];
    enemies = [];
    bosses = [];
    potions = [];
    formation = null;
    level = 1;
    score = 0;
    lives = PLAYER_LIVES;
    state = "PLAY";
    stageElapsedMs = 0;
    potionSchedule = [];
    nextPotionIdx = 0;
  }

  function preparePotionSchedule(isBoss) {
    const [lo, hi] = isBoss ? POTION_SPAWN_RANGE_BOSS : POTION_SPAWN_RANGE_REGULAR;
    const times = [];
    for (let i = 0; i < POTIONS_PER_STAGE; i++) times.push(randInt(lo, hi));
    times.sort((a, b) => a - b);
    return times;
  }

  function playerShoot() {
    if (player.cooldown === 0) {
      bullets.push(makeBullet(player.x + 30, player.y - 2, PLAYER_BULLET_SPEED, rgb(255, 255, 160)));
      player.cooldown = PLAYER_COOLDOWN;
      GameAudio.play("shoot");
    }
  }

  /* ------------------------------------------------------------------ */
  /* Simulation step (fixed dt = STEP_MS)                               */
  /* ------------------------------------------------------------------ */
  function step(dt) {
    const stage = STAGES[(level - 1) % STAGES.length];
    const bossConf = stage.boss;
    const diff = stage.diff;
    const diffCfg = DIFFICULTY[diff];

    // BGM per stage type (no-ops if unchanged)
    GameAudio.playMusic(bossConf ? "classic" : "pop");

    if (state !== "PLAY") return;

    // ---- New stage start ----
    if (enemies.length === 0 && bosses.length === 0) {
      stageElapsedMs = 0;
      potions = [];
      nextPotionIdx = 0;
      potionSchedule = preparePotionSchedule(!!bossConf);

      if (bossConf) {
        if (bossConf === "double") {
          bosses.push(makeBoss(diff, WIDTH / 3));
          bosses.push(makeBoss(diff, (2 * WIDTH) / 3));
        } else {
          bosses.push(makeBoss(diff));
        }
        GameAudio.play("boss_intro");
        formation = null;
      } else {
        enemies = createEnemies();
        formation = makeFormation(enemies, diffCfg.enemy_speed_mul);
        GameAudio.play("drop");
      }
    }

    // ---- Player ----
    const left = keys["ArrowLeft"] || keys["KeyA"];
    const right = keys["ArrowRight"] || keys["KeyD"];
    player.x += ((right ? 1 : 0) - (left ? 1 : 0)) * PLAYER_SPEED;
    player.x = Math.max(0, Math.min(WIDTH - player.w, player.x));
    if (player.cooldown > 0) player.cooldown = Math.max(0, player.cooldown - dt);
    if (keys["Space"]) playerShoot();

    // ---- Projectiles & movers ----
    bullets.forEach(updateBullet);
    enemyBullets.forEach(updateBullet);
    for (const b of bosses) b.update(dt);
    for (const p of potions) {
      p.y += p.vy;
      if (p.y > HEIGHT + 4) p.dead = true;
    }

    // ---- Regular enemies: move & fire ----
    if (enemies.length) {
      formation.group = enemies;
      formation.update();
      const bottomPerCol = {};
      for (const e of enemies) {
        const prev = bottomPerCol[e.col];
        if (!prev || e.y + e.h > prev.y + prev.h) bottomPerCol[e.col] = e;
      }
      const shooters = Object.values(bottomPerCol);
      if (shooters.length && Math.random() < ENEMY_FIRE_BASE * diffCfg.fire_mul) {
        const s = shooters[randInt(0, shooters.length - 1)];
        enemyBullets.push(
          makeBullet(s.x + 25, s.y + s.h + 6, diffCfg.enemy_bullet_speed, rgb(255, 120, 120), 4, 12, 0)
        );
      }
    }

    // ---- Bosses shoot ----
    for (const b of bosses) b.shoot(enemyBullets, [player.x + 30, player.y + 13]);

    // ---- Collisions: player bullets vs enemies ----
    let killed = 0;
    for (const e of enemies) {
      if (e.dead) continue;
      let hit = false;
      for (const b of bullets) {
        if (!b.dead && overlap(e, b)) {
          b.dead = true;
          hit = true;
        }
      }
      if (hit) {
        e.dead = true;
        killed++;
      }
    }
    if (killed) {
      score += 10 * killed;
      GameAudio.play("hit");
    }

    // ---- Player bullets vs bosses ----
    for (const b of bosses) {
      let hit = false;
      for (const bl of bullets) {
        if (!bl.dead && overlap(b, bl)) {
          bl.dead = true;
          hit = true;
        }
      }
      if (hit) {
        b.hp -= 4;
        GameAudio.play("boss_hit");
        if (b.hp <= 0) {
          b.dead = true;
          GameAudio.play("boss_die");
          score += 200;
        }
      }
    }

    // ---- Enemy bullets vs player ----
    let playerHit = false;
    for (const b of enemyBullets) {
      if (!b.dead && overlap(player, b)) {
        b.dead = true;
        playerHit = true;
      }
    }
    if (playerHit) {
      lives -= 1;
      GameAudio.play("playerhit");
      if (lives <= 0) state = "GAMEOVER";
    }

    // ---- Enemy touch / invasion ----
    if (enemies.length) {
      for (const e of enemies) {
        if (overlap(player, e)) {
          state = "GAMEOVER";
          break;
        }
      }
      if (formation) {
        const b = formation.boundaries();
        if (b && b[2] >= HEIGHT - 80) state = "GAMEOVER";
      }
    }

    // ---- Potion spawns & pickup ----
    stageElapsedMs += dt;
    while (nextPotionIdx < potionSchedule.length && stageElapsedMs >= potionSchedule[nextPotionIdx]) {
      const x = randInt(POTION_SPAWN_MARGIN_X, WIDTH - POTION_SPAWN_MARGIN_X);
      potions.push(makePotion(x, -12));
      GameAudio.play("potion_spawn");
      nextPotionIdx++;
    }
    let gotPotion = false;
    for (const p of potions) {
      if (!p.dead && overlap(player, p)) {
        p.dead = true;
        gotPotion = true;
      }
    }
    if (gotPotion) {
      if (lives < PLAYER_LIVES_MAX) lives += 1;
      GameAudio.play("potion_get");
    }

    // ---- Cull dead entities ----
    bullets = bullets.filter((b) => !b.dead);
    enemyBullets = enemyBullets.filter((b) => !b.dead);
    enemies = enemies.filter((e) => !e.dead);
    bosses = bosses.filter((b) => !b.dead);
    potions = potions.filter((p) => !p.dead);

    // ---- Stage clear ----
    if (enemies.length === 0 && bosses.length === 0 && state === "PLAY") level += 1;
  }

  /* ------------------------------------------------------------------ */
  /* Rendering                                                          */
  /* ------------------------------------------------------------------ */
  function drawHud() {
    const stage = STAGES[(level - 1) % STAGES.length];
    ctx.textBaseline = "top";
    ctx.font = "bold 20px 'Courier New', monospace";
    ctx.fillStyle = rgb(240, 240, 240);
    const vol = Math.round(GameAudio.volume * 100);
    ctx.fillText(
      `Stage ${level}  Diff: ${stage.diff}  Score: ${score}  Lives: ${lives}/${PLAYER_LIVES_MAX}  Vol: ${vol}%`,
      10,
      8
    );
    if (bosses.length) {
      ctx.fillStyle = rgb(255, 200, 180);
      ctx.fillText("BOSS", 10, 34);
    }
  }

  function drawBossHp() {
    const barW = 420,
      barH = 16;
    const x = WIDTH / 2 - barW / 2;
    let y = 36;
    for (const b of bosses) {
      fillRoundRect(ctx, x, y, barW, barH, 4, rgb(60, 60, 60));
      const ratio = clamp01(b.hp / b.maxHp);
      fillRoundRect(ctx, x, y, barW * ratio, barH, 4, rgb(255, 100, 100));
      y += 24;
    }
  }

  function render() {
    const stage = STAGES[(level - 1) % STAGES.length];
    drawBackground(ctx, running ? stage.bg : "forest");

    if (!running) return;

    ctx.drawImage(sprites.player, player.x, player.y);
    for (const e of enemies) ctx.drawImage(sprites.octopus, e.x, e.y);
    for (const b of bosses) ctx.drawImage(sprites.boss, b.x, b.y);
    for (const b of bullets) fillRoundRect(ctx, b.x, b.y, b.w, b.h, 2, b.color);
    for (const b of enemyBullets) fillRoundRect(ctx, b.x, b.y, b.w, b.h, 2, b.color);
    for (const p of potions) ctx.drawImage(sprites.potion, p.x, p.y);

    drawHud();
    if (bosses.length) drawBossHp();

    if (state === "GAMEOVER") {
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = "rgb(255,255,255)";
      ctx.font = "bold 48px 'Courier New', monospace";
      ctx.fillText("GAME OVER", WIDTH / 2, HEIGHT / 2 - 16);
      ctx.font = "bold 22px 'Courier New', monospace";
      ctx.fillStyle = rgb(240, 240, 240);
      ctx.fillText("Press R to Restart", WIDTH / 2, HEIGHT / 2 + 24);
      ctx.textAlign = "left";
    }
  }

  /* ------------------------------------------------------------------ */
  /* Main loop (fixed-timestep accumulator)                             */
  /* ------------------------------------------------------------------ */
  let lastTs = 0;
  let acc = 0;

  function loop(ts) {
    const realDt = Math.min(100, ts - lastTs || 0);
    lastTs = ts;
    if (running) {
      acc += realDt;
      let steps = 0;
      while (acc >= STEP_MS && steps < 5) {
        step(STEP_MS);
        acc -= STEP_MS;
        steps++;
      }
    }
    render();
    requestAnimationFrame(loop);
  }

  /* ------------------------------------------------------------------ */
  /* Input & start                                                      */
  /* ------------------------------------------------------------------ */
  function changeVolume(delta) {
    const v = clamp01(GameAudio.volume + delta);
    if (v > 0) lastNonzeroVol = v;
    GameAudio.setVolume(v);
  }
  function toggleMute() {
    if (GameAudio.volume > 0) {
      lastNonzeroVol = GameAudio.volume;
      GameAudio.setVolume(0);
    } else {
      GameAudio.setVolume(lastNonzeroVol || 0.5);
    }
  }

  function startGame() {
    if (running) return;
    GameAudio.init();
    GameAudio.resume();
    GameAudio.setVolume(GameAudio.volume);
    resetGame();
    running = true;
    const overlay = document.getElementById("start-overlay");
    if (overlay) overlay.classList.add("hidden");
  }

  function setupInput() {
    window.addEventListener("keydown", (e) => {
      keys[e.code] = true;
      if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Space"].includes(e.code)) {
        e.preventDefault();
      }
      if (!running) {
        if (e.code === "Space" || e.code === "Enter") startGame();
        return;
      }
      if (e.repeat) return;
      if (e.code === "KeyR" && state === "GAMEOVER") resetGame();
      if (e.code === "ArrowUp") changeVolume(0.1);
      if (e.code === "ArrowDown") changeVolume(-0.1);
      if (e.code === "KeyM") toggleMute();
    });
    window.addEventListener("keyup", (e) => {
      keys[e.code] = false;
    });
    const btn = document.getElementById("start-btn");
    if (btn) btn.addEventListener("click", startGame);
  }

  /* ------------------------------------------------------------------ */
  /* Bootstrap                                                          */
  /* ------------------------------------------------------------------ */
  window.addEventListener("DOMContentLoaded", () => {
    canvas = document.getElementById("game");
    ctx = canvas.getContext("2d");
    buildSprites();
    bgObjects = genBgObjects();
    stars = genStars();
    resetGame();
    setupInput();
    requestAnimationFrame(loop);
  });
})();
