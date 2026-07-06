// Three.js is loaded globally via script tag in index.html

const ARENA_SIZE = 40;
const WALL_HEIGHT = 6;
const PLAYER_SPEED = 12;
const TURN_SPEED = 2.2;
const PLAYER_MAX_HP = 80;
const ENEMY_MAX_HP = 120;
const BULLET_SPEED = 55;
const ENEMY_BULLET_SPEED = 62;
const PLAYER_BULLET_DAMAGE = 18;
const ENEMY_BULLET_DAMAGE = 28;
const FIRE_COOLDOWN = 0.38;
const ENEMY_FIRE_COOLDOWN = 0.5;
const ENEMY_SPEED = 10;
const ENEMY_SIGHT_RANGE = 38;
const ENEMY_TURN_SPEED = 4.8;
const MAG_SIZE = 12;
const RELOAD_TIME = 1.6;

const canvas = document.getElementById("game-canvas");
const menu = document.getElementById("menu");
const hud = document.getElementById("hud");
const gameOverPanel = document.getElementById("game-over");
const startBtn = document.getElementById("start-btn");
const restartBtn = document.getElementById("restart-btn");
const playerHealthBar = document.getElementById("player-health");
const enemyHealthBar = document.getElementById("enemy-health");
const playerHpText = document.getElementById("player-hp-text");
const enemyHpText = document.getElementById("enemy-hp-text");
const scoreEl = document.getElementById("score");
const timerEl = document.getElementById("match-timer");
const enemyDistEl = document.getElementById("enemy-distance");
const threatEl = document.getElementById("threat-indicator");
const ammoEl = document.getElementById("ammo-count");
const weaponStatusEl = document.getElementById("weapon-status");
const reloadBar = document.getElementById("reload-bar");
const compassNeedle = document.getElementById("compass-needle");
const damageFlash = document.getElementById("damage-flash");
const messageEl = document.getElementById("message");
const resultTitle = document.getElementById("result-title");
const resultText = document.getElementById("result-text");
const tagline = document.querySelector(".tagline");

const keys = {};
let playing = false;
let score = 0;
let playerHP = PLAYER_MAX_HP;
let enemyHP = ENEMY_MAX_HP;
let lastFireTime = 0;
let enemyLastFireTime = 0;
let messageTimer = 0;
let yaw = 0;
let matchStartTime = 0;
let ammo = MAG_SIZE;
let reloading = false;
let reloadTimer = 0;
let damageFlashTimer = 0;
let enemyHasLOS = false;
let lastPlayerX = 0;
let lastPlayerZ = 0;

const bullets = [];
const enemyBullets = [];
const obstacles = [];

let renderer;
let scene;
let camera;
let weaponGroup;
let muzzleFlash;

let enemyGroup;
let enemyModel;
let enemyLegL;
let enemyLegR;
let enemyArmR;
let enemyGun;
let enemyMuzzle;
let enemyEyes = [];
let enemyTargetLaser;
let enemyHostileLabel;
let enemyWalkPhase = 0;
let enemyMoving = false;

function showLoadError(message) {
  if (tagline) tagline.textContent = message;
  if (startBtn) {
    startBtn.disabled = true;
    startBtn.textContent = "Unable to start";
  }
}

function buildArena() {
  const half = ARENA_SIZE / 2;

  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(ARENA_SIZE, ARENA_SIZE),
    new THREE.MeshStandardMaterial({ color: 0x1a2030, roughness: 0.85, metalness: 0.15 })
  );
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);

  const gridHelper = new THREE.GridHelper(ARENA_SIZE, 20, 0x334466, 0x222a3a);
  gridHelper.position.y = 0.01;
  scene.add(gridHelper);

  const wallMat = new THREE.MeshStandardMaterial({ color: 0x2a3348, roughness: 0.7, metalness: 0.2 });
  const wallGeoH = new THREE.BoxGeometry(ARENA_SIZE, WALL_HEIGHT, 0.6);
  const wallGeoV = new THREE.BoxGeometry(0.6, WALL_HEIGHT, ARENA_SIZE);
  const walls = [
    { geo: wallGeoH, pos: [0, WALL_HEIGHT / 2, -half] },
    { geo: wallGeoH, pos: [0, WALL_HEIGHT / 2, half] },
    { geo: wallGeoV, pos: [-half, WALL_HEIGHT / 2, 0] },
    { geo: wallGeoV, pos: [half, WALL_HEIGHT / 2, 0] },
  ];

  for (const w of walls) {
    const mesh = new THREE.Mesh(w.geo, wallMat);
    mesh.position.set(...w.pos);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    scene.add(mesh);
    obstacles.push(mesh);
  }

  const coverMat = new THREE.MeshStandardMaterial({ color: 0x3a4560, roughness: 0.6, metalness: 0.3 });
  const coverPositions = [
    [-8, 1.2, -5, 3, 2.4, 3],
    [8, 1.2, 5, 3, 2.4, 3],
    [0, 0.8, 0, 5, 1.6, 5],
    [-12, 1, 10, 2.5, 2, 6],
    [12, 1, -10, 2.5, 2, 6],
    [5, 0.6, -12, 6, 1.2, 2],
    [-5, 0.6, 12, 6, 1.2, 2],
  ];

  for (const [x, y, z, w, h, d] of coverPositions) {
    const box = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), coverMat);
    box.position.set(x, y, z);
    box.castShadow = true;
    box.receiveShadow = true;
    scene.add(box);
    obstacles.push(box);
  }
}

