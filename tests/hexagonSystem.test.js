const test = require("node:test");
const assert = require("node:assert/strict");
const hex = require("../js/hexagonSystem.js");

function reset() {
    hex.reset();
    hex.configure({
        radius: 30, maxHexagons: 8, spawnInterval: 8, spawnAttempts: 60,
        playerSafeMargin: 90, obstacleGap: 8, initialHealth: 3, pingPongDamage: 1
    });
}
const arena = { width: 900, height: 700 };
const player = { x: 450, y: 350, radius: 15 };

test("hexagon exposes six vertices and configurable geometry", () => {
    reset();
    const item = hex.spawn(arena, {x:100,y:100,radius:15}, [], 34);
    assert.ok(item);
    assert.equal(hex.vertices(item).length, 6);
    assert.equal(item.radius, 30);
});

test("spawn keeps hexagons inside arena and away from player", () => {
    reset();
    const item = hex.spawn(arena, player, [], 34);
    assert.ok(item);
    assert.ok(item.x >= 34 && item.x <= arena.width - 34);
    assert.ok(item.y >= 34 && item.y <= arena.height - 34);
    assert.ok(Math.hypot(item.x-player.x,item.y-player.y) >= 135);
});

test("spawn refuses overlapping player and pursuer locations", () => {
    reset();
    const originalRandom = Math.random;
    Math.random = () => 0.5;
    try {
        assert.equal(hex.spawn(arena, {x:450,y:350,radius:15}, [], 34), null);
        assert.equal(hex.spawn(arena, {x:100,y:100,radius:15}, [{x:450,y:350,state:"ACTIVE"}], 34), null);
    } finally {
        Math.random = originalRandom;
    }
});

test("spawn respects maximum simultaneous hexagons", () => {
    reset();
    const farPlayer = {x:80,y:80,radius:15};
    for (let i=0;i<8;i++) {
        const item = hex.spawn(arena, farPlayer, [], 34);
        assert.ok(item);
    }
    assert.equal(hex.spawn(arena, farPlayer, [], 34), null);
});

test("circle polygon contact detects overlap and ignores distant circles", () => {
    reset();
    const item = {x:200,y:200,radius:42};
    const polygon = hex.vertices(item);
    assert.ok(hex.circlePolygonContact({x:200,y:200,radius:10},polygon));
    assert.equal(hex.circlePolygonContact({x:400,y:400,radius:10},polygon),null);
});

test("player is pushed out of hexagon and contact damage uses shared collision gate", () => {
    reset();
    const item = hex.spawn(arena, {x:100,y:100,radius:15}, [], 34);
    const actor = {x:item.x,y:item.y,radius:15};
    let damage = 0, registered = 0;
    const collision = {
        registerCollision(){registered++;return true;},
        getState(){return {damage:25};}
    };
    const health = {applyDamage(value){damage+=value;return {gameOver:false};}};
    assert.equal(hex.resolvePlayer(actor,health,collision),true);
    assert.equal(hex.circlePolygonContact(actor, hex.vertices(item)), null);
    assert.equal(registered,1);
    assert.equal(damage,25);
});

test("player contact respects invulnerability and does not apply repeated damage", () => {
    reset();
    const item = hex.spawn(arena, {x:100,y:100,radius:15}, [], 34);
    const actor = {x:item.x,y:item.y,radius:15};
    let damage = 0;
    const collision = {registerCollision(){return false;},getState(){return {damage:25};}};
    const health = {applyDamage(value){damage+=value;return {gameOver:false};}};
    hex.resolvePlayer(actor,health,collision);
    assert.equal(damage,0);
});

test("square obstacle is separated from hexagon", () => {
    reset();
    const item = hex.spawn(arena, {x:100,y:100,radius:15}, [], 34);
    const square = {x:item.x,y:item.y,state:"ACTIVE"};
    assert.equal(hex.resolveObstacles([square],34),1);
    assert.equal(
        hex.polygonCollision(hex.vertices(item), hex.rectangleVertices(square,34)),
        null
    );
});

