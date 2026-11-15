const test = require("node:test");
const assert = require("node:assert/strict");
const onredWorld = require("../js/onredWorld.js");

test("ONREDWorld exposes the central world api", () => {
    assert.ok(onredWorld);
    assert.equal(typeof onredWorld.getWorld, "function");
    assert.equal(typeof onredWorld.worldToScreen, "function");
    assert.equal(typeof onredWorld.screenToWorld, "function");
    assert.equal(typeof onredWorld.fit, "function");
    assert.equal(typeof onredWorld.resize, "function");
});

test("ONREDWorld reads the viewport as the logical world", () => {
    globalThis.innerWidth = 390;
    globalThis.innerHeight = 844;

    const world = onredWorld.resize();
    assert.equal(world.width, 390);
    assert.equal(world.height, 844);

    assert.deepEqual(onredWorld.getWorld(), { width: 390, height: 844 });
});

test("ONREDWorld conversions are the identity at scale 1 and offset 0", () => {
    const point = onredWorld.worldToScreen({ x: 10, y: 20 });
    assert.deepEqual(point, { x: 10, y: 20 });

    const back = onredWorld.screenToWorld(point);
    assert.deepEqual(back, { x: 10, y: 20 });
});

test("ONREDWorld fit resolves the world for a profile from the window", () => {
    const fitted = onredWorld.fit("mobile", { innerWidth: 390, innerHeight: 844 });
    assert.equal(fitted.width, 390);
    assert.equal(fitted.height, 844);
});

test("ONREDWorld exposes the dpr api", () => {
    assert.equal(typeof onredWorld.getDpr, "function");
    assert.equal(typeof onredWorld.getCanvasSize, "function");
});

test("ONREDWorld defaults dpr to 1 when devicePixelRatio is unavailable", () => {
    delete globalThis.devicePixelRatio;
    assert.equal(onredWorld.getDpr(), 1);
});

test("ONREDWorld keeps logical world and maps dpr to the canvas resolution", () => {
    globalThis.devicePixelRatio = 2;
    globalThis.innerWidth = 390;
    globalThis.innerHeight = 844;

    onredWorld.resize();

    const world = onredWorld.getWorld();
    const size = onredWorld.getCanvasSize();

    assert.equal(world.width, 390);
    assert.equal(world.height, 844);
    assert.equal(size.dpr, 2);
    assert.equal(size.width, 780);
    assert.equal(size.height, 1688);
});

test("ONREDWorld rounds the canvas resolution for fractional dpr", () => {
    globalThis.devicePixelRatio = 1.5;
    globalThis.innerWidth = 390;
    globalThis.innerHeight = 844;

    onredWorld.resize();

    const size = onredWorld.getCanvasSize();

    assert.equal(size.dpr, 1.5);
    assert.equal(size.width, 585);
    assert.equal(size.height, 1266);
});


test("escala central: a referencia mobile fica em escala 1", () => {
    globalThis.devicePixelRatio = 2;
    globalThis.innerWidth = 390;
    globalThis.innerHeight = 844;

    onredWorld.resize();

    assert.equal(onredWorld.getScale(), 1);
    assert.deepEqual(onredWorld.getWorld(), { width: 390, height: 844 });
    assert.deepEqual(onredWorld.getScaleReference(), { width: 390, height: 844 });
});

test("escala central: viewport maior que a referencia escala uniformemente", () => {
    globalThis.innerWidth = 780;   // 2x a referencia
    globalThis.innerHeight = 1688; // 2x a referencia

    onredWorld.resize();

    const scale = onredWorld.getScale();
    const world = onredWorld.getWorld();

    assert.equal(scale, 2);
    // O mundo logico cobre a viewport: 780/2 x 1688/2.
    assert.deepEqual(world, { width: 390, height: 844 });
    // Mundo x escala == viewport exatamente (sem deformacao).
    assert.equal(world.width * scale, 780);
    assert.equal(world.height * scale, 1688);
});

