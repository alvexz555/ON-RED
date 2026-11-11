
/*
 * ON RED
 * COLLISION SYSTEM
 * Version: 1.1
 *
 * Detecção círculo x retângulo.
 * Dano: 25 HP
 * Invulnerabilidade: 1 segundo
 * Feedback: descarga elétrica de impacto.
 */

(function () {
    "use strict";

    // ======================================
    // CONFIGURAÇÃO
    // ======================================

    const CONFIG = {
        damage: 25,
        invulnerabilityTime: 1,
        effectDuration: 0.32
    };

    // ======================================
    // ESTADO INTERNO
    // ======================================

    let invulnerabilityTimer = 0;
    let isInvulnerable = false;
    let impactEffectTimer = 0;

    // ======================================
    // DETECÇÃO CÍRCULO x RETÂNGULO
    // ======================================

    function checkCircleRectangle(circle, rectangle, size) {

        const half = size / 2;

        const left = rectangle.x - half;
        const right = rectangle.x + half;
        const top = rectangle.y - half;
        const bottom = rectangle.y + half;

        const closestX = Math.max(left, Math.min(circle.x, right));
        const closestY = Math.max(top, Math.min(circle.y, bottom));

        const dx = circle.x - closestX;
        const dy = circle.y - closestY;

        return (
            dx * dx + dy * dy <=
            circle.radius * circle.radius
        );
    }

    // ======================================
    // VERIFICAÇÃO DE COLISÃO
    // ======================================

    function checkCollisions(player, obstacles, obstacleSize) {

        if (!player || !Array.isArray(obstacles)) {
            return false;
        }

        if (isInvulnerable) {
            return false;
        }

        for (const obstacle of obstacles) {

            if (
                checkCircleRectangle(
                    player,
                    obstacle,
                    obstacleSize
                )
            ) {
                return true;
            }
        }

        return false;
    }

    // ======================================
    // REGISTRO DE COLISÃO
    // ======================================

    function registerCollision() {

        if (isInvulnerable) {
            return false;
        }

        isInvulnerable = true;

        invulnerabilityTimer =
            CONFIG.invulnerabilityTime;

        impactEffectTimer =
            CONFIG.effectDuration;

        return true;
    }

    // ======================================
    // ATUALIZAÇÃO
    // ======================================

    function update(deltaTime) {

        if (isInvulnerable) {

            invulnerabilityTimer -= deltaTime;

            if (invulnerabilityTimer <= 0) {

                invulnerabilityTimer = 0;
                isInvulnerable = false;
            }
        }

        if (impactEffectTimer > 0) {

            impactEffectTimer -= deltaTime;

            impactEffectTimer = Math.max(
                0,
                impactEffectTimer
            );
        }
    }

    // ======================================
    // EFEITO VISUAL DE IMPACTO
    // ======================================

    function drawImpact(ctx, player) {

        if (!ctx || !player || impactEffectTimer <= 0) {
            return;
        }

        const progress =
            1 - impactEffectTimer / CONFIG.effectDuration;

        const alpha = 1 - progress;
        const radius = player.radius + 8 + progress * 15;

        ctx.save();

        ctx.translate(player.x, player.y);
        ctx.globalAlpha = alpha;

        // AURA VERMELHA

        ctx.beginPath();
        ctx.arc(0, 0, radius, 0, Math.PI * 2);

        ctx.strokeStyle = "#FF303F";
        ctx.lineWidth = 5;
        ctx.shadowColor = "#FF303F";
        ctx.shadowBlur = 28;
        ctx.stroke();

        // DESCARGAS ELÉTRICAS

        ctx.lineWidth = 2.5;
        ctx.strokeStyle = "#FFFFFF";
        ctx.shadowColor = "#FF303F";
        ctx.shadowBlur = 20;

        const branches = 12;

        for (let i = 0; i < branches; i++) {

            const angle =
                (Math.PI * 2 / branches) * i +
                Math.sin(progress * 18 + i) * 0.15;

            const innerRadius = player.radius - 2;
            const outerRadius = radius + Math.sin(i * 4) * 5;

            const midRadius =
                (innerRadius + outerRadius) / 2;

            const midAngle =
                angle + Math.sin(i * 7 + progress * 20) * 0.13;

            ctx.beginPath();

            ctx.moveTo(
                Math.cos(angle) * innerRadius,
                Math.sin(angle) * innerRadius
            );

            ctx.lineTo(
                Math.cos(midAngle) * midRadius,
                Math.sin(midAngle) * midRadius
            );

            ctx.lineTo(
                Math.cos(angle) * outerRadius,
                Math.sin(angle) * outerRadius
            );

            ctx.stroke();
        }

        // NÚCLEO BRANCO DO IMPACTO

        ctx.beginPath();
        ctx.arc(0, 0, player.radius + 2, 0, Math.PI * 2);

        ctx.strokeStyle = "#FFFFFF";
        ctx.lineWidth = 2;
        ctx.shadowColor = "#FFFFFF";
        ctx.shadowBlur = 22;
        ctx.stroke();

        ctx.restore();
    }

    // ======================================
    // RESET
    // ======================================

    function reset() {

        invulnerabilityTimer = 0;
        isInvulnerable = false;
        impactEffectTimer = 0;
    }

    // ======================================
    // ESTADO PÚBLICO
    // ======================================

    function getState() {

        return {
            isInvulnerable,
            invulnerabilityTimer,
            impactEffectTimer,
            damage: CONFIG.damage
        };
    }

    // ======================================
    // API GLOBAL
    // ======================================

    window.ONREDCollisionSystem = {
        checkCollisions,
        registerCollision,
        update,
        drawImpact,
        reset,
        getState
    };

    console.log("[ON RED] Collision System carregado.");

})();