function buildEnemy() {
  enemyGroup = new THREE.Group();
  enemyModel = new THREE.Group();
  enemyModel.scale.set(1.2, 1.2, 1.2);
  enemyModel.rotation.x = 0.14;
  enemyGroup.add(enemyModel);

  const bodyMat = new THREE.MeshStandardMaterial({ color: 0x14141c, roughness: 0.55, metalness: 0.65 });
  const plateMat = new THREE.MeshStandardMaterial({ color: 0x3a0808, roughness: 0.45, metalness: 0.55 });
  const hazardYellow = new THREE.MeshStandardMaterial({
    color: 0xffcc00,
    emissive: 0xaa8800,
    emissiveIntensity: 0.45,
    roughness: 0.4,
  });
  const hazardBlack = new THREE.MeshStandardMaterial({ color: 0x0a0a0a, roughness: 0.7, metalness: 0.3 });
  const eyeMat = new THREE.MeshStandardMaterial({
    color: 0xff0000,
    emissive: 0xff0000,
    emissiveIntensity: 2.5,
    roughness: 0.05,
  });
  const boneMat = new THREE.MeshStandardMaterial({ color: 0xd8d0b8, roughness: 0.8, metalness: 0.05 });
  const gunMat = new THREE.MeshStandardMaterial({ color: 0x1a1a22, roughness: 0.4, metalness: 0.85 });
  const clawMat = new THREE.MeshStandardMaterial({ color: 0x882222, roughness: 0.35, metalness: 0.7 });

  function part(geo, mat, x, y, z, rx = 0, ry = 0, rz = 0) {
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, y, z);
    mesh.rotation.set(rx, ry, rz);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
  }

  function hazardStripes(parent, x, y, z, w, h, d, vertical = true) {
    const count = 4;
    for (let i = 0; i < count; i++) {
      const mat = i % 2 === 0 ? hazardYellow : hazardBlack;
      if (vertical) {
        parent.add(part(new THREE.BoxGeometry(w / count, h, d + 0.01), mat, x + (i - 1.5) * (w / count), y, z));
      } else {
        parent.add(part(new THREE.BoxGeometry(w, h / count, d + 0.01), mat, x, y + (i - 1.5) * (h / count), z));
      }
    }
  }

  function makeHostileLabel() {
    const c = document.createElement("canvas");
    c.width = 256;
    c.height = 64;
    const ctx = c.getContext("2d");
    ctx.fillStyle = "rgba(40, 0, 0, 0.9)";
    ctx.fillRect(0, 0, 256, 64);
    ctx.strokeStyle = "#ff2222";
    ctx.lineWidth = 5;
    ctx.strokeRect(4, 4, 248, 56);
    ctx.fillStyle = "#ff4444";
    ctx.font = "bold 34px Segoe UI, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("⚠ HOSTILE", 128, 34);
    const sprite = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthTest: false })
    );
    sprite.scale.set(2.4, 0.6, 1);
    sprite.position.set(0, 3.45, 0);
    sprite.renderOrder = 999;
    return sprite;
  }

  // Legs — heavy stomper boots
  enemyLegL = new THREE.Group();
  enemyLegL.position.set(-0.32, 0.92, 0.04);
  enemyLegL.add(part(new THREE.BoxGeometry(0.34, 0.52, 0.38), bodyMat, 0, -0.26, 0));
  hazardStripes(enemyLegL, 0, -0.58, 0.02, 0.34, 0.12, 0.36, false);
  enemyLegL.add(part(new THREE.BoxGeometry(0.32, 0.48, 0.36), plateMat, 0, -0.86, 0));
  enemyLegL.add(part(new THREE.BoxGeometry(0.38, 0.16, 0.44), bodyMat, 0, -1.16, 0.1));
  enemyLegL.add(part(new THREE.BoxGeometry(0.1, 0.08, 0.12), clawMat, -0.1, -1.22, 0.28));

  enemyLegR = new THREE.Group();
  enemyLegR.position.set(0.32, 0.92, 0.04);
  enemyLegR.add(part(new THREE.BoxGeometry(0.34, 0.52, 0.38), bodyMat, 0, -0.26, 0));
  hazardStripes(enemyLegR, 0, -0.58, 0.02, 0.34, 0.12, 0.36, false);
  enemyLegR.add(part(new THREE.BoxGeometry(0.32, 0.48, 0.36), plateMat, 0, -0.86, 0));
  enemyLegR.add(part(new THREE.BoxGeometry(0.38, 0.16, 0.44), bodyMat, 0, -1.16, 0.1));
  enemyLegR.add(part(new THREE.BoxGeometry(0.1, 0.08, 0.12), clawMat, 0.1, -1.22, 0.28));

  // Hunched armored torso
  const torso = part(new THREE.BoxGeometry(1.08, 1.0, 0.68), bodyMat, 0, 1.42, -0.04);
  const chestArmor = part(new THREE.BoxGeometry(0.88, 0.78, 0.2), plateMat, 0, 1.5, 0.34);
  hazardStripes(enemyModel, 0, 1.18, 0.38, 0.72, 0.14, 0.08, false);

  // Skull emblem on chest
  const skullFace = part(new THREE.BoxGeometry(0.42, 0.38, 0.06), boneMat, 0, 1.52, 0.46);
  const skullEyeL = part(new THREE.BoxGeometry(0.1, 0.1, 0.04), bodyMat, -0.1, 1.58, 0.49);
  const skullEyeR = part(new THREE.BoxGeometry(0.1, 0.1, 0.04), bodyMat, 0.1, 1.58, 0.49);
  const skullNose = part(new THREE.BoxGeometry(0.06, 0.08, 0.04), bodyMat, 0, 1.5, 0.49);
  const skullTeeth = part(new THREE.BoxGeometry(0.28, 0.06, 0.04), boneMat, 0, 1.42, 0.49);

  const spikeL = part(new THREE.ConeGeometry(0.1, 0.35, 4), clawMat, -0.72, 1.95, 0, 0, 0, -0.5);
  const spikeR = part(new THREE.ConeGeometry(0.1, 0.35, 4), clawMat, 0.72, 1.95, 0, 0, 0, 0.5);
  const pauldronL = part(new THREE.BoxGeometry(0.42, 0.24, 0.52), plateMat, -0.7, 1.86, -0.02, 0, 0, 0.25);
  const pauldronR = part(new THREE.BoxGeometry(0.42, 0.24, 0.52), plateMat, 0.7, 1.86, -0.02, 0, 0, -0.25);

  const fuelTank = part(new THREE.BoxGeometry(0.76, 0.78, 0.4), bodyMat, 0, 1.44, -0.42);
  const exhaust = part(new THREE.CylinderGeometry(0.06, 0.08, 0.3, 6), plateMat, 0.28, 1.72, -0.62, 0.5, 0, 0);

  // Horned helmet — angry brow, slit eyes, fangs
  const helmet = part(new THREE.BoxGeometry(0.66, 0.58, 0.64), bodyMat, 0, 2.36, 0.02);
  const brow = part(new THREE.BoxGeometry(0.72, 0.12, 0.22), plateMat, 0, 2.52, 0.28, -0.35, 0, 0);
  const hornL = part(new THREE.ConeGeometry(0.09, 0.42, 5), clawMat, -0.28, 2.72, 0, 0.2, 0, 0.35);
  const hornR = part(new THREE.ConeGeometry(0.09, 0.42, 5), clawMat, 0.28, 2.72, 0, 0.2, 0, -0.35);

  const eyeL = part(new THREE.BoxGeometry(0.16, 0.06, 0.06), eyeMat, -0.14, 2.38, 0.34);
  const eyeR = part(new THREE.BoxGeometry(0.16, 0.06, 0.06), eyeMat, 0.14, 2.38, 0.34);
  enemyEyes = [eyeL, eyeR];

  const jaw = part(new THREE.BoxGeometry(0.5, 0.14, 0.14), plateMat, 0, 2.18, 0.32, 0.2, 0, 0);
  for (let i = -2; i <= 2; i++) {
    enemyModel.add(part(new THREE.BoxGeometry(0.06, 0.08, 0.05), boneMat, i * 0.1, 2.12, 0.38));
  }

  // Left claw arm
  const armL = new THREE.Group();
  armL.position.set(-0.68, 1.68, -0.02);
  armL.add(part(new THREE.BoxGeometry(0.3, 0.44, 0.34), bodyMat, 0, -0.1, 0));
  armL.add(part(new THREE.BoxGeometry(0.26, 0.36, 0.28), plateMat, 0, -0.46, 0.04));
  for (let i = -1; i <= 1; i++) {
    armL.add(part(new THREE.BoxGeometry(0.07, 0.18, 0.07), clawMat, i * 0.1, -0.72, 0.1, -0.4, 0, 0));
  }
  armL.rotation.z = 0.25;
  armL.rotation.x = -0.15;

  // Right gun arm
  enemyArmR = new THREE.Group();
  enemyArmR.position.set(0.68, 1.68, -0.02);
  enemyArmR.add(part(new THREE.BoxGeometry(0.3, 0.44, 0.34), bodyMat, 0, -0.1, 0));
  hazardStripes(enemyArmR, 0, -0.42, 0.06, 0.28, 0.3, 0.28, true);
  enemyArmR.add(part(new THREE.BoxGeometry(0.26, 0.36, 0.28), plateMat, 0, -0.46, 0.04));

  enemyGun = new THREE.Group();
  enemyGun.position.set(0.08, -0.74, 0.28);
  enemyGun.add(part(new THREE.BoxGeometry(0.14, 0.16, 0.58), gunMat, 0, 0, -0.14));
  enemyGun.add(part(new THREE.BoxGeometry(0.1, 0.1, 0.48), gunMat, 0, 0.05, -0.58));
  enemyGun.add(part(new THREE.BoxGeometry(0.22, 0.22, 0.16), plateMat, 0, -0.08, 0.1));
  enemyGun.add(part(new THREE.BoxGeometry(0.08, 0.12, 0.08), hazardYellow, 0, 0.12, -0.1));
  enemyMuzzle = part(
    new THREE.SphereGeometry(0.12, 8, 8),
    new THREE.MeshBasicMaterial({ color: 0xff4400, transparent: true, opacity: 0 }),
    0, 0.05, -0.88
  );
  enemyGun.add(enemyMuzzle);
  enemyArmR.add(enemyGun);

  const enemyLight = new THREE.PointLight(0xff1100, 1.8, 7);
  enemyLight.position.set(0, 1.5, 0.7);
  enemyModel.add(enemyLight);

  const laserGeo = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(0, 2.35, 0.4),
    new THREE.Vector3(0, 2.35, 4),
  ]);
  enemyTargetLaser = new THREE.Line(
    laserGeo,
    new THREE.LineBasicMaterial({ color: 0xff0000, transparent: true, opacity: 0.55 })
  );
  enemyTargetLaser.visible = false;
  enemyModel.add(enemyTargetLaser);

  enemyHostileLabel = makeHostileLabel();

  enemyModel.add(
    enemyLegL, enemyLegR, torso, chestArmor, skullFace, skullEyeL, skullEyeR, skullNose, skullTeeth,
    spikeL, spikeR, pauldronL, pauldronR, fuelTank, exhaust,
    helmet, brow, hornL, hornR, eyeL, eyeR, jaw,
    armL, enemyArmR, enemyHostileLabel
  );

  enemyGroup.position.set(0, 0, -8);
  scene.add(enemyGroup);
}

