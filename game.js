/**
 * Toilet vs Poop - Level Based Platformer
 */

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Game Constants
const GRAVITY = 0.6;
const FRICTION = 0.8;
const PLAYER_SPEED = 1;
const JUMP_FORCE = -15;
const TILE_SIZE = 64;

// Game State
// Game State
let gameState = 'START'; // START, PLAYING, LEVEL_COMPLETE, GAMEOVER, WIN
let currentLevel = 1;
const TOTAL_LEVELS = 5;
let score = 0;
let lives = 5;
let animationId = null;
let keys = {};
let frames = 0;
let entities = [];
let particles = [];
let platforms = [];
let gateways = [];
let boss = null;
let camera = { x: 0, y: 0 };
let levelWidth = 4500;
let levelTheme = 'BATHROOM'; // BATHROOM, SEWER, DARK_PIPES

// UI Elements
const uiScore = document.getElementById('score');
const uiHealth = document.getElementById('health');
const uiLives = document.getElementById('lives');
const uiMainMenu = document.getElementById('main-menu');
const uiLevelSelect = document.getElementById('level-select');
const uiGameOver = document.getElementById('game-over-screen');
const uiFinalScore = document.getElementById('final-score');

// Assets
const assets = {
    player: new Image(),
    enemy: new Image(),
    enemyEvil: new Image(),
    boss: new Image(),
    bg: new Image(),
    bgPattern: null,
    pickupHealth: new Image(),
    // New Enemies
    soap: new Image(),
    duckie: new Image(),
    toothbrush: new Image(),
    toiletBrush: new Image(), // New Asset
    // Audio
    sndHitGeneric: new Audio(),
    sndHitSoap: new Audio(),
    sndHitDuckie: new Audio(),
    sndBossActive: new Audio(),
    // Level 4
    toxicPlant: new Image(),
    slime: new Image()
};

let assetsLoaded = 0;
const totalAssets = 11; // Increased count

function loadAssets() {
    assets.player.src = 'assets/player.png';
    assets.enemy.src = 'assets/enemy.png';
    assets.enemyEvil.src = 'assets/enemy_evil.png';
    assets.boss.src = 'assets/boss.png';
    assets.bg.src = 'assets/bg.png';
    assets.pickupHealth.src = 'assets/pickup_health.png';

    // Fallback/Placeholder links or blank if file missing (browser handles 404 gracefully usually, or we can use data uri)
    // For now pointing to what we wanted to generate. 
    // Since generation failed, these will fail to load, so I will handle asset loading error or just rely on fallback drawing in draw().
    assets.soap.src = 'assets/soap.png';
    assets.duckie.src = 'assets/duckie.png';
    assets.toothbrush.src = 'assets/toothbrush.png';
    assets.toiletBrush.src = 'assets/toilet_brush.png'; // Placeholder path

    // Audio Sources (Placeholders)
    assets.sndHitGeneric.src = 'assets/hit_generic.mp3';
    assets.sndHitSoap.src = 'assets/hit_soap.mp3';
    assets.sndHitDuckie.src = 'assets/hit_duckie.mp3';
    assets.sndBossActive.src = 'assets/boss_active.mp3';

    assets.toxicPlant.src = 'assets/toxic_plant.png'; // Placeholder
    assets.slime.src = 'assets/slime.png'; // Placeholder

    const images = [
        assets.player, assets.enemy, assets.enemyEvil, assets.boss, assets.bg, assets.pickupHealth,
        assets.soap, assets.duckie, assets.toothbrush, assets.toxicPlant, assets.slime
    ];

    images.forEach(img => {
        img.onload = () => {
            assetsLoaded++;
            if (assetsLoaded === totalAssets) {
                assets.bgPattern = ctx.createPattern(assets.bg, 'repeat');
                console.log('All assets loaded');
            }
        };
        // Add onerror to avoid stuck loading
        img.onerror = () => {
            assetsLoaded++;
            console.log('Asset failed to load, proceeding anyway');
            if (assetsLoaded === totalAssets) {
                if (assets.bg.complete && assets.bg.naturalWidth !== 0) {
                    assets.bgPattern = ctx.createPattern(assets.bg, 'repeat');
                }
            }
        };
    });
}

// Setup Canvas
function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}
window.addEventListener('resize', resize);
resize();

// Input
window.addEventListener('keydown', (e) => {
    keys[e.code] = true;
    // Removed direct start from keydown for 'START' state
    if (gameState === 'GAMEOVER' && e.code === 'Space') {
        showMainMenu();
    }
    if (gameState === 'WIN' && e.code === 'Space') {
        showMainMenu();
    }
    if (gameState === 'LEVEL_COMPLETE' && e.code === 'Space') {
        currentLevel++;
        startGame();
    }
    if (gameState === 'PLAYING' && (e.code === 'KeyZ' || e.code === 'Click')) player.shoot();
    if (gameState === 'PLAYING' && e.code === 'KeyX') player.meleeAttack(); // Secondary Attack
    if (gameState === 'PLAYING' && (e.code === 'ArrowDown' || e.code === 'KeyS')) checkGatewayInteraction();
});
window.addEventListener('keyup', (e) => keys[e.code] = false);
window.addEventListener('mousedown', () => {
    if (gameState === 'PLAYING') player.shoot();
});

// Utility
function checkCollision(rect1, rect2) {
    return (
        rect1.x < rect2.x + rect2.width &&
        rect1.x + rect1.width > rect2.x &&
        rect1.y < rect2.y + rect2.height &&
        rect1.height + rect1.y > rect2.y
    );
}

// ------------------------------
// Classes
// ------------------------------

class Player {
    constructor() {
        this.width = 64;
        this.height = 64;
        this.x = 100;
        this.y = canvas.height - 300;
        this.vx = 0;
        this.vy = 0;
        this.health = 100;
        this.grounded = false;
        this.jumpCount = 0; // Double Jump
        this.powerUpTimer = 0;
        this.powerups = { spread: false, piercing: false };
        this.facingRight = true;
        this.meleeTimer = 0; // Visual timer
        this.meleeCooldown = 0; // Usage logic timer
        this.shield = 0; // Soap Shield HP
        this.shieldHitCooldown = 0; // Invincibility frames for shield
    }

    update() {
        // Input
        if (keys['ArrowRight'] || keys['KeyD']) {
            this.vx += PLAYER_SPEED;
            this.facingRight = true;
        }
        if (keys['ArrowLeft'] || keys['KeyA']) {
            this.vx -= PLAYER_SPEED;
            this.facingRight = false;
        }

        // Jump Logic (Double Jump)
        if (keys['Space'] || keys['ArrowUp'] || keys['KeyW']) {
            if (!this.jumpKeyHeld) {
                if (this.grounded) {
                    this.vy = JUMP_FORCE;
                    this.grounded = false;
                    this.jumpCount = 1;
                    this.jumpKeyHeld = true;
                } else if (this.jumpCount < 2) {
                    this.vy = JUMP_FORCE;
                    this.jumpCount++;
                    this.jumpKeyHeld = true;
                }
            }
        } else {
            this.jumpKeyHeld = false;
        }

        // Physics
        this.vx *= FRICTION;
        this.vy += GRAVITY;
        this.x += this.vx;
        this.y += this.vy;

        // Level Bounds
        if (this.x < 0) this.x = 0;
        if (this.x > levelWidth - this.width) this.x = levelWidth - this.width;

        // Platform Collision
        this.grounded = false;

        // Check Platforms
        for (let plat of platforms) {
            // Simple AABB for checking if inside
            if (checkCollision(this, plat)) {
                // Determine side of collision

                // Landing on top
                if (this.vy > 0 && this.y + this.height - this.vy <= plat.y + this.vy * 2) {
                    this.y = plat.y - this.height;
                    this.vy = 0;
                    this.grounded = true;
                    this.jumpCount = 0; // Reset Jump
                }
                // Hitting head
                else if (this.vy < 0 && this.y - this.vy >= plat.y + plat.height) {
                    this.y = plat.y + plat.height;
                    this.vy = 0;
                }
                // Hitting side
                else if (this.vx > 0 && this.x + this.width - this.vx <= plat.x) {
                    this.x = plat.x - this.width;
                    this.vx = 0;
                }
                else if (this.vx < 0 && this.x - this.vx >= plat.x + plat.width) {
                    this.x = plat.x + plat.width;
                    this.vx = 0;
                }
            }
        }

        // Pit Death
        if (this.y > canvas.height + 100) {
            this.health = 0;
        }



        // Melee Timers
        if (this.meleeTimer > 0) this.meleeTimer--;
        if (this.meleeCooldown > 0) this.meleeCooldown--;
        if (this.shieldHitCooldown > 0) this.shieldHitCooldown--;

        // Camera Follow
        let targetCamX = this.x - canvas.width / 3;
        if (targetCamX < 0) targetCamX = 0;
        if (targetCamX > levelWidth - canvas.width) targetCamX = levelWidth - canvas.width;

        camera.x += (targetCamX - camera.x) * 0.1;

        // Vertical Camera Follow
        let targetCamY = this.y - canvas.height / 2;
        // Optional: Clamp camera.y if we want a floor, but for secret areas it's better to be free
        camera.y += (targetCamY - camera.y) * 0.05; // Slightly slower vertical follow
    }

