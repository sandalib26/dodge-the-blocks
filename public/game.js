/* ============================================================
   Dodge the Blocks — Enhanced Edition
   Levels, power-ups, obstacle variety, particles, sound (WebAudio)
   ============================================================ */

const CONFIG = {
    githubUsername: "sandalib26",
    startSpeed: 3,
    speedPerLevel: 0.6,
    scorePerLevel: 15,          // score needed to level up
    baseSpawnFrames: 42,        // frames between spawns at level 1
    minSpawnFrames: 14,         // fastest spawn rate at high levels
    startLives: 3,
    maxLives: 5,
    shieldDuration: 6000,       // ms
    slowMoDuration: 5000,       // ms
    slowMoFactor: 0.45,
    multiplierDuration: 8000,   // ms
    powerUpChance: 0.16         // chance a spawn is a power-up instead of an obstacle
};

const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const scoreElement = document.getElementById("score");
const bestScoreElement = document.getElementById("bestScore");
const levelElement = document.getElementById("level");
const livesElement = document.getElementById("lives");
const restartBtn = document.getElementById("restartBtn");
const leftBtn = document.getElementById("leftBtn");
const rightBtn = document.getElementById("rightBtn");
const muteBtn = document.getElementById("muteBtn");
const gameMessage = document.getElementById("gameMessage");
const statusBar = document.getElementById("statusBar");

const BEST_KEY = "dodge-the-blocks:best-score";
const MUTE_KEY = "dodge-the-blocks:muted";
let muted = localStorage.getItem(MUTE_KEY) === "1";
let paused = false;

const player = {
    x: 275,
    y: 440,
    width: 44,
    height: 30,
    speed: 7.5,
    shieldUntil: 0,
    invulnUntil: 0 // brief flicker after taking a hit
};

let entities = [];       // obstacles + power-ups falling down
let particles = [];      // visual particles
let stars = [];          // parallax background
let score = 0;
let best = Number(localStorage.getItem(BEST_KEY)) || 0;
let level = 1;
let lives = CONFIG.startLives;
let gameOver = false;
let running = false;
let keys = {};
let spawnTimer = 0;
let shakeUntil = 0;
let shakeMag = 0;

let slowMoUntil = 0;
let multiplierUntil = 0;

bestScoreElement.textContent = String(best).padStart(5, "0");

/* ---------------- Sound (Web Audio, no external files) ---------------- */

let audioCtx = null;
function getAudio() {
    if (!audioCtx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (AC) audioCtx = new AC();
    }
    return audioCtx;
}

function beep({ freq = 440, duration = 0.1, type = "square", volume = 0.08, slideTo = null }) {
    if (muted) return;
    const ac = getAudio();
    if (!ac) return;
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, ac.currentTime);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, ac.currentTime + duration);
    gain.gain.setValueAtTime(volume, ac.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + duration);
    osc.connect(gain).connect(ac.destination);
    osc.start();
    osc.stop(ac.currentTime + duration);
}

/* ---------------- Background music (procedural loop) ---------------- */

const MUSIC_SCALE = [220, 246.94, 261.63, 293.66, 329.63, 392.0, 440.0]; // A minor-ish
let musicTimer = null;
let musicStep = 0;

function playMusicNote() {
    if (muted) return;
    const ac = getAudio();
    if (!ac) return;
    const base = MUSIC_SCALE[musicStep % MUSIC_SCALE.length];
    const octave = (musicStep % 8 < 4) ? 1 : 0.5;
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(base * octave, ac.currentTime);
    gain.gain.setValueAtTime(0, ac.currentTime);
    gain.gain.linearRampToValueAtTime(0.028, ac.currentTime + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + 0.35);
    osc.connect(gain).connect(ac.destination);
    osc.start();
    osc.stop(ac.currentTime + 0.36);
    musicStep++;
}

function startMusic() {
    stopMusic();
    if (muted) return;
    musicTimer = setInterval(playMusicNote, 260);
}

