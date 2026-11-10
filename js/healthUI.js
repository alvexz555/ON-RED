/*
 * ON RED
 * HEALTH UI
 * Version: 1.0
 *
 * HUD de vidas e HP.
 * Renderização Canvas 2D.
 */

(function () {
    "use strict";

    // ==========================================
    // CONFIGURAÇÃO VISUAL
    // ==========================================

    const CONFIG = {
        margin: 22,

        lifeRadius: 7,
        lifeSpacing: 23,

        barWidth: 125,
        barHeight: 9,

        colors: {
            life: "#FF303F",
            emptyLife: "#54232B",

            hp: "#FF303F",
            hpBackground: "#303743",

            text: "#FFFFFF",
            secondary: "#AAB4C3"
        }
    };

    // ==========================================
    // VALIDAR DEPENDÊNCIA
    // ==========================================

    function getHealthSystem() {
        return window.ONREDHealthSystem || null;
    }

    // ==========================================
    // DESENHAR VIDAS
    // ==========================================

    function drawLives(ctx, state, x, y) {

        for (let i = 0; i < state.maxLives; i++) {

            const lifeX =
                x + i * CONFIG.lifeSpacing;

            ctx.beginPath();

            ctx.arc(
                lifeX,
                y,
                CONFIG.lifeRadius,
                0,
                Math.PI * 2
            );

            ctx.fillStyle =
                i < state.lives
                    ? CONFIG.colors.life
                    : CONFIG.colors.emptyLife;

            ctx.fill();
        }
    }

    // ==========================================
    // DESENHAR BARRA DE HP
    // ==========================================

    function drawHP(ctx, state, x, y) {

        const percentage = Math.max(
            0,
            Math.min(1, state.hp / state.maxHP)
        );

        // FUNDO DA BARRA

        ctx.fillStyle =
            CONFIG.colors.hpBackground;

        ctx.fillRect(
            x,
            y,
            CONFIG.barWidth,
            CONFIG.barHeight
        );

        // PREENCHIMENTO

        if (percentage > 0) {

            ctx.fillStyle =
                CONFIG.colors.hp;

            ctx.fillRect(
                x,
                y,
                CONFIG.barWidth * percentage,
                CONFIG.barHeight
            );
        }

        // CONTORNO

        ctx.strokeStyle =
            "rgba(255,255,255,0.15)";

        ctx.lineWidth = 1;

        ctx.strokeRect(
            x,
            y,
            CONFIG.barWidth,
            CONFIG.barHeight
        );
    }

    // ==========================================
    // DESENHAR HUD COMPLETO
    // ==========================================

    function draw(ctx, canvas) {

        const health = getHealthSystem();

        if (!health || !ctx || !canvas) {
            return;
        }

        const state = health.getState();

        const x = CONFIG.margin;
        const y = CONFIG.margin;

        ctx.save();

        // TEXTO LIVES

        ctx.font = "bold 10px Arial";
        ctx.textAlign = "left";
        ctx.textBaseline = "middle";

        ctx.fillStyle =
            CONFIG.colors.secondary;

        ctx.fillText(
            "LIVES",
            x,
            y
        );

        // INDICADORES DE VIDA

        drawLives(
            ctx,
            state,
            x + 58,
            y
        );

        // TEXTO HP

        ctx.fillStyle =
            CONFIG.colors.text;

        ctx.fillText(
            "HP",
            x,
            y + 25
        );

        ctx.textAlign = "right";

        ctx.fillText(
            `${Math.ceil(state.hp)}%`,
            x + CONFIG.barWidth,
            y + 25
        );

        // BARRA DE HP

        drawHP(
            ctx,
            state,
            x,
            y + 37
        );

        ctx.restore();
    }

    // ==========================================
    // API PÚBLICA
    // ==========================================

    window.ONREDHealthUI = {
        draw
    };

    console.log("[ON RED] Health UI carregada.");

})();
