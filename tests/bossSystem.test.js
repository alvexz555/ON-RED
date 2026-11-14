const test = require("node:test");
const assert = require("node:assert/strict");
const boss = require("../js/bossSystem.js");

const arena = { width: 900, height: 700 };
const player = { x: 450, y: 350, radius: 15 };

function createCombat(hitKinds) {
    const kinds = hitKinds || ["ray", "white", "electric", "boss"];
    const state = { damage: 25, registered: 0, isInvulnerable: false };
    const damageCalls = [];
    const health = {
        applyDamage(amount) {
            damageCalls.push(amount);
            return { applied: true, damage: amount, gameOver: false };
        },
        getState() { return { hp: boss.getState().boss.hp, gameOver: false }; }
    };
    const collision = {
        registerCollision() {
            if (state.isInvulnerable) return false;
            state.isInvulnerable = true;
            return true;
        },
        getState() { return state; },
        checkCollisions(targetPlayer, obstacles) {
            if (state.isInvulnerable) return false;
            if (!obstacles || !obstacles.length) return false;
            for (const obstacle of obstacles) {
                if (!obstacle || obstacle.state !== "ACTIVE") continue;
                if (!kinds.includes(obstacle.kind)) continue;
                const half = obstacle.kind === "ray"
                    ? (obstacle.width || 0) / 2
                    : (obstacle.kind === "boss" ? (obstacle.size || 0) / 2 : (obstacle.radius || 0));
                const minDistance = (targetPlayer.radius || 0) + half;
                const dx = targetPlayer.x - obstacle.x;
                const dy = targetPlayer.y - obstacle.y;
                if (dx * dx + dy * dy <= minDistance * minDistance) return true;
            }
            return false;
        }
    };
    return { state, damageCalls, health, collision };
}

function startFight(kinds) {
    boss.reset();
    boss.start(arena, player);
    const game = createCombat(kinds);
    player.x = 100;
    player.y = 650;
    let guard = 0;
    while (boss.getState().phase !== "FIGHT" && guard++ < 20) {
        boss.update(0.5, arena, player, game.health, game.collision);
    }
    assert.equal(boss.getState().phase, "FIGHT");
    return game;
}

function advanceUntilWeapon(game, type, maxSteps = 200) {
    let guard = 0;
    while (guard++ < maxSteps) {
        const state = boss.getState();
        if (state.weapon && state.weapon.type === type) {
            const weapon = state.weapon;
            const distanceFromBoss = Math.hypot(
                weapon.x - state.boss.x,
                weapon.y - state.boss.y
            );
            // Para testar parry/retorno, o projétil precisa realmente viajar
            // até a janela de aproximação, não ser rebatido no ponto de spawn.
            if (type !== "white" || distanceFromBoss >= state.boss.size / 2 + 150) {
                return weapon;
            }
        }
        boss.update(0.05, arena, player, game.health, game.collision);
    }
    return boss.getState().weapon;
}

function parryTarget() {
    const state = boss.getState();
    const weapon = state.weapon;
    const speed = Math.hypot(weapon.vx, weapon.vy) || 1;
    player.x = weapon.x + (weapon.vx / speed) * 30;
    player.y = weapon.y + (weapon.vy / speed) * 30;
    return player;
}

// Conduz o projétil rebatido até o impacto no Boss.
function advanceToImpact(game, maxSteps = 600) {
    let guard = 0;
    while (boss.getState().weapon && guard++ < maxSteps) {
        boss.update(0.05, arena, player, game.health, game.collision);
    }
    return !boss.getState().weapon;
}

test("boss trigger fires at 20000 and not before", () => {
    assert.equal(boss.getConfig().triggerScore, 20000);
    assert.equal(boss.shouldStart(19999), false);
    assert.equal(boss.shouldStart(20000), true);
});

