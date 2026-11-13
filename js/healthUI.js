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

            const filled = i < state.lives;

            ctx.beginPath();

            ctx.arc(
                lifeX,
                y,
                CONFIG.lifeRadius,
                0,
                Math.PI * 2
            );

            if (filled) {

                // MESMA IDENTIDADE DA BOLA DO JOGADOR E DAS ESFERAS DO MERGE:
                // núcleo vermelho com brilho e ponto de luz branco.

                ctx.shadowColor = CONFIG.colors.life;
                ctx.shadowBlur = 10;

                ctx.fillStyle = CONFIG.colors.life;

                ctx.fill();

                ctx.shadowBlur = 0;

                ctx.beginPath();

                ctx.arc(
                    lifeX - CONFIG.lifeRadius * 0.3,
                    y - CONFIG.lifeRadius * 0.3,
                    CONFIG.lifeRadius * 0.3,
                    0,
                    Math.PI * 2
                );

                ctx.fillStyle = "rgba(255,255,255,0.7)";

                ctx.fill();

            } else {

                ctx.fillStyle = CONFIG.colors.emptyLife;

                ctx.fill();
            }
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

            // MESMA IDENTIDADE DAS ESFERAS: brilho vermelho no preenchimento.

            ctx.shadowColor = CONFIG.colors.hp;
            ctx.shadowBlur = 10;

            ctx.fillStyle =
                CONFIG.colors.hp;

            ctx.fillRect(
                x,
                y,
                CONFIG.barWidth * percentage,
                CONFIG.barHeight
            );

            ctx.shadowBlur = 0;
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
    // FEEDBACK DE MUDANÇA DE HP / VIDAS
    // ==========================================

    // A UI compara o estado de um frame com o anterior e exibe um
    // texto curto (dano, cura, vida extra, vida perdida) que se desvanece.

    const FEEDBACK_DURATION = 1.4;

    let lastSnapshot = null;
    let lastClock = null;
    let feedback = null;

    function updateFeedback(state) {

        const now = performance.now();
        const delta = lastClock === null ? 0 : (now - lastClock) / 1000;
        lastClock = now;

        if (feedback) {
            feedback.timer = Math.max(0, feedback.timer - delta);
            if (feedback.timer === 0) {
                feedback = null;
            }
        }

        if (!lastSnapshot) {
            lastSnapshot = { ...state };
            return;
        }

        const hpDelta = state.hp - lastSnapshot.hp;
        const livesDelta = state.lives - lastSnapshot.lives;

        // Reinício de partida: estados pulam de uma vez (ex.: 0 -> 1 vida,
        // 100 HP). Não é evento de gameplay, não gera feedback.
        const matchRestarted =
            (lastSnapshot.lives === 0 && state.lives > 0) ||
            (livesDelta > 0 && hpDelta > 50);

        if (
            !feedback &&
            !matchRestarted &&
            (hpDelta !== 0 || livesDelta !== 0)
        ) {
            if (livesDelta < 0) {
                feedback = { text: "LIFE LOST", color: CONFIG.colors.life, timer: FEEDBACK_DURATION };
            } else if (hpDelta < 0) {
                feedback = { text: `-${Math.ceil(-hpDelta)} HP`, color: CONFIG.colors.life, timer: FEEDBACK_DURATION };
            } else if (hpDelta > 0) {
                feedback = { text: `+${Math.ceil(hpDelta)} HP`, color: CONFIG.colors.text, timer: FEEDBACK_DURATION };
            } else if (livesDelta > 0) {
                feedback = { text: "EXTRA LIFE", color: "#168BFF", timer: FEEDBACK_DURATION };
            }
        }

        lastSnapshot = { ...state };
    }

    function drawFeedback(ctx, x, y) {

        if (!feedback) return;

        ctx.save();

        ctx.globalAlpha = Math.min(1, feedback.timer / (FEEDBACK_DURATION * 0.6));

        ctx.font = "bold 10px Arial";
        ctx.textAlign = "left";
        ctx.textBaseline = "middle";

        ctx.fillStyle = feedback.color;

        ctx.fillText(feedback.text, x, y);

        ctx.restore();
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

        updateFeedback(state);

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

        // FEEDBACK DE MUDANÇA (ao lado da barra)

        drawFeedback(
            ctx,
            x + CONFIG.barWidth + 14,
            y + 37 + CONFIG.barHeight / 2
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