function stopMusic() {
    if (musicTimer) clearInterval(musicTimer);
    musicTimer = null;
}

function updateMuteButton() {
    if (!muteBtn) return;
    muteBtn.textContent = muted ? "🔇" : "🔊";
    muteBtn.setAttribute("aria-label", muted ? "Unmute" : "Mute");
}

if (muteBtn) {
    updateMuteButton();
    muteBtn.addEventListener("click", () => {
        muted = !muted;
        localStorage.setItem(MUTE_KEY, muted ? "1" : "0");
        updateMuteButton();
        if (muted) stopMusic();
        else if (running) startMusic();
    });
}

const sfx = {
    score: () => beep({ freq: 720, duration: 0.06, type: "square", volume: 0.05 }),
    powerUp: () => beep({ freq: 500, duration: 0.18, type: "triangle", volume: 0.09, slideTo: 1100 }),
    levelUp: () => {
        beep({ freq: 440, duration: 0.09, type: "square", volume: 0.08 });
        setTimeout(() => beep({ freq: 660, duration: 0.12, type: "square", volume: 0.08 }), 90);
    },
    hit: () => beep({ freq: 180, duration: 0.22, type: "sawtooth", volume: 0.12, slideTo: 60 }),
    gameOver: () => {
        beep({ freq: 300, duration: 0.15, type: "sawtooth", volume: 0.1 });
        setTimeout(() => beep({ freq: 200, duration: 0.2, type: "sawtooth", volume: 0.1 }), 150);
        setTimeout(() => beep({ freq: 110, duration: 0.35, type: "sawtooth", volume: 0.1 }), 330);
    }
};

/* ---------------- Input ---------------- */

document.addEventListener("keydown", (event) => {
    keys[event.key] = true;
    if ((event.key === "ArrowLeft" || event.key === "ArrowRight") && !running && !gameOver) {
        startGame();
    }
    if ((event.key === "p" || event.key === "P" || event.key === "Escape") && running) {
        togglePause();
    }
});

document.addEventListener("keyup", (event) => {
    keys[event.key] = false;
});

function bindHold(btn, key) {
    const start = (e) => { e.preventDefault(); keys[key] = true; if (!running && !gameOver) startGame(); };
    const end = (e) => { e.preventDefault(); keys[key] = false; };
    btn.addEventListener("touchstart", start, { passive: false });
    btn.addEventListener("touchend", end);
    btn.addEventListener("mousedown", start);
    btn.addEventListener("mouseup", end);
    btn.addEventListener("mouseleave", end);
}
bindHold(leftBtn, "ArrowLeft");
bindHold(rightBtn, "ArrowRight");

// Swipe / drag on canvas for mobile
let dragging = false;
canvas.addEventListener("touchstart", () => { dragging = true; if (!running && !gameOver) startGame(); }, { passive: true });
canvas.addEventListener("touchend", () => { dragging = false; keys["ArrowLeft"] = false; keys["ArrowRight"] = false; });
canvas.addEventListener("touchmove", (e) => {
    if (!dragging) return;
    const rect = canvas.getBoundingClientRect();
    const touchX = (e.touches[0].clientX - rect.left) * (canvas.width / rect.width);
    keys["ArrowLeft"] = touchX < player.x + player.width / 2;
    keys["ArrowRight"] = touchX >= player.x + player.width / 2;
}, { passive: true });

// Auto-pause when tab hidden
document.addEventListener("visibilitychange", () => {
    if (document.hidden && running) togglePause(true);
});

function togglePause(forceOn) {
    if (gameOver) return;
    paused = forceOn === true ? true : !paused;
    if (paused) {
        running = false;
        stopMusic();
        flashStatus("PAUSED · P to resume");
        draw();
        drawPauseOverlay();
    } else {
        running = true;
        startMusic();
        requestAnimationFrame(gameLoop);
    }
}