function updateEnemyLaser() {
  if (!enemyTargetLaser || !playing) {
    if (enemyTargetLaser) enemyTargetLaser.visible = false;
    return;
  }

  const ex = enemyGroup.position.x;
  const ez = enemyGroup.position.z;
  const dx = camera.position.x - ex;
  const dz = camera.position.z - ez;
  const dist = Math.sqrt(dx * dx + dz * dz);

  if (dist >= ENEMY_SIGHT_RANGE) {
    enemyTargetLaser.visible = false;
    return;
  }

  const hitDist = raycastObstacles(
    new THREE.Vector3(ex, 2.2, ez),
    new THREE.Vector3(dx / dist, 0, dz / dist),
    dist
  );

  if (hitDist < dist - 1) {
    enemyTargetLaser.visible = false;
    return;
  }

  const targetLocal = enemyModel.worldToLocal(
    new THREE.Vector3(camera.position.x, 1.5, camera.position.z)
  );
  enemyTargetLaser.geometry.setFromPoints([
    new THREE.Vector3(0, 2.35, 0.4),
    targetLocal,
  ]);
  enemyTargetLaser.visible = true;
}

function animateEnemy(dt, now) {
  const pulse = 0.6 + Math.sin(now * 0.008) * 0.4;
  for (const eye of enemyEyes) {
    eye.material.emissiveIntensity = pulse * 2.5;
  }

  if (enemyHostileLabel && camera) {
    enemyHostileLabel.lookAt(camera.position);
  }

  if (enemyMoving) {
    enemyWalkPhase += dt * 9;
    const swing = Math.sin(enemyWalkPhase) * 0.45;
    enemyLegL.rotation.x = swing;
    enemyLegR.rotation.x = -swing;
    enemyModel.position.y = Math.abs(Math.sin(enemyWalkPhase * 2)) * 0.08;
    enemyModel.rotation.x = THREE.MathUtils.lerp(enemyModel.rotation.x, 0.2, dt * 5);
  } else {
    enemyLegL.rotation.x *= 0.8;
    enemyLegR.rotation.x *= 0.8;
    enemyModel.position.y *= 0.85;
    enemyModel.rotation.x = THREE.MathUtils.lerp(enemyModel.rotation.x, 0.14, dt * 3);
  }

  enemyModel.position.y += Math.sin(now * 0.003) * 0.008;

  if (playing && enemyArmR) {
    const dx = camera.position.x - enemyGroup.position.x;
    const dz = camera.position.z - enemyGroup.position.z;
    const dist = Math.sqrt(dx * dx + dz * dz) || 1;
    const pitch = -Math.atan2(
      (camera.position.y + 0.5) - (enemyGroup.position.y + 1.7),
      dist
    );
    enemyArmR.rotation.x = THREE.MathUtils.lerp(enemyArmR.rotation.x, pitch * 0.6 - 0.3, dt * 6);
    enemyArmR.rotation.z = THREE.MathUtils.lerp(enemyArmR.rotation.z, -0.18, dt * 4);
  }

  updateEnemyLaser();
}

