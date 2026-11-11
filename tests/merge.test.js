/*
 * ON RED
 * MERGE SYSTEM TESTS
 *
 * Executa os módulos reais (healthSystem.js e mergeSystem.js)
 * em um contexto isolado com um window falso.
 *
 * Rodar com: node --test tests/merge.test.js
 */

"use strict";

const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const test = require("node:test");
const assert = require("node:assert/strict");

const JS_DIR = path.join(__dirname, "..", "js");
const ARENA = { width: 400, height: 800 };

function loadSystems() {

    const silentConsole = {
        log() {},
        warn() {},
        error() {}
    };

    const sandbox = {
        console: silentConsole,
        Math,
        Date
    };

    sandbox.window = sandbox;

    vm.createContext(sandbox);

    ["healthSystem.js", "mergeSystem.js"].forEach(file => {

        const code = fs.readFileSync(
            path.join(JS_DIR, file),
            "utf8"
        );

        vm.runInContext(code, sandbox, { filename: file });
    });

    return {
        health: sandbox.ONREDHealthSystem,
        merge: sandbox.ONREDMergeSystem,
        sandbox
    };
}

function startMatch() {

    const { health, merge } = loadSystems();

    health.reset();
    merge.reset(ARENA, { x: 200, y: 400, radius: 15 });

    return { health, merge };
}

function playerAt(x, y) {
    return { x, y, radius: 15 };
}

// TESTE 01 — COLETA COM HP BAIXO

test("TESTE 01: coleta com HP baixo recupera HP", () => {

    const { health, merge } = startMatch();

    health.applyDamage(50);
    assert.equal(health.getState().hp, 50);

    const orb = merge.getOrbs()[0];
    const beforeCount = merge.getOrbs().length;

    const results = merge.update(
        0,
        playerAt(orb.x, orb.y),
        ARENA,
        health
    );

    assert.equal(results.length, 1);
    assert.equal(results[0].type, "heal");
    assert.equal(results[0].healed, 25);
    assert.equal(health.getState().hp, 75);

    // A esfera foi removida.
    assert.equal(merge.getOrbs().length, beforeCount - 1);
});

// TESTE 02 — LIMITE DE HP

test("TESTE 02: HP nunca ultrapassa 100%", () => {

    const { health, merge } = startMatch();

    health.applyDamage(10);
    assert.equal(health.getState().hp, 90);

    const orb = merge.getOrbs()[0];

    merge.update(0, playerAt(orb.x, orb.y), ARENA, health);

    const state = health.getState();

    assert.equal(state.hp, 100);
    assert.equal(state.hp, state.maxHP);
});

test("TESTE 02b: HP em 100% não ganha HP extra", () => {

    const { health } = startMatch();

    const result = health.heal(25);

    assert.equal(result.applied, false);
    assert.equal(result.healed, 0);
    assert.equal(health.getState().hp, 100);
});

// TESTE 03 — COLETA COM HP COMPLETO

test("TESTE 03: coleta com HP em 100% concede vida extra", () => {

    const { health, merge } = startMatch();

    const before = health.getState();
    assert.equal(before.hp, 100);
    assert.equal(before.lives, 3);

    const orbsBefore = merge.getOrbs().length;
    const orb = merge.getOrbs()[0];

    const results = merge.update(
        0,
        playerAt(orb.x, orb.y),
        ARENA,
        health
    );

    assert.equal(results.length, 1);
    assert.equal(results[0].type, "extra_life");

    const after = health.getState();

    assert.equal(after.lives, 4);
    assert.equal(after.maxLives, 4);
    assert.equal(after.hp, 100);

    // A esfera foi removida.
    assert.equal(merge.getOrbs().length, orbsBefore - 1);
});

// TESTE 04 — PREVENÇÃO DE COLETA DUPLICADA