function drawPauseOverlay() {
    ctx.save();
    ctx.fillStyle = "rgba(11, 15, 20, 0.7)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#e6edf3";
    ctx.font = "bold 26px monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("PAUSED", canvas.width / 2, canvas.height / 2 - 10);
    ctx.font = "12px monospace";
    ctx.fillStyle = "#8b949e";
    ctx.fillText("press P or tap to resume", canvas.width / 2, canvas.height / 2 + 18);
    ctx.restore();
}

canvas.addEventListener("click", () => {
    if (paused) togglePause();
});

/* ---------------- Entity types ---------------- */

const OBSTACLE_TYPES = [
    { kind: "normal", weight: 5, color: ["#ef4444", "#7f1d1d"], speedMul: 1, sizeMin: 30, sizeMax: 58 },
    { kind: "fast", weight: 3, color: ["#f97316", "#7c2d12"], speedMul: 1.7, sizeMin: 20, sizeMax: 30 },
    { kind: "wide", weight: 2, color: ["#a855f7", "#4c1d95"], speedMul: 0.65, sizeMin: 70, sizeMax: 110, heightMul: 0.55 },
    { kind: "zigzag", weight: 2, color: ["#38bdf8", "#075985"], speedMul: 1.1, sizeMin: 26, sizeMax: 38 }
];

const POWERUP_TYPES = [
    { kind: "shield", color: "#facc15", glyph: "🛡" },
    { kind: "slowmo", color: "#22d3ee", glyph: "⏱" },
    { kind: "multiplier", color: "#c084fc", glyph: "x2" },
    { kind: "life", color: "#f472b6", glyph: "❤" }
];

function weightedObstacle() {
    const total = OBSTACLE_TYPES.reduce((s, t) => s + t.weight, 0);
    let r = Math.random() * total;
    for (const t of OBSTACLE_TYPES) {
        if (r < t.weight) return t;
        r -= t.weight;
    }
    return OBSTACLE_TYPES[0];
}

function spawnEntity() {
    const isPowerUp = Math.random() < CONFIG.powerUpChance;

    if (isPowerUp) {
        const type = POWERUP_TYPES[Math.floor(Math.random() * POWERUP_TYPES.length)];
        const size = 26;
        entities.push({
            isPowerUp: true,
            kind: type.kind,
            color: type.color,
            glyph: type.glyph,
            x: Math.random() * (canvas.width - size),
            y: -size,
            width: size,
            height: size,
            speed: currentSpeed() * 0.8,
            wobble: Math.random() * Math.PI * 2
        });
        return;
    }

    const type = weightedObstacle();
    const size = type.sizeMin + Math.random() * (type.sizeMax - type.sizeMin);
    entities.push({
        isPowerUp: false,
        kind: type.kind,
        color: type.color,
        x: Math.random() * (canvas.width - size),
        y: -size,
        width: size,
        height: size * (type.heightMul || 1),
        speed: currentSpeed() * type.speedMul,
        zigT: Math.random() * Math.PI * 2,
        zigAmp: 1.5 + Math.random() * 2
    });
}

function currentSpeed() {
    return CONFIG.startSpeed + (level - 1) * CONFIG.speedPerLevel;
}

function spawnInterval() {
    return Math.max(CONFIG.minSpawnFrames, CONFIG.baseSpawnFrames - (level - 1) * 2.4);
}

/* ---------------- Particles ---------------- */

function burst(x, y, color, count = 16) {
    for (let i = 0; i < count; i++) {
        const angle = (Math.PI * 2 * i) / count + Math.random() * 0.5;
        const speed = 1.5 + Math.random() * 3.5;
        particles.push({
            x, y,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            life: 1,
            color,
            size: 2 + Math.random() * 3
        });
    }
}

function updateParticles() {
    particles.forEach((p) => {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.08;
        p.life -= 0.025;
    });
    particles = particles.filter((p) => p.life > 0);
}

function drawParticles() {
    particles.forEach((p) => {
        ctx.globalAlpha = Math.max(p.life, 0);
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
    });
    ctx.globalAlpha = 1;
}

