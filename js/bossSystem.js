/*
 * ON RED
 * BOSS SYSTEM — FINAL BOSS OF PHASE 1
 * WARNING -> FIGHT -> DEFEATED -> IDLE (a vitória é disparada pelo engine)
 *
 * O Boss final da Fase 1:
 * - WARNING (1,8s): aviso antes da aproximação.
 * - FIGHT: patrulha lenta no terço superior, raios telegrafados, pongs.
 * - DEFEATED (1,0s): explosão; o engine assume a vitória.
 */
(function (root) {
    "use strict";

    const CONFIG = {
        triggerScore: 20000,
        bossSize: 150,
        minBossSize: 96,
        bossHp: 1000,
        damagePerParry: 100,
        moveSpeed: 45,
        patrolAmplitudeRatio: 0.3,
        patrolYRatio: 0.22,
        warningDuration: 1.8,
        defeatDuration: 1.0,
        victoryBonusScore: 5000,
        ray: {
            firstIn: 5.0,
            interval: 7.0,
            telegraphDuration: 1.0,
            sequenceTelegraphDuration: 0.9,
            activeDuration: 0.16,
            radius: 105,
            singleRadius: 170,
            sequenceRadius: 85,
            sequenceCount: 5,
            sequenceSpacing: 150,
            sequenceDelay: 0.55,
            predictionStep: 0.22,
            predictionMaxDistance: 150,
            damage: 25
        },
        pong: {
            white: {
                firstIn: 2.0,
                interval: 3.4,
                speed: 380,
                radius: 12,
                damage: 25,
                reboundSpeed: 420,
                windowDistance: 105
            },
            electric: {
                interval: 6.8,
                lifetime: 8.0,
                projectiles: 2,
                speed: 380,
                angleStep: Math.PI / 20,
                damage: 25,
                wallSpeedMultiplier: 1.2,
                maxSpeed: 1200,
                electrifiedDuration: 3.0,
                stunIntervalMin: 0.22,
                stunIntervalMax: 0.58,
                stunDurationMin: 0.10,
                stunDurationMax: 0.22
            }
        }
    };

    const RAY_SPEED = 300;

    // Seleção de dificuldade da Fase 1 (requisito da ordem original).
    // NORMAL reproduz exatamente os valores aprovados; EASY e HARD são
    // propostas configuráveis, sujeitas a ajuste antes de se tornarem
    // definitivas.
    const DIFFICULTY_PRESETS = {
        EASY: {
            bossHp: 600,
            moveSpeed: 36,
            ray: { interval: 9.0 },
            pong: { white: { interval: 4.2 }, electric: { interval: 8.5 } }
        },
        NORMAL: {},
        HARD: {
            bossHp: 1400,
            moveSpeed: 58,
            ray: { interval: 5.5 },
            pong: { white: { interval: 2.8 }, electric: { interval: 5.2 } }
        }
    };

    function applyDifficultyPreset(name) {
        const preset = DIFFICULTY_PRESETS[name];
        if (!preset) return;
        configure({
            bossHp: preset.bossHp,
            moveSpeed: preset.moveSpeed,
            ray: preset.ray,
            pong: preset.pong
        });
    }

    let difficulty = "NORMAL";

    // Instantâneo dos valores de fábrica para o preset NORMAL restaurar.
    const BASELINE = JSON.parse(JSON.stringify({
        bossHp: CONFIG.bossHp,
        moveSpeed: CONFIG.moveSpeed,
        ray: CONFIG.ray,
        pong: CONFIG.pong
    }));

    function setDifficulty(name) {
        if (!name || !DIFFICULTY_PRESETS[name]) return getDifficulty();
        difficulty = name;
        if (name === "NORMAL") {
            configure(BASELINE);
        } else {
            applyDifficultyPreset(name);
        }
        return getDifficulty();
    }

    function getDifficulty() {
        return { difficulty, presets: Object.keys(DIFFICULTY_PRESETS) };
    }

    let phase = "IDLE";
    let phaseTimer = 0;
    let fightTimer = 0;
    let boss = {
        x: 0,
        y: 0,
        size: CONFIG.bossSize,
        hp: CONFIG.bossHp,
        maxHP: CONFIG.bossHp,
        baseX: 0,
        baseY: 0,
        amplitudeX: 0,
        patrolPhase: 0,
        defeated: false
    };
    let weapon = null;
    let electricWeapon = null;
    let electricTrails = [];
    let whiteTimer = CONFIG.pong.white.firstIn;
    let rayTimer = CONFIG.ray.firstIn;
    let electricTimer = CONFIG.pong.electric.interval;
    let rayVolleyIndex = 0;
    // Ciclo obrigatório da Boss Fight: A (single) -> C (sequence) -> A -> C...
    // O padrão só avança quando um ataque de área é efetivamente disparado.
    let nextAreaPattern = "single";
    let playerMotion = { x: null, y: null, vx: 0, vy: 0 };
    let activeArena = null;
    let electrifiedTimer = 0;
    let stunTimer = 0;
    let nextStunIn = 0;
    // Um Boss derrotado não volta a aparecer na mesma partida;
    // só o reset de partida limpa esta marcação.
    let conquered = false;

    function clamp(value, min, max) {
        return Math.max(min, Math.min(max, value));
    }

    function reset() {
        phase = "IDLE";
        phaseTimer = 0;
        fightTimer = 0;
        conquered = false;
        boss = {
            x: 0,
            y: 0,
            size: CONFIG.bossSize,
            hp: CONFIG.bossHp,
            maxHP: CONFIG.bossHp,
            baseX: 0,
            baseY: 0,
            amplitudeX: 0,
            patrolPhase: 0,
            defeated: false
        };
        weapon = null;
        electricWeapon = null;
        electricTrails = [];
        whiteTimer = CONFIG.pong.white.firstIn;
        rayTimer = CONFIG.ray.firstIn;
        electricTimer = CONFIG.pong.electric.interval;
        rayVolleyIndex = 0;
        nextAreaPattern = "single";
        playerMotion = { x: null, y: null, vx: 0, vy: 0 };
        activeArena = null;
        electrifiedTimer = 0;
        stunTimer = 0;
        nextStunIn = 0;

        return getState();
    }

    function getConfig() {
        return {
            triggerScore: CONFIG.triggerScore,
            bossSize: CONFIG.bossSize,
            minBossSize: CONFIG.minBossSize,
            bossHp: CONFIG.bossHp,
            damagePerParry: CONFIG.damagePerParry,
            moveSpeed: CONFIG.moveSpeed,
            patrolAmplitudeRatio: CONFIG.patrolAmplitudeRatio,
            patrolYRatio: CONFIG.patrolYRatio,
            warningDuration: CONFIG.warningDuration,
            defeatDuration: CONFIG.defeatDuration,
            victoryBonusScore: CONFIG.victoryBonusScore,
            ray: { ...CONFIG.ray },
            pong: {
                white: { ...CONFIG.pong.white },
                electric: { ...CONFIG.pong.electric }
            }
        };
    }

    function shouldStart(scoreValue) {
        if (conquered) return false;
        const value = Number(scoreValue);
        return Number.isFinite(value) && value >= CONFIG.triggerScore;
    }

    function configure(options) {
        if (!options || typeof options !== "object") return getConfig();

        const numericKeys = [
            "triggerScore", "bossSize", "minBossSize", "bossHp", "damagePerParry",
            "moveSpeed", "patrolAmplitudeRatio", "patrolYRatio", "warningDuration",
            "defeatDuration", "victoryBonusScore"
        ];
        for (const key of numericKeys) {
            if (
                Object.prototype.hasOwnProperty.call(options, key) &&
                Number.isFinite(options[key]) && options[key] > 0
            ) {
                CONFIG[key] = options[key];
            }
        }

        if (options.ray) {
            for (const key of Object.keys(CONFIG.ray)) {
                if (Number.isFinite(options.ray[key]) && options.ray[key] > 0) {
                    CONFIG.ray[key] = options.ray[key];
                }
            }
        }

        if (options.pong) {
            if (options.pong.white) {
                for (const key of Object.keys(CONFIG.pong.white)) {
                    if (Number.isFinite(options.pong.white[key]) && options.pong.white[key] > 0) {
                        CONFIG.pong.white[key] = options.pong.white[key];
                    }
                }
            }
            if (options.pong.electric) {
                for (const key of Object.keys(CONFIG.pong.electric)) {
                    if (Number.isFinite(options.pong.electric[key]) && options.pong.electric[key] > 0) {
                        CONFIG.pong.electric[key] = options.pong.electric[key];
                    }
                }
            }
        }

        return getConfig();
    }

    function start(arena, player) {
        if (conquered || phase !== "IDLE") return getState();

        phase = "WARNING";
        phaseTimer = CONFIG.warningDuration;

        const width = arena && Number.isFinite(arena.width) ? arena.width : CONFIG.bossSize * 3;
        const height = arena && Number.isFinite(arena.height) ? arena.height : CONFIG.bossSize * 3;

        boss.size = clamp(CONFIG.bossSize, CONFIG.minBossSize, width * 0.34);
        boss.amplitudeX = Math.min(width * CONFIG.patrolAmplitudeRatio, boss.size * 2);
        boss.baseX = width / 2;
        boss.baseY = height * CONFIG.patrolYRatio;
        // O Boss já aparece na posição correta durante WARNING.
        boss.x = boss.baseX;
        boss.y = boss.baseY;
        boss.hp = boss.maxHP;
        boss.defeated = false;
        boss.patrolPhase = 0;

        return getState();
    }

    function updateBossMovement(deltaTime, arena) {
        if (phase !== "FIGHT") return;

        const half = boss.size / 2;
        const minX = Math.max(half, 0);
        const maxX = Math.max(arena.width - half, half);
        const minY = Math.max(half, 0);
        const maxY = Math.max(arena.height - half, half);

        boss.x = clamp(arena.width / 2 + Math.sin(boss.patrolPhase) * boss.amplitudeX, minX, maxX);
        boss.y = clamp(arena.height * CONFIG.patrolYRatio, minY, maxY);
        boss.patrolPhase += deltaTime * (CONFIG.moveSpeed / Math.max(boss.amplitudeX, 0.0001));
    }

    function fireWhite(player) {
        const angle = player ? Math.atan2(player.y - boss.y, player.x - boss.x) : Math.atan2(0, 1);
        const speed = CONFIG.pong.white.speed;
        weapon = {
            type: "white",
            kind: "white",
            state: "ACTIVE",
            timer: 0,
            x: boss.x,
            y: boss.y,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            radius: CONFIG.pong.white.radius,
            damage: CONFIG.pong.white.damage,
            reboundSpeed: CONFIG.pong.white.reboundSpeed,
            windowDistance: CONFIG.pong.white.windowDistance,
            consumed: false,
            impactCount: 0,
            electric: false
        };
    }

    function predictPlayerPosition(player, arena, radius, leadSeconds) {
        const speed = Math.hypot(playerMotion.vx, playerMotion.vy);
        const scale = speed > 0
            ? Math.min(leadSeconds, CONFIG.ray.predictionMaxDistance / speed)
            : 0;
        const x = player.x + playerMotion.vx * scale;
        const y = player.y + playerMotion.vy * scale;
        return {
            x: clamp(x, radius, Math.max(radius, arena.width - radius)),
            y: clamp(y, radius, Math.max(radius, arena.height - radius))
        };
    }

    function fireRay(player, arena) {
        const pattern = nextAreaPattern;
        nextAreaPattern = nextAreaPattern === "single" ? "sequence" : "single";
        const count = pattern === "single" ? 1 : CONFIG.ray.sequenceCount;
        const blasts = [];

        if (pattern === "single") {
            const radius = CONFIG.ray.singleRadius;
            const x = clamp(player ? player.x : arena.width / 2, radius, arena.width - radius);
            const y = clamp(player ? player.y : arena.height / 2, radius, arena.height - radius);
            blasts.push({
                x, y, radius,
                damage: CONFIG.ray.damage,
                state: "TELEGRAPH",
                timer: CONFIG.ray.telegraphDuration,
                activeTimer: CONFIG.ray.activeDuration,
                targetLocked: true
            });
        } else {
            for (let i = 0; i < count; i++) {
                const blast = {
                    x: null,
                    y: null,
                    radius: CONFIG.ray.sequenceRadius,
                    damage: CONFIG.ray.damage,
                    state: i === 0 ? "TELEGRAPH" : "WAITING",
                    timer: i === 0 ? CONFIG.ray.sequenceTelegraphDuration : i * CONFIG.ray.sequenceDelay,
                    activeTimer: CONFIG.ray.activeDuration,
                    targetLocked: false
                };
                if (i === 0) {
                    const target = predictPlayerPosition(
                        player || { x: arena.width / 2, y: arena.height / 2 },
                        arena, blast.radius, 0
                    );
                    blast.x = target.x;
                    blast.y = target.y;
                    blast.targetLocked = true;
                }
                blasts.push(blast);
            }
        }

        weapon = { type: "ray", kind: "area", state: "TELEGRAPH", pattern, blasts };
    }

    function fireElectric(player) {
        const aimX = player ? clamp(player.x + playerMotion.vx * 0.18, CONFIG.pong.white.radius, Math.max(CONFIG.pong.white.radius, arenaWidth() - CONFIG.pong.white.radius)) : boss.x + 1;
        const aimY = player ? clamp(player.y + playerMotion.vy * 0.18, CONFIG.pong.white.radius, Math.max(CONFIG.pong.white.radius, arenaHeight() - CONFIG.pong.white.radius)) : boss.y;
        const baseAngle = Math.atan2(aimY - boss.y, aimX - boss.x);
        const perpendicularX = -Math.sin(baseAngle);
        const perpendicularY = Math.cos(baseAngle);
        const flankOffset = 46;
        const projectiles = [];

        for (let i = 0; i < CONFIG.pong.electric.projectiles; i++) {
            // Os disparos fecham os dois lados da posição prevista do jogador.
            const side = i % 2 === 0 ? -1 : 1;
            const targetX = aimX + perpendicularX * flankOffset * side;
            const targetY = aimY + perpendicularY * flankOffset * side;
            const angle = Math.atan2(targetY - boss.y, targetX - boss.x);
            projectiles.push({
                type: "electric",
                kind: "electric",
                state: "ACTIVE",
                x: boss.x,
                y: boss.y,
                vx: Math.cos(angle) * CONFIG.pong.electric.speed,
                vy: Math.sin(angle) * CONFIG.pong.electric.speed,
                radius: CONFIG.pong.white.radius,
                damage: CONFIG.pong.electric.damage,
                impactCount: 0,
                electric: true,
                targetX,
                targetY
            });
        }

        electricWeapon = {
            type: "electric",
            state: "ACTIVE",
            timer: CONFIG.pong.electric.lifetime,
            projectiles
        };
        electricTimer = CONFIG.pong.electric.interval;
    }

    function arenaWidth() {
        return activeArena ? activeArena.width : CONFIG.bossSize * 3;
    }

    function arenaHeight() {
        return activeArena ? activeArena.height : CONFIG.bossSize * 3;
    }

    function distanceToSegment(point, start, end) {
        const dx = end.x - start.x;
        const dy = end.y - start.y;
        const lengthSquared = dx * dx + dy * dy || 1;
        const projection = clamp(
            ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared,
            0,
            1
        );
        const closestX = start.x + projection * dx;
        const closestY = start.y + projection * dy;
        return Math.hypot(point.x - closestX, point.y - closestY);
    }

    function updateRay(deltaTime, arena, player, health, collision) {
        if (!weapon || !Array.isArray(weapon.blasts)) return;
        for (const blast of weapon.blasts) {
            if (blast.state === "DONE") continue;

            // C: cada marca só captura a posição do jogador quando sua vez começa.
            // Depois de marcada, a coordenada fica travada até a detonação.
            if (blast.state === "WAITING") {
                blast.timer -= deltaTime;
                if (blast.timer <= 0) {
                    const blastIndex = weapon.blasts.indexOf(blast);
                    const target = predictPlayerPosition(
                        player, arena, blast.radius,
                        blastIndex * CONFIG.ray.predictionStep
                    );
                    blast.x = target.x;
                    blast.y = target.y;
                    blast.targetLocked = true;
                    blast.state = "TELEGRAPH";
                    blast.timer = CONFIG.ray.sequenceTelegraphDuration;
                }
            } else if (blast.state === "TELEGRAPH") {
                blast.timer -= deltaTime;
                if (blast.timer <= 0) {
                    blast.state = "ACTIVE";
                    const distance = Math.hypot(player.x - blast.x, player.y - blast.y);
                    if (distance <= blast.radius + (player.radius || 0) &&
                        collision && collision.registerCollision()) {
                        health.applyDamage(blast.damage);
                    }
                }
            } else if (blast.state === "ACTIVE") {
                blast.activeTimer -= deltaTime;
                if (blast.activeTimer <= 0) blast.state = "DONE";
            }
        }
        if (weapon.blasts.every(blast => blast.state === "DONE")) weapon = null;
    }

    function updateWhite(deltaTime, player, health, collision, arena) {
        if (weapon.state === "RETURNING") {
            // Rebatida: o projétil retorna contra o Boss (persegue o corpo atual).
            const dx = boss.x - weapon.x;
            const dy = boss.y - weapon.y;
            const distance = Math.hypot(dx, dy) || 1;
            const speed = weapon.reboundSpeed || CONFIG.pong.white.reboundSpeed;
            weapon.vx = (dx / distance) * speed;
            weapon.vy = (dy / distance) * speed;
            weapon.x += weapon.vx * deltaTime;
            weapon.y += weapon.vy * deltaTime;
            const distanceAfterMove = Math.hypot(boss.x - weapon.x, boss.y - weapon.y);

            if (distanceAfterMove <= boss.size / 2 + weapon.radius) {
                const impact = applyBossDamage(CONFIG.damagePerParry);
                weapon = null;
                return impact;
            }
            return null;
        }

        if (weapon.state !== "ACTIVE") return;

        weapon.x += weapon.vx * deltaTime;
        weapon.y += weapon.vy * deltaTime;

        if (collision && collision.checkCollisions(player, [weapon], weapon.radius)) {
            const damage = weapon.damage;
            weapon = null;
            if (collision.registerCollision()) {
                health.applyDamage(damage);
            }
            return;
        }

        bounceProjectileFromWalls(weapon, arena);
    }

    function bounceProjectileFromWalls(projectile, arena) {
        if (!projectile || !arena) return false;
        const minX = projectile.radius;
        const maxX = Math.max(minX, arena.width - projectile.radius);
        const minY = projectile.radius;
        const maxY = Math.max(minY, arena.height - projectile.radius);
        let bounced = false;

        if (projectile.x < minX) {
            projectile.x = minX;
            if (projectile.vx < 0) { projectile.vx = Math.abs(projectile.vx); bounced = true; }
        } else if (projectile.x > maxX) {
            projectile.x = maxX;
            if (projectile.vx > 0) { projectile.vx = -Math.abs(projectile.vx); bounced = true; }
        }

        if (projectile.y < minY) {
            projectile.y = minY;
            if (projectile.vy < 0) { projectile.vy = Math.abs(projectile.vy); bounced = true; }
        } else if (projectile.y > maxY) {
            projectile.y = maxY;
            if (projectile.vy > 0) { projectile.vy = -Math.abs(projectile.vy); bounced = true; }
        }
        if (bounced) {
            projectile.impactCount = (projectile.impactCount || 0) + 1;
            const speed = Math.hypot(projectile.vx, projectile.vy);
            if (!projectile.electric && projectile.impactCount >= 20) {
                projectile.electric = true;
                projectile.impactCount = 20;
            }
            if (speed > 0) {
                const multiplier = projectile.electric ? CONFIG.pong.electric.wallSpeedMultiplier : 1.08;
                const maxSpeed = projectile.electric ? CONFIG.pong.electric.maxSpeed : 1200;
                const nextSpeed = Math.min(speed * multiplier, maxSpeed);
                let angle = Math.atan2(projectile.vy, projectile.vx);
                if (projectile.electric) {
                    // Cada ricochete elétrico altera um pouco o ângulo, além de acelerar.
                    angle += projectile.impactCount % 2 === 0 ? -0.14 : 0.14;
                }
                projectile.vx = Math.cos(angle) * nextSpeed;
                projectile.vy = Math.sin(angle) * nextSpeed;
            }
        }
        return bounced;
    }

    function randomBetween(min, max) { return min + Math.random() * (max - min); }

    function electrifyPlayer() {
        electrifiedTimer = CONFIG.pong.electric.electrifiedDuration;
        stunTimer = 0;
        nextStunIn = randomBetween(CONFIG.pong.electric.stunIntervalMin, CONFIG.pong.electric.stunIntervalMax);
    }

    function updateElectricalState(deltaTime) {
        if (electrifiedTimer <= 0) return;
        electrifiedTimer = Math.max(0, electrifiedTimer - deltaTime);
        if (stunTimer > 0) stunTimer = Math.max(0, stunTimer - deltaTime);
        else {
            nextStunIn -= deltaTime;
            if (nextStunIn <= 0 && electrifiedTimer > 0) {
                stunTimer = randomBetween(CONFIG.pong.electric.stunDurationMin, CONFIG.pong.electric.stunDurationMax);
                nextStunIn = randomBetween(CONFIG.pong.electric.stunIntervalMin, CONFIG.pong.electric.stunIntervalMax);
            }
        }
        if (electrifiedTimer === 0) { stunTimer = 0; nextStunIn = 0; }
    }

    function getControlMultiplier() { return stunTimer > 0 ? 0 : 1; }

    function updateElectric(deltaTime, player, health, collision, arena) {
        if (electricWeapon) {
            electricWeapon.timer -= deltaTime;
            for (const projectile of electricWeapon.projectiles) {
                if (projectile.state !== "ACTIVE") continue;
                const previousX = projectile.x;
                const previousY = projectile.y;
                projectile.x += projectile.vx * deltaTime;
                projectile.y += projectile.vy * deltaTime;

                if (bounceProjectileFromWalls(projectile, arena)) {
                    electricTrails.push({
                        x1: previousX,
                        y1: previousY,
                        x2: projectile.x,
                        y2: projectile.y,
                        radius: 8,
                        damage: 12,
                        timer: 1.15,
                        consumed: false
                    });
                }

                if (
                    collision &&
                    collision.checkCollisions(player, [projectile], projectile.radius * 2)
                ) {
                    projectile.state = "CONSUMED";
                    electrifyPlayer();
                    if (collision.registerCollision()) health.applyDamage(projectile.damage);
                }
            }

            if (electricWeapon.timer <= 0) {
                electricWeapon = null;
            }
        }

        for (const trail of electricTrails) {
            trail.timer = Math.max(0, trail.timer - deltaTime);
            if (trail.consumed || trail.timer <= 0) continue;
            const distance = distanceToSegment(
                player,
                { x: trail.x1, y: trail.y1 },
                { x: trail.x2, y: trail.y2 }
            );
            if (distance <= (player.radius || 0) + trail.radius) {
                trail.consumed = true;
                if (collision && collision.registerCollision()) {
                    health.applyDamage(trail.damage);
                }
            }
        }
        electricTrails = electricTrails.filter(trail => trail.timer > 0);
    }

    function updateCombat(deltaTime, arena, player, health, collision) {
        if (phase !== "FIGHT") return;

        if (weapon && weapon.state === "CONSUMED") weapon = null;

        // Os relógios avançam em paralelo: o Pong elétrico pode coexistir
        // com a explosão A/C ou com o Pong branco.
        whiteTimer -= deltaTime;
        rayTimer -= deltaTime;
        electricTimer -= deltaTime;

        if (!weapon) {
            if (whiteTimer <= 0) {
                whiteTimer = CONFIG.pong.white.interval;
                fireWhite(player);
            } else if (rayTimer <= 0) {
                rayTimer = CONFIG.ray.interval;
                fireRay(player, arena);
            }
        }

        if (weapon && weapon.type === "ray") {
            updateRay(deltaTime, arena, player, health, collision);
        } else if (weapon && weapon.type === "white") {
            updateWhite(deltaTime, player, health, collision, arena);
        }

        if (!electricWeapon && electricTimer <= 0) fireElectric(player);
        if (electricWeapon || electricTrails.length) {
            updateElectric(deltaTime, player, health, collision, arena);
        }

        const bossBody = { x: boss.x, y: boss.y, state: "ACTIVE", kind: "boss" };
        if (collision && collision.checkCollisions(player, [bossBody], boss.size)) {
            if (collision.registerCollision()) {
                health.applyDamage(collision.getState().damage);
            }
        }
    }

    function updatePlayerMotion(deltaTime, player) {
        if (!(deltaTime > 0)) return;
        if (playerMotion.x === null || playerMotion.y === null) {
            playerMotion.x = player.x;
            playerMotion.y = player.y;
            return;
        }
        const rawVx = (player.x - playerMotion.x) / deltaTime;
        const rawVy = (player.y - playerMotion.y) / deltaTime;
        const speed = Math.hypot(rawVx, rawVy);
        const maxSpeed = 650;
        const factor = speed > maxSpeed ? maxSpeed / speed : 1;
        playerMotion.vx = rawVx * factor;
        playerMotion.vy = rawVy * factor;
        playerMotion.x = player.x;
        playerMotion.y = player.y;
    }

    function update(deltaTime, arena, player, health, collision) {
        if (!Number.isFinite(deltaTime) || deltaTime < 0) return getState();
        if (!arena || !Number.isFinite(arena.width) || !Number.isFinite(arena.height)) return getState();
        if (!player) return getState();
        activeArena = arena;

        if (phase === "IDLE") return getState();

        updatePlayerMotion(deltaTime, player);
        updateElectricalState(deltaTime);

        if (phase === "DEFEATED") {
            phaseTimer -= deltaTime;
            if (phaseTimer <= 0) phase = "IDLE";
            return getState();
        }

        if (phase === "WARNING") {
            phaseTimer -= deltaTime;
            if (phaseTimer > 0) return getState();
            phase = "FIGHT";
            fightTimer = 0;
            weapon = null;
        }

        fightTimer += deltaTime;
        updateBossMovement(deltaTime, arena);
        updateCombat(deltaTime, arena, player, health, collision);

        return getState();
    }

    function tryParry(player) {
        if (phase !== "FIGHT") return { applied: false, reason: "phase" };
        if (!weapon || weapon.type !== "white" || weapon.state !== "ACTIVE") {
            return { applied: false, reason: "no_target" };
        }

        const distance = Math.hypot(player.x - weapon.x, player.y - weapon.y);
        const speed = Math.hypot(weapon.vx, weapon.vy) || 1;
        const approaching = (weapon.vx * (player.x - weapon.x) + weapon.vy * (player.y - weapon.y)) > 0;

        if (distance > weapon.windowDistance) return { applied: false, reason: "out_of_range" };
        if (!approaching) return { applied: false, reason: "not_approaching" };

        weapon.state = "RETURNING";
        weapon.parried = true;
        // O projétil rebatido retorna contra o Boss (requisito da ordem original);
        // o dano é registrado no impacto, uma única vez.

        return { applied: true, returning: true, hp: boss.hp, maxHP: boss.maxHP, defeated: false };
    }

    function applyBossDamage(amount) {
        boss.hp = Math.max(0, boss.hp - amount);
        const defeated = boss.hp <= 0;
        if (defeated) {
            electricWeapon = null;
            electricTrails = [];
            phase = "DEFEATED";
            phaseTimer = CONFIG.defeatDuration;
            boss.defeated = true;
            conquered = true;
        }
        return { damage: amount, hp: boss.hp, maxHP: boss.maxHP, defeated };
    }

    function drawWeapon(ctx) {
        if (weapon && weapon.type === "ray") {
            for (const blast of weapon.blasts || []) {
                if (blast.state === "DONE" || blast.state === "WAITING") continue;
                ctx.save();
                const active = blast.state === "ACTIVE";
                ctx.globalAlpha = active ? 0.85 : 0.42;
                ctx.fillStyle = active ? "#FF303F" : "#FF5964";
                ctx.strokeStyle = "#FF303F";
                ctx.lineWidth = active ? 4 : 2;
                ctx.shadowColor = "#FF303F";
                ctx.shadowBlur = active ? 24 : 10;
                ctx.beginPath();
                ctx.arc(blast.x, blast.y, blast.radius, 0, Math.PI * 2);
                if (active) ctx.fill(); else ctx.stroke();
                ctx.restore();
            }
        }

        if (weapon && weapon.type === "white") {
            ctx.save();
            ctx.shadowColor = weapon.electric ? "#35CFFF" : "#FFFFFF";
            ctx.shadowBlur = weapon.electric ? 26 : 18;
            ctx.beginPath();
            ctx.arc(weapon.x, weapon.y, weapon.radius, 0, Math.PI * 2);
            ctx.fillStyle = "#FFFFFF";
            ctx.fill();
            if (weapon.electric) {
                ctx.strokeStyle = "#35CFFF";
                ctx.lineWidth = 3;
                ctx.beginPath();
                ctx.arc(weapon.x, weapon.y, weapon.radius + 7, 0, Math.PI * 2);
                ctx.stroke();
            }
            ctx.restore();
        }

        // Rastro de ricochete: zona elétrica temporária que permanece na arena.
        for (const trail of electricTrails) {
            if (trail.consumed || trail.timer <= 0) continue;
            ctx.save();
            ctx.globalAlpha = Math.min(0.82, trail.timer / 1.15);
            ctx.strokeStyle = "#35CFFF";
            ctx.lineWidth = trail.radius * 2;
            ctx.lineCap = "round";
            ctx.shadowColor = "#168BFF";
            ctx.shadowBlur = 18;
            ctx.beginPath();
            ctx.moveTo(trail.x1, trail.y1);
            ctx.lineTo(trail.x2, trail.y2);
            ctx.stroke();
            ctx.restore();
        }

        if (electricWeapon && Array.isArray(electricWeapon.projectiles)) {
            for (const projectile of electricWeapon.projectiles) {
                if (projectile.state !== "ACTIVE") continue;
                ctx.save();
                ctx.shadowColor = "#8CEBFF";
                ctx.shadowBlur = 24;
                ctx.beginPath();
                ctx.arc(projectile.x, projectile.y, projectile.radius, 0, Math.PI * 2);
                ctx.fillStyle = "#FFFFFF";
                ctx.fill();
                ctx.strokeStyle = "#35CFFF";
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.arc(projectile.x, projectile.y, projectile.radius + 7, 0, Math.PI * 2);
                ctx.stroke();
                ctx.restore();
            }
        }
    }

    function draw(ctx, canvas, player) {
        if (!ctx) return;
        if (phase === "IDLE" || phase === "DEFEATED") return;

        ctx.save();
        ctx.shadowColor = "#168BFF";
        ctx.shadowBlur = 26;
        ctx.fillStyle = "#168BFF";
        ctx.fillRect(boss.x - boss.size / 2, boss.y - boss.size / 2, boss.size, boss.size);
        ctx.shadowBlur = 0;
        ctx.fillStyle = "rgba(8, 13, 22, 0.9)";
        ctx.fillRect(boss.x - boss.size / 2 + 10, boss.y - boss.size / 2 + 10, boss.size - 20, boss.size - 20);
        ctx.strokeStyle = "#65B8FF";
        ctx.lineWidth = 3;
        ctx.strokeRect(boss.x - boss.size / 2, boss.y - boss.size / 2, boss.size, boss.size);
        ctx.restore();

        if (weapon || electricWeapon || electricTrails.length) drawWeapon(ctx, canvas);
        if (electrifiedTimer > 0 && player) {
            const pulse = 0.78 + Math.sin(Date.now() / 95) * 0.18;
            ctx.save();
            ctx.globalAlpha = pulse;
            ctx.strokeStyle = "#35CFFF";
            ctx.lineWidth = 2;
            ctx.shadowColor = "#168BFF";
            ctx.shadowBlur = stunTimer > 0 ? 28 : 18;
            ctx.beginPath();
            ctx.arc(player.x, player.y, player.radius + 7 + Math.sin(Date.now() / 120) * 2, 0, Math.PI * 2);
            ctx.stroke();
            ctx.beginPath();
            for (let i = 0; i < 8; i++) {
                const angle = Date.now() / 180 + i * Math.PI / 4;
                ctx.moveTo(player.x + Math.cos(angle) * (player.radius + 3), player.y + Math.sin(angle) * (player.radius + 3));
                ctx.lineTo(player.x + Math.cos(angle + 0.12) * (player.radius + 11 + (i % 2) * 5), player.y + Math.sin(angle + 0.12) * (player.radius + 11 + (i % 2) * 5));
            }
            ctx.stroke();
            if (stunTimer > 0) {
                ctx.strokeStyle = "#FFFFFF"; ctx.globalAlpha = 0.75;
                ctx.beginPath(); ctx.arc(player.x, player.y, player.radius + 2, 0, Math.PI * 2); ctx.stroke();
            }
            ctx.restore();
        }
    }

    function drawHUD(ctx, canvas) {
        if (phase !== "FIGHT") return;
        if (!ctx || !canvas) return;

        const width = Math.min(420, canvas.width * 0.55);
        const height = 8;
        const x = (canvas.width - width) / 2;
        const y = 66;

        ctx.save();
        ctx.fillStyle = "#303743";
        ctx.fillRect(x, y, width, height);
        const ratio = boss.maxHP > 0 ? Math.max(0, Math.min(1, boss.hp / boss.maxHP)) : 0;
        ctx.fillStyle = "#FF303F";
        ctx.fillRect(x, y, width * ratio, height);
        ctx.strokeStyle = "rgba(255,255,255,0.15)";
        ctx.lineWidth = 1;
        ctx.strokeRect(x, y, width, height);
        ctx.fillStyle = "#FFFFFF";
        ctx.font = "bold 10px Arial";
        ctx.textAlign = "center";
        ctx.textBaseline = "bottom";
        ctx.fillText("BOSS", canvas.width / 2, y - 8);
        ctx.textBaseline = "top";
        ctx.fillText(Math.ceil(boss.hp) + " / " + Math.ceil(boss.maxHP), canvas.width / 2, y + height + 10);
        ctx.restore();
    }

    function getState() {
        const cloneWeapon = value => value
            ? {
                ...value,
                projectiles: value.projectiles ? value.projectiles.map(p => ({ ...p })) : null,
                blasts: value.blasts ? value.blasts.map(blast => ({ ...blast })) : null
            }
            : null;
        const weaponCopy = cloneWeapon(weapon);
        const electricWeaponCopy = cloneWeapon(electricWeapon);
        return {
            phase,
            phaseTimer,
            fightTimer,
            boss: { ...boss },
            weapon: weaponCopy,
            electricWeapon: electricWeaponCopy,
            electricTrails: electricTrails.map(trail => ({ ...trail })),
            electrifiedTimer,
            stunTimer,
            controlMultiplier: getControlMultiplier()
        };
    }

    const api = {
        reset,
        start,
        update,
        draw,
        drawHUD,
        tryParry,
        getState,
        getConfig,
        shouldStart,
        configure,
        setDifficulty,
        getDifficulty,
        getControlMultiplier
    };

    if (typeof module !== "undefined" && module.exports) {
        module.exports = api;
    }
    if (root) {
        root.ONREDBossSystem = api;
    }

    console.log("[ON RED] Boss System carregado.");
})(typeof window !== "undefined" ? window : globalThis);