test("escala central: viewport maior so na largura expande o mundo na horizontal", () => {
    globalThis.innerWidth = 780;
    globalThis.innerHeight = 844;

    onredWorld.resize();

    // Altura limita: escala 1; a largura extra vira mundo logico.
    assert.equal(onredWorld.getScale(), 1);
    assert.deepEqual(onredWorld.getWorld(), { width: 780, height: 844 });
});

test("escala central: viewport menor que a referencia reduz a escala", () => {
    globalThis.innerWidth = 195;
    globalThis.innerHeight = 844;

    onredWorld.resize();

    assert.equal(onredWorld.getScale(), 0.5);
    assert.deepEqual(onredWorld.getWorld(), { width: 390, height: 1688 });
});

test("escala central: proporcoes diferentes usam a menor dimensao relativa", () => {
    globalThis.innerWidth = 1366;
    globalThis.innerHeight = 768;

    onredWorld.resize();

    const scale = onredWorld.getScale();
    const world = onredWorld.getWorld();

    assert.equal(scale, 768 / 844);
    assert.equal(Math.round(world.width), Math.round(1366 / scale));
    assert.equal(Math.round(world.height), 844);
});

test("escala central: conversoes de ponto e tamanho com escala != 1", () => {
    globalThis.innerWidth = 780;
    globalThis.innerHeight = 1688;

    onredWorld.resize();

    const worldPoint = onredWorld.screenToWorld({ x: 100, y: 50 });
    assert.deepEqual(worldPoint, { x: 50, y: 25 });
    const screenPoint = onredWorld.worldToScreen(worldPoint);
    assert.deepEqual(screenPoint, { x: 100, y: 50 });

    assert.equal(onredWorld.sizeToScreen(15), 30);
    assert.equal(onredWorld.sizeToWorld(30), 15);
});

test("escala central: ida e volta de coordenada nao acumula erro", () => {
    globalThis.innerWidth = 1366;
    globalThis.innerHeight = 768;

    onredWorld.resize();

    for (const point of [{ x: 0, y: 0 }, { x: 683, y: 384 }, { x: 100, y: 700 }]) {
        const back = onredWorld.worldToScreen(onredWorld.screenToWorld(point));
        assert.ok(Math.abs(back.x - point.x) < 1e-9);
        assert.ok(Math.abs(back.y - point.y) < 1e-9);
    }
});

test("escala central: resolucao fisica combina dpr x escala uma unica vez", () => {
    globalThis.devicePixelRatio = 2;
    globalThis.innerWidth = 780;
    globalThis.innerHeight = 1688;

    onredWorld.resize();

    const size = onredWorld.getCanvasSize();

    // 780 x 1688 fisicos em dpr 2: a escala central (2) ja esta no CSS,
    // o backing store e a viewport fisica, nao o mundo x escala x dpr dobrado.
    assert.equal(size.width, 1560);
    assert.equal(size.height, 3376);
    assert.equal(size.scale, 2);

    // Transform do canvas: dpr x escala aplicado uma vez pelo main.js.
    const expectedTransform = size.dpr * size.scale;
    assert.equal(expectedTransform, 4);
});

test("escala central: resize durante partida e mudanca de orientacao", () => {
    globalThis.innerWidth = 390;
    globalThis.innerHeight = 844;
    onredWorld.resize();
    assert.equal(onredWorld.getScale(), 1);

    // Rotacao: paisagem 844x390.
    globalThis.innerWidth = 844;
    globalThis.innerHeight = 390;
    onredWorld.resize();

    const scale = onredWorld.getScale();
    const world = onredWorld.getWorld();

    assert.equal(scale, 390 / 844);
    assert.equal(Math.round(world.height), 844);
    assert.equal(world.width * scale, 844);
});

test("escala central: viewport invalida nao quebra (escala 1)", () => {
    globalThis.innerWidth = 0;
    globalThis.innerHeight = 0;

    onredWorld.resize();

    assert.equal(onredWorld.getScale(), 1);
    assert.equal(onredWorld.getWorld().width, 0);
});