test("warning phase lasts 1.8 seconds before the fight starts", () => {
    boss.reset();
    boss.start(arena, player);
    assert.equal(boss.getState().phase, "WARNING");
    assert.equal(boss.getState().phaseTimer, 1.8);

    boss.update(1.7, arena, player, createCombat().health, createCombat().collision);
    assert.equal(boss.getState().phase, "WARNING");

    boss.update(0.2, arena, player, createCombat().health, createCombat().collision);
    assert.equal(boss.getState().phase, "FIGHT");
});

test("boss starts the fight with 1000 hp and the bar reflects hp over max hp", () => {
    boss.reset();
    boss.start(arena, player);
    const state = boss.getState();
    assert.equal(state.boss.hp, 1000);
    assert.equal(state.boss.maxHP, 1000);
    assert.equal(state.boss.hp / state.boss.maxHP, 1);
});

test("parry accepted inside the window consumes the white projectile and hits the boss", () => {
    const game = startFight(["white"]);
    const weapon = advanceUntilWeapon(game, "white");
    assert.ok(weapon);
    assert.equal(weapon.type, "white");
    assert.equal(weapon.state, "ACTIVE");

    const hpBefore = boss.getState().boss.hp;
    const result = boss.tryParry(parryTarget());

    assert.equal(result.applied, true);
    // A rebatida não tira HP na hora: o projétil retorna contra o Boss.
    assert.equal(boss.getState().boss.hp, hpBefore);
    assert.equal(boss.getState().weapon.state, "RETURNING");

    assert.equal(advanceToImpact(game), true);
    assert.equal(boss.getState().boss.hp, hpBefore - 100);
    assert.equal(boss.getState().weapon, null);
});

test("parry rejected outside the window keeps the boss untouched", () => {
    const game = startFight(["white"]);
    const weapon = advanceUntilWeapon(game, "white");
    assert.ok(weapon);

    player.x = weapon.x + 200;
    player.y = weapon.y;
    const hpBefore = boss.getState().boss.hp;

    const result = boss.tryParry(player);

    assert.equal(result.applied, false);
    assert.equal(boss.getState().boss.hp, hpBefore);
});

test("electric projectile cannot be parried and still deals damage on contact", () => {
    boss.configure({ pong: { electric: { interval: 0.01 } } });
    const game = startFight();
    const weapon = advanceUntilWeapon(game, "electric");
    assert.ok(weapon);
    assert.equal(weapon.type, "electric");

    const hpBefore = boss.getState().boss.hp;
    const parryResult = boss.tryParry(player);
    assert.equal(parryResult.applied, false);
    assert.equal(boss.getState().boss.hp, hpBefore);

    const projectile = weapon.projectiles[0];
    const speed = Math.hypot(projectile.vx, projectile.vy) || 1;
    player.x = projectile.x + (projectile.vx / speed) * 10;
    player.y = projectile.y + (projectile.vy / speed) * 10;
    game.damageCalls.length = 0;

    boss.update(0.05, arena, player, game.health, game.collision);
    assert.deepEqual(game.damageCalls, [25]);
});

test("one parry deals exactly 100 damage and consumes the projectile once", () => {
    const game = startFight(["white"]);
    const weapon = advanceUntilWeapon(game, "white");
    assert.ok(weapon);

    const hpBefore = boss.getState().boss.hp;
    const result = boss.tryParry(parryTarget());
    assert.equal(result.applied, true);
    assert.equal(boss.getState().boss.hp, hpBefore);
    assert.equal(boss.getState().weapon.state, "RETURNING");

    assert.equal(advanceToImpact(game), true);
    assert.equal(boss.getState().boss.hp, hpBefore - 100);
    assert.equal(boss.getState().weapon, null);

    // Sem projétil ativo: sem alvo para a rebatida.
    const second = boss.tryParry({ x: player.x, y: player.y });
    assert.equal(second.applied, false);
});

