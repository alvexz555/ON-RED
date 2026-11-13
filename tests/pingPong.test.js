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

test("twenty valid impacts activate electric overload and electrify the player on contact", () => {
    const game = createGame();
    const arena = { width: 5000, height: 5000 };
    const player = { x: 10000, y: 10000, radius: 15 };
    const electricHexMock = {
        resolvePingPongCollision(_ball, electric) {
            electricStates.push(Boolean(electric));
            return !electric;
        },
        isCirclePositionClear() { return true; }
    };
    const electricStates = [];

    assert.equal(game.pingPong.spawn(arena, player, [], 34, electricHexMock), true);
    for (let i = 0; i < 20; i++) {
        game.pingPong.update(0, player, arena, game.health, game.collision, [], 34, electricHexMock);
    }

    assert.equal(game.pingPong.getState().overloaded, true);
    assert.equal(game.pingPong.getState().impactCount, 20);
    assert.equal(electricStates.slice(0, 20).every(value => value === false), true);

    const ball = game.pingPong.getState().ball;
    player.x = ball.x;
    player.y = ball.y;
    game.pingPong.update(0, player, arena, game.health, game.collision, [], 34, electricHexMock);

    const state = game.pingPong.getState();
    assert.equal(state.overloaded, false);
    assert.ok(state.electrifiedTimer > 0);
    assert.equal(state.stunTimer, 0);
    assert.equal(state.controlMultiplier, 0.2, "a recuperação normal do knockback continua ativa após a eletrização");
    assert.equal(state.overloaded, false);
    assert.equal(electricStates[20], true);
});


test("an electric hexagon hit consumes overload and preserves accumulated speed", () => {
    const game = createGame();
    const arena = { width: 5000, height: 5000 };
    const player = { x: 4900, y: 4900, radius: 15 };
    let consumeOnElectricHit = false;
    const hexMock = {
        resolvePingPongCollision(_ball, electric) {
            return Boolean(electric && consumeOnElectricHit) || !electric;
        },
        isCirclePositionClear() { return true; }
    };

    game.pingPong.spawn(arena, player, [], 34, hexMock);
    for (let i = 0; i < 20; i++) {
        game.pingPong.update(0, player, arena, game.health, game.collision, [], 34, hexMock);
    }
    const speedBeforeHit = Math.hypot(
        game.pingPong.getState().ball.vx, game.pingPong.getState().ball.vy
    );
    assert.equal(game.pingPong.getState().overloaded, true);

    consumeOnElectricHit = true;
    game.pingPong.update(0, player, arena, game.health, game.collision, [], 34, hexMock);
    const state = game.pingPong.getState();

    assert.equal(state.overloaded, false);
    assert.equal(state.impactCount, 0);
    assert.ok(Math.hypot(state.ball.vx, state.ball.vy) > speedBeforeHit);
});

test("electric stun temporarily blocks movement and expires automatically", () => {
    const game = createGame();
    const arena = { width: 5000, height: 5000 };
    const player = { x: 4900, y: 4900, radius: 15 };
    const hexMock = { resolvePingPongCollision(_ball, electric) { return !electric; }, isCirclePositionClear() { return true; } };

    game.pingPong.spawn(arena, player, [], 34, hexMock);
    for (let i = 0; i < 20; i++) game.pingPong.update(0, player, arena, game.health, game.collision, [], 34, hexMock);

    const ball = game.pingPong.getState().ball;
    player.x = ball.x;
    player.y = ball.y;
    game.pingPong.update(0, player, arena, game.health, game.collision, [], 34, hexMock);

    let guard = 0;
    while (game.pingPong.getState().stunTimer === 0 && guard++ < 100) {
        game.pingPong.update(0.1, player, arena, game.health, game.collision, [], 34, hexMock);
    }
    assert.ok(game.pingPong.getState().stunTimer > 0);
    assert.equal(game.pingPong.getControlMultiplier(), 0);

    game.pingPong.update(4, player, arena, game.health, game.collision, [], 34, hexMock);
    assert.equal(game.pingPong.getState().electrifiedTimer, 0);
    assert.equal(game.pingPong.getControlMultiplier(), 1);
});

