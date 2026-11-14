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
            telegraphDuration: 1.2,
            activeDuration: 0.16,
            radius: 105,
            sequenceCount: 3,
            sequenceSpacing: 150,
            sequenceDelay: 0.55,
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
                projectiles: 2,
                speed: 380,
                angleStep: Math.PI / 20,
                damage: 25
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
    let whiteTimer = CONFIG.pong.white.firstIn;
    let rayTimer = CONFIG.ray.firstIn;
    let electricTimer = CONFIG.pong.electric.interval;
    let rayVolleyIndex = 0;
    let nextAreaPattern = "single";
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
        whiteTimer = CONFIG.pong.white.firstIn;
        rayTimer = CONFIG.ray.firstIn;
        electricTimer = CONFIG.pong.electric.interval;
        rayVolleyIndex = 0;
        nextAreaPattern = "single";

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

    function fireRay(player, arena) {
        const pattern = nextAreaPattern;
        nextAreaPattern = nextAreaPattern === "single" ? "sequence" : "single";
        const count = pattern === "single" ? 1 : CONFIG.ray.sequenceCount;
        const centerX = clamp(player ? player.x : arena.width / 2, CONFIG.ray.radius, arena.width - CONFIG.ray.radius);
        const centerY = clamp(player ? player.y : arena.height / 2, CONFIG.ray.radius, arena.height - CONFIG.ray.radius);
        const blasts = [];
        for (let i = 0; i < count; i++) {
            const offset = pattern === "single" ? 0 : (i - (count - 1) / 2) * CONFIG.ray.sequenceSpacing;
            blasts.push({
                x: clamp(centerX + offset, CONFIG.ray.radius, arena.width - CONFIG.ray.radius),
                y: centerY,
                radius: CONFIG.ray.radius,
                damage: CONFIG.ray.damage,
                state: "TELEGRAPH",
                timer: CONFIG.ray.telegraphDuration + i * (pattern === "sequence" ? CONFIG.ray.sequenceDelay : 0),
                activeTimer: CONFIG.ray.activeDuration
            });
        }
        weapon = { type: "ray", kind: "area", state: "TELEGRAPH", pattern, blasts };
    }

    function fireElectric(player) {
        const baseAngle = player ? Math.atan2(player.y - boss.y, player.x - boss.x) : Math.atan2(0, 1);
        const projectiles = [];
        for (let i = 0; i < CONFIG.pong.electric.projectiles; i++) {
            const angle = baseAngle + (i - 0.5) * CONFIG.pong.electric.angleStep * 2;
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
                electric: true
            });
        }
        weapon = {
            type: "electric",
            state: "ACTIVE",
            timer: CONFIG.pong.electric.interval,
            projectiles
        };
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

    function updateRay(deltaTime, player, health, collision) {
        if (!weapon || !Array.isArray(weapon.blasts)) return;
        for (const blast of weapon.blasts) {
            if (blast.state === "DONE") continue;
            if (blast.state === "TELEGRAPH") {
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
            if (speed > 0 && projectile.impactCount <= 20) {
                const nextSpeed = Math.min(speed * 1.08, 1200);
                projectile.vx = projectile.vx / speed * nextSpeed;
                projectile.vy = projectile.vy / speed * nextSpeed;
            }
        }
        return bounced;
    }

    function updateElectric(deltaTime, player, health, collision, arena) {
        weapon.timer -= deltaTime;
        for (const projectile of weapon.projectiles) {
            projectile.x += projectile.vx * deltaTime;
            projectile.y += projectile.vy * deltaTime;
            bounceProjectileFromWalls(projectile, arena);

            if (
                projectile.state === "ACTIVE" &&
                collision &&
                collision.checkCollisions(player, [projectile], projectile.radius * 2)
            ) {
                projectile.state = "CONSUMED";
                if (collision.registerCollision()) {
                    health.applyDamage(projectile.damage);
                }
            }
        }

        if (weapon.timer <= 0) {
            weapon = null;
        }
    }

    function updateCombat(deltaTime, arena, player, health, collision) {
        if (phase !== "FIGHT") return;

        if (weapon && weapon.state === "CONSUMED") {
            weapon = null;
        }

        if (!weapon) {
            whiteTimer -= deltaTime;
            rayTimer -= deltaTime;
            electricTimer -= deltaTime;

            if (whiteTimer <= 0) { whiteTimer = CONFIG.pong.white.interval; fireWhite(player); return; }
            if (rayTimer <= 0) { rayTimer = CONFIG.ray.interval; fireRay(player); return; }
            if (electricTimer <= 0) { electricTimer = CONFIG.pong.electric.interval; fireElectric(player); return; }
            return;
        }

        if (weapon.type === "ray") {
            updateRay(deltaTime, player, health, collision);
        } else if (weapon.type === "white") {
            updateWhite(deltaTime, player, health, collision, arena);
        } else if (weapon.type === "electric") {
            updateElectric(deltaTime, player, health, collision, arena);
        }

        const bossBody = { x: boss.x, y: boss.y, state: "ACTIVE", kind: "boss" };
        if (collision && collision.checkCollisions(player, [bossBody], boss.size)) {
            if (collision.registerCollision()) {
                health.applyDamage(collision.getState().damage);
            }
        }
    }

    function update(deltaTime, arena, player, health, collision) {
        if (!Number.isFinite(deltaTime) || deltaTime < 0) return getState();
        if (!arena || !Number.isFinite(arena.width) || !Number.isFinite(arena.height)) return getState();
        if (!player) return getState();

        if (phase === "IDLE") return getState();

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
        if (!weapon || weapon.type !== "white" || weapon.state !== "ACTIVE" || weapon.electric) {
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
            phase = "DEFEATED";
            phaseTimer = CONFIG.defeatDuration;
            boss.defeated = true;
            conquered = true;
        }
        return { damage: amount, hp: boss.hp, maxHP: boss.maxHP, defeated };
    }

    function drawWeapon(ctx) {
        if (weapon.type === "ray") {
            for (const blast of weapon.blasts || []) {
                if (blast.state === "DONE") continue;
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
            return;
        }

        if (weapon.type === "white") {
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
            ctx.shadowBlur = 0;
            ctx.restore();
            return;
        }

        if (Array.isArray(weapon.projectiles)) {
            for (const projectile of weapon.projectiles) {
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
                ctx.shadowBlur = 0;
                ctx.restore();
            }
        }
    }

    function draw(ctx, canvas) {
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

        if (weapon) drawWeapon(ctx, canvas);
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
        const weaponCopy = weapon
            ? {
                ...weapon,
                projectiles: weapon.projectiles ? weapon.projectiles.map(p => ({ ...p })) : null
            }
            : null;
        return {
            phase,
            phaseTimer,
            fightTimer,
            boss: { ...boss },
            weapon: weaponCopy
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
        getDifficulty
    };

    if (typeof module !== "undefined" && module.exports) {
        module.exports = api;
    }
    if (root) {
        root.ONREDBossSystem = api;
    }

    console.log("[ON RED] Boss System carregado.");
})(typeof window !== "undefined" ? window : globalThis);