test("ten parries defeat the boss with exact hp and never negative", () => {
    boss.configure({ pong: { white: { interval: 0.005, firstIn: 0.005 } } });
    boss.reset();
    boss.start(arena, player);
    const game = createCombat(["white"]);
    player.x = 100;
    player.y = 650;
    let guard = 0;
    while (boss.getState().phase !== "FIGHT" && guard++ < 20) {
        boss.update(0.5, arena, player, game.health, game.collision);
    }

    let parries = 0;
    while (boss.getState().phase !== "DEFEATED" && parries < 10) {
        let inner = 0;
        while (inner++ < 2000) {
            const state = boss.getState();
            if (state.weapon && state.weapon.type === "white" && state.weapon.state === "ACTIVE") break;
            boss.update(0.005, arena, player, game.health, game.collision);
        }
        const state = boss.getState();
        if (!(state.weapon && state.weapon.type === "white" && state.weapon.state === "ACTIVE")) break;

        const before = boss.getState().boss.hp;
        const result = boss.tryParry(parryTarget());
        assert.equal(result.applied, true);
        assert.equal(advanceToImpact(game), true);
        assert.equal(boss.getState().boss.hp, before - 100);
        parries += 1;
    }

    assert.equal(parries, 10);
    assert.equal(boss.getState().phase, "DEFEATED");
    assert.equal(boss.getState().boss.hp, 0);
    assert.ok(boss.getState().boss.hp >= 0);
});

test("boss at zero hp does not accept new damage", () => {
    boss.configure({ pong: { white: { interval: 0.005, firstIn: 0.005 } } });
    boss.reset();
    boss.start(arena, player);
    const game = createCombat(["white"]);
    player.x = 100;
    player.y = 650;
    let guard = 0;
    while (boss.getState().phase !== "FIGHT" && guard++ < 20) {
        boss.update(0.5, arena, player, game.health, game.collision);
    }

    let parries = 0;
    while (boss.getState().phase !== "DEFEATED" && parries < 10) {
        let inner = 0;
        while (inner++ < 2000) {
            const state = boss.getState();
            if (state.weapon && state.weapon.type === "white" && state.weapon.state === "ACTIVE") break;
            boss.update(0.005, arena, player, game.health, game.collision);
        }
        const state = boss.getState();
        if (!(state.weapon && state.weapon.type === "white" && state.weapon.state === "ACTIVE")) break;
        boss.tryParry(parryTarget());
        assert.equal(advanceToImpact(game), true);
        parries += 1;
    }

    assert.equal(boss.getState().phase, "DEFEATED");
    // Sem projétil ativo (HP zero): sem alvo para a rebatida.
    const result = boss.tryParry({ x: player.x, y: player.y });
    assert.equal(result.applied, false);
});

test("circular area attack telegraphs a ring and deals damage only in its active window", () => {
    boss.configure({ ray: { firstIn: 0.01 }, pong: { white: { firstIn: 2.0, interval: 3.4 } } });
    const game = startFight();
    const weapon = advanceUntilWeapon(game, "ray");
    assert.ok(weapon);
    assert.equal(weapon.type, "ray");
    assert.equal(weapon.state, "TELEGRAPH");
    assert.ok(weapon.radius > 0);
    game.damageCalls.length = 0;

    boss.update(0.5, arena, player, game.health, game.collision);
    assert.equal(game.damageCalls.length, 0);
    assert.equal(boss.getState().weapon.state, "TELEGRAPH");

    boss.update(weapon.timer + 0.01, arena, player, game.health, game.collision);
    const activeWeapon = boss.getState().weapon;
    assert.equal(activeWeapon.state, "ACTIVE");

    player.x = activeWeapon.x + activeWeapon.radius;
    player.y = activeWeapon.y;
    boss.update(0.01, arena, player, game.health, game.collision);
    assert.deepEqual(game.damageCalls, [25]);
});

test("circular area attack keeps its radius stable throughout the telegraph", () => {
    boss.configure({ ray: { firstIn: 0.01 }, pong: { white: { firstIn: 2.0, interval: 3.4 } } });
    const game = startFight();
    const weapon = advanceUntilWeapon(game, "ray");
    assert.ok(weapon);
    const telegraphRadius = weapon.radius;

    boss.update(weapon.timer / 2, arena, player, game.health, game.collision);
    assert.equal(boss.getState().weapon.state, "TELEGRAPH");
    assert.equal(boss.getState().weapon.radius, telegraphRadius);
    assert.equal(boss.getConfig().ray.radius, telegraphRadius);
});