    draw() {
        const drawX = this.x - camera.x;
        const drawY = this.y - camera.y;

        if (assetsLoaded === totalAssets) {
            ctx.save();
            // Hands logic
            const handX = 50;
            const handY = 40;

            if (!this.facingRight) {
                ctx.translate(drawX + this.width, drawY);
                ctx.scale(-1, 1);
                ctx.drawImage(assets.player, 0, 0, this.width, this.height);

                // Draw Melee (Attached to hand)
                if (this.meleeTimer > 0) {
                    ctx.save();
                    ctx.translate(handX, handY); // Pivot at hand
                    let angle = -Math.PI / 4 + (10 - this.meleeTimer) * 0.2;
                    ctx.rotate(angle);
                    if (assets.toiletBrush.complete && assets.toiletBrush.naturalWidth !== 0) {
                        ctx.drawImage(assets.toiletBrush, -10, -50, 40, 80);
                    } else {
                        ctx.fillStyle = '#bdc3c7'; // Silver handle
                        ctx.fillRect(0, 0, 10, 60);
                        ctx.fillStyle = '#3498db'; // Blue bristles
                        ctx.fillRect(-10, 0, 30, 20);
                    }
                    ctx.restore();
                }

                // Draw Hands
                ctx.fillStyle = 'white';
                ctx.beginPath();
                ctx.arc(handX, handY, 8, 0, Math.PI * 2); // Main Hand
                ctx.fill();
                ctx.beginPath();
                ctx.arc(20, 45, 8, 0, Math.PI * 2); // Off Hand
                ctx.fill();

            } else {
                ctx.drawImage(assets.player, drawX, drawY, this.width, this.height);

                // Draw Melee (Attached to hand)
                if (this.meleeTimer > 0) {
                    ctx.save();
                    ctx.translate(drawX + handX, drawY + handY); // Pivot at hand
                    let angle = Math.PI / 4 - (10 - this.meleeTimer) * 0.2;
                    ctx.rotate(angle);
                    if (assets.toiletBrush.complete && assets.toiletBrush.naturalWidth !== 0) {
                        ctx.drawImage(assets.toiletBrush, -30, -50, 40, 80);
                    } else {
                        ctx.fillStyle = '#bdc3c7';
                        ctx.fillRect(0, 0, 10, 60);
                        ctx.fillStyle = '#3498db';
                        ctx.fillRect(-10, 0, 30, 20);
                    }
                    ctx.restore();
                }

                // Draw Hands
                ctx.fillStyle = 'white';
                ctx.beginPath();
                ctx.arc(drawX + handX, drawY + handY, 8, 0, Math.PI * 2); // Main Hand
                ctx.fill();
                ctx.beginPath();
                ctx.arc(drawX + 20, drawY + 45, 8, 0, Math.PI * 2); // Off Hand
                ctx.fill();
            }
            ctx.restore();
        } else {
            ctx.fillStyle = 'white';
            ctx.fillRect(drawX, drawY, this.width, this.height);
        }

        if (this.powerups.spread) {
            ctx.fillStyle = 'yellow';
            ctx.beginPath();
            ctx.arc(drawX + this.width / 2, drawY - 10, 5, 0, Math.PI * 2);
            ctx.fill();
        }
        if (this.powerups.piercing) {
            ctx.fillStyle = 'gold';
            ctx.beginPath();
            ctx.arc(drawX + this.width / 2, drawY - 20, 5, 0, Math.PI * 2);
            ctx.fill();
        }

        // Draw Soap Shield Bubble
        if (this.shield > 0) {
            // Blink if in cooldown
            if (this.shieldHitCooldown > 0 && frames % 4 < 2) {
                // Skip drawing or draw lighter to show hit
            } else {
                ctx.save();
                ctx.beginPath();
                let pulse = Math.sin(frames * 0.1) * 5;
                ctx.arc(drawX + this.width / 2, drawY + this.height / 2, (this.width / 2) + 15 + pulse, 0, Math.PI * 2);
                ctx.fillStyle = 'rgba(173, 216, 230, 0.4)'; // Translucent Light Blue
                ctx.fill();
                ctx.strokeStyle = '#00a8ff';
                ctx.lineWidth = 2 + (this.shield * 1); // Get thicker with more HP
                ctx.stroke();

                // Sparkles
                for (let i = 0; i < this.shield; i++) {
                    ctx.fillStyle = 'white';
                    let sa = (frames * 0.05) + (i * Math.PI * 2 / 3);
                    let sx = (drawX + this.width / 2) + Math.cos(sa) * (this.width / 2 + 15);
                    let sy = (drawY + this.height / 2) + Math.sin(sa) * (this.width / 2 + 15);
                    ctx.fillRect(sx - 2, sy - 2, 4, 4);
                }
                ctx.restore();
            }
        }
    }

    shoot() {
        let dir = this.facingRight ? 1 : -1;
        // Hand position relative to sprite is roughly 50, 40
        let handOffsetX = 50;
        let handOffsetY = 40;

        let startX = this.facingRight ? this.x + handOffsetX : this.x + (this.width - handOffsetX);
        let startY = this.y + handOffsetY;

        const createProjectile = (vx, vy) => {
            let p = new Projectile(startX, startY, vx, vy);
            if (this.powerups.piercing) {
                p.isPiercing = true;
                p.color = 'gold';
                p.radius = 12;
            }
            entities.push(p);
        };

        if (this.powerups.spread) {
            createProjectile(12 * dir, -2);
            createProjectile(12 * dir, 0);
            createProjectile(12 * dir, 2);
        } else {
            createProjectile(15 * dir, 0);
        }
    }

    heal(amount) {
        this.health += amount;
        if (this.health > 100) this.health = 100;
    }

    meleeAttack() {
        if (this.meleeCooldown > 0) return;

        this.meleeTimer = 15; // Visual duration
        this.meleeCooldown = 20; // 0.33s cooldown (Buffed from 30)

        let range = 150; // Buffed from 100
        let damage = 10; // Buffed from 4.5

        // Hitbox center
        let cx = this.facingRight ? this.x + this.width + range / 2 : this.x - range / 2;
        let cy = this.y + this.height / 2;

        let hitRect = {
            x: this.facingRight ? this.x + this.width : this.x - range,
            y: this.y,
            width: range,
            height: this.height
        };

        // Check collisions immediately (Hitscan-ish)
        let hit = false;

        // Enemies
        entities.forEach(e => {
            if (e instanceof Enemy || e instanceof SoapEnemy || e instanceof DuckieEnemy || e instanceof ToothbrushEnemy || e instanceof ToxicPlantEnemy || e instanceof SlimeEnemy) {
                if (checkCollision(hitRect, e)) {
                    e.hp -= damage;
                    createExplosion(e.x + e.width / 2, e.y + e.height / 2, 'blue', 5); // Brush particles
                    hit = true;

                    if (e.hp <= 0) {
                        e.markedForDeletion = true;
                        score += e.scoreValue || 100;
                        createExplosion(e.x + e.width / 2, e.y + e.height / 2, 'brown');
                    }
                }
            }
        });

        // Boss
        if (boss && boss.state === 'FIGHTING') {
            if (checkCollision(hitRect, boss)) {
                boss.hp -= damage;
                createExplosion(boss.x + boss.width / 2, boss.y + boss.height / 2, 'blue', 5);
                hit = true;

                if (boss.hp <= 0) {
                    boss.markedForDeletion = true;
                    createExplosion(boss.x + boss.width / 2, boss.y + boss.height / 2, 'gold', 100);

                    if (currentLevel < TOTAL_LEVELS) {
                        gameState = 'LEVEL_COMPLETE';
                        score += 1000;
                    } else {
                        score += 5000;
                        gameState = 'WIN';
                    }
                    boss = null;
                }
            }
        }

        if (hit) cameraShake();
    }
}

class Projectile {
    constructor(x, y, vx, vy, isEnemy = false) {
        this.x = x;
        this.y = y;
        this.vx = vx;
        this.vy = vy;
        this.radius = 8;
        this.color = isEnemy ? 'brown' : '#00a8ff';
        this.markedForDeletion = false;
        this.isEnemy = isEnemy;
        this.isPiercing = false;
        this.hitEnemies = new Set(); // To prevent multi-hitting the same enemy with piercing
    }

    update() {
        this.x += this.vx;
        this.y += this.vy;

        if (this.x < camera.x - 100 || this.x > camera.x + canvas.width + 100 || this.y > canvas.height + 100) {
            this.markedForDeletion = true;
        }

        for (let plat of platforms) {
            if (this.x > plat.x && this.x < plat.x + plat.width &&
                this.y > plat.y && this.y < plat.y + plat.height) {
                this.markedForDeletion = true;
                createExplosion(this.x, this.y, 'gray', 3);
            }
        }
    }

    draw() {
        ctx.fillStyle = this.color;

        if (this.isPiercing) {
            // Gold shadow/glow
            ctx.shadowBlur = 15;
            ctx.shadowColor = 'gold';
        }

        ctx.beginPath();
        ctx.arc(this.x - camera.x, this.y - camera.y, this.radius, 0, Math.PI * 2);
        ctx.fill();

        ctx.shadowBlur = 0; // Reset
    }
}