/* ---------------- Background ---------------- */

function initStars() {
    stars = Array.from({ length: 60 }, () => ({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        r: Math.random() * 1.6 + 0.3,
        speed: 0.3 + Math.random() * 1.1
    }));
}
initStars();

function updateStars() {
    stars.forEach((s) => {
        s.y += s.speed * (isSlowMo() ? CONFIG.slowMoFactor : 1);
        if (s.y > canvas.height) {
            s.y = -2;
            s.x = Math.random() * canvas.width;
        }
    });
}

function drawBackground() {
    const grad = ctx.createLinearGradient(0, 0, 0, canvas.height);
    const hue = 210 + level * 4;
    grad.addColorStop(0, `hsl(${hue}, 35%, 8%)`);
    grad.addColorStop(1, `hsl(${hue + 10}, 40%, 4%)`);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = "rgba(255,255,255,0.5)";
    stars.forEach((s) => {
        ctx.globalAlpha = 0.35;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fill();
    });
    ctx.globalAlpha = 1;
}

/* ---------------- Update logic ---------------- */

function isSlowMo() {
    return performance.now() < slowMoUntil;
}
function isShielded() {
    return performance.now() < player.shieldUntil;
}
function isMultiplied() {
    return performance.now() < multiplierUntil;
}

function movePlayer() {
    if (keys["ArrowLeft"] && player.x > 0) player.x -= player.speed;
    if (keys["ArrowRight"] && player.x < canvas.width - player.width) player.x += player.speed;
}

function moveEntities() {
    const factor = isSlowMo() ? CONFIG.slowMoFactor : 1;

    entities.forEach((e) => {
        e.y += e.speed * factor;
        if (e.kind === "zigzag") {
            e.zigT += 0.05;
            e.x += Math.sin(e.zigT) * e.zigAmp * factor;
            e.x = Math.max(0, Math.min(canvas.width - e.width, e.x));
        }
        if (e.isPowerUp) e.wobble += 0.08;
    });

    entities = entities.filter((e) => {
        if (e.y > canvas.height) {
            if (!e.isPowerUp) {
                const gained = isMultiplied() ? 2 : 1;
                score += gained;
                scoreElement.textContent = String(score).padStart(5, "0");
                sfx.score();
                maybeLevelUp();
            }
            return false;
        }
        return true;
    });
}

function maybeLevelUp() {
    const targetLevel = Math.floor(score / CONFIG.scorePerLevel) + 1;
    if (targetLevel > level) {
        level = targetLevel;
        levelElement.textContent = String(level);
        sfx.levelUp();
        flashStatus(`LEVEL ${level}!`);
    }
}

function overlap(a, b) {
    return (
        a.x < b.x + b.width &&
        a.x + a.width > b.x &&
        a.y < b.y + b.height &&
        a.y + a.height > b.y
    );
}

function applyPowerUp(kind) {
    const now = performance.now();
    sfx.powerUp();
    burst(player.x + player.width / 2, player.y + player.height / 2, "#facc15", 20);

    if (kind === "shield") {
        player.shieldUntil = now + CONFIG.shieldDuration;
        flashStatus("SHIELD ACTIVE");
    } else if (kind === "slowmo") {
        slowMoUntil = now + CONFIG.slowMoDuration;
        flashStatus("SLOW-MO!");
    } else if (kind === "multiplier") {
        multiplierUntil = now + CONFIG.multiplierDuration;
        flashStatus("SCORE x2!");
    } else if (kind === "life") {
        lives = Math.min(CONFIG.maxLives, lives + 1);
        livesElement.textContent = "❤".repeat(lives);
        flashStatus("+1 LIFE");
    }
}

let statusTimeout = null;
function flashStatus(text) {
    if (!statusBar) return;
    statusBar.textContent = text;
    statusBar.classList.add("show");
    clearTimeout(statusTimeout);
    statusTimeout = setTimeout(() => statusBar.classList.remove("show"), 1400);
}

