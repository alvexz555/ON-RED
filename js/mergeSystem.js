/*
 * ON RED
 * MERGE SYSTEM
 * Version: 1.0
 *
 * Esferas vermelhas coletáveis dentro da arena.
 *
 * Regra do Merge:
 * - HP abaixo de 100%: recupera HP (nunca passa de 100%).
 * - HP em 100%: concede uma vida extra.
 *
 * A esfera é removida no momento da coleta, impedindo
 * que a mesma esfera seja ativada mais de uma vez.
 */

(function () {
    "use strict";

    // ==========================================
    // CONFIGURAÇÃO
    // ==========================================

  const CONFIG = {
    radius: 9,
    healAmount: 25,

    bonusScorePerOrb: 250,

    maxOrbs: 4,
    initialOrbs: 2,
    spawnInterval: 6,

    margin: 55,
    spawnAttempts: 20,

    pulseSpeed: 3.2,
    glowBlur: 18
};

    // ==========================================
    // ESTADO INTERNO
    // ==========================================

    const orbs = [];

    let spawnTimer = 0;
    let elapsed = 0;

    // ==========================================
    // POSIÇÃO ALEATÓRIA DENTRO DA ARENA
    // ==========================================

    function randomOrbPosition(arena, player) {

        const width = arena && arena.width ? arena.width : 0;
        const height = arena && arena.height ? arena.height : 0;

        const minX = CONFIG.margin;
        const maxX = Math.max(minX, width - CONFIG.margin);

        const minY = CONFIG.margin;
        const maxY = Math.max(minY, height - CONFIG.margin);

        let x = (minX + maxX) / 2;
        let y = (minY + maxY) / 2;

        const playerX = player ? player.x : null;
        const playerY = player ? player.y : null;
        const playerRadius = player ? player.radius : 0;

        const safeDistance =
            playerRadius + CONFIG.radius + 30;

        for (let attempt = 0; attempt < CONFIG.spawnAttempts; attempt++) {

            x = minX + Math.random() * (maxX - minX);
            y = minY + Math.random() * (maxY - minY);

            const farFromPlayer =
                playerX === null ||
                Math.hypot(x - playerX, y - playerY) > safeDistance;

            if (farFromPlayer) {
                break;
            }
        }

        return { x, y };
    }

    // ==========================================
    // GERAÇÃO DE ESFERAS
    // ==========================================

    function spawnOrb(arena, player) {

        if (orbs.length >= CONFIG.maxOrbs) {
            return null;
        }

        const position = randomOrbPosition(arena, player);

        const orb = {
            x: position.x,
            y: position.y,
            radius: CONFIG.radius,
            phase: Math.random() * Math.PI * 2,
            collected: false
        };

        orbs.push(orb);

        return orb;
    }

    // ==========================================
    // DETECÇÃO DE COLETA
    // ==========================================

    function isTouchingPlayer(orb, player) {

        if (!orb || !player) return false;

        const dx = player.x - orb.x;
        const dy = player.y - orb.y;

        const limit = player.radius + orb.radius;

        return dx * dx + dy * dy <= limit * limit;
    }

    // ==========================================
    // APLICAÇÃO DO EFEITO (MERGE)
    // ==========================================

    function applyMerge(healthSystem) {

        const health = healthSystem || window.ONREDHealthSystem;

        if (!health) {
            return null;
        }

        const state = health.getState();

        // HP ABAIXO DE 100%: RECUPERA HP.
        if (state.hp < state.maxHP) {
            const result = health.heal(CONFIG.healAmount);

            return {
                type: "heal",
                applied: result.applied,
                healed: result.healed || 0,
                hp: result.state.hp,
                maxHP: result.state.maxHP
            };
        }

        // HP EM 100%: TENTA CONCEDER VIDA EXTRA.
        const result = health.addExtraLife();

        // LIMITE DE 5 VIDAS ATINGIDO: CONVERTE A ESFERA EM PONTOS.
        if (result.reason === "life_limit_reached") {
            return {
                type: "bonus_score",
                applied: true,
                points: CONFIG.bonusScorePerOrb
            };
        }

        return {
            type: "extra_life",
            applied: result.applied,
            lives: result.state.lives,
            maxLives: result.state.maxLives
        };
    }

    // ==========================================
    // ATUALIZAÇÃO
    // ==========================================

    function update(deltaTime, player, arena, healthSystem) {

        if (typeof deltaTime !== "number" || deltaTime < 0) {
            return [];
        }

        elapsed += deltaTime;
        spawnTimer += deltaTime;

        if (spawnTimer >= CONFIG.spawnInterval) {

            spawnTimer = 0;

            spawnOrb(arena, player);
        }

        const results = [];

        for (let index = orbs.length - 1; index >= 0; index--) {

            const orb = orbs[index];

            if (!isTouchingPlayer(orb, player)) {
                continue;
            }

            // Marca e remove antes de aplicar o efeito para
            // que a mesma esfera nunca seja contada duas vezes.
            orb.collected = true;
            orbs.splice(index, 1);

            const merge = applyMerge(healthSystem);

            if (merge) {
                results.push(merge);
            }
        }

        return results;
    }

    // ==========================================
    // DESENHO
    // ==========================================

    function draw(ctx) {

        if (!ctx) return;

        orbs.forEach(orb => {

            const pulse =
                1 + Math.sin(elapsed * CONFIG.pulseSpeed + orb.phase) * 0.12;

            const radius = orb.radius * pulse;

            ctx.save();

            // AURA EXTERNA

            ctx.beginPath();
            ctx.arc(orb.x, orb.y, radius + 3, 0, Math.PI * 2);

            ctx.strokeStyle = "rgba(255, 48, 63, 0.45)";
            ctx.lineWidth = 2;
            ctx.stroke();

            // ESFERA VERMELHA

            ctx.beginPath();
            ctx.arc(orb.x, orb.y, radius, 0, Math.PI * 2);

            ctx.fillStyle = "#FF303F";
            ctx.shadowColor = "#FF303F";
            ctx.shadowBlur = CONFIG.glowBlur;
            ctx.fill();

            // BRILHO INTERNO

            ctx.beginPath();
            ctx.arc(
                orb.x - radius * 0.3,
                orb.y - radius * 0.3,
                radius * 0.3,
                0,
                Math.PI * 2
            );

            ctx.fillStyle = "rgba(255,255,255,0.7)";
            ctx.shadowBlur = 0;
            ctx.fill();

            ctx.restore();
        });
    }

    // ==========================================
    // RESET
    // ==========================================

    function reset(arena, player) {

        orbs.length = 0;

        spawnTimer = 0;
        elapsed = 0;

        for (let i = 0; i < CONFIG.initialOrbs; i++) {
            spawnOrb(arena, player);
        }
    }

    // ==========================================
    // ESTADO PÚBLICO
    // ==========================================

    function getOrbs() {

        return orbs.map(orb => ({
            x: orb.x,
            y: orb.y,
            radius: orb.radius,
            collected: orb.collected
        }));
    }

    function getConfig() {
        return { ...CONFIG };
    }

    // ==========================================
    // API GLOBAL
    // ==========================================

    window.ONREDMergeSystem = {
        update,
        draw,
        reset,
        spawnOrb,
        getOrbs,
        getConfig,
        healAmount: CONFIG.healAmount
    };

    console.log("[ON RED] Merge System carregado.");

})();