class Enemy {
    constructor(x, y, isEvil = false) {
        this.width = 64;
        this.height = 64;
        this.x = x;
        this.y = y;
        this.homeX = x;
        this.moveRange = 200;
        this.speed = isEvil ? 4 : 2;
        this.vx = this.speed;
        this.markedForDeletion = false;
        this.isEvil = isEvil;
        this.hp = isEvil ? 3 : 1;
        this.facingRight = true;
        this.scoreValue = isEvil ? 200 : 100;
    }

    update() {
        this.x += this.vx;
        if (this.x > this.homeX + this.moveRange) {
            this.vx = -this.speed;
            this.facingRight = false;
        }
        if (this.x < this.homeX - this.moveRange) {
            this.vx = this.speed;
            this.facingRight = true;
        }
    }

    draw() {
        const drawX = this.x - camera.x;
        const drawY = this.y - camera.y;
        if (drawX < -100 || drawX > canvas.width + 100) return;

        if (this.isEvil) {
            // Draw Evil
            if (assets.enemyEvil.complete && assets.enemyEvil.naturalWidth !== 0) {
                ctx.save();
                if (!this.facingRight) {
                    ctx.translate(drawX + this.width, drawY);
                    ctx.scale(-1, 1);
                    ctx.drawImage(assets.enemyEvil, 0, 0, this.width, this.height);
                } else {
                    ctx.drawImage(assets.enemyEvil, drawX, drawY, this.width, this.height);
                }
                ctx.restore();
            } else {
                ctx.fillStyle = '#440000';
                ctx.fillRect(drawX, drawY, this.width, this.height);
            }
        } else {
            // Draw Normal
            if (assets.enemy.complete && assets.enemy.naturalWidth !== 0) {
                ctx.save();
                if (!this.facingRight) {
                    ctx.translate(drawX + this.width, drawY);
                    ctx.scale(-1, 1);
                    ctx.drawImage(assets.enemy, 0, 0, this.width, this.height);
                } else {
                    ctx.drawImage(assets.enemy, drawX, drawY, this.width, this.height);
                }
                ctx.restore();
            } else {
                ctx.fillStyle = 'brown';
                ctx.fillRect(drawX, drawY, this.width, this.height);
            }
        }
    }
}

class SoapEnemy {
    constructor(x, y) {
        this.width = 48;
        this.height = 48;
        this.x = x;
        this.y = y;
        this.initialY = y;
        this.vx = -3;
        this.hp = 1;
        this.angle = 0;
        this.markedForDeletion = false;
        this.isEvil = false; // For score calc
        this.scoreValue = 300;
    }

    update() {
        this.x += this.vx;
        this.angle += 0.1;
        this.y = this.initialY + Math.sin(this.angle) * 50;

        if (this.x < camera.x - 200) this.markedForDeletion = true; // Despawn if too far left
    }

    draw() {
        const drawX = this.x - camera.x;
        const drawY = this.y - camera.y;
        if (drawX < -100 || drawX > canvas.width + 100) return;

        if (assets.soap && assets.soap.complete && assets.soap.naturalWidth !== 0) {
            ctx.drawImage(assets.soap, drawX, drawY, this.width, this.height);
        } else {
            ctx.fillStyle = 'pink';
            ctx.fillRect(drawX, drawY, this.width, this.height);
            ctx.fillStyle = 'white';
            ctx.font = '12px Arial';
            ctx.fillText("SOAP", drawX, drawY + 20);
        }
    }
}

class DuckieEnemy {
    constructor(x, y) {
        this.width = 64;
        this.height = 64;
        this.x = x;
        this.y = y;
        this.hp = 3;
        this.attackTimer = 0;
        this.markedForDeletion = false;
        this.isEvil = true;
        this.scoreValue = 400;
    }

    update() {
        // Shoots bubbles
        if (this.x - camera.x < canvas.width && this.x - camera.x > 0) {
            this.attackTimer++;
            if (this.attackTimer > 120) {
                let dir = (player.x < this.x) ? -1 : 1;
                let bubble = new Projectile(this.x + this.width / 2, this.y + this.height / 2, 5 * dir, 0, true);
                bubble.color = 'rgba(255,255,255,0.7)'; // Bubble color
                bubble.radius = 12;
                entities.push(bubble);
                this.attackTimer = 0;
            }
        }
    }

    draw() {
        const drawX = this.x - camera.x;
        const drawY = this.y - camera.y;
        if (drawX < -100 || drawX > canvas.width + 100) return;

        if (assets.duckie && assets.duckie.complete && assets.duckie.naturalWidth !== 0) {
            ctx.drawImage(assets.duckie, drawX, drawY, this.width, this.height);
        } else {
            ctx.fillStyle = 'yellow';
            ctx.fillRect(drawX, drawY, this.width, this.height);
            ctx.fillStyle = 'orange';
            ctx.fillRect(drawX + 40, drawY + 20, 20, 10); // Beak
        }
    }
}

class ToothbrushEnemy {
    constructor(x, y) {
        this.width = 30;
        this.height = 90;
        this.x = x;
        this.y = y;
        this.homeX = x;
        this.moveRange = 300;
        this.speed = 6; // Fast
        this.vx = this.speed;
        this.hp = 2;
        this.markedForDeletion = false;
        this.facingRight = true;
        this.isEvil = true;
        this.scoreValue = 500;
    }

    update() {
        this.x += this.vx;
        if (this.x > this.homeX + this.moveRange) {
            this.vx = -this.speed;
            this.facingRight = false;
        }
        if (this.x < this.homeX - this.moveRange) {
            this.vx = this.speed;
            this.facingRight = true;
        }
    }

    draw() {
        const drawX = this.x - camera.x;
        const drawY = this.y - camera.y;
        if (drawX < -100 || drawX > canvas.width + 100) return;

        if (assets.toothbrush && assets.toothbrush.complete && assets.toothbrush.naturalWidth !== 0) {
            ctx.save();
            if (!this.facingRight) {
                ctx.translate(drawX + this.width, drawY);
                ctx.scale(-1, 1);
                ctx.drawImage(assets.toothbrush, 0, 0, this.width, this.height);
            } else {
                ctx.drawImage(assets.toothbrush, drawX, drawY, this.width, this.height);
            }
            ctx.restore();
        } else {
            ctx.fillStyle = 'blue';
            ctx.fillRect(drawX, drawY, this.width, this.height);
            ctx.fillStyle = 'white';
            ctx.fillRect(drawX, drawY, this.width, 20); // Bristles
        }
    }
}

class ToxicPlantEnemy {
    constructor(x, y) {
        this.width = 64;
        this.height = 80;
        this.x = x;
        this.y = y;
        this.hp = 30; // Tanky
        this.markedForDeletion = false;
        this.shootTimer = 0;
        this.scoreValue = 600;
    }

    update() {
        this.shootTimer++;
        if (this.shootTimer > 120) { // Shoot every 2s
            // Only shoot if on screen
            if (this.x - camera.x > -100 && this.x - camera.x < canvas.width + 100) {
                // Aim at player
                let dx = (player.x + player.width / 2) - (this.x + this.width / 2);
                let dy = (player.y + player.height / 2) - (this.y + 20); // Sprout height
                let dist = Math.sqrt(dx * dx + dy * dy);
                if (dist < 800) {
                    let speed = 8;
                    let velX = (dx / dist) * speed;
                    let velY = (dy / dist) * speed;

                    let p = new Projectile(this.x + this.width / 2, this.y + 20, velX, velY);
                    p.isEnemy = true;
                    p.color = '#8e44ad'; // Purple spore
                    entities.push(p);
                }
            }
            this.shootTimer = 0;
        }
    }

    draw() {
        const drawX = this.x - camera.x;
        const drawY = this.y - camera.y;
        if (drawX + this.width < 0 || drawX > canvas.width) return;

        if (assets.toxicPlant.complete && assets.toxicPlant.naturalWidth !== 0) {
            ctx.drawImage(assets.toxicPlant, drawX, drawY, this.width, this.height);
        } else {
            // Fallback
            ctx.fillStyle = '#27ae60';
            ctx.fillRect(drawX + 10, drawY + 20, 44, 60); // Stem
            ctx.fillStyle = '#e74c3c';
            ctx.beginPath();
            ctx.arc(drawX + 32, drawY + 20, 20, 0, Math.PI * 2); // Head
            ctx.fill();
        }
    }
}

class SlimeEnemy {
    constructor(x, y) {
        this.width = 48;
        this.height = 32;
        this.x = x;
        this.y = y;
        this.vx = -2;
        this.vy = 0;
        this.hp = 10; // Weak
        this.markedForDeletion = false;
        this.grounded = false;
        this.jumpTimer = Math.random() * 100;
        this.baseY = y; // To try and return/stay on platform
        this.scoreValue = 200;
    }

