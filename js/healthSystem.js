
/*
 * ON RED
 * HEALTH SYSTEM
 * Version: 1.0
 *
 * Sistema modular de vidas e HP.
 * 3 vidas iniciais.
 * HP de 0 a 100.
 */

(function () {
    "use strict";

    // ==========================================
    // CONFIGURAÇÃO
    // ==========================================

    const CONFIG = {
        maxLives: 3,
        maxHP: 100
    };

    // ==========================================
    // ESTADO
    // ==========================================

    let state = {
        lives: CONFIG.maxLives,
        maxLives: CONFIG.maxLives,

        hp: CONFIG.maxHP,
        maxHP: CONFIG.maxHP,

        gameOver: false
    };

    // ==========================================
    // RESET
    // ==========================================

    function reset() {
        state = {
            lives: CONFIG.maxLives,
            maxLives: CONFIG.maxLives,

            hp: CONFIG.maxHP,
            maxHP: CONFIG.maxHP,

            gameOver: false
        };

        return getState();
    }

    // ==========================================
    // OBTER ESTADO
    // ==========================================

    function getState() {
        return { ...state };
    }

    // ==========================================
    // APLICAR DANO
    // ==========================================

    function applyDamage(amount) {

        if (state.gameOver) {
            return {
                applied: false,
                reason: "game_over",
                state: getState()
            };
        }

        if (
            typeof amount !== "number" ||
            !Number.isFinite(amount) ||
            amount <= 0
        ) {
            return {
                applied: false,
                reason: "invalid_damage",
                state: getState()
            };
        }

        const previousHP = state.hp;

        state.hp = Math.max(0, state.hp - amount);

        const damageApplied = previousHP - state.hp;

        let lifeLost = false;

        // ======================================
        // PERDA DE VIDA
        // ======================================

        if (state.hp <= 0) {

            state.lives--;

            lifeLost = true;

            if (state.lives > 0) {

                // Recupera o HP para a próxima vida.
                state.hp = CONFIG.maxHP;

            } else {

                // Todas as vidas foram perdidas.
                state.hp = 0;
                state.gameOver = true;
            }
        }

        return {
            applied: damageApplied > 0,
            damage: damageApplied,
            lifeLost,
            gameOver: state.gameOver,
            state: getState()
        };
    }

    // ==========================================
    // RECUPERAR HP
    // ==========================================

    function heal(amount) {

        if (state.gameOver) {
            return {
                applied: false,
                reason: "game_over",
                state: getState()
            };
        }

        if (
            typeof amount !== "number" ||
            !Number.isFinite(amount) ||
            amount <= 0
        ) {
            return {
                applied: false,
                reason: "invalid_heal",
                state: getState()
            };
        }

        const previousHP = state.hp;

        // O HP nunca ultrapassa o máximo.
        state.hp = Math.min(state.maxHP, state.hp + amount);

        return {
            applied: state.hp > previousHP,
            healed: state.hp - previousHP,
            state: getState()
        };
    }

    // ==========================================
    // VIDA EXTRA
    // ==========================================

    function addExtraLife() {

        if (state.gameOver) {
            return {
                applied: false,
                reason: "game_over",
                state: getState()
            };
        }

        state.lives++;
        state.maxLives++;

        return {
            applied: true,
            lifeGranted: true,
            state: getState()
        };
    }

    // ==========================================
    // API PÚBLICA
    // ==========================================

    window.ONREDHealthSystem = {
        reset,
        getState,
        applyDamage,
        heal,
        addExtraLife
    };

    console.log("[ON RED] Health System carregado.");

})();