function checkNearMisses() {
    const NEAR_MISS_GAP = 16; // px of horizontal daylight that still counts as a close call
    entities.forEach((e) => {
        if (e.isPowerUp || e.nearMissChecked) return;
        const verticallyLevel = e.y + e.height >= player.y && e.y <= player.y + player.height;
        if (!verticallyLevel) return;

        const gapLeft = player.x - (e.x + e.width);   // obstacle passing on player's left
        const gapRight = e.x - (player.x + player.width); // obstacle passing on player's right
        const gap = Math.max(gapLeft, gapRight);

        if (gap >= 0 && gap <= NEAR_MISS_GAP) {
            e.nearMissChecked = true;
            const bonus = 2;
            score += bonus;
            scoreElement.textContent = String(score).padStart(5, "0");
            flashStatus(`NICE DODGE! +${bonus}`);
            burst(e.x + e.width / 2, player.y, "#38bdf8", 8);
        } else if (gap < 0) {
            // will collide or already overlapping — handled elsewhere
            e.nearMissChecked = true;
        }
    });
}

function checkCollisions() {
    checkNearMisses();
    for (const e of entities) {
        if (!overlap(player, e)) continue;

        if (e.isPowerUp) {
            applyPowerUp(e.kind);
            e.y = canvas.height + 999; // remove next filter pass
            continue;
        }

        if (isShielded()) {
            burst(e.x + e.width / 2, e.y + e.height / 2, "#facc15", 10);
            e.y = canvas.height + 999;
            continue;
        }

        if (performance.now() < player.invulnUntil) continue;

        handleHit(e);
        return;
    }
    entities = entities.filter((e) => e.y < canvas.height + 500);
}

function handleHit(e) {
    lives--;
    livesElement.textContent = "❤".repeat(Math.max(lives, 0));
    sfx.hit();
    burst(player.x + player.width / 2, player.y + player.height / 2, "#ef4444", 24);
    shakeUntil = performance.now() + 300;
    shakeMag = 8;

    e.y = canvas.height + 999;

    if (lives <= 0) {
        endGame();
    } else {
        player.invulnUntil = performance.now() + 1400;
        flashStatus(`HIT! ${lives} LIFE${lives === 1 ? "" : "S"} LEFT`);
    }
}

function endGame() {
    gameOver = true;
    running = false;
    stopMusic();
    sfx.gameOver();

    if (score > best) {
        best = score;
        localStorage.setItem(BEST_KEY, String(best));
        bestScoreElement.textContent = String(best).padStart(5, "0");
        gameMessage.textContent = `NEW BEST! Score: ${score} 🏆`;
    } else {
        gameMessage.textContent = `Game Over! Score: ${score}`;
    }
}

/* ---------------- Drawing ---------------- */

function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
}

function drawPlayer() {
    const shielded = isShielded();
    const flicker = performance.now() < player.invulnUntil && Math.floor(performance.now() / 100) % 2 === 0;
    if (flicker) return;

    if (shielded) {
        ctx.save();
        ctx.strokeStyle = "rgba(250, 204, 21, 0.9)";
        ctx.lineWidth = 3;
        ctx.shadowColor = "#facc15";
        ctx.shadowBlur = 14;
        roundRect(player.x - 5, player.y - 5, player.width + 10, player.height + 10, 10);
        ctx.stroke();
        ctx.restore();
    }

    const grad = ctx.createLinearGradient(player.x, player.y, player.x, player.y + player.height);
    grad.addColorStop(0, "#4ade80");
    grad.addColorStop(1, "#15803d");
    ctx.save();
    ctx.shadowColor = "rgba(74, 222, 128, 0.6)";
    ctx.shadowBlur = 10;
    ctx.fillStyle = grad;
    roundRect(player.x, player.y, player.width, player.height, 7);
    ctx.fill();
    ctx.restore();
}

