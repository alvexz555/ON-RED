/*
 * ON RED
 * PING PONG ENEMY
 * Movimento autônomo, rebote nas paredes e no jogador.
 */
(function () {
    "use strict";

    const CONFIG = {
        radius: 12,
        speed: 380,
        spawnInterval: 10, // Padrão provisório de teste; ajustar após playtests.
        spawnMargin: 32,
        minPlayerDistance: 130,
        spawnAttempts: 40,
        knockbackSpeed: 900,
        knockbackDamping: 4,
        controlRecoveryDuration: 1,
        controlMinMultiplier: 0.2
    };

    let ball = null;
    let spawnTimer = 0;
    let knockbackX = 0;
    let knockbackY = 0;
    let controlSlowTimer = 0;

    function clamp(value, min, max) {
        return Math.max(min, Math.min(max, value));
    }

    function isClearOfObstacles(x, y, obstacles, obstacleSize) {
        if (!Array.isArray(obstacles)) return true;

        const half = (Number(obstacleSize) || 0) / 2;
        for (const obstacle of obstacles) {
            const closestX = clamp(x, obstacle.x - half, obstacle.x + half);
            const closestY = clamp(y, obstacle.y - half, obstacle.y + half);
            const dx = x - closestX;
            const dy = y - closestY;
            if (dx * dx + dy * dy < CONFIG.radius * CONFIG.radius) {
                return false;
            }
        }
        return true;
    }

    function createSpawnPosition(arena, player, obstacles, obstacleSize, hexSystem) {
        const minX = CONFIG.radius + CONFIG.spawnMargin;
        const maxX = Math.max(minX, arena.width - minX);
        const minY = CONFIG.radius + CONFIG.spawnMargin;
        const maxY = Math.max(minY, arena.height - minY);

        let candidate = {
            x: clamp(arena.width * 0.75, minX, maxX),
            y: clamp(arena.height * 0.25, minY, maxY)
        };

        for (let attempt = 0; attempt < CONFIG.spawnAttempts; attempt++) {
            candidate = {
                x: minX + Math.random() * (maxX - minX),
                y: minY + Math.random() * (maxY - minY)
            };

            const playerDistance = Math.hypot(
                candidate.x - player.x,
                candidate.y - player.y
            );

            const clearOfPlayer =
                playerDistance >= player.radius +
                CONFIG.radius +
                CONFIG.minPlayerDistance;

            if (
                clearOfPlayer &&
                isClearOfObstacles(
                    candidate.x,
                    candidate.y,
                    obstacles,
                    obstacleSize
                ) &&
                (!hexSystem || hexSystem.isCirclePositionClear({
                    x: candidate.x, y: candidate.y, radius: CONFIG.radius
                }))
            ) {
                return candidate;
            }
        }

        return null;
    }

    function randomDirection() {
        let angle = 0;
        let vx = 0;
        let vy = 0;

        // Evita trajetórias quase horizontais ou verticais.
        for (let attempt = 0; attempt < 30; attempt++) {
            angle = Math.random() * Math.PI * 2;
            vx = Math.cos(angle);
            vy = Math.sin(angle);

            if (Math.abs(vx) >= 0.2 && Math.abs(vy) >= 0.2) {
                break;
            }
        }

        return { x: vx, y: vy };
    }

    function spawn(arena, player, obstacles, obstacleSize, hexSystem) {
        if (ball || !arena || !player) return false;

        const position = createSpawnPosition(
            arena,
            player,
            obstacles,
            obstacleSize,
            hexSystem
        );
        if (!position) return false;

        const direction = randomDirection();

        ball = {
            x: position.x,
            y: position.y,
            vx: direction.x * CONFIG.speed,
            vy: direction.y * CONFIG.speed,
            radius: CONFIG.radius
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

        player.x = clamp(
            player.x,
            player.radius,
            Math.max(player.radius, arena.width - player.radius)
        );
        player.y = clamp(
            player.y,
            player.radius,
            Math.max(player.radius, arena.height - player.radius)
        );

        const damping = Math.exp(-CONFIG.knockbackDamping * deltaTime);
        knockbackX *= damping;
        knockbackY *= damping;
    }

    function bounceFromWalls(arena) {
        const minX = ball.radius;
        const maxX = Math.max(minX, arena.width - ball.radius);
        const minY = ball.radius;
        const maxY = Math.max(minY, arena.height - ball.radius);

        if (ball.x < minX) {
            ball.x = minX;
            if (ball.vx < 0) ball.vx = Math.abs(ball.vx);
        } else if (ball.x > maxX) {
            ball.x = maxX;
            if (ball.vx > 0) ball.vx = -Math.abs(ball.vx);
        }

        if (ball.y < minY) {
            ball.y = minY;
            if (ball.vy < 0) ball.vy = Math.abs(ball.vy);
        } else if (ball.y > maxY) {
            ball.y = maxY;
            if (ball.vy > 0) ball.vy = -Math.abs(ball.vy);
        }
    }

    function collideWithPlayer(player, healthSystem, collisionSystem) {
        const dx = player.x - ball.x;
        const dy = player.y - ball.y;
        const minimumDistance = player.radius + ball.radius;
        const distanceSquared = dx * dx + dy * dy;

        if (distanceSquared > minimumDistance * minimumDistance) {
            return;
        }

        const distance = Math.sqrt(distanceSquared);
        let nx;
        let ny;

        if (distance > 0.0001) {
            nx = dx / distance;
            ny = dy / distance;
        } else {
            const speed = Math.hypot(ball.vx, ball.vy) || 1;
            nx = ball.vx / speed;
            ny = ball.vy / speed;
        }

        // Separa a bola do jogador para impedir colisões repetidas
        // causadas pela mesma sobreposição.
        const overlap = minimumDistance - distance;
        ball.x -= nx * (overlap + 0.5);
        ball.y -= ny * (overlap + 0.5);

        // Reflexão vetorial: v' = v - 2(v · n)n.
        const velocityAlongNormal = ball.vx * nx + ball.vy * ny;
        if (velocityAlongNormal > 0) {
            ball.vx -= 2 * velocityAlongNormal * nx;
            ball.vy -= 2 * velocityAlongNormal * ny;
        }

        // O jogador recebe impulso para longe do centro da bola.
        knockbackX = nx * CONFIG.knockbackSpeed;
        knockbackY = ny * CONFIG.knockbackSpeed;

        // Reduz temporariamente a influência dos controles do jogador.
        controlSlowTimer = CONFIG.controlRecoveryDuration;

        // Compartilha a janela global de invulnerabilidade do jogo.
        const registered = collisionSystem
            ? collisionSystem.registerCollision()
            : true;

        if (registered && healthSystem) {
            const damage = collisionSystem
                ? collisionSystem.getState().damage
                : 25;
            const result = healthSystem.applyDamage(damage);

            if (result.gameOver && typeof window.triggerGameOver === "function") {
                window.triggerGameOver();
            }
        }
    }

    function update(
        deltaTime,
        player,
        arena,
        healthSystem,
        collisionSystem,
        obstacles,
        obstacleSize,
        hexSystem
    ) {
        if (
            !Number.isFinite(deltaTime) ||
            deltaTime < 0 ||
            !player ||
            !arena ||
            !Number.isFinite(arena.width) ||
            !Number.isFinite(arena.height)
        ) {
            return;
        }

        controlSlowTimer = Math.max(0, controlSlowTimer - deltaTime);

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

        bounceFromWalls(arena);
        if (hexSystem && typeof hexSystem.resolvePingPongCollision === "function") {
            hexSystem.resolvePingPongCollision(ball);
        }
        collideWithPlayer(player, healthSystem, collisionSystem);
        bounceFromWalls(arena);
    }

    function draw(ctx) {
        if (!ctx || !ball) return;

        ctx.save();
        ctx.beginPath();
        ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
        ctx.fillStyle = "#FFFFFF";
        ctx.shadowColor = "#FFFFFF";
        ctx.shadowBlur = 18;
        ctx.fill();

        ctx.shadowBlur = 0;
        ctx.beginPath();
        ctx.arc(
            ball.x - ball.radius * 0.3,
            ball.y - ball.radius * 0.3,
            ball.radius * 0.24,
            0,
            Math.PI * 2
        );
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
    }

    function getControlMultiplier() {
        if (controlSlowTimer <= 0) return 1;

        const duration = Math.max(CONFIG.controlRecoveryDuration, 0.001);
        const progress = 1 - controlSlowTimer / duration;

        return CONFIG.controlMinMultiplier +
            (1 - CONFIG.controlMinMultiplier) * progress;
    }

    function configure(options) {
        if (!options || typeof options !== "object") return getConfig();

        for (const key of Object.keys(CONFIG)) {
            if (
                Object.prototype.hasOwnProperty.call(options, key) &&
                Number.isFinite(options[key]) &&
                options[key] > 0
            ) {
                CONFIG[key] = options[key];
            }
        }

        if (ball) {
            ball.radius = CONFIG.radius;
            const speed = Math.hypot(ball.vx, ball.vy) || 1;
            ball.vx = (ball.vx / speed) * CONFIG.speed;
            ball.vy = (ball.vy / speed) * CONFIG.speed;
        }

        return getConfig();
    }

    function getConfig() {
        return { ...CONFIG };
    }

    function getState() {
        return {
            active: Boolean(ball),
            ball: ball ? { ...ball } : null,
            spawnTimer,
            knockback: { x: knockbackX, y: knockbackY },
            controlSlowTimer,
            controlMultiplier: getControlMultiplier()
        };
    }

    function remove() {
        ball = null;
        spawnTimer = 0;
    }

    window.ONREDPingPong = {
        update,
        draw,
        reset,
        spawn,
        remove,
        configure,
        getConfig,
        getState,
        getControlMultiplier
    };

    console.log("[ON RED] Ping Pong Enemy carregado.");
})();
