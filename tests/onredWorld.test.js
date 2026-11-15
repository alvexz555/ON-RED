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