function buildWeapon() {
  const gunMat = new THREE.MeshStandardMaterial({ color: 0x333340, roughness: 0.4, metalness: 0.7 });
  weaponGroup = new THREE.Group();

  const barrel = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.5), gunMat);
  barrel.position.set(0.25, -0.2, -0.5);

  const body = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.2, 0.35), gunMat);
  body.position.set(0.25, -0.25, -0.3);

  muzzleFlash = new THREE.Mesh(
    new THREE.SphereGeometry(0.12, 8, 8),
    new THREE.MeshBasicMaterial({ color: 0xffaa00, transparent: true, opacity: 0 })
  );
  muzzleFlash.position.set(0.25, -0.2, -0.78);

  weaponGroup.add(body, barrel, muzzleFlash);
  camera.add(weaponGroup);
  scene.add(camera);
}

const playerRadius = 0.4;
const enemyRadius = 0.6;

function circleRectOverlap(px, pz, r, box) {
  const bx = box.position.x;
  const bz = box.position.z;
  const sx = box.geometry.parameters.width / 2 + r;
  const sz = box.geometry.parameters.depth / 2 + r;
  const closestX = Math.max(bx - sx, Math.min(px, bx + sx));
  const closestZ = Math.max(bz - sz, Math.min(pz, bz + sz));
  const dx = px - closestX;
  const dz = pz - closestZ;
  return dx * dx + dz * dz < r * r;
}