    update() {
        this.x += this.vx;
        this.y += this.vy;
        this.vy += GRAVITY;

        // Patrol turn
        // Simple logic for now: turn on timers or collision (handled in checkCollisions sort of)
        // Let's just bounce back and forth on a timer or distance for simplicity or reuse basic Enemy logic
        // For now, let's keep it simple: jumping is the main feature

        this.grounded = false;
        for (let plat of platforms) {
            if (checkCollision(this, plat)) {
                if (this.vy > 0 && this.y + this.height - this.vy <= plat.y + this.vy * 2) {
                    this.y = plat.y - this.height;
                    this.vy = 0;
                    this.grounded = true;
                } else if (this.vx < 0 && this.x - this.vx >= plat.x + plat.width) {
                    this.x = plat.x + plat.width;
                    this.vx = 2;
                } else if (this.vx > 0 && this.x + this.width - this.vx <= plat.x) {
                    this.x = plat.x - this.width;
                    this.vx = -2;
                }
            }
        }

        // Random Jumps from Ground
        if (this.grounded) {
            this.jumpTimer++;
            if (this.jumpTimer > 100) {
                this.vy = -12;
                this.grounded = false;
                this.jumpTimer = 0;
            }
        }
    }

    draw() {
        const drawX = this.x - camera.x;
        const drawY = this.y - camera.y;
        if (drawX + this.width < 0 || drawX > canvas.width) return;

        if (assets.slime.complete && assets.slime.naturalWidth !== 0) {
            ctx.drawImage(assets.slime, drawX, drawY, this.width, this.height);
        } else {
            ctx.fillStyle = '#00ff00'; // Lime
            ctx.beginPath();
            ctx.arc(drawX + this.width / 2, drawY + this.height / 2, this.width / 2, Math.PI, 0);
            ctx.lineTo(drawX + this.width, drawY + this.height);
            ctx.lineTo(drawX, drawY + this.height);
            ctx.fill();
        }
    }
}

class Boss {
    constructor() {
        this.width = 256;
        this.height = 256;
        this.x = 3600; // Adjusted for new level length
        this.y = canvas.height - 100 - this.height;
        this.hp = 100;
        this.maxHp = 100;
        this.state = 'WAITING'; // WAITING, FIGHTING
        this.attackTimer = 0;
        this.markedForDeletion = false;
        this.angle = 0;
    }

    update() {
        // Activate earlier
        if (this.state === 'WAITING' && camera.x > this.x - 1200) {
            this.state = 'FIGHTING';
            playSound('BOSS_ACTIVE');
        }

        if (this.state === 'FIGHTING') {
            this.angle += 0.05;
            this.y = (canvas.height - 100 - this.height) + Math.sin(this.angle) * 50;

            this.attackTimer++;
            if (this.attackTimer > 80) {
                this.attack();
                this.attackTimer = 0;
            }
        }
    }

    attack() {
        let dx = (player.x + player.width / 2) - (this.x + this.width / 2);
        let dy = (player.y + player.height / 2) - (this.y + this.height / 2);
        let angle = Math.atan2(dy, dx);
        let speed = 8;
        let vx = Math.cos(angle) * speed;
        let vy = Math.sin(angle) * speed;

        let proj = new Projectile(this.x + this.width / 2, this.y + this.height / 2, vx, vy, true);
        proj.radius = 20;
        entities.push(proj);
    }

    draw() {
        const drawX = this.x - camera.x;
        const drawY = this.y - camera.y;
        if (assetsLoaded === totalAssets) {
            ctx.drawImage(assets.boss, drawX, drawY, this.width, this.height);
        } else {
            ctx.fillStyle = 'red';
            ctx.fillRect(drawX, drawY, this.width, this.height);
        }

        if (this.state === 'FIGHTING') {
            const barWidth = 400;
            const barHeight = 20;
            const barX = (canvas.width - barWidth) / 2;
            const barY = 50;

            ctx.fillStyle = 'black';
            ctx.fillRect(barX, barY, barWidth, barHeight);
            ctx.fillStyle = 'red';
            ctx.fillRect(barX, barY, barWidth * (this.hp / this.maxHp), barHeight);

            ctx.fillStyle = 'white';
            ctx.font = '20px Courier New';
            ctx.fillText("KING POOP", barX, barY - 10);
        }
    }
}

class Pickup {
    constructor(x, y, type) {
        this.x = x;
        this.y = y;
        this.type = type;
        this.width = 48;
        this.height = 48;
        this.markedForDeletion = false;
        this.bobOffset = Math.random() * 100;
    }

    update() {
        this.y += Math.sin((frames + this.bobOffset) * 0.1) * 0.5;
    }

    draw() {
        const drawX = this.x - camera.x;
        const drawY = this.y - camera.y;
        if (this.type === 'HEALTH') {
            if (assetsLoaded === totalAssets) {
                ctx.drawImage(assets.pickupHealth, drawX, drawY, this.width, this.height);
            } else {
                ctx.fillStyle = 'white';
                ctx.fillRect(drawX, drawY, this.width, this.height);
            }
        } else if (this.type === 'PLUNGER') {
            ctx.save();
            ctx.translate(drawX + this.width / 2, drawY + this.height / 2);
            ctx.rotate(-Math.PI / 4);
            ctx.fillStyle = '#8B4513';
            ctx.fillRect(-5, -20, 10, 40);
            ctx.fillStyle = '#b71540';
            ctx.beginPath();
            ctx.arc(0, -20, 15, 0, Math.PI, true);
            ctx.fill();
            ctx.restore();
        } else if (this.type === 'SOAP_SHIELD') {
            // Draw a shiny bar of soap
            ctx.fillStyle = '#f1f2f6'; // Soap color
            ctx.strokeStyle = '#00a8ff';
            ctx.lineWidth = 3;
            ctx.beginPath();
            if (ctx.roundRect) {
                ctx.roundRect(drawX, drawY + 10, this.width, 28, 8);
            } else {
                ctx.rect(drawX, drawY + 10, this.width, 28);
            }
            ctx.fill();
            ctx.stroke();

            // Bubbles popping off it
            ctx.fillStyle = 'white';
            let bx = drawX + Math.sin(frames * 0.2) * 20 + 20;
            let by = drawY + Math.cos(frames * 0.2) * 5;
            ctx.beginPath();
            ctx.arc(bx, by, 5, 0, Math.PI * 2);
            ctx.fill();
        } else if (this.type === 'GOLD_PLUNGER') {
            // Draw a shiny golden plunger
            ctx.save();
            ctx.translate(drawX + this.width / 2, drawY + this.height / 2);
            ctx.rotate(-Math.PI / 4);

            // Glow
            ctx.shadowBlur = 10;
            ctx.shadowColor = 'gold';

            // Handle
            ctx.fillStyle = '#f1c40f'; // Gold handle
            ctx.fillRect(-5, -20, 10, 40);

            // Cup
            ctx.fillStyle = '#e67e22'; // Darker orange/gold cup
            ctx.beginPath();
            ctx.arc(0, -20, 15, 0, Math.PI, true);
            ctx.fill();

            ctx.restore();
        }
    }
}

class Platform {
    constructor(x, y, w, h) {
        this.x = x;
        this.y = y;
        this.width = w;
        this.height = h;
    }

    draw() {
        const drawX = this.x - camera.x;
        const drawY = this.y - camera.y;
        if (drawX + this.width < 0 || drawX > canvas.width) return;

        // Theme colors
        let gradientTop = '#dfe6e9';
        let gradientBottom = '#b2bec3';
        let borderColor = '#636e72';

        if (levelTheme === 'SEWER') {
            gradientTop = '#95a5a6'; // Cement Grey
            gradientBottom = '#7f8c8d'; // Darker Cement
            borderColor = '#2c3e50'; // Charcoal Border
        } else if (levelTheme === 'DARK_PIPES') {
            gradientTop = '#fab1a0';
            gradientBottom = '#e17055';
            borderColor = '#d63031';
        } else if (levelTheme === 'TOXIC') {
            gradientTop = '#bef3db';
            gradientBottom = '#2ecc71';
            borderColor = '#27ae60';
        } else if (levelTheme === 'VOID') {
            gradientTop = '#a29bfe';
            gradientBottom = '#6c5ce7';
            borderColor = '#a29bfe';
        }

        ctx.save();

        // Gradient Fill
        let grd = ctx.createLinearGradient(0, drawY, 0, drawY + this.height);
        grd.addColorStop(0, gradientTop);
        grd.addColorStop(1, gradientBottom);

        ctx.fillStyle = grd;
        ctx.strokeStyle = borderColor;
        ctx.lineWidth = 4;

        ctx.beginPath();
        if (ctx.roundRect) {
            ctx.roundRect(drawX, drawY, this.width, this.height, 15);
        } else {
            // Polyfill-ish fallback
            ctx.rect(drawX, drawY, this.width, this.height);
        }
        ctx.fill();
        ctx.stroke();

        // Inner highlight for 3D feel
        ctx.strokeStyle = 'rgba(255,255,255,0.3)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        if (ctx.roundRect) {
            ctx.roundRect(drawX + 5, drawY + 5, this.width - 10, this.height - 10, 10);
        } else {
            ctx.rect(drawX + 5, drawY + 5, this.width - 10, this.height - 10);
        }
        ctx.stroke();

        // Cement Brick Pattern for Sewer
        if (levelTheme === 'SEWER') {
            ctx.strokeStyle = 'rgba(0,0,0,0.15)';
            ctx.lineWidth = 2;
            // Horizontal lines
            for (let ly = 40; ly < this.height; ly += 40) {
                ctx.beginPath();
                ctx.moveTo(drawX + 5, drawY + ly);
                ctx.lineTo(drawX + this.width - 5, drawY + ly);
                ctx.stroke();
            }
            // Vertical lines (staggered)
            for (let ly = 0; ly < this.height; ly += 40) {
                let offset = (ly / 40) % 2 === 0 ? 0 : 40;
                for (let lx = offset; lx < this.width; lx += 80) {
                    if (lx > 0 && lx < this.width) {
                        ctx.beginPath();
                        ctx.moveTo(drawX + lx, drawY + ly);
                        ctx.lineTo(drawX + lx, drawY + ly + 40);
                        ctx.stroke();
                    }
                }
            }
        }

