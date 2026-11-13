const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

function createGame() {
    let registeredCollisions = 0;
    const window = {};
    const source = fs.readFileSync(require.resolve("../js/pingPong.js"), "utf8");
    vm.runInNewContext(source, { window, console, Math });

    const damageCalls = [];
    const health = {
        applyDamage(amount) {
            damageCalls.push(amount);
            return { applied: true, gameOver: false };
        }
    };
    const collision = {
        registerCollision() {
            registeredCollisions++;
            return true;
        },
        getState() {
            return { damage: 25, isInvulnerable: false };
        }
    };

    return {
        pingPong: window.ONREDPingPong,
        health,
        collision,
        damageCalls,
        getRegisteredCollisions: () => registeredCollisions
    };
}

test("Ping Pong damages the player without activating global invulnerability", () => {
    const game = createGame();
    const arena = { width: 900, height: 700 };
    const player = { x: 450, y: 350, radius: 15 };

    assert.equal(game.pingPong.spawn(arena, player, [], 34, null), true);
    const ball = game.pingPong.getState().ball;
    player.x = ball.x + player.radius + ball.radius - 1;
    player.y = ball.y;

    game.pingPong.update(
        0, player, arena, game.health, game.collision, [], 34, null
    );

    assert.deepEqual(game.damageCalls, [25]);
    assert.equal(game.getRegisteredCollisions(), 0);
    assert.equal(game.pingPong.getState().controlSlowTimer, 1);
    assert.ok(Math.hypot(
        game.pingPong.getState().knockback.x,
        game.pingPong.getState().knockback.y
    ) > 0);
});

test("Ping Pong knockback does not block subsequent damage sources", () => {
    const game = createGame();
    const arena = { width: 900, height: 700 };
    const player = { x: 450, y: 350, radius: 15 };

    assert.equal(game.pingPong.spawn(arena, player, [], 34, null), true);
    const ball = game.pingPong.getState().ball;
    player.x = ball.x + player.radius + ball.radius - 1;
    player.y = ball.y;
    game.pingPong.update(0, player, arena, game.health, game.collision, [], 34, null);

    // Simula uma fonte de dano independente após o impacto do Ping Pong.
    game.health.applyDamage(25);

    assert.deepEqual(game.damageCalls, [25, 25]);
    assert.equal(game.getRegisteredCollisions(), 0);
});