function canPlayerMoveTo(x, z) {
  const half = ARENA_SIZE / 2 - playerRadius - 0.3;
  if (Math.abs(x) > half || Math.abs(z) > half) return false;

  for (const obs of obstacles) {
    if (circleRectOverlap(x, z, playerRadius, obs)) return false;
  }

  const dx = x - enemyGroup.position.x;
  const dz = z - enemyGroup.position.z;
  return dx * dx + dz * dz >= (playerRadius + enemyRadius) ** 2;
}

function canEnemyMoveTo(x, z) {
  const half = ARENA_SIZE / 2 - enemyRadius - 0.3;
  if (Math.abs(x) > half || Math.abs(z) > half) return false;

  for (const obs of obstacles) {
    if (circleRectOverlap(x, z, enemyRadius, obs)) return false;
  }

  const dx = x - camera.position.x;
  const dz = z - camera.position.z;
  return dx * dx + dz * dz >= (playerRadius + enemyRadius) ** 2;
}

function raycastObstacles(origin, direction, maxDist) {
  const raycaster = new THREE.Raycaster(origin, direction, 0, maxDist);
  const hits = raycaster.intersectObjects(obstacles, false);
  return hits.length > 0 ? hits[0].distance : maxDist;
}

function createBullet(origin, direction, isEnemy) {
  const mesh = new THREE.Mesh(
    new THREE.SphereGeometry(isEnemy ? 0.1 : 0.08, 6, 6),
    new THREE.MeshBasicMaterial({ color: isEnemy ? 0xff4444 : 0x44aaff })
  );
  mesh.position.copy(origin);
  scene.add(mesh);

  (isEnemy ? enemyBullets : bullets).push({
    mesh,
    velocity: direction.clone().multiplyScalar(isEnemy ? ENEMY_BULLET_SPEED : BULLET_SPEED),
    isEnemy,
    life: 2,
  });
}