test("white boss Pong ricochets from arena walls without leaving the arena", () => {
    const game = startFight(["white"]);
    const weapon = advanceUntilWeapon(game, "white");
    assert.ok(weapon);
    const initialVx = weapon.vx;
    assert.notEqual(initialVx, 0);

    let bounced = false;
    for (let i = 0; i < 400 && !bounced; i++) {
        player.x = 100;
        player.y = 650;
        boss.update(0.05, arena, player, game.health, game.collision);
        const current = boss.getState().weapon;
        if (!current || current.type !== "white") break;
        const inside = current.x >= current.radius && current.x <= arena.width - current.radius &&
            current.y >= current.radius && current.y <= arena.height - current.radius;
        assert.equal(inside, true);
        bounced = Math.sign(current.vx) !== Math.sign(initialVx) ||
            Math.sign(current.vy) !== Math.sign(weapon.vy);
    }
    assert.equal(bounced, true);
});

test("missed white pong applies the 25 damage gate once", () => {
    const game = startFight(["white"]);
    const weapon = advanceUntilWeapon(game, "white");
    assert.ok(weapon);

    player.x = weapon.x;
    player.y = weapon.y;
    boss.update(0.05, arena, player, game.health, game.collision);

    assert.equal(game.damageCalls.length, 1);
    assert.equal(game.damageCalls[0], 25);
});

test("boss movement stays inside arena and patrol band", () => {
    const game = startFight();
    boss.update(2, arena, player, game.health, game.collision);
    const state = boss.getState();
    const half = state.boss.size / 2;
    assert.ok(state.boss.x >= half);
    assert.ok(state.boss.x <= arena.width - half);
    assert.ok(state.boss.y >= half);
    assert.ok(state.boss.y <= arena.height - half);
    assert.ok(Math.abs(state.boss.x - arena.width / 2) <= state.boss.amplitudeX);
});

test("reset clears boss hp, projectiles, telegraph and timers", () => {
    const game = startFight();
    advanceUntilWeapon(game, "white");
    boss.reset();
    const state = boss.getState();
    assert.equal(state.phase, "IDLE");
    assert.equal(state.boss.hp, boss.getConfig().bossHp);
    assert.equal(state.weapon, null);
});

test("configure only accepts positive numbers and reflects them on getConfig", () => {
    assert.equal(boss.getConfig().bossHp, 1000);
    assert.equal(boss.configure({ bossHp: 500 }).bossHp, 500);
    assert.equal(boss.configure({ bossHp: -5 }).bossHp, 500);
    assert.equal(boss.configure({ pong: { white: { speed: 200 } } }).pong.white.speed, 200);
});

test("victory is not declared before the boss is defeated", () => {
    boss.reset();
    const state = boss.getState();
    assert.equal(state.phase, "IDLE");
    assert.equal(state.boss.hp, boss.getConfig().bossHp);
});

test("idle boss game does not apply damage and does not parry", () => {
    boss.reset();
    const game = createCombat();
    boss.update(0.1, arena, player, game.health, game.collision);
    const result = boss.tryParry(player);
    assert.equal(result.applied, false);
    assert.equal(game.damageCalls.length, 0);
});


