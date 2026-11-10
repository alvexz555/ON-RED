
/*
 * ON RED
 * COLLISION SYSTEM
 * Version: 1.0
 *
 * Detecção de colisão:
 * Jogador circular x obstáculos quadrados.
 *
 * Dano: 25 HP
 * Invulnerabilidade: 1 segundo
 */

(function () {
    "use strict";

    // ======================================
    // CONFIGURAÇÃO
    // ======================================

    const CONFIG = {
        damage: 25,
        invulnerabilityTime: 1
    };

    // ======================================
    // ESTADO INTERNO
    // ======================================

    let invulnerabilityTimer = 0;
    let isInvulnerable = false;

    // ======================================
    // DETECÇÃO CÍRCULO x RETÂNGULO
    // ======================================

    function checkCircleRectangle(circle, rectangle, size) {

        const half = size / 2;

        const left = rectangle.x - half;
        const right = rectangle.x + half;
        const top = rectangle.y - half;
        const bottom = rectangle.y + half;

        const closestX = Math.max(
            left,
            Math.min(circle.x, right)
        );

        const closestY = Math.max(
            top,
            Math.min(circle.y, bottom)
        );

        const dx = circle.x - closestX;
        const dy = circle.y - closestY;

        const distanceSquared = dx * dx + dy * dy;

        return distanceSquared <= circle.radius * circle.radius;
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

        return true;
    }

    // ======================================
    // ATUALIZAÇÃO
    // ======================================

    function update(deltaTime) {

        if (!isInvulnerable) return;

        invulnerabilityTimer -= deltaTime;

        if (invulnerabilityTimer <= 0) {

            invulnerabilityTimer = 0;
            isInvulnerable = false;
        }
    }

    // ======================================
    // RESET
    // ======================================

    function reset() {

        invulnerabilityTimer = 0;
        isInvulnerable = false;
    }

    // ======================================
    // ESTADO PÚBLICO
    // ======================================

    function getState() {

        return {
            isInvulnerable,
            invulnerabilityTimer,
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
        reset,
        getState
    };

    console.log("[ON RED] Collision System carregado.");

})();