function updateBullets(list, dt) {
  for (let i = list.length - 1; i >= 0; i--) {
    const b = list[i];
    b.life -= dt;
    if (b.life <= 0) {
      scene.remove(b.mesh);
      list.splice(i, 1);
      continue;
    }

    const prev = b.mesh.position.clone();
    b.mesh.position.addScaledVector(b.velocity, dt);

    const dir = b.velocity.clone().normalize();
    const dist = b.velocity.length * dt;
    if (raycastObstacles(prev, dir, dist) < dist) {
      scene.remove(b.mesh);
      list.splice(i, 1);
      continue;
    }

    if (b.isEnemy) {
      const dx = b.mesh.position.x - camera.position.x;
      const dz = b.mesh.position.z - camera.position.z;
      if (dx * dx + dz * dz < playerRadius ** 2 && b.mesh.position.y > 0.5 && b.mesh.position.y < 2.2) {
        damagePlayer(ENEMY_BULLET_DAMAGE);
        scene.remove(b.mesh);
        list.splice(i, 1);
      }
    } else {
      const dx = b.mesh.position.x - enemyGroup.position.x;
      const dz = b.mesh.position.z - enemyGroup.position.z;
      if (dx * dx + dz * dz < enemyRadius ** 2 && b.mesh.position.y > 0.5 && b.mesh.position.y < 2.8) {
        damageEnemy(PLAYER_BULLET_DAMAGE);
        scene.remove(b.mesh);
        list.splice(i, 1);
      }
    }
  }
}

function startReload() {
  if (reloading || ammo >= MAG_SIZE) return;
  reloading = true;
  reloadTimer = RELOAD_TIME;
  updateHUD();
}

function updateReload(dt) {
  if (!reloading) {
    if (reloadBar) reloadBar.style.width = "0%";
    return;
  }

  reloadTimer -= dt;
  if (reloadBar) {
    reloadBar.style.width = `${Math.max(0, (1 - reloadTimer / RELOAD_TIME) * 100)}%`;
  }

  if (reloadTimer <= 0) {
    reloading = false;
    ammo = MAG_SIZE;
    reloadTimer = 0;
    updateHUD();
  }
}

function shoot() {
  const now = performance.now() / 1000;
  if (reloading) return;
  if (ammo <= 0) {
    startReload();
    return;
  }
  if (now - lastFireTime < FIRE_COOLDOWN) return;
  lastFireTime = now;
  ammo--;

  const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
  const origin = camera.position.clone().add(dir.clone().multiplyScalar(0.5));
  origin.y -= 0.1;
  createBullet(origin, dir, false);

  muzzleFlash.material.opacity = 1;
  setTimeout(() => {
    muzzleFlash.material.opacity = 0;
  }, 50);

  if (ammo <= 0) startReload();
  updateHUD();
}

function enemyShoot() {
  const now = performance.now() / 1000;
  if (now - enemyLastFireTime < ENEMY_FIRE_COOLDOWN) return;
  enemyLastFireTime = now;

  const muzzlePos = new THREE.Vector3();
  enemyMuzzle.getWorldPosition(muzzlePos);

  const target = camera.position.clone();
  target.y = 1.5;

  const dist = muzzlePos.distanceTo(target);
  const travelTime = dist / ENEMY_BULLET_SPEED;
  const vx = camera.position.x - lastPlayerX;
  const vz = camera.position.z - lastPlayerZ;
  target.x += vx * travelTime * 0.85;
  target.z += vz * travelTime * 0.85;

  createBullet(muzzlePos, target.sub(muzzlePos).normalize(), true);

  enemyMuzzle.material.opacity = 1;
  setTimeout(() => {
    if (enemyMuzzle) enemyMuzzle.material.opacity = 0;
  }, 60);
}

function damagePlayer(amount) {
  playerHP = Math.max(0, playerHP - amount);
  damageFlashTimer = 0.25;
  if (damageFlash) damageFlash.classList.add("active");
  updateHUD();
  flashMessage("Hit!");
  if (playerHP <= 0) endGame(false);
}

function damageEnemy(amount) {
  enemyHP = Math.max(0, enemyHP - amount);
  updateHUD();
  if (enemyHP <= 0) {
    score++;
    updateHUD();
    flashMessage("Enemy down!");
    endGame(true);
  }
}

