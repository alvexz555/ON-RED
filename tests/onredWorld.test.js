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

// ==========================================
// ETAPA 3 — ESCALA CENTRAL
// ==========================================

function approx(actual, expected, tolerance = 1e-6) {
    assert.ok(
        Math.abs(actual - expected) <= tolerance,
        `${actual} != ${expected}`
    );
}

function setViewport(width, height, dpr = 1) {
    globalThis.innerWidth = width;
    globalThis.innerHeight = height;
    globalThis.devicePixelRatio = dpr;
    return onredWorld.resize();
}

test("Etapa 3: the approved mobile reference stays at scale 1", () => {
    const world = setViewport(390, 844, 2);

    assert.equal(onredWorld.getScale(), 1);
    assert.deepEqual(world, { width: 390, height: 844 });
    assert.deepEqual(onredWorld.getScaleReference(), { width: 390, height: 844 });

    const size = onredWorld.getCanvasSize();
    assert.equal(size.pixelRatio, 2);
    assert.equal(size.width, 780);
    assert.equal(size.height, 1688);
});

test("Etapa 3: a larger viewport scales up uniformly and keeps the logical height", () => {
    const world = setViewport(1920, 1080, 1);

    approx(onredWorld.getScale(), 1080 / 844);
    approx(world.height, 844);
    approx(world.width, 1920 / (1080 / 844));

    const css = onredWorld.getCssSize();
    assert.deepEqual(css, { width: 1920, height: 1080 });
});

test("Etapa 3: a smaller viewport scales down without deforming", () => {
    const world = setViewport(320, 640, 3);

    const expectedScale = Math.min(320 / 390, 640 / 844);
    approx(onredWorld.getScale(), expectedScale);
    approx(world.width, 320 / expectedScale);
    approx(world.height, 844);
});

test("Etapa 3: landscape keeps the scale uniform and widens the logical world", () => {
    const world = setViewport(844, 390, 1);

    approx(onredWorld.getScale(), 390 / 844);
    approx(world.height, 844);
    approx(world.width, 844 / (390 / 844));
});

test("Etapa 3: 1366x768 desktop keeps consistent proportions", () => {
    const world = setViewport(1366, 768, 1);

    approx(onredWorld.getScale(), 768 / 844);
    approx(world.height, 844);
    approx(world.width, 1366 / (768 / 844));
});

test("Etapa 3: world and screen conversions round-trip at any scale", () => {
    setViewport(1920, 1080, 1);

    const point = { x: 123.5, y: 456.25 };
    const screen = onredWorld.worldToScreen(point);
    const back = onredWorld.screenToWorld(screen);

    approx(back.x, point.x);
    approx(back.y, point.y);

    approx(onredWorld.sizeToScreen(30), 30 * onredWorld.getScale());
    approx(onredWorld.sizeToWorld(onredWorld.sizeToScreen(30)), 30);
});

test("Etapa 3: screenToWorld subtracts the canvas rect before scaling", () => {
    setViewport(1920, 1080, 1);
    const scale = onredWorld.getScale();

    const world = onredWorld.screenToWorld(
        { x: 100, y: 50 },
        { left: 10, top: 20 }
    );

    approx(world.x, 90 / scale);
    approx(world.y, 30 / scale);
});

test("Etapa 3: dpr and scale are combined exactly once", () => {
    setViewport(1920, 1080, 2);

    const size = onredWorld.getCanvasSize();
    approx(size.pixelRatio, 2 * onredWorld.getScale());
    assert.equal(onredWorld.getPixelRatio(), size.pixelRatio);
    assert.equal(size.width, 3840);
    assert.equal(size.height, 2160);
});

test("Etapa 3: resize during a run recomputes scale and world", () => {
    setViewport(390, 844, 1);
    assert.equal(onredWorld.getScale(), 1);

    setViewport(844, 390, 1);
    approx(onredWorld.getScale(), 390 / 844);
    approx(onredWorld.getWorld().height, 844);

    setViewport(390, 844, 1);
    assert.equal(onredWorld.getScale(), 1);
    assert.deepEqual(onredWorld.getWorld(), { width: 390, height: 844 });
});

test("Etapa 3: zero-sized viewports fall back to scale 1 without NaN", () => {
    setViewport(0, 0, 1);
    assert.equal(onredWorld.computeScale(0, 0), 1);
    assert.equal(onredWorld.computeScale(-5, 100), 1);
});