        ctx.restore();
    }
}

class Decoration {
    constructor(x, y, type) {
        this.x = x;
        this.y = y;
        this.type = type;
        this.width = 100;
        this.height = 100;
    }

    draw() {
        const drawX = this.x - camera.x;
        const drawY = this.y - camera.y;
        if (drawX + this.width < 0 || drawX > canvas.width) return;

        ctx.save();
        ctx.translate(drawX, drawY);

        if (this.type === 'SHOWER') {
            ctx.fillStyle = '#b2bec3';
            ctx.fillRect(20, 0, 60, 10);
            ctx.fillStyle = '#636e72';
            ctx.beginPath();
            ctx.arc(50, 20, 15, 0, Math.PI, false);
            ctx.fill();

            ctx.fillStyle = 'rgba(0, 168, 255, 0.5)';
            if (frames % 20 < 10) {
                ctx.fillRect(40, 30, 5, 50);
                ctx.fillRect(55, 30, 5, 50);
            } else {
                ctx.fillRect(40, 40, 5, 50);
                ctx.fillRect(55, 40, 5, 50);
            }
        }
        else if (this.type === 'SINK') {
            ctx.fillStyle = '#dfe6e9';
            ctx.fillRect(10, 0, 80, 50);
            ctx.strokeStyle = '#b2bec3';
            ctx.strokeRect(10, 0, 80, 50);

            ctx.fillStyle = 'white';
            ctx.beginPath();
            ctx.arc(30, 60, 20, 0, Math.PI, false);
            ctx.fill();
            ctx.beginPath();
            ctx.arc(70, 60, 20, 0, Math.PI, false);
            ctx.fill();

            ctx.fillStyle = '#636e72';
            ctx.fillRect(25, 40, 10, 10);
            ctx.fillRect(65, 40, 10, 10);
        }
        else if (this.type === 'MIRROR') {
            ctx.fillStyle = '#74b9ff';
            ctx.fillRect(0, 0, 80, 100);
            ctx.lineWidth = 5;
            ctx.strokeStyle = 'white';
            ctx.strokeRect(0, 0, 80, 100);

            ctx.fillStyle = 'rgba(255,255,255,0.3)';
            ctx.beginPath();
            ctx.moveTo(10, 80);
            ctx.lineTo(30, 10);
            ctx.lineTo(50, 10);
            ctx.lineTo(30, 80);
            ctx.fill();
        }

        ctx.restore();
    }
}

class Gateway {
    constructor(x, y, destX, destY) {
        this.x = x;
        this.y = y;
        this.width = 100;
        this.height = 100;
        this.destX = destX;
        this.destY = destY;
        this.type = 'PIPE';
    }

    draw() {
        const drawX = this.x - camera.x;
        const drawY = this.y - camera.y;
        if (drawX + this.width < 0 || drawX > canvas.width) return;

        ctx.fillStyle = '#2d3436';
        ctx.strokeStyle = '#00cec9'; // Sewer neon style
        ctx.lineWidth = 4;
        ctx.fillRect(drawX, drawY, this.width, this.height);
        ctx.strokeRect(drawX, drawY, this.width, this.height);

        // Pipe top visual
        ctx.fillStyle = '#171c1e';
        ctx.fillRect(drawX + 10, drawY - 20, 80, 20);
        ctx.strokeRect(drawX + 10, drawY - 20, 80, 20);
    }
}

function checkGatewayInteraction() {
    for (let g of gateways) {
        // Simple center point check
        let playerCenter = player.x + player.width / 2;
        if (playerCenter > g.x && playerCenter < g.x + g.width &&
            Math.abs((player.y + player.height) - g.y) < 20) {

            // Teleport
            player.x = g.destX;
            player.y = g.destY;
            player.vx = 0;
            player.vy = 0;
            camera.x = player.x - canvas.width / 3; // Snap camera
            camera.y = player.y - canvas.height / 2;
            playSound('BOSS_ACTIVE'); // Reuse sound for effect
        }
    }
}

// ------------------------------
// Setup Level
// ------------------------------
// ------------------------------
// Setup Level
// ------------------------------
function initLevel() {
    entities = [];
    platforms = [];
    gateways = [];
    particles = [];
    decorations = [];
    boss = null;

    // Reset specific level    camera.x = 0;

    if (currentLevel === 1) setupLevel1();
    if (currentLevel === 2) setupLevel2();
    if (currentLevel === 3) setupLevel3();
    if (currentLevel === 4) setupLevel4();
    if (currentLevel === 5) setupLevel5();

    // Create boss based on levelWidth logic set inside setup functions
    if (currentLevel <= TOTAL_LEVELS) {
        boss = new Boss();
        boss.x = levelWidth - 1000; // General positioning, specific setups override if needed
    }
}

function setupLevel1() {
    levelTheme = 'BATHROOM';
    levelWidth = 7200;

    // 1. Ground / Platforms
    platforms.push(new Platform(0, canvas.height - 100, 1000, 100));
    platforms.push(new Platform(1200, canvas.height - 200, 300, 50));
    platforms.push(new Platform(1600, canvas.height - 350, 300, 50));
    platforms.push(new Platform(2000, canvas.height - 150, 400, 150));
    platforms.push(new Platform(2600, canvas.height - 250, 200, 50));
    platforms.push(new Platform(2900, canvas.height - 200, 100, 50));

    // Previous Extension (3000 - 4000)
    platforms.push(new Platform(3200, canvas.height - 150, 200, 50));
    platforms.push(new Platform(3600, canvas.height - 250, 200, 50));

    // New Extension 1.3x (4000 - 5700)
    platforms.push(new Platform(4100, canvas.height - 100, 800, 100)); // Long flat
    platforms.push(new Platform(5000, canvas.height - 250, 200, 50));
    platforms.push(new Platform(5300, canvas.height - 350, 200, 50));

    platforms.push(new Platform(5700, canvas.height - 100, 1500, 100)); // Boss arena (Shifted)

    // Walls
    platforms.push(new Platform(-50, 0, 50, canvas.height));
    platforms.push(new Platform(levelWidth, 0, 50, canvas.height));

    // 2. Decorations
    decorations.push(new Decoration(200, canvas.height - 300, 'SHOWER'));
    decorations.push(new Decoration(800, canvas.height - 200, 'SINK'));
    decorations.push(new Decoration(1800, canvas.height - 400, 'SINK'));
    decorations.push(new Decoration(2700, canvas.height - 400, 'SHOWER'));
    decorations.push(new Decoration(3250, canvas.height - 250, 'MIRROR'));
    decorations.push(new Decoration(4500, canvas.height - 300, 'SINK')); // New Decor
    decorations.push(new Decoration(6000, canvas.height - 400, 'MIRROR')); // Shifted Mirror

    // 3. Enemies
    entities.push(new Enemy(600, canvas.height - 164));
    entities.push(new DuckieEnemy(900, canvas.height - 264));
    entities.push(new Enemy(1300, canvas.height - 264));
    entities.push(new Enemy(1700, canvas.height - 414, true));
    entities.push(new SoapEnemy(2500, canvas.height - 300));
    entities.push(new Enemy(2100, canvas.height - 214));
    entities.push(new Enemy(2300, canvas.height - 214, true));

    // Previous Enemies
    entities.push(new SoapEnemy(3500, canvas.height - 300));
    entities.push(new DuckieEnemy(3700, canvas.height - 314));

    // New Enemies 1.3x
    entities.push(new DuckieEnemy(4300, canvas.height - 264));
    entities.push(new DuckieEnemy(4600, canvas.height - 264));
    entities.push(new SoapEnemy(5200, canvas.height - 400));

    // 4. Pickups
    entities.push(new Pickup(1350, canvas.height - 300, 'HEALTH'));
    entities.push(new Pickup(2100, canvas.height - 300, 'PLUNGER'));
    entities.push(new Pickup(3650, canvas.height - 350, 'HEALTH'));
    entities.push(new Pickup(5400, canvas.height - 400, 'PLUNGER')); // New Pickup
}