function updateEnemy(dt, now) {
  enemyMoving = false;

  const px = camera.position.x;
  const pz = camera.position.z;
  const ex = enemyGroup.position.x;
  const ez = enemyGroup.position.z;
  const dx = px - ex;
  const dz = pz - ez;
  const dist = Math.sqrt(dx * dx + dz * dz);

  const targetAngle = Math.atan2(dx, dz);
  let angleDiff = targetAngle - enemyGroup.rotation.y;
  while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
  while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
  enemyGroup.rotation.y += angleDiff * Math.min(1, dt * ENEMY_TURN_SPEED);

  if (dist > 2 && dist < ENEMY_SIGHT_RANGE) {
    const moveX = ex + (dx / dist) * ENEMY_SPEED * dt;
    const moveZ = ez + (dz / dist) * ENEMY_SPEED * dt;
    if (canEnemyMoveTo(moveX, moveZ)) {
      enemyGroup.position.x = moveX;
      enemyGroup.position.z = moveZ;
      enemyMoving = true;
    } else if (canEnemyMoveTo(moveX, ez)) {
      enemyGroup.position.x = moveX;
      enemyMoving = true;
    } else if (canEnemyMoveTo(ex, moveZ)) {
      enemyGroup.position.z = moveZ;
      enemyMoving = true;
    }
  }

  animateEnemy(dt, now);

  enemyHasLOS = false;
  if (dist < ENEMY_SIGHT_RANGE) {
    const hitDist = raycastObstacles(
      new THREE.Vector3(ex, 2, ez),
      new THREE.Vector3(dx / dist, 0, dz / dist),
      dist
    );
    if (hitDist >= dist - 1) {
      enemyHasLOS = true;
      enemyShoot();
    }
  }
}

function updatePlayer(dt) {
  if (keys["ArrowLeft"]) yaw += TURN_SPEED * dt;
  if (keys["ArrowRight"]) yaw -= TURN_SPEED * dt;
  camera.rotation.set(0, yaw, 0, "YXZ");

  const forward = new THREE.Vector3(0, 0, -1).applyAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
  const moveDir = new THREE.Vector3();
  if (keys["ArrowUp"]) moveDir.add(forward);
  if (keys["ArrowDown"]) moveDir.sub(forward);

  if (moveDir.lengthSq() > 0) {
    moveDir.normalize();
    const nx = camera.position.x + moveDir.x * PLAYER_SPEED * dt;
    const nz = camera.position.z + moveDir.z * PLAYER_SPEED * dt;
    if (canPlayerMoveTo(nx, camera.position.z)) camera.position.x = nx;
    if (canPlayerMoveTo(camera.position.x, nz)) camera.position.z = nz;
  }

  if (keys[" "]) shoot();
  if (keys.r) startReload();

  lastPlayerX = camera.position.x;
  lastPlayerZ = camera.position.z;
}

function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function updateHUD() {
  playerHealthBar.style.width = `${(playerHP / PLAYER_MAX_HP) * 100}%`;
  enemyHealthBar.style.width = `${(enemyHP / ENEMY_MAX_HP) * 100}%`;
  if (playerHpText) playerHpText.textContent = Math.ceil(playerHP);
  if (enemyHpText) enemyHpText.textContent = Math.ceil(enemyHP);
  scoreEl.textContent = score;
  if (ammoEl) ammoEl.textContent = ammo;

  if (weaponStatusEl) {
    weaponStatusEl.classList.remove("reloading", "empty");
    if (reloading) {
      weaponStatusEl.textContent = "RELOADING";
      weaponStatusEl.classList.add("reloading");
    } else if (ammo <= 0) {
      weaponStatusEl.textContent = "EMPTY";
      weaponStatusEl.classList.add("empty");
    } else {
      weaponStatusEl.textContent = "READY";
    }
  }
}

function updateHUDLive(now, dt) {
  if (!playing) return;

  updateHUD();

  if (timerEl && matchStartTime) {
    timerEl.textContent = formatTime((now - matchStartTime) / 1000);
  }

  if (enemyDistEl && enemyGroup) {
    const dx = camera.position.x - enemyGroup.position.x;
    const dz = camera.position.z - enemyGroup.position.z;
    const dist = Math.sqrt(dx * dx + dz * dz);
    enemyDistEl.textContent = `${Math.round(dist)} m`;
  }

  if (threatEl) {
    threatEl.classList.toggle("hidden", !enemyHasLOS);
  }

  if (compassNeedle && enemyGroup) {
    const angleToEnemy = Math.atan2(
      enemyGroup.position.x - camera.position.x,
      enemyGroup.position.z - camera.position.z
    );
    compassNeedle.style.transform = `rotate(${angleToEnemy - yaw}rad)`;
  }

  if (damageFlashTimer > 0) {
    damageFlashTimer -= dt;
    if (damageFlashTimer <= 0 && damageFlash) {
      damageFlash.classList.remove("active");
    }
  }
}

function flashMessage(text) {
  messageEl.textContent = text;
  messageEl.classList.remove("hidden");
  messageTimer = 1.2;
}