test("a defeated boss cannot be triggered again in the same match", () => {
    // HP reduzido: uma única rebatida derrota o Boss.
    assert.equal(boss.configure({ bossHp: 100 }).bossHp, 100);
    const game = startFight(["white"]);
    let parried = false;
    let guard = 0;
    while (!parried && guard++ < 400) {
        const weapon = boss.getState().weapon;
        if (weapon && weapon.type === "white" && weapon.state === "ACTIVE") {
            const speed = Math.hypot(weapon.vx, weapon.vy) || 1;
            // Posiciona o jogador um pouco à frente do projétil: a rebatida
            // exige proximidade E projétil se aproximando.
            player.x = weapon.x + (weapon.vx / speed) * 60;
            player.y = weapon.y + (weapon.vy / speed) * 60;
            const result = boss.tryParry(player);
            if (result.applied) parried = true;
        } else {
            player.x = 100;
            player.y = 650;
        }
        boss.update(0.1, arena, player, game.health, game.collision);
    }
    assert.equal(parried, true);
    // O projétil rebatido precisa alcançar o Boss para a derrota.
    assert.equal(advanceToImpact(game), true);
    // Espera DEFEATED -> IDLE.
    guard = 0;
    while (boss.getState().phase !== "IDLE" && guard++ < 50) {
        boss.update(0.1, arena, player, game.health, game.collision);
    }
    assert.equal(boss.getState().phase, "IDLE");
    // Mesmo acima do gatilho, o Boss não retorna na mesma partida.
    assert.equal(boss.shouldStart(boss.getConfig().triggerScore + 10000), false);
    assert.equal(boss.start(arena, player).phase, "IDLE");
    // O reset de partida libera um novo confronto.
    boss.reset();
    assert.equal(boss.shouldStart(boss.getConfig().triggerScore), true);
});


test("a parried projectile that misses cannot parry again and hits once", () => {
    boss.configure({ bossHp: 300 });
    const game = startFight(["white"]);
    const weapon = advanceUntilWeapon(game, "white");
    assert.ok(weapon);

    boss.tryParry(parryTarget());
    const hpAfterParry = boss.getState().boss.hp;
    assert.equal(advanceToImpact(game), true);

    // O impacto aplica o dano exatamente uma vez: sem segunda passagem.
    assert.equal(boss.getState().boss.hp, hpAfterParry - 100);
    assert.equal(boss.getState().weapon, null);
    game.damageCalls.length = 0;
    for (let i = 0; i < 20; i++) {
        boss.update(0.05, arena, player, game.health, game.collision);
    }
    assert.deepEqual(game.damageCalls, []);
});

test("a lost white pong is discarded off-arena and the boss attacks again", () => {
    const game = startFight(["white"]);
    const weapon = advanceUntilWeapon(game, "white");
    assert.ok(weapon);

    // Deixa o pong atravessar a arena sem rebatida e sem tocar o jogador.
    let guard = 0;
    while (boss.getState().weapon && guard++ < 400) {
        player.x = 100;
        player.y = 650;
        boss.update(0.1, arena, player, game.health, game.collision);
    }
    assert.equal(boss.getState().weapon, null);

    // O Boss volta a atacar: um novo pong branco surge dentro do intervalo.
    guard = 0;
    let nextWeapon = null;
    while (guard++ < 400) {
        player.x = 100;
        player.y = 650;
        boss.update(0.1, arena, player, game.health, game.collision);
        const state = boss.getState();
        if (state.weapon && state.weapon.type === "white" && state.weapon.state === "ACTIVE") {
            nextWeapon = state.weapon;
            break;
        }
    }
    assert.ok(nextWeapon);
});

test("difficulty selection changes only boss combat knobs and survives reset", () => {
    boss.configure({ bossHp: 1000, moveSpeed: 45 });
    boss.setDifficulty("HARD");
    let config = boss.getConfig();
    assert.equal(config.bossHp, 1400);
    assert.equal(config.moveSpeed, 58);
    assert.equal(config.ray.interval, 5.5);
    assert.equal(boss.getDifficulty().difficulty, "HARD");

    boss.reset();
    assert.equal(boss.getConfig().bossHp, 1400);
    assert.equal(boss.getDifficulty().difficulty, "HARD");

    boss.setDifficulty("NORMAL");
    config = boss.getConfig();
    assert.equal(config.bossHp, 1000);
    assert.equal(config.moveSpeed, 45);
    assert.equal(config.ray.interval, 7.0);
    assert.equal(boss.getDifficulty().difficulty, "NORMAL");

    boss.setDifficulty("EASY");
    config = boss.getConfig();
    assert.equal(config.bossHp, 600);
    assert.equal(config.moveSpeed, 36);
    assert.equal(config.ray.interval, 9.0);
    boss.setDifficulty("NORMAL");
});
