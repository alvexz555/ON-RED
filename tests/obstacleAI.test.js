"use strict";

const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const test = require("node:test");
const assert = require("node:assert/strict");

function loadObstacleAI(player = { x: 100, y: 100 }) {
    const sandbox = { player, Math };
    vm.createContext(sandbox);
    const source = fs.readFileSync(
        path.join(__dirname, "..", "js", "obstacleAI.js"),
        "utf8"
    );
    vm.runInContext(source, sandbox, { filename: "obstacleAI.js" });
    return sandbox.ObstacleAI;
}

test("initialization assigns one active attacker", () => {
    const ai = loadObstacleAI();
    const obstacles = [
        { x: 0, y: 0, state: "ACTIVE" },
        { x: 80, y: 80, state: "ACTIVE" }
    ];

    ai.initialize(obstacles);

    assert.ok(ai.attacker);
    assert.equal(ai.attacker.role, "attacker");
    assert.equal(obstacles.filter(item => item.role === "attacker").length, 1);
});

test("AI selects a new attacker when the previous one is removed", () => {
    const ai = loadObstacleAI();
    const first = { x: 0, y: 0, state: "ACTIVE" };
    const second = { x: 80, y: 80, state: "ACTIVE" };
    const obstacles = [first, second];

    ai.initialize(obstacles);
    obstacles.shift();
    ai.updateRoles(obstacles);

    assert.equal(ai.attacker, second);
    assert.equal(second.role, "attacker");
});

test("AI selects a new attacker when the previous one is inactive", () => {
    const ai = loadObstacleAI();
    const first = { x: 0, y: 0, state: "ACTIVE" };
    const second = { x: 80, y: 80, state: "ACTIVE" };
    const obstacles = [first, second];

    ai.initialize(obstacles);
    first.state = "ELIMINATED";
    ai.updateRoles(obstacles);

    assert.equal(ai.attacker, second);
    assert.equal(second.role, "attacker");
});

test("attacker receives direct pursuit velocity toward player", () => {
    const ai = loadObstacleAI({ x: 100, y: 0 });
    const attacker = { x: 0, y: 0, role: "attacker" };

    const velocity = ai.getDesiredVelocity(attacker, 0, { x: 100, y: 0 }, 100);

    assert.ok(velocity.x > 0);
    assert.equal(velocity.y, 0);
});

test("AI clears attacker when no active obstacles remain", () => {
    const ai = loadObstacleAI();
    const obstacle = { x: 0, y: 0, state: "ACTIVE" };
    const obstacles = [obstacle];

    ai.initialize(obstacles);
    obstacle.state = "ELIMINATED";
    ai.updateRoles(obstacles);

    assert.equal(ai.attacker, null);
    assert.equal(obstacle.role, "pressure");
});
