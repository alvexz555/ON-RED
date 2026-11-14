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

test("single circular blast warns first and damages the entire marked area", () => {
    boss.configure({ ray: { firstIn: 0.01 }, pong: { white: { firstIn: 2.0, interval: 3.4 } } });
    const game = startFight();
    const weapon = advanceUntilWeapon(game, "ray");
    assert.ok(weapon);
    assert.equal(weapon.pattern, "single");
    assert.equal(weapon.blasts.length, 1);
    const blast = weapon.blasts[0];
    assert.equal(blast.state, "TELEGRAPH");
    assert.equal(blast.radius, boss.getConfig().ray.singleRadius);
    assert.ok(blast.radius > boss.getConfig().ray.sequenceRadius);
    game.damageCalls.length = 0;

    player.x = blast.x + blast.radius - 2;
    player.y = blast.y;
    boss.update(blast.timer + 0.01, arena, player, game.health, game.collision);
    assert.deepEqual(game.damageCalls, [25]);
    assert.equal(boss.getState().weapon.blasts[0].state, "ACTIVE");
});

test("area attacks repeat the mandatory A-C-A-C cycle throughout the Boss fight", () => {
    boss.configure({ ray: { firstIn: 0.01, interval: 0.01 }, pong: { white: { firstIn: 100, interval: 100 }, electric: { interval: 100 } } });
    const game = startFight();
    player.x = 450;
    player.y = 350;

    const expected = [
        { pattern: "single", count: 1 },
        { pattern: "sequence", count: 5 },
        { pattern: "single", count: 1 },
        { pattern: "sequence", count: 5 }
    ];

    for (let index = 0; index < expected.length; index++) {
        let weapon = boss.getState().weapon;
        let guard = 0;
        while ((!weapon || weapon.type !== "ray") && guard++ < 200) {
            boss.update(0.05, arena, player, game.health, game.collision);
            weapon = boss.getState().weapon;
        }

        assert.ok(weapon, `area attack ${index + 1} should be fired`);
        assert.equal(weapon.pattern, expected[index].pattern);
        assert.equal(weapon.blasts.length, expected[index].count);

        if (weapon.pattern === "sequence") {
            assert.equal(weapon.blasts[0].state, "TELEGRAPH");
            assert.equal(weapon.blasts[1].state, "WAITING");
            assert.equal(weapon.blasts[2].state, "WAITING");
            assert.equal(weapon.blasts[3].state, "WAITING");
            assert.equal(weapon.blasts[4].state, "WAITING");
            assert.ok(weapon.blasts.every(blast => blast.radius === boss.getConfig().ray.sequenceRadius));
        }

        // Esvazia completamente as zonas antes de solicitar o próximo ataque.
        guard = 0;
        while (boss.getState().weapon && guard++ < 200) {
            boss.update(0.1, arena, player, game.health, game.collision);
        }
        assert.equal(boss.getState().weapon, null);
    }
});