function endGame(victory) {
  playing = false;
  hud.classList.add("hidden");
  gameOverPanel.classList.remove("hidden");
  resultTitle.textContent = victory ? "Victory" : "Defeated";
  resultText.textContent = victory
    ? `You eliminated the opponent. Score: ${score}`
    : "The enemy got the better of you. Try again.";
}

function resetGame() {
  playerHP = PLAYER_MAX_HP;
  enemyHP = ENEMY_MAX_HP;
  lastFireTime = 0;
  enemyLastFireTime = 0;
  yaw = 0;
  ammo = MAG_SIZE;
  reloading = false;
  reloadTimer = 0;
  damageFlashTimer = 0;
  enemyHasLOS = false;
  lastPlayerX = 0;
  lastPlayerZ = 0;
  if (damageFlash) damageFlash.classList.remove("active");
  if (threatEl) threatEl.classList.add("hidden");

  camera.position.set(0, 1.7, 15);
  camera.rotation.set(0, 0, 0);
  lastPlayerX = camera.position.x;
  lastPlayerZ = camera.position.z;
  enemyGroup.position.set(0, 0, -8);
  enemyGroup.rotation.set(0, 0, 0);
  enemyWalkPhase = 0;
  enemyMoving = false;
  if (enemyModel) {
    enemyModel.position.set(0, 0, 0);
    enemyModel.rotation.set(0.14, 0, 0);
  }
  if (enemyTargetLaser) enemyTargetLaser.visible = false;
  if (enemyLegL) enemyLegL.rotation.x = 0;
  if (enemyLegR) enemyLegR.rotation.x = 0;
  if (enemyArmR) enemyArmR.rotation.set(0, 0, 0);

  for (const b of bullets) scene.remove(b.mesh);
  for (const b of enemyBullets) scene.remove(b.mesh);
  bullets.length = 0;
  enemyBullets.length = 0;

  updateHUD();
  messageEl.classList.add("hidden");
}

function startGame() {
  if (!renderer) return;
  resetGame();
  matchStartTime = performance.now();
  menu.classList.add("hidden");
  gameOverPanel.classList.add("hidden");
  hud.classList.remove("hidden");
  playing = true;
  canvas.focus();
}

function initGame() {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0c1018);
  scene.fog = new THREE.Fog(0x0c1018, 30, 70);

  camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 100);
  camera.position.set(0, 1.7, 15);

  scene.add(new THREE.AmbientLight(0x404060, 0.6));

  const sun = new THREE.DirectionalLight(0xfff0dd, 1.2);
  sun.position.set(15, 25, 10);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 60;
  sun.shadow.camera.left = -25;
  sun.shadow.camera.right = 25;
  sun.shadow.camera.top = 25;
  sun.shadow.camera.bottom = -25;
  scene.add(sun);

  const rimLight = new THREE.PointLight(0x6688ff, 0.8, 50);
  rimLight.position.set(-10, 8, -10);
  scene.add(rimLight);

  const accentLight = new THREE.PointLight(0xff6644, 0.6, 40);
  accentLight.position.set(10, 6, 10);
  scene.add(accentLight);

  buildArena();
  buildEnemy();
  buildWeapon();
  updateHUD();

  let lastTime = performance.now();

  function loop(now) {
    requestAnimationFrame(loop);
    const dt = Math.min((now - lastTime) / 1000, 0.05);
    lastTime = now;

    if (playing) {
      updatePlayer(dt);
      updateReload(dt);
      updateEnemy(dt, now);
      updateBullets(bullets, dt);
      updateBullets(enemyBullets, dt);
      updateHUDLive(now, dt);
    } else if (enemyModel) {
      animateEnemy(dt, now);
    }

    if (messageTimer > 0) {
      messageTimer -= dt;
      if (messageTimer <= 0) messageEl.classList.add("hidden");
    }

    if (weaponGroup) {
      weaponGroup.position.set(
        0.25 + Math.sin(now * 0.003) * 0.005,
        -0.25 + Math.cos(now * 0.004) * 0.003,
        -0.3
      );
    }

    renderer.render(scene, camera);
  }

  requestAnimationFrame(loop);
}

startBtn.addEventListener("click", startGame);
restartBtn.addEventListener("click", startGame);

window.addEventListener("keydown", (e) => {
  if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", " "].includes(e.key)) {
    e.preventDefault();
    keys[e.key] = true;
  }
  if (e.key === "r" || e.key === "R") keys.r = true;
});

window.addEventListener("keyup", (e) => {
  if (e.key === "r" || e.key === "R") keys.r = false;
  else keys[e.key] = false;
});

window.addEventListener("resize", () => {
  if (!camera || !renderer) return;
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

if (typeof THREE === "undefined") {
  showLoadError("Three.js failed to load. Check your internet connection and refresh.");
} else {
  initGame();
}
