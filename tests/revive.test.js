"use strict";

const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const test = require("node:test");
const assert = require("node:assert/strict");

function loadHealthSystem() {
    const sandbox = { console: { log() {}, warn() {}, error() {} }, Math };
    sandbox.window = sandbox;
    vm.createContext(sandbox);
    const source = fs.readFileSync(
        path.join(__dirname, "..", "js", "healthSystem.js"),
        "utf8"
    );
    vm.runInContext(source, sandbox, { filename: "healthSystem.js" });
    return sandbox.ONREDHealthSystem;
}

test("revive restores one life and 50 HP after defeat", () => {
    const health = loadHealthSystem();
    health.reset();
    const defeat = health.applyDamage(100);
    assert.equal(defeat.gameOver, true);

    const result = health.revive();
    assert.equal(result.applied, true);
    assert.equal(result.state.gameOver, false);
    assert.equal(result.state.lives, 1);
    assert.equal(result.state.hp, 50);
});

test("revive grants two seconds of damage protection", () => {
    const health = loadHealthSystem();
    health.reset();
    health.applyDamage(100);
    health.revive();

    const blocked = health.applyDamage(25);
    assert.equal(blocked.applied, false);
    assert.equal(blocked.reason, "revive_protection");
    assert.equal(health.getState().hp, 50);

    health.update(2.01);
    const applied = health.applyDamage(25);
    assert.equal(applied.applied, true);
    assert.equal(health.getState().hp, 25);
});

test("revive cannot be used before the player is defeated", () => {
    const health = loadHealthSystem();
    health.reset();
    const result = health.revive();
    assert.equal(result.applied, false);
    assert.equal(result.reason, "player_not_defeated");
    assert.equal(health.getState().hp, 100);
});