test("Ping Pong damages hexagon and reflects from its surface", () => {
    reset();
    const item = hex.spawn(arena, {x:100,y:100,radius:15}, [], 34);
    const ball = {x:item.x-item.radius-5,y:item.y,vx:100,vy:0,radius:12};
    assert.equal(hex.resolvePingPongCollision(ball),true);
    assert.equal(item.health,2);
    assert.ok(ball.vx < 0, "a bola deve rebater para longe do hexágono");
    assert.ok(Math.hypot(ball.x-item.x,ball.y-item.y) > item.radius);
});

test("three valid Ping Pong impacts destroy and remove the hexagon", () => {
    reset();
    const item = hex.spawn(arena, {x:100,y:100,radius:15}, [], 34);
    assert.equal(hex.damage(item,1),true);
    assert.equal(hex.damage(item,1),true);
    assert.equal(hex.damage(item,1),true);
    assert.equal(item.destroyed,true);
    assert.equal(hex.getState().count,0);
    assert.equal(hex.damage(item,1),false);
});

test("Ping Pong spawn validation rejects positions overlapping hexagons", () => {
    reset();
    const item = hex.spawn(arena, {x:100,y:100,radius:15}, [], 34);
    assert.equal(hex.isCirclePositionClear({x:item.x,y:item.y,radius:12}),false);
    assert.equal(hex.isCirclePositionClear({x:800,y:600,radius:12}),true);
});

test("reset clears hexagons and generation timer", () => {
    reset();
    hex.spawn(arena, {x:100,y:100,radius:15}, [], 34);
    hex.update(9,arena,player,[],34,null);
    hex.reset();
    assert.equal(hex.getState().count,0);
    assert.equal(hex.getState().spawnTimer,0);
});

test("destroyed hexagons are excluded from collision and drawing state", () => {
    reset();
    const item = hex.spawn(arena, {x:100,y:100,radius:15}, [], 34);
    hex.damage(item,3);
    assert.equal(hex.getHexagons().includes(item),false);
    assert.equal(hex.resolvePingPongCollision({x:item.x,y:item.y,vx:0,vy:0,radius:12}),false);
});

test("electric Ping Pong collision instantly destroys a hexagon and preserves bounce", () => {
    reset();
    const item = hex.spawn(arena, {x:100,y:100,radius:15}, [], 34);
    const ball = {x:item.x-item.radius-5,y:item.y,vx:100,vy:0,radius:12};
    assert.equal(hex.resolvePingPongCollision(ball, true), true);
    assert.equal(item.destroyed, true);
    assert.equal(hex.getState().count, 0);
    assert.ok(ball.vx < 0, "a bola deve preservar o rebote ao destruir o hexágono");
});

test("hexagon generation keeps replenishing after destruction without exceeding simultaneous cap", () => {
    reset();
    const farPlayer = { x: 80, y: 80, radius: 15 };
    const created = [];
    for (let i = 0; i < 8; i++) {
        const item = hex.spawn(arena, farPlayer, [], 34);
        assert.ok(item);
        created.push(item);
    }
    assert.equal(hex.getState().count, 8);

    for (const item of created) hex.damage(item, item.health);
    assert.equal(hex.getState().count, 0);

    hex.update(8, arena, farPlayer, [], 34, null);
    assert.equal(hex.getState().count, 1);

    for (let cycle = 0; cycle < 4; cycle++) {
        const current = hex.getHexagons()[0];
        assert.ok(current);
        hex.damage(current, current.health);
        hex.update(14, arena, farPlayer, [], 34, null);
    }
    assert.equal(hex.getState().count, 1);
    assert.ok(hex.getState().hexagons[0].id > created[4].id);
});


test("hexagons begin spawning after eight seconds, not fourteen", () => {
    reset();
    const farPlayer = { x: 80, y: 80, radius: 15 };
    hex.update(7.99, arena, farPlayer, [], 34, null);
    assert.equal(hex.getState().count, 0);
    hex.update(0.01, arena, farPlayer, [], 34, null);
    assert.equal(hex.getState().count, 1);
});

test("hexagon system supports eight simultaneous units", () => {
    reset();
    const farPlayer = { x: 80, y: 80, radius: 15 };
    for (let i = 0; i < 8; i++) {
        assert.ok(hex.spawn(arena, farPlayer, [], 34));
    }
    assert.equal(hex.getState().count, 8);
    assert.equal(hex.spawn(arena, farPlayer, [], 34), null);
});