function setupLevel2() {
    levelTheme = 'SEWER';
    levelWidth = 7800;

    // More jumps, darker theme
    // Start
    platforms.push(new Platform(0, canvas.height - 100, 600, 100));

    // Hazardous Jumps
    platforms.push(new Platform(700, canvas.height - 200, 200, 30));
    platforms.push(new Platform(1000, canvas.height - 300, 200, 30));
    platforms.push(new Platform(1400, canvas.height - 200, 200, 30));

    // Middle section
    platforms.push(new Platform(1800, canvas.height - 100, 800, 100));

    // High path
    platforms.push(new Platform(2700, canvas.height - 300, 200, 30));
    platforms.push(new Platform(3000, canvas.height - 400, 200, 30));
    platforms.push(new Platform(3300, canvas.height - 300, 200, 30));

    // Previous Extension (3600 - 4600)
    platforms.push(new Platform(3700, canvas.height - 250, 150, 30));
    platforms.push(new Platform(4000, canvas.height - 150, 150, 30));
    platforms.push(new Platform(4300, canvas.height - 250, 150, 30));

    // New Extension 1.3x (4600 - 6400)
    platforms.push(new Platform(4800, canvas.height - 350, 150, 30)); // Leap of faith
    platforms.push(new Platform(5200, canvas.height - 400, 150, 30));
    platforms.push(new Platform(5600, canvas.height - 250, 150, 30));
    platforms.push(new Platform(6000, canvas.height - 150, 300, 50));

    // Boss Arena
    platforms.push(new Platform(6400, canvas.height - 100, 1400, 100)); // Shifted

    // Walls
    platforms.push(new Platform(-50, 0, 50, canvas.height));
    platforms.push(new Platform(levelWidth, 0, 50, canvas.height));

    // Enemies - More Evil ones
    entities.push(new Enemy(400, canvas.height - 164));
    entities.push(new ToothbrushEnemy(1900, canvas.height - 190));
    entities.push(new Enemy(2000, canvas.height - 164, true));
    entities.push(new SoapEnemy(3100, canvas.height - 400));
    entities.push(new Enemy(2200, canvas.height - 164, true));
    entities.push(new Enemy(2800, canvas.height - 364, true));

    // Previous Enemies
    entities.push(new ToothbrushEnemy(4050, canvas.height - 240));
    entities.push(new Enemy(3800, canvas.height - 314, true));

    // New Enemies 1.3x
    entities.push(new ToothbrushEnemy(5000, canvas.height - 500));
    entities.push(new ToothbrushEnemy(5800, canvas.height - 400)); // Gauntlet
    entities.push(new Enemy(6100, canvas.height - 214, true));

    // Pickups
    entities.push(new Pickup(1100, canvas.height - 350, 'HEALTH'));
    entities.push(new Pickup(3100, canvas.height - 450, 'PLUNGER'));
    entities.push(new Pickup(4350, canvas.height - 350, 'HEALTH'));
    entities.push(new Pickup(4350, canvas.height - 350, 'HEALTH'));
    entities.push(new Pickup(5300, canvas.height - 450, 'PLUNGER')); // New

    // SECRET GATEWAY
    // Hidden low under the "High path" section
    gateways.push(new Gateway(3150, canvas.height - 100, 3150, -2000 - 64));

    // Add visual platform for the gateway to sit on if needed, or it can be on ground
    platforms.push(new Platform(3000, canvas.height - 100, 400, 100)); // Hidden lower platform

    // SECRET AREA (Sky Vault) at Y = -2000
    platforms.push(new Platform(3000, -2000, 1000, 50)); // Main floor
    platforms.push(new Platform(3000, -2300, 50, 300)); // Left wall
    platforms.push(new Platform(4000, -2300, 50, 300)); // Right wall

    // Loot
    for (let i = 0; i < 8; i++) {
        entities.push(new Pickup(3100 + i * 100, -2100, 'PLUNGER'));
        if (i === 4) entities.push(new Pickup(3500, -2250, 'GOLD_PLUNGER')); // Secret within secret
        if (i % 2 === 0) entities.push(new Pickup(3100 + i * 100, -2200, 'HEALTH'));
    }

    // Some Evil Enemies guarding the loot
    entities.push(new ToothbrushEnemy(3500, -2100));

    // Return logic: falling off the platform at -2000 makes you fall naturally back to Y>0? 
    // Gravity works, so if they jump off, they fall 2000 pixels down. 
    // We need to ensure they don't die from fall damage (no fall damage in this game)
    // and that they land somewhere safe-ish.
    // 3000 x is near 3000, canvas.height - 400. So falling might land on previous platforms.
}

function setupLevel3() {
    levelTheme = 'DARK_PIPES';
    levelWidth = 9100;

    // Hard platforming
    platforms.push(new Platform(0, canvas.height - 100, 500, 100));

    // Floating pipes
    for (let i = 0; i < 8; i++) {
        let h = (i % 2 === 0) ? 200 : 400;
        platforms.push(new Platform(600 + i * 400, canvas.height - h, 150, 40));

        // Spawn Random Enemies on pipes
        if (i % 2 !== 0) {
            entities.push(new DuckieEnemy(600 + i * 400 + 40, canvas.height - h - 64));
        } else if (i === 4) {
            entities.push(new ToothbrushEnemy(600 + i * 400 + 40, canvas.height - h - 90));
        }
    }

    platforms.push(new Platform(3800, canvas.height - 150, 400, 50));

    // Previous Extension (4300 - 5700)
    for (let i = 0; i < 3; i++) {
        let x = 4400 + i * 400;
        platforms.push(new Platform(x, canvas.height - 300, 200, 40));
        if (i === 1) entities.push(new SoapEnemy(x, canvas.height - 500));
    }

    // New Extension 1.3x (5700 - 7800)
    // Massive pipe maze
    for (let i = 0; i < 5; i++) {
        let x = 5800 + i * 350;
        let h = 200 + (i % 3) * 150;
        platforms.push(new Platform(x, canvas.height - h, 100, 30));
        if (i % 2 === 0) entities.push(new Enemy(x, canvas.height - h - 64, true));
    }

    platforms.push(new Platform(7500, canvas.height - 150, 300, 50));

    // Final Boss Arena
    platforms.push(new Platform(7800, canvas.height - 100, 1300, 100)); // Shifted

    // Walls
    platforms.push(new Platform(-50, 0, 50, canvas.height));
    platforms.push(new Platform(levelWidth, 0, 50, canvas.height));

    // Enemies everywhere
    entities.push(new SoapEnemy(3000, canvas.height - 300));
    entities.push(new SoapEnemy(3200, canvas.height - 400));
    entities.push(new Enemy(3900, canvas.height - 214, true));

    // Previous enemies extension
    entities.push(new ToothbrushEnemy(4500, canvas.height - 390));
    entities.push(new Enemy(5450, canvas.height - 264, true));

    // New Enemies 1.3x
    entities.push(new ToothbrushEnemy(6500, canvas.height - 400));
    entities.push(new SoapEnemy(7000, canvas.height - 500));

    // Pickups
    entities.push(new Pickup(2000, canvas.height - 500, 'HEALTH'));
    entities.push(new Pickup(5000, canvas.height - 400, 'PLUNGER'));
    entities.push(new Pickup(4000, canvas.height - 200, 'HEALTH'));
    entities.push(new Pickup(6200, canvas.height - 400, 'HEALTH')); // New
    entities.push(new Pickup(1500, canvas.height - 350, 'SOAP_SHIELD')); // New Powerup
}

function setupLevel4() {
    levelTheme = 'TOXIC';
    levelWidth = 8000;

    // Introduction - safe drops
    platforms.push(new Platform(0, canvas.height - 100, 600, 100));
    platforms.push(new Platform(700, canvas.height - 200, 200, 50));
    platforms.push(new Platform(1000, canvas.height - 300, 200, 50));

    // Toxic Pools (Gaps)
    platforms.push(new Platform(1300, canvas.height - 200, 800, 100)); // Bridge
    platforms.push(new Platform(2200, canvas.height - 100, 300, 100));

    // High Jumps
    platforms.push(new Platform(2600, canvas.height - 350, 150, 30));
    platforms.push(new Platform(2900, canvas.height - 500, 150, 30)); // Pretty high
    platforms.push(new Platform(3200, canvas.height - 400, 150, 30));

    // Long run
    platforms.push(new Platform(3500, canvas.height - 200, 2000, 100));

    platforms.push(new Platform(5600, canvas.height - 300, 200, 30));
    platforms.push(new Platform(5900, canvas.height - 400, 200, 30));
    platforms.push(new Platform(6200, canvas.height - 500, 200, 30));

    // Boss Area
    platforms.push(new Platform(6800, canvas.height - 100, 1200, 100));

    platforms.push(new Platform(-50, 0, 50, canvas.height));
    platforms.push(new Platform(levelWidth, 0, 50, canvas.height));

    // Enemies - lots of Soap (Sliding risk near gaps)
    entities.push(new SlimeEnemy(1400, canvas.height - 300));
    entities.push(new ToxicPlantEnemy(1900, canvas.height - 380));

    entities.push(new SlimeEnemy(2300, canvas.height - 200));
    entities.push(new ToxicPlantEnemy(2650, canvas.height - 430));

    entities.push(new SoapEnemy(3600, canvas.height - 290));
    entities.push(new SlimeEnemy(4000, canvas.height - 300));
    entities.push(new SlimeEnemy(4500, canvas.height - 300));
    entities.push(new ToxicPlantEnemy(5700, canvas.height - 380));
    entities.push(new ToxicPlantEnemy(6300, canvas.height - 580)); // High sniper

    entities.push(new Pickup(2900, canvas.height - 560, 'PLUNGER'));
    entities.push(new Pickup(4000, canvas.height - 300, 'GOLD_PLUNGER')); // Offensive boost
    entities.push(new Pickup(5000, canvas.height - 300, 'HEALTH'));
}