test("Ping Pong accelerates during overload but never exceeds the 1200 speed cap", () => {
    const game = createGame();
    const arena = { width: 5000, height: 5000 };
    const player = { x: 10000, y: 10000, radius: 15 };
    game.pingPong.configure({ collisionSpeedMultiplier: 1.01 });
    const hexMock = {
        resolvePingPongCollision(_ball, electric) { return !electric; },
        isCirclePositionClear() { return true; }
    };
    game.pingPong.spawn(arena, player, [], 34, hexMock);

    for (let i = 0; i < 20; i++) {
        game.pingPong.update(0, player, arena, game.health, game.collision, [], 34, hexMock);
    }
    const speedAtOverload = Math.hypot(
        game.pingPong.getState().ball.vx, game.pingPong.getState().ball.vy
    );
    assert.ok(speedAtOverload > 380);
    assert.equal(game.pingPong.getState().overloaded, true);

    for (let i = 0; i < 100; i++) {
        game.pingPong.update(10, player, arena, game.health, game.collision, [], 34, hexMock);
    }
    const speedDuringOverload = Math.hypot(
        game.pingPong.getState().ball.vx, game.pingPong.getState().ball.vy
    );
    assert.ok(speedDuringOverload > speedAtOverload);
    const cappedState = game.pingPong.getState();
    const cappedSpeed = Math.hypot(cappedState.ball.vx, cappedState.ball.vy);
    assert.equal(game.pingPong.getConfig().maxSpeed, 1200);
    assert.ok(cappedSpeed <= 1200.001, `expected speed <= 1200, received ${cappedSpeed}`);
});

test("overload remains active indefinitely until a hexagon consumes it", () => {
    const game = createGame();
    const arena = { width: 5000, height: 5000 };
    const player = { x: 10000, y: 10000, radius: 15 };
    const hexMock = {
        resolvePingPongCollision(_ball, electric) { return !electric; },
        isCirclePositionClear() { return true; }
    };
    game.pingPong.spawn(arena, player, [], 34, hexMock);
    for (let i = 0; i < 20; i++) {
        game.pingPong.update(0, player, arena, game.health, game.collision, [], 34, hexMock);
    }
    const speedBeforeExpiry = Math.hypot(
        game.pingPong.getState().ball.vx, game.pingPong.getState().ball.vy
    );

    game.pingPong.update(10, player, arena, game.health, game.collision, [], 34, null);
    const state = game.pingPong.getState();
    assert.equal(state.overloaded, true);
    assert.ok(Math.abs(Math.hypot(state.ball.vx, state.ball.vy) - speedBeforeExpiry) < 0.001);
    assert.equal(state.impactCount, 20);
});

test("Ping Pong resets to base speed only after touching the player", () => {
    const game = createGame();
    const arena = { width: 5000, height: 5000 };
    const player = { x: 4900, y: 4900, radius: 15 };
    const hexMock = {
        resolvePingPongCollision(_ball, electric) { return !electric; },
        isCirclePositionClear() { return true; }
    };
    game.pingPong.spawn(arena, player, [], 34, hexMock);
    for (let i = 0; i < 7; i++) {
        game.pingPong.update(0, player, arena, game.health, game.collision, [], 34, hexMock);
    }
    const ball = game.pingPong.getState().ball;
    player.x = ball.x;
    player.y = ball.y;
    game.pingPong.update(0, player, arena, game.health, game.collision, [], 34, null);
    const state = game.pingPong.getState();
    assert.ok(Math.abs(Math.hypot(state.ball.vx, state.ball.vy) - 380) < 0.001);
    assert.equal(state.overloaded, false);
});
