
/*
 * ON RED
 * HEALTH SYSTEM
 * Version: 1.1
 *
 * 1 vida inicial + até 4 vidas extras.
 * Máximo total: 5 vidas.
 */

(function () {
    "use strict";

    const CONFIG = {
        initialLives: 1,
        maxExtraLives: 4,
        maxLives: 5,
        maxHP: 100
    };

    let state = {};
    let reviveProtectionTimer = 0;

    function reset() {
        reviveProtectionTimer = 0;
        state = {
            lives: CONFIG.initialLives,
            maxLives: CONFIG.maxLives,
            hp: CONFIG.maxHP,
            maxHP: CONFIG.maxHP,
            gameOver: false
        };

        return getState();
    }

    function getState() {
        return { ...state };
    }

    let damageListener = null;

    function setDamageListener(listener) {
        damageListener = typeof listener === "function" ? listener : null;
    }

    function update(deltaTime) {
        if (typeof deltaTime !== "number" || !Number.isFinite(deltaTime) || deltaTime <= 0) return;
        reviveProtectionTimer = Math.max(0, reviveProtectionTimer - deltaTime);
    }

    function grantReviveProtection(seconds = 2) {
        if (typeof seconds !== "number" || !Number.isFinite(seconds) || seconds <= 0) return false;
        reviveProtectionTimer = Math.max(reviveProtectionTimer, seconds);
        return true;
    }

    function revive() {
        if (!state.gameOver) {
            return { applied: false, reason: "player_not_defeated", state: getState() };
        }
        state.lives = 1;
        state.hp = Math.min(50, state.maxHP);
        state.gameOver = false;
        grantReviveProtection(2);
        return { applied: true, livesGranted: 1, hpRestored: state.hp, state: getState() };
    }

    function applyDamage(amount) {
        if (reviveProtectionTimer > 0) {
            return { applied: false, reason: "revive_protection", protected: true, state: getState() };
        }
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

        if (state.hp <= 0) {
            state.lives--;
            lifeLost = true;

            if (state.lives > 0) {
                state.hp = CONFIG.maxHP;
            } else {
                state.hp = 0;
                state.gameOver = true;
            }
        }

        const result = {
            applied: damageApplied > 0,
            damage: damageApplied,
            lifeLost,
            gameOver: state.gameOver,
            state: getState()
        };

        if (result.applied && damageListener) {
            try {
                damageListener({
                    damage: result.damage,
                    lifeLost: result.lifeLost,
                    state: result.state
                });
            } catch (error) {
                console.error("[ON RED] Damage listener failed:", error);
            }
        }

        return result;
    }

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

        state.hp = Math.min(
            state.maxHP,
            state.hp + amount
        );

        return {
            applied: state.hp > previousHP,
            healed: state.hp - previousHP,
            state: getState()
        };
    }

    function addExtraLife() {
        if (state.gameOver) {
            return {
                applied: false,
                reason: "game_over",
                state: getState()
            };
        }

        if (state.lives >= CONFIG.maxLives) {
            return {
                applied: false,
                reason: "life_limit_reached",
                state: getState()
            };
        }

        state.lives++;

        return {
            applied: true,
            lifeGranted: true,
            state: getState()
        };
    }

    reset();

    window.ONREDHealthSystem = {
        reset,
        getState,
        update,
        revive,
        grantReviveProtection,
        setDamageListener,
        applyDamage,
        heal,
        addExtraLife
    };

    console.log("[ON RED] Health System carregado.");

})();