function setupLevel5() {
    levelTheme = 'VOID';
    levelWidth = 6000;

    // Start
    platforms.push(new Platform(0, canvas.height - 100, 500, 100));

    // Floating Islands in the Void
    platforms.push(new Platform(600, canvas.height - 300, 300, 50));
    platforms.push(new Platform(1100, canvas.height - 400, 300, 50));
    platforms.push(new Platform(1600, canvas.height - 200, 300, 50)); // Low

    platforms.push(new Platform(2200, canvas.height - 500, 100, 30)); // Tiny
    platforms.push(new Platform(2500, canvas.height - 400, 100, 30));
    platforms.push(new Platform(2800, canvas.height - 300, 100, 30));

    platforms.push(new Platform(3200, canvas.height - 200, 1000, 50)); // Runway

    // Final Arena
    platforms.push(new Platform(4500, canvas.height - 100, 1500, 100));

    platforms.push(new Platform(-50, 0, 50, canvas.height));
    platforms.push(new Platform(levelWidth, 0, 50, canvas.height));

    // Heavy combat
    entities.push(new Enemy(1200, canvas.height - 464, true));
    entities.push(new Enemy(3300, canvas.height - 264, true));
    entities.push(new Enemy(3500, canvas.height - 264, true));
    entities.push(new ToothbrushEnemy(3800, canvas.height - 290));

    entities.push(new Pickup(1150, canvas.height - 500, 'HEALTH'));
    entities.push(new Pickup(4000, canvas.height - 300, 'PLUNGER'));
    entities.push(new Pickup(2500, canvas.height - 550, 'SOAP_SHIELD')); // New Powerup
}

// Menu Logic
function initMenu() {
    document.getElementById('btn-new-game').addEventListener('click', () => {
        currentLevel = 1;
        score = 0;
        lives = 5;
        startGame();
    });

    document.getElementById('btn-level-select').addEventListener('click', () => {
        uiMainMenu.classList.add('hidden');
        uiLevelSelect.classList.remove('hidden');
    });

    document.getElementById('btn-back').addEventListener('click', () => {
        uiLevelSelect.classList.add('hidden');
        uiMainMenu.classList.remove('hidden');
    });

    document.querySelectorAll('.level-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            currentLevel = parseInt(e.target.dataset.level);
            score = 0; // Reset score on level select
            lives = 5;
            startGame();
        });
    });
}

function showMainMenu() {
    gameState = 'START';
    uiMainMenu.classList.remove('hidden');
    uiLevelSelect.classList.add('hidden');
    uiGameOver.classList.add('hidden');
    uiScore.classList.add('hidden');
    uiHealth.classList.add('hidden');
    if (uiLives) uiLives.classList.add('hidden');

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
}

function startGame() {
    gameState = 'PLAYING';
    frames = 0;

    player = new Player();
    camera.x = 0;

    initLevel();

    uiMainMenu.classList.add('hidden');
    uiLevelSelect.classList.add('hidden');
    uiGameOver.classList.add('hidden');
    uiScore.classList.remove('hidden');
    uiHealth.classList.remove('hidden');
    if (uiLives) uiLives.classList.remove('hidden');

    if (document.getElementById('win-screen')) document.getElementById('win-screen').remove();

    if (animationId) cancelAnimationFrame(animationId);
    animate();
}

function checkGameCollisions() {
    // Player vs Entities
    for (let e of entities) {
        if (e instanceof Enemy || e instanceof SoapEnemy || e instanceof DuckieEnemy || e instanceof ToothbrushEnemy || e instanceof ToxicPlantEnemy || e instanceof SlimeEnemy) {
            if (checkCollision(player, e)) {

                // Sound Triggers
                if (e instanceof SoapEnemy) playSound('HIT_SOAP');
                else if (e instanceof DuckieEnemy) playSound('HIT_DUCKIE');
                else playSound('HIT_GENERIC');

                if (player.shield > 0) {
                    if (player.shieldHitCooldown <= 0) {
                        player.shield--;
                        player.shieldHitCooldown = 30; // 0.5s invincibility
                        cameraShake();
                        createExplosion(player.x + player.width / 2, player.y + player.height / 2, '#add8e6', 5);
                    }
                } else {
                    player.health -= 1;
                    if (e instanceof ToothbrushEnemy) player.health -= 2; // Extra Damage
                    if (e instanceof ToxicPlantEnemy) player.health -= 2; // Poison Damage

                    // Deactivate powerups on health damage
                    if (player.powerups.spread || player.powerups.piercing) {
                        let pColor = player.powerups.piercing ? 'gold' : 'yellow';
                        createExplosion(player.x + player.width / 2, player.y + player.height / 2, pColor, 10);
                        player.powerups.spread = false;
                        player.powerups.piercing = false;
                        player.powerUpTimer = 0;
                    }
                }
                createExplosion(player.x + player.width / 2, player.y + player.height / 2, 'red', 1);
            }
        } else if (e instanceof Projectile && e.isEnemy) {
            let projRect = { x: e.x - e.radius, y: e.y - e.radius, width: e.radius * 2, height: e.radius * 2 };
            if (checkCollision(player, projRect)) {
                if (player.shield > 0) {
                    if (player.shieldHitCooldown <= 0) {
                        player.shield--;
                        player.shieldHitCooldown = 30;
                    }
                } else {
                    player.health -= 10; // Reduced from 15

                    // Deactivate powerups on health damage
                    if (player.powerups.spread || player.powerups.piercing) {
                        let pColor = player.powerups.piercing ? 'gold' : 'yellow';
                        createExplosion(player.x + player.width / 2, player.y + player.height / 2, pColor, 10);
                        player.powerups.spread = false;
                        player.powerups.piercing = false;
                        player.powerUpTimer = 0;
                    }
                }
                e.markedForDeletion = true;
                cameraShake();
            }
        } else if (e instanceof Pickup) {
            if (checkCollision(player, e)) {
                if (e.type === 'HEALTH') player.heal(30);
                if (e.type === 'PLUNGER') {
                    player.powerups.spread = true;
                }
                if (e.type === 'GOLD_PLUNGER') {
                    player.powerups.piercing = true;
                }
                if (e.type === 'SOAP_SHIELD') {
                    player.shield = 3;
                }
                score += 50;
                e.markedForDeletion = true;
            }
        }
    }

    // Boss Collision
    if (boss && boss.state === 'FIGHTING') {
        if (checkCollision(player, boss)) {
            if (player.shield > 0) {
                if (player.shieldHitCooldown <= 0) {
                    player.shield--;
                    player.shieldHitCooldown = 30;
                    cameraShake();
                }
            } else {
                player.health -= 2;

                // Deactivate powerups on health damage
                if (player.powerups.spread || player.powerups.piercing) {
                    let pColor = player.powerups.piercing ? 'gold' : 'yellow';
                    createExplosion(player.x + player.width / 2, player.y + player.height / 2, pColor, 10);
                    player.powerups.spread = false;
                    player.powerups.piercing = false;
                    player.powerUpTimer = 0;
                }
            }
        }
    }

    // Player Projectiles vs Enemies/Boss
    let projectiles = entities.filter(e => e instanceof Projectile && !e.isEnemy);
    let enemies = entities.filter(e => e instanceof Enemy || e instanceof SoapEnemy || e instanceof DuckieEnemy || e instanceof ToothbrushEnemy || e instanceof ToxicPlantEnemy || e instanceof SlimeEnemy);

    projectiles.forEach(p => {
        let pRect = { x: p.x - p.radius, y: p.y - p.radius, width: p.radius * 2, height: p.radius * 2 };

        enemies.forEach(e => {
            if (checkCollision(pRect, e)) {
                if (p.isPiercing) {
                    if (!p.hitEnemies.has(e)) {
                        e.hp -= 3; // Gold Plunger is powerful!
                        p.hitEnemies.add(e);
                        createExplosion(p.x, p.y, 'gold', 5);
                    }
                } else {
                    p.markedForDeletion = true;
                    e.hp -= 1.05;
                }

                if (e.hp <= 0) {
                    e.markedForDeletion = true;
                    score += e.scoreValue || 100;
                    createExplosion(e.x + e.width / 2, e.y + e.height / 2, 'brown');
                }
                if (!p.isPiercing) createExplosion(p.x, p.y, 'white', 2);
            }
        });

        if (boss && boss.state === 'FIGHTING') {
            if (checkCollision(pRect, boss)) {
                if (p.isPiercing) {
                    if (!p.hitEnemies.has(boss)) {
                        boss.hp -= 3;
                        p.hitEnemies.add(boss);
                        createExplosion(p.x, p.y, 'gold', 5);
                    }
                } else {
                    p.markedForDeletion = true;
                    boss.hp -= 1.05;
                    createExplosion(p.x, p.y, 'white', 2);
                }

                if (boss.hp <= 0) {
                    boss.markedForDeletion = true;
                    createExplosion(boss.x + boss.width / 2, boss.y + boss.height / 2, 'gold', 100);

                    if (currentLevel < TOTAL_LEVELS) {
                        gameState = 'LEVEL_COMPLETE';
                        score += 1000;
                    } else {
                        score += 5000;
                        gameState = 'WIN';
                    }
                    boss = null;
                }
            }
        }
    });
}

function createExplosion(x, y, color, count = 10) {
    for (let i = 0; i < count; i++) {
        particles.push({
            x: x,
            y: y,
            vx: (Math.random() - 0.5) * 10,
            vy: (Math.random() - 0.5) * 10,
            life: 30,
            color: color
        });
    }
}

