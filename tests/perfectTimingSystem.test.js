const test = require("node:test");
const assert = require("node:assert/strict");
const system = require("../js/perfectTimingSystem.js");

function setupFive() {
    system.reset();
    const active = [];
    for (let i = 0; i < 5; i++) {
        active.push(system.registerObstacle({
            x: 80 + i * 90,
            y: 80,
            vx: 0,
            vy: 0,
            role: "pressure"
        }));
    }
    return active;
}

const arena = { width: 900, height: 700 };
const player = { x: 450, y: 350, radius: 15 };
const size = 34;

test("final configuration uses 5s cooldown, 25s individual and 10s collective respawn", () => {
    assert.deepEqual(system.getConfig(), {
        maxObstacles: 5,
        individualRespawnDelay: 25,
        collectiveRespawnDelay: 10,
        playerSafeMargin: 80,
        obstacleGap: 20,
        spawnAttempts: 100,
        retryInterval: 0.25
    });
});

test("impact target is selected by closing velocity, not array order or nearest center", () => {
    system.reset();
    const slowNear = system.registerObstacle({ x: 100, y: 100, vx: 0, vy: 0, role: "pressure" });
    const fastFar = system.registerObstacle({ x: 130, y: 100, vx: -120, vy: 0, role: "pressure" });
    const playerAtImpact = { x: 115, y: 100, radius: 15 };
    assert.equal(system.findImpactTarget(playerAtImpact, [slowNear, fastFar], 34), fastFar);
});

test("elimination removes only the selected active obstacle", () => {
    const active = setupFive();
    const target = active[2];
    const result = system.eliminate(target, active);

    assert.equal(result.applied, true);
    assert.equal(active.length, 4);
    assert.equal(active.includes(target), false);
    assert.equal(target.state, "ELIMINATED");
    assert.equal(system.getState().eliminatedCount, 1);
});

test("the same obstacle cannot be eliminated twice", () => {
    const active = setupFive();
    const target = active[0];

    assert.equal(system.eliminate(target, active).applied, true);
    assert.equal(system.eliminate(target, active).applied, false);
    assert.equal(system.getState().eliminatedCount, 1);
});

test("individual respawn waits the full 25 seconds", () => {
    const active = setupFive();
    const target = active[1];
    system.eliminate(target, active);

    system.update(24.99, arena, player, size, active);
    assert.equal(active.includes(target), false);

    const returned = system.update(0.02, arena, player, size, active);
    assert.equal(returned.length, 1);
    assert.equal(active.length, 5);
    assert.equal(target.state, "ACTIVE");
});

test("five eliminations trigger one collective 10-second return", () => {
    const active = setupFive();

    for (let i = 0; i < 4; i++) {
        assert.equal(system.eliminate(active[0], active).collectiveTriggered, false);
    }

    const final = system.eliminate(active[0], active);
    assert.equal(final.collectiveTriggered, true);
    assert.equal(active.length, 0);
    assert.equal(system.getState().collectiveRemaining, 10);

    system.update(9.99, arena, player, size, active);
    assert.equal(active.length, 0);

    const returned = system.update(0.02, arena, player, size, active);
    assert.equal(returned.length, 5);
    assert.equal(active.length, 5);
    assert.equal(system.getState().collectiveActive, false);
    assert.ok(active.every(obstacle => obstacle.state === "ACTIVE"));
});

test("respawn positions are inside arena and separated from player", () => {
    const active = setupFive();
    const target = active[0];
    system.eliminate(target, active);

    const returned = system.update(25, arena, player, size, active);
    assert.equal(returned.length, 1);

    const obstacle = returned[0];
    assert.ok(obstacle.x >= size / 2 + 4);
    assert.ok(obstacle.x <= arena.width - size / 2 - 4);
    assert.ok(obstacle.y >= size / 2 + 4);
    assert.ok(obstacle.y <= arena.height - size / 2 - 4);
    assert.ok(
        Math.hypot(obstacle.x - player.x, obstacle.y - player.y) >=
        player.radius + size / 2 + 80
    );
});

test("collective respawn restores all five together without overlaps", () => {
    const active = setupFive();
    for (let i = 0; i < 5; i++) system.eliminate(active[0], active);

    const returned = system.update(10, arena, player, size, active);
    assert.equal(returned.length, 5);
    assert.equal(active.length, 5);

    for (let i = 0; i < active.length; i++) {
        assert.ok(Math.hypot(active[i].x - player.x, active[i].y - player.y) >=
            player.radius + size / 2 + 80);
        for (let j = i + 1; j < active.length; j++) {
            assert.ok(
                Math.abs(active[i].x - active[j].x) >= size + 20 ||
                Math.abs(active[i].y - active[j].y) >= size + 20
            );
        }
    }
});

test("respawn never exceeds the five-obstacle cap", () => {
    const active = setupFive();
    system.eliminate(active[0], active);
    system.update(25, arena, player, size, active);
    assert.ok(active.length <= 5);
});