function drawEntities() {
    entities.forEach((e) => {
        if (e.isPowerUp) {
            const bob = Math.sin(e.wobble) * 3;
            ctx.save();
            ctx.shadowColor = e.color;
            ctx.shadowBlur = 12;
            ctx.fillStyle = e.color;
            ctx.beginPath();
            ctx.arc(e.x + e.width / 2, e.y + e.height / 2 + bob, e.width / 2, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
            ctx.fillStyle = "#0b0f14";
            ctx.font = "13px monospace";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText(e.glyph, e.x + e.width / 2, e.y + e.height / 2 + bob + 1);
            return;
        }

        const grad = ctx.createLinearGradient(e.x, e.y, e.x, e.y + e.height);
        grad.addColorStop(0, e.color[0]);
        grad.addColorStop(1, e.color[1]);
        ctx.save();
        ctx.shadowColor = e.color[0];
        ctx.shadowBlur = 8;
        ctx.fillStyle = grad;
        roundRect(e.x, e.y, e.width, e.height, 5);
        ctx.fill();
        ctx.restore();
    });
}

function drawOverlayBadges() {
    const now = performance.now();
    const badges = [];
    if (isShielded()) badges.push({ t: "🛡 SHIELD", ms: player.shieldUntil - now, dur: CONFIG.shieldDuration });
    if (isSlowMo()) badges.push({ t: "⏱ SLOW-MO", ms: slowMoUntil - now, dur: CONFIG.slowMoDuration });
    if (isMultiplied()) badges.push({ t: "x2 SCORE", ms: multiplierUntil - now, dur: CONFIG.multiplierDuration });

    badges.forEach((b, i) => {
        const w = 96, h = 18, x = 10, y = 10 + i * 24;
        ctx.fillStyle = "rgba(0,0,0,0.4)";
        roundRect(x, y, w, h, 4);
        ctx.fill();
        ctx.fillStyle = "#4ade80";
        const pct = Math.max(0, Math.min(1, b.ms / b.dur));
        roundRect(x, y, w * pct, h, 4);
        ctx.fill();
        ctx.fillStyle = "white";
        ctx.font = "10px monospace";
        ctx.textAlign = "left";
        ctx.textBaseline = "middle";
        ctx.fillText(b.t, x + 5, y + h / 2 + 1);
    });
}

function draw() {
    ctx.save();

    if (performance.now() < shakeUntil) {
        const dx = (Math.random() - 0.5) * shakeMag;
        const dy = (Math.random() - 0.5) * shakeMag;
        ctx.translate(dx, dy);
    }

    drawBackground();
    drawParticles();
    drawEntities();
    drawPlayer();
    drawOverlayBadges();

    ctx.restore();
}

/* ---------------- Game loop ---------------- */

function gameLoop() {
    if (!running) return;

    movePlayer();
    moveEntities();
    updateParticles();
    updateStars();
    checkCollisions();

    spawnTimer++;
    if (spawnTimer > spawnInterval()) {
        spawnEntity();
        spawnTimer = 0;
    }

    draw();

    if (running) requestAnimationFrame(gameLoop);
}

function startGame() {
    getAudio(); // unlock audio on first user gesture
    running = true;
    paused = false;
    gameMessage.textContent = "";
    startMusic();
    requestAnimationFrame(gameLoop);
}

function restartGame() {
    player.x = 275;
    player.shieldUntil = 0;
    player.invulnUntil = 0;
    entities = [];
    particles = [];
    score = 0;
    level = 1;
    lives = CONFIG.startLives;
    gameOver = false;
    spawnTimer = 0;
    slowMoUntil = 0;
    multiplierUntil = 0;

    scoreElement.textContent = "00000";
    levelElement.textContent = "1";
    livesElement.textContent = "❤".repeat(lives);
    gameMessage.textContent = "PRESS ← OR → TO START";

    draw();
    startGame();
}

restartBtn.addEventListener("click", restartGame);

/* ---------------- Init ---------------- */

livesElement.textContent = "❤".repeat(lives);
levelElement.textContent = String(level);
draw();