test("TESTE 04: esfera coletada não ativa duas vezes", () => {

    const { health, merge } = startMatch();

    health.applyDamage(50);

    const orb = merge.getOrbs()[0];
    const x = orb.x;
    const y = orb.y;

    merge.update(0, playerAt(x, y), ARENA, health);

    const hpAfterFirst = health.getState().hp;
    const countAfterFirst = merge.getOrbs().length;

    assert.equal(hpAfterFirst, 75);
    assert.equal(countAfterFirst, 1);

    // Mesma posição, sem esfera: nada muda.
    const secondResults = merge.update(
        0,
        playerAt(x, y),
        ARENA,
        health
    );

    assert.equal(secondResults.length, 0);
    assert.equal(health.getState().hp, hpAfterFirst);
    assert.equal(merge.getOrbs().length, countAfterFirst);
});

// TESTE 05 — INTEGRIDADE DA PARTIDA

test("TESTE 05: várias esferas mantêm HP e vidas consistentes", () => {

    const { health, merge } = startMatch();

    health.applyDamage(80);
    assert.equal(health.getState().hp, 20);

    // Coleta 2 esferas com HP baixo.

    for (let i = 0; i < 2; i++) {

        const orb = merge.getOrbs()[0];
        merge.update(0, playerAt(orb.x, orb.y), ARENA, health);
    }

    assert.equal(health.getState().hp, 70);

    // Gera esferas até o limite e coleta todas com HP cheio.

    health.heal(100);
    assert.equal(health.getState().hp, 100);

    const config = merge.getConfig();
    let guard = 0;

    while (merge.getOrbs().length < config.maxOrbs && guard < 10) {
        merge.spawnOrb(ARENA, null);
        guard++;
    }

    const orbsToCollect = merge.getOrbs();

    orbsToCollect.forEach(orb => {
        merge.update(0, playerAt(orb.x, orb.y), ARENA, health);
    });

    const state = health.getState();

    assert.equal(state.hp, 100);
    assert.equal(state.lives, 3 + orbsToCollect.length);
    assert.equal(state.maxLives, 3 + orbsToCollect.length);
    assert.equal(merge.getOrbs().length, 0);
});

test("TESTE 05b: esferas nascem dentro da arena e respeitam o limite", () => {

    const { merge } = startMatch();

    const config = merge.getConfig();

    // O reset deve gerar as esferas iniciais.
    assert.equal(merge.getOrbs().length, config.initialOrbs);

    for (let i = 0; i < 20; i++) {
        merge.spawnOrb(ARENA, null);
    }

    const orbs = merge.getOrbs();

    assert.equal(orbs.length, config.maxOrbs);

    orbs.forEach(orb => {
        assert.ok(orb.x >= config.margin);
        assert.ok(orb.x <= ARENA.width - config.margin);
        assert.ok(orb.y >= config.margin);
        assert.ok(orb.y <= ARENA.height - config.margin);
    });
});

test("TESTE 05c: reset restaura HP, vidas e esferas", () => {

    const { health, merge } = startMatch();

    health.applyDamage(100);
    merge.update(0, playerAt(200, 400), ARENA, health);

    health.reset();
    merge.reset(ARENA, playerAt(200, 400));

    const state = health.getState();
    const config = merge.getConfig();

    assert.equal(state.hp, 100);
    assert.equal(state.lives, 3);
    assert.equal(state.maxLives, 3);
    assert.equal(state.gameOver, false);
    assert.equal(merge.getOrbs().length, config.initialOrbs);
});

test("TESTE 05d: em game over a coleta não altera HP nem vidas", () => {

    const { health, merge } = startMatch();

    // Cada dano letal consome uma vida; 3 danos encerram a partida.
    health.applyDamage(1000);
    health.applyDamage(1000);
    health.applyDamage(1000);

    assert.equal(health.getState().gameOver, true);

    const orb = merge.getOrbs()[0];
    merge.update(0, playerAt(orb.x, orb.y), ARENA, health);

    const state = health.getState();

    assert.equal(state.hp, 0);
    assert.equal(state.lives, 0);
    assert.equal(state.gameOver, true);
});
