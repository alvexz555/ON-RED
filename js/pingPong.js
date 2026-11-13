/*
 * ON RED
 * PING PONG ENEMY + ELECTRIC OVERLOAD
 * Movimento autônomo, rebotes, aceleração progressiva e eletrização.
 */
(function () {
    "use strict";

    const CONFIG = {
        radius: 12,
        speed: 380,
        maxSpeed: 1200,
        spawnInterval: 10,
        spawnMargin: 32,
        minPlayerDistance: 130,
        spawnAttempts: 40,
        knockbackSpeed: 900,
        knockbackDamping: 4,
        controlRecoveryDuration: 1,
        controlMinMultiplier: 0.2,
        collisionSpeedMultiplier: 1.08,
        overloadHitCount: 20,
        electrifiedDuration: 3,
        stunIntervalMin: 0.22,
        stunIntervalMax: 0.58,
        stunDurationMin: 0.10,
        stunDurationMax: 0.22
    };

    let ball = null;
    let spawnTimer = 0;
    let knockbackX = 0;
    let knockbackY = 0;
    let controlSlowTimer = 0;
    let overloadHits = 0;
    let electrifiedTimer = 0;
    let stunTimer = 0;
    let nextStunIn = 0;

    function clamp(value, min, max) {
        return Math.max(min, Math.min(max, value));
    }

    function randomBetween(min, max) {
        return min + Math.random() * (max - min);
    }

    function isClearOfObstacles(x, y, obstacles, obstacleSize) {
        if (!Array.isArray(obstacles)) return true;
        const half = (Number(obstacleSize) || 0) / 2;
        for (const obstacle of obstacles) {
            if (!obstacle || obstacle.state === "ELIMINATED" || obstacle.state === "RESPAWNING") continue;
            const closestX = clamp(x, obstacle.x - half, obstacle.x + half);
            const closestY = clamp(y, obstacle.y - half, obstacle.y + half);
            const dx = x - closestX, dy = y - closestY;
            if (dx * dx + dy * dy < CONFIG.radius * CONFIG.radius) return false;
        }
        return true;
    }

    function createSpawnPosition(arena, player, obstacles, obstacleSize, hexSystem) {
        const minX = CONFIG.radius + CONFIG.spawnMargin;
        const maxX = Math.max(minX, arena.width - minX);
        const minY = CONFIG.radius + CONFIG.spawnMargin;
        const maxY = Math.max(minY, arena.height - minY);

        for (let attempt = 0; attempt < CONFIG.spawnAttempts; attempt++) {
            const candidate = {
                x: minX + Math.random() * (maxX - minX),
                y: minY + Math.random() * (maxY - minY)
            };
            const playerDistance = Math.hypot(candidate.x - player.x, candidate.y - player.y);
            const clearOfPlayer = playerDistance >= player.radius + CONFIG.radius + CONFIG.minPlayerDistance;
            if (clearOfPlayer &&
                isClearOfObstacles(candidate.x, candidate.y, obstacles, obstacleSize) &&
                (!hexSystem || typeof hexSystem.isCirclePositionClear !== "function" ||
                    hexSystem.isCirclePositionClear({ x: candidate.x, y: candidate.y, radius: CONFIG.radius }))) {
                return candidate;
            }
        }
        return null;
    }

    function randomDirection() {
        let angle = 0, vx = 0, vy = 0;
        for (let attempt = 0; attempt < 30; attempt++) {
            angle = Math.random() * Math.PI * 2;
            vx = Math.cos(angle);
            vy = Math.sin(angle);
            if (Math.abs(vx) >= 0.2 && Math.abs(vy) >= 0.2) break;
        }
        return { x: vx, y: vy };
    }

    function currentSpeed() {
        return ball ? Math.hypot(ball.vx, ball.vy) : CONFIG.speed;
    }

    function setBallSpeed(speed) {
        if (!ball) return;
        const magnitude = Math.hypot(ball.vx, ball.vy) || 1;
        const cappedSpeed = Math.min(speed, CONFIG.maxSpeed);
        ball.vx = ball.vx / magnitude * cappedSpeed;
        ball.vy = ball.vy / magnitude * cappedSpeed;
    }

    function startOverload() {
        if (!ball || ball.electric) return;
        ball.electric = true;
    }

    function registerValidImpact() {
        if (!ball) return;
        // Cada impacto válido acelera a bola, inclusive durante a sobrecarga.
        setBallSpeed(currentSpeed() * CONFIG.collisionSpeedMultiplier);
        if (!ball.electric) {
            overloadHits++;
            if (overloadHits >= CONFIG.overloadHitCount) startOverload();
        }
    }

    function endOverload() {
        if (ball) ball.electric = false;
        overloadHits = 0;
        // O fim da sobrecarga remove apenas a eletricidade.
        // A velocidade acumulada só é restaurada no contato com o jogador.
    }

    function spawn(arena, player, obstacles, obstacleSize, hexSystem) {
        if (ball || !arena || !player) return false;
        const position = createSpawnPosition(arena, player, obstacles, obstacleSize, hexSystem);
        if (!position) return false;
        const direction = randomDirection();
        ball = {
            x: position.x, y: position.y,
            vx: direction.x * CONFIG.speed,
            vy: direction.y * CONFIG.speed,
            radius: CONFIG.radius,
            electric: false
        };
        return true;
    }

    function applyPlayerKnockback(deltaTime, player, arena) {
        if (!player || !arena) return;
        if (Math.abs(knockbackX) + Math.abs(knockbackY) < 1) {
            knockbackX = 0;
            knockbackY = 0;
            return;
        }
        player.x += knockbackX * deltaTime;
        player.y += knockbackY * deltaTime;
        player.x = clamp(player.x, player.radius, Math.max(player.radius, arena.width - player.radius));
        player.y = clamp(player.y, player.radius, Math.max(player.radius, arena.height - player.radius));
        const damping = Math.exp(-CONFIG.knockbackDamping * deltaTime);
        knockbackX *= damping;
        knockbackY *= damping;
    }

    function bounceFromWalls(arena) {
        if (!ball) return false;
        const minX = ball.radius, maxX = Math.max(minX, arena.width - ball.radius);
        const minY = ball.radius, maxY = Math.max(minY, arena.height - ball.radius);
        let bounced = false;

        if (ball.x < minX) {
            ball.x = minX;
            if (ball.vx < 0) { ball.vx = Math.abs(ball.vx); bounced = true; }
        } else if (ball.x > maxX) {
            ball.x = maxX;
            if (ball.vx > 0) { ball.vx = -Math.abs(ball.vx); bounced = true; }
        }
        if (ball.y < minY) {
            ball.y = minY;
            if (ball.vy < 0) { ball.vy = Math.abs(ball.vy); bounced = true; }
        } else if (ball.y > maxY) {
            ball.y = maxY;
            if (ball.vy > 0) { ball.vy = -Math.abs(ball.vy); bounced = true; }
        }
        return bounced;
    }

    function electrifyPlayer() {
        electrifiedTimer = CONFIG.electrifiedDuration;
        stunTimer = 0;
        nextStunIn = randomBetween(CONFIG.stunIntervalMin, CONFIG.stunIntervalMax);
    }

    function collideWithPlayer(player, healthSystem, collisionSystem) {
        const dx = player.x - ball.x, dy = player.y - ball.y;
        const minimumDistance = player.radius + ball.radius;
        const distanceSquared = dx * dx + dy * dy;
        if (distanceSquared > minimumDistance * minimumDistance) return false;

        const distance = Math.sqrt(distanceSquared);
        let nx, ny;
        if (distance > 0.0001) {
            nx = dx / distance; ny = dy / distance;
        } else {
            const speed = Math.hypot(ball.vx, ball.vy) || 1;
            nx = ball.vx / speed; ny = ball.vy / speed;
        }

        const overlap = minimumDistance - distance;
        ball.x -= nx * (overlap + 0.5);
        ball.y -= ny * (overlap + 0.5);

        const velocityAlongNormal = ball.vx * nx + ball.vy * ny;
        if (velocityAlongNormal > 0) {
            ball.vx -= 2 * velocityAlongNormal * nx;
            ball.vy -= 2 * velocityAlongNormal * ny;
        }

        knockbackX = nx * CONFIG.knockbackSpeed;
        knockbackY = ny * CONFIG.knockbackSpeed;
        controlSlowTimer = CONFIG.controlRecoveryDuration;

        const wasElectric = Boolean(ball.electric);
        if (wasElectric) {
            electrifyPlayer();
            endOverload();
        } else {
            overloadHits = 0;
            setBallSpeed(CONFIG.speed);
        }

        if (healthSystem) {
            const damage = collisionSystem && typeof collisionSystem.getState === "function"
                ? collisionSystem.getState().damage : 25;
            const result = healthSystem.applyDamage(damage);
            if (result.gameOver && typeof window.triggerGameOver === "function") window.triggerGameOver();
        }
        return true;
    }

    function updateElectricalState(deltaTime) {
        if (electrifiedTimer > 0) {
            electrifiedTimer = Math.max(0, electrifiedTimer - deltaTime);
            if (stunTimer > 0) {
                stunTimer = Math.max(0, stunTimer - deltaTime);
            } else {
                nextStunIn -= deltaTime;
                if (nextStunIn <= 0 && electrifiedTimer > 0) {
                    stunTimer = randomBetween(CONFIG.stunDurationMin, CONFIG.stunDurationMax);
                    nextStunIn = randomBetween(CONFIG.stunIntervalMin, CONFIG.stunIntervalMax);
                }
            }
            if (electrifiedTimer === 0) {
                stunTimer = 0;
                nextStunIn = 0;
            }
        }
    }

    function update(deltaTime, player, arena, healthSystem, collisionSystem, obstacles, obstacleSize, hexSystem) {
        if (!Number.isFinite(deltaTime) || deltaTime < 0 || !player || !arena ||
            !Number.isFinite(arena.width) || !Number.isFinite(arena.height)) return;

        controlSlowTimer = Math.max(0, controlSlowTimer - deltaTime);
        updateElectricalState(deltaTime);
        applyPlayerKnockback(deltaTime, player, arena);

        if (!ball) {
            spawnTimer += deltaTime;
            if (spawnTimer >= CONFIG.spawnInterval) {
                spawnTimer = 0;
                spawn(arena, player, obstacles, obstacleSize, hexSystem);
            }
            return;
        }

        ball.x += ball.vx * deltaTime;
        ball.y += ball.vy * deltaTime;

        if (bounceFromWalls(arena)) registerValidImpact();

        if (hexSystem && typeof hexSystem.resolvePingPongCollision === "function") {
            const wasElectric = Boolean(ball.electric);
            const hexHit = hexSystem.resolvePingPongCollision(ball, wasElectric);
            if (hexHit) {
                // O impacto sempre acelera; se a bola estava eletrizada, consome a carga.
                registerValidImpact();
                if (wasElectric) endOverload();
            }
        }

        collideWithPlayer(player, healthSystem, collisionSystem);
        bounceFromWalls(arena);
    }

    function drawElectricArc(ctx, x, y, radius, alpha = 1, phase = 0) {
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.strokeStyle = "#8CEBFF";
        ctx.lineWidth = 2;
        ctx.shadowColor = "#37CFFF";
        ctx.shadowBlur = 14;
        ctx.beginPath();
        const segments = 12;
        for (let i = 0; i <= segments; i++) {
            const angle = phase + (Math.PI * 2 * i) / segments;
            const jitter = Math.sin(phase * 2.4 + i * 2.1) * 0.12;
            const r = radius * (i % 2 === 0 ? 1 : 0.72 + jitter);
            const px = x + Math.cos(angle) * r;
            const py = y + Math.sin(angle) * r;
            if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.stroke();
        ctx.restore();
    }

    function drawElectricAura(ctx, x, y, radius, phase, intensity = 1) {
        ctx.save();
        ctx.globalAlpha = intensity;
        ctx.strokeStyle = "#35CFFF";
        ctx.lineWidth = 2;
        ctx.shadowColor = "#168BFF";
        ctx.shadowBlur = 22;
        ctx.beginPath();
        ctx.arc(x, y, radius + Math.sin(phase * 2) * 2, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();

        drawElectricArc(ctx, x, y, radius + 5, 0.95 * intensity, phase);
        drawElectricArc(ctx, x, y, radius + 10, 0.55 * intensity, -phase * 1.3);
    }

    function draw(ctx, player) {
        if (!ctx) return;

        const phase = Date.now() / 95;
        if (electrifiedTimer > 0 && player) {
            const pulse = 0.72 + Math.sin(phase) * 0.22;
            drawElectricAura(ctx, player.x, player.y, player.radius + 7, phase, pulse);

            // Pequenos clarões brancos aparecem nas pausas de atordoamento.
            if (stunTimer > 0) {
                ctx.save();
                ctx.globalAlpha = 0.45 + Math.sin(phase * 2.8) * 0.2;
                ctx.strokeStyle = "#FFFFFF";
                ctx.lineWidth = 2;
                ctx.shadowColor = "#8CEBFF";
                ctx.shadowBlur = 18;
                ctx.beginPath();
                ctx.arc(player.x, player.y, player.radius + 3, 0, Math.PI * 2);
                ctx.stroke();
                ctx.restore();
            }
        }

        if (!ball) return;
        ctx.save();
        if (ball.electric) {
            const pulse = 0.75 + Math.sin(phase * 1.4) * 0.2;
            drawElectricAura(ctx, ball.x, ball.y, ball.radius + 5, phase, pulse);
            ctx.shadowColor = "#45DFFF";
            ctx.shadowBlur = 28;
        } else {
            ctx.shadowColor = "#FFFFFF";
            ctx.shadowBlur = 18;
        }

        // A esfera permanece branca; a eletricidade azul é uma camada externa.
        ctx.beginPath();
        ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
        ctx.fillStyle = "#FFFFFF";
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.beginPath();
        ctx.arc(ball.x - ball.radius * 0.3, ball.y - ball.radius * 0.3,
            ball.radius * 0.24, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(255,255,255,0.85)";
        ctx.fill();
        ctx.restore();
    }

    function reset() {
        ball = null;
        spawnTimer = 0;
        knockbackX = 0;
        knockbackY = 0;
        controlSlowTimer = 0;
        overloadHits = 0;
        electrifiedTimer = 0;
        stunTimer = 0;
        nextStunIn = 0;
    }

    function getControlMultiplier() {
        if (stunTimer > 0) return 0;
        if (controlSlowTimer <= 0) return 1;
        const duration = Math.max(CONFIG.controlRecoveryDuration, 0.001);
        const progress = 1 - controlSlowTimer / duration;
        return CONFIG.controlMinMultiplier + (1 - CONFIG.controlMinMultiplier) * progress;
    }

    function configure(options) {
        if (!options || typeof options !== "object") return getConfig();
        for (const key of Object.keys(CONFIG)) {
            if (Object.prototype.hasOwnProperty.call(options, key) &&
                Number.isFinite(options[key]) && options[key] > 0) CONFIG[key] = options[key];
        }
        if (ball) ball.radius = CONFIG.radius;
        return getConfig();
    }

    function getConfig() { return { ...CONFIG }; }

    function getState() {
        return {
            active: Boolean(ball),
            ball: ball ? { ...ball } : null,
            spawnTimer,
            knockback: { x: knockbackX, y: knockbackY },
            controlSlowTimer,
            controlMultiplier: getControlMultiplier(),
            impactCount: overloadHits,
            overloaded: Boolean(ball && ball.electric),
            electrifiedTimer,
            stunTimer
        };
    }

    function remove() {
        ball = null;
        spawnTimer = 0;
        overloadHits = 0;
    }

    window.ONREDPingPong = {
        update, draw, reset, spawn, remove, configure, getConfig, getState, getControlMultiplier
    };

    console.log("[ON RED] Ping Pong elétrico carregado.");
})();