test("white boss Pong ricochets from arena walls without leaving the arena", () => {
    boss.configure({ ray: { interval: 100, firstIn: 100 }, pong: { white: { firstIn: 0.01, interval: 100 }, electric: { interval: 100 } } });
    const game = startFight(["white"]);
    const weapon = advanceUntilWeapon(game, "white");
    assert.ok(weapon);
    const initialVx = weapon.vx;
    const initialVy = weapon.vy;
    assert.notEqual(initialVx, 0);
    player.x = 850;
    player.y = 50;

    let bounced = false;
    for (let i = 0; i < 400 && !bounced; i++) {
        boss.update(0.05, arena, player, game.health, game.collision);
        const current = boss.getState().weapon;
        if (!current || current.type !== "white") break;
        const inside = current.x >= current.radius && current.x <= arena.width - current.radius &&
            current.y >= current.radius && current.y <= arena.height - current.radius;
        assert.equal(inside, true);
        bounced = Math.sign(current.vx) !== Math.sign(initialVx) ||
            Math.sign(current.vy) !== Math.sign(initialVy);
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
    boss.configure({ ray: { interval: 100, firstIn: 100 }, pong: { electric: { interval: 100 } } });
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
    boss.configure({ bossHp: 300, ray: { interval: 100, firstIn: 100 }, pong: { white: { firstIn: 0.01, interval: 3.4 }, electric: { interval: 100 } } });
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

test("white Boss Pong keeps ricocheting inside the arena instead of disappearing", () => {
    boss.configure({ ray: { interval: 100, firstIn: 100 }, pong: { white: { firstIn: 0.01, interval: 100 }, electric: { interval: 100 } } });
    const game = startFight(["white"]);
    assert.ok(advanceUntilWeapon(game, "white"));
    // O projétil já foi lançado na direção anterior; afasta o jogador para observar os ricochetes.
    player.x = 800;
    player.y = 650;

    let observedBounce = false;
    let previousVelocity = null;
    for (let i = 0; i < 400; i++) {
        const before = boss.getState().weapon;
        if (before && before.type === "white") previousVelocity = { vx: before.vx, vy: before.vy };
        boss.update(0.1, arena, player, game.health, game.collision);
        const current = boss.getState().weapon;
        if (!current || current.type !== "white") break;
        assert.ok(current.x >= current.radius && current.x <= arena.width - current.radius);
        assert.ok(current.y >= current.radius && current.y <= arena.height - current.radius);
        if (previousVelocity &&
            (Math.sign(current.vx) !== Math.sign(previousVelocity.vx) ||
             Math.sign(current.vy) !== Math.sign(previousVelocity.vy))) observedBounce = true;
    }
    assert.equal(observedBounce, true);
    assert.equal(boss.getState().weapon.type, "white");
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


test("five sequence blasts predict the player's recent movement and lock each mark", () => {
    boss.configure({
        ray: {
            firstIn: 0.01, interval: 0.01, sequenceDelay: 0.4,
            sequenceTelegraphDuration: 0.5, predictionStep: 0.22,
            predictionMaxDistance: 150
        },
        pong: { white: { firstIn: 100, interval: 100 }, electric: { interval: 100 } }
    });
    const game = startFight();
    player.x = 180;
    player.y = 220;
    boss.update(0.1, arena, player, game.health, game.collision);
    player.x = 220;
    player.y = 220;
    boss.update(0.1, arena, player, game.health, game.collision);

    let weapon = boss.getState().weapon;
    let guard = 0;
    while ((!weapon || weapon.type !== "ray" || weapon.pattern !== "sequence") && guard++ < 300) {
        boss.update(0.05, arena, player, game.health, game.collision);
        weapon = boss.getState().weapon;
    }
    assert.ok(weapon);
    assert.equal(weapon.blasts.length, 5);
    const [first, second, third, fourth, fifth] = weapon.blasts;
    assert.equal(first.state, "TELEGRAPH");
    assert.deepEqual([first.x, first.y], [220, 220]);
    assert.equal(second.state, "WAITING");
    assert.equal(third.state, "WAITING");
    assert.equal(fourth.state, "WAITING");
    assert.equal(fifth.state, "WAITING");

    player.x = 260;
    player.y = 220;
    boss.update(0.4, arena, player, game.health, game.collision);
    weapon = boss.getState().weapon;
    assert.equal(weapon.blasts[1].state, "TELEGRAPH");
    assert.ok(weapon.blasts[1].x > player.x);
    const lockedSecond = weapon.blasts[1].x;

    player.x = 240;
    player.y = 300;
    boss.update(0.1, arena, player, game.health, game.collision);
    weapon = boss.getState().weapon;
    assert.equal(weapon.blasts[1].x, lockedSecond);
    assert.equal(weapon.blasts.length, 5);
});


test("electric Boss Pong applies energized status and temporary control interruptions", () => {
    boss.configure({ ray: { firstIn: 100, interval: 100 }, pong: { white: { firstIn: 100, interval: 100 }, electric: { interval: 0.01, electrifiedDuration: 3 } } });
    const game = startFight(["electric"]);
    let guard = 0;
    while ((!boss.getState().weapon || boss.getState().weapon.type !== "electric") && guard++ < 100) boss.update(0.05, arena, player, game.health, game.collision);
    const projectile = boss.getState().weapon.projectiles[0];
    player.x = projectile.x + projectile.vx * 0.01; player.y = projectile.y + projectile.vy * 0.01;
    boss.update(0.05, arena, player, game.health, game.collision);
    assert.ok(boss.getState().electrifiedTimer > 0 && boss.getState().electrifiedTimer <= 3);
    let interrupted = false;
    for (let i = 0; i < 30; i++) { boss.update(0.05, arena, player, game.health, game.collision); if (boss.getState().controlMultiplier === 0) { interrupted = true; break; } }
    assert.equal(interrupted, true);
});

test("electric Boss Pong accelerates by 20 percent on wall bounce and caps at 1200", () => {
    boss.configure({ ray: { firstIn: 100, interval: 100 }, pong: { white: { firstIn: 100, interval: 100 }, electric: { interval: 0.01, speed: 100, wallSpeedMultiplier: 1.2, maxSpeed: 1200 } } });
    const game = startFight(["electric"]);
    let guard = 0;
    while ((!boss.getState().weapon || boss.getState().weapon.type !== "electric") && guard++ < 100) boss.update(0.05, arena, player, game.health, game.collision);
    let volley = boss.getState().weapon;
    let previousSpeed = Math.hypot(volley.projectiles[0].vx, volley.projectiles[0].vy);
    player.x = 100; player.y = 650;
    let observedBounce = false;
    for (let i = 0; i < 300; i++) {
        boss.update(0.05, arena, player, game.health, game.collision);
        volley = boss.getState().weapon; if (!volley || volley.type !== "electric") break;
        const speed = Math.hypot(volley.projectiles[0].vx, volley.projectiles[0].vy);
        if (speed > previousSpeed + 0.01) { assert.ok(Math.abs(speed - Math.min(previousSpeed * 1.2, 1200)) < 0.1); observedBounce = true; break; }
    }
    assert.equal(observedBounce, true);
});


test("electric Boss volley overlaps an area attack instead of waiting for it to finish", () => {
    boss.configure({
        ray: { firstIn: 0.01, interval: 100 },
        pong: {
            white: { firstIn: 100, interval: 100 },
            electric: { interval: 0.01, lifetime: 8, speed: 380 }
        }
    });
    const game = startFight(["ray", "electric"]);
    boss.update(0.05, arena, player, game.health, game.collision);
    const state = boss.getState();
    assert.equal(state.weapon.type, "ray");
    assert.equal(state.electricWeapon.type, "electric");
    assert.equal(state.electricWeapon.projectiles.length, 2);
});

test("electric wall ricochets leave visible temporary damage trails", () => {
    boss.configure({
        ray: { firstIn: 100, interval: 100 },
        pong: {
            white: { firstIn: 100, interval: 100 },
            electric: { interval: 0.01, lifetime: 8, speed: 600, wallSpeedMultiplier: 1.2 }
        }
    });
    const game = startFight(["electric"]);
    boss.update(0.05, arena, player, game.health, game.collision);
    player.x = 800;
    player.y = 650;

    let observedTrail = false;
    for (let i = 0; i < 80; i++) {
        boss.update(0.05, arena, player, game.health, game.collision);
        const state = boss.getState();
        if (state.electricTrails.length > 0) {
            observedTrail = true;
            assert.ok(state.electricTrails.some(trail => trail.timer > 0));
            break;
        }
    }
    assert.equal(observedTrail, true);
});