let shake = 0;
function cameraShake() { shake = 10; }

function animate() {
    if (gameState === 'GAMEOVER') {
        uiGameOver.classList.remove('hidden');
        uiFinalScore.innerText = score;
        return;
    }
    if (gameState === 'LEVEL_COMPLETE') {
        ctx.fillStyle = 'rgba(0,0,0,0.8)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        ctx.fillStyle = '#00a8ff';
        ctx.font = '60px Courier New';
        ctx.textAlign = 'center';
        ctx.fillText("LEVEL COMPLETE!", canvas.width / 2, canvas.height / 2 - 50);

        ctx.fillStyle = 'white';
        ctx.font = '30px Courier New';
        ctx.fillText(`Score: ${score}`, canvas.width / 2, canvas.height / 2 + 20);
        ctx.fillText("Press SPACE for Next Level", canvas.width / 2, canvas.height / 2 + 70);
        return;
    }

    if (gameState === 'WIN') {
        ctx.fillStyle = 'rgba(0,0,0,0.8)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        ctx.fillStyle = 'gold';
        ctx.font = '60px Courier New';
        ctx.textAlign = 'center';
        ctx.fillText("YOU FLUSHED THE EVIL!", canvas.width / 2, canvas.height / 2 - 50);

        ctx.fillStyle = 'white';
        ctx.font = '30px Courier New';
        ctx.fillText(`Final Score: ${score}`, canvas.width / 2, canvas.height / 2 + 20);
        ctx.fillText("Press SPACE to Play Again", canvas.width / 2, canvas.height / 2 + 70);
        return;
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Update Score UI
    uiScore.innerText = 'Score: ' + score;

    ctx.save();
    if (shake > 0) {
        ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);
        shake *= 0.9;
    }

    // Dynamic Background
    let bgColor = '#b2bec3';
    if (levelTheme === 'SEWER') bgColor = '#2d3436';
    if (levelTheme === 'DARK_PIPES') bgColor = '#2c040d'; // Dark Red
    if (levelTheme === 'TOXIC') bgColor = '#1e272e'; // Dark Grey
    if (levelTheme === 'VOID') bgColor = '#000000'; // Pure Black

    if (assets.bgPattern && levelTheme === 'BATHROOM') {
        ctx.fillStyle = assets.bgPattern;
        ctx.save();
        ctx.translate(-camera.x * 0.5, 0);
        ctx.fillRect(camera.x * 0.5, 0, canvas.width, canvas.height);
        ctx.restore();
    } else {
        ctx.fillStyle = bgColor;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        // Extend background drawing for negative Y (Secret areas)
        ctx.fillRect(0, -3000, canvas.width, 3000);

        // Concrete Slab Texture for Sewer
        if (levelTheme === 'SEWER') {
            ctx.strokeStyle = 'rgba(0,0,0,0.2)';
            ctx.lineWidth = 2;
            const slabSize = 256;
            const scrollX = (camera.x * 0.2) % slabSize;
            const scrollY = (camera.y * 0.2) % slabSize;

            for (let x = -scrollX; x < canvas.width; x += slabSize) {
                ctx.beginPath();
                ctx.moveTo(x, 0);
                ctx.lineTo(x, canvas.height);
                ctx.stroke();
            }
            for (let y = -scrollY; y < canvas.height; y += slabSize) {
                ctx.beginPath();
                ctx.moveTo(0, y);
                ctx.lineTo(canvas.width, y);
                ctx.stroke();
            }

            // Subtle "concrete dots" or wear
            ctx.fillStyle = 'rgba(0,0,0,0.1)';
            for (let x = -scrollX + 20; x < canvas.width; x += slabSize) {
                for (let y = -scrollY + 20; y < canvas.height; y += slabSize) {
                    ctx.fillRect(x, y, 4, 4);
                    ctx.fillRect(x + slabSize - 40, y + slabSize - 40, 4, 4);
                }
            }
        }
    }

    // Draw Gateways (Behind foreground)
    for (let g of gateways) {
        g.draw();
    }

    // Sewer Water (Background Layer)
    if (levelTheme === 'SEWER' || levelTheme === 'TOXIC') {
        drawSewerWater(ctx);
        // Bubble Spawner
        if (Math.random() < 0.05) {
            particles.push({
                x: Math.random() * canvas.width + camera.x,
                y: canvas.height,
                vx: 0,
                vy: -1 - Math.random(),
                life: 120,
                color: 'rgba(255, 255, 255, 0.5)',
                isBubble: true
            });
        }
    }

    platforms.forEach(p => p.draw());

    decorations.forEach(d => d.draw());

    entities.forEach(e => e.update());
    entities = entities.filter(e => !e.markedForDeletion);
    entities.forEach(e => e.draw());

    if (boss) {
        boss.update();
        boss.draw();
    }

    player.update();
    player.draw();

    particles.forEach((p, i) => {
        p.x += p.vx;
        p.y += p.vy;
        p.life--;
        ctx.fillStyle = p.color;
        ctx.fillRect(p.x - camera.x, p.y - camera.y, 4, 4);
        if (p.life <= 0) particles.splice(i, 1);
    });

    ctx.restore();

    checkGameCollisions();

    uiScore.innerText = `Level: ${currentLevel} | Score: ${score}`;
    uiHealth.innerText = `Health: ${Math.floor(player.health)}%`;
    if (uiLives) uiLives.innerText = `Lives: ${lives}`;

    if (player.health <= 0) {
        handlePlayerDeath();
        return;
    }

    frames++;
    if (gameState === 'PLAYING') {
        animationId = requestAnimationFrame(animate);
    }
}

function handlePlayerDeath() {
    lives--;
    if (lives > 0) {
        // Restart Level
        startGame();
    } else {
        gameState = 'GAMEOVER';
    }
}

loadAssets();
initMenu();
showMainMenu(); // Initialize state

function drawSewerWater(ctx) {
    if (levelTheme !== 'SEWER') return;

    const waterHeight = 80;
    const y = canvas.height - waterHeight;

    ctx.save();
    ctx.fillStyle = 'rgba(74, 92, 49, 0.7)'; // Murky Sewer Brown/Green
    ctx.beginPath();
    ctx.moveTo(0, canvas.height);
    ctx.lineTo(0, y);

    // Wave effect
    for (let x = 0; x <= canvas.width; x += 20) {
        let waveY = y + Math.sin((x + frames * 2) * 0.02) * 10;
        ctx.lineTo(x, waveY);
    }

    ctx.lineTo(canvas.width, canvas.height);
    ctx.fill();

    // Scum line
    ctx.strokeStyle = '#2ecc71';
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.restore();
}

function playSound(type) {
    let snd;
    if (type === 'HIT_GENERIC') snd = assets.sndHitGeneric;
    if (type === 'HIT_SOAP') snd = assets.sndHitSoap;
    if (type === 'HIT_DUCKIE') snd = assets.sndHitDuckie;
    if (type === 'BOSS_ACTIVE') snd = assets.sndBossActive;

    if (snd) {
        // Reset and play
        try {
            snd.currentTime = 0;
            snd.play().catch(e => console.log('Audio play failed (no interaction?):', e));
        } catch (e) {
            console.log('Audio error:', e);
        }
    }
}

// ------------------------------
// Touch Controls Logic
// ------------------------------

function setupTouchControls() {
    const touchMap = {
        'btn-left': 'ArrowLeft',
        'btn-right': 'ArrowRight',
        'btn-up': 'ArrowUp',
        'btn-down': 'ArrowDown',
        'btn-jump': 'Space',
        'btn-shoot': 'KeyZ',
        'btn-melee': 'KeyX'
    };

    Object.keys(touchMap).forEach(id => {
        const btn = document.getElementById(id);
        const key = touchMap[id];

        if (!btn) return;

        // Handle Touch Start
        btn.addEventListener('touchstart', (e) => {
            e.preventDefault(); // Prevent scrolling/zooming
            keys[key] = true;
            handlespecialTouch(key);
        }, { passive: false });

        // Handle Touch End
        btn.addEventListener('touchend', (e) => {
            e.preventDefault();
            keys[key] = false;
        }, { passive: false });

        // Handle Mouse Down (for PC testing)
        btn.addEventListener('mousedown', (e) => {
            keys[key] = true;
            handlespecialTouch(key);
        });

        // Handle Mouse Up
        btn.addEventListener('mouseup', (e) => {
            keys[key] = false;
        });

        // Handle Mouse Leave (if mouse drags out of button)
        btn.addEventListener('mouseleave', (e) => {
            keys[key] = false;
        });
    });
}

function handlespecialTouch(code) {
    // Replicate keydown special logic
    if (gameState === 'GAMEOVER' && code === 'Space') {
        showMainMenu();
    }
    if (gameState === 'WIN' && code === 'Space') {
        showMainMenu();
    }
    if (gameState === 'LEVEL_COMPLETE' && code === 'Space') {
        currentLevel++;
        startGame();
    }
    if (gameState === 'PLAYING') {
        if (code === 'KeyZ') player.shoot();
        if (code === 'KeyX') player.meleeAttack();
        if (code === 'ArrowDown' || code === 'KeyS') checkGatewayInteraction();
        // Note: ArrowDown maps to 'ArrowDown' in my touchMap, so consistent.
    }
}

// Initialize Touch Controls
setupTouchControls();

