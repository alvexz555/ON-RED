const test = require("node:test");
const assert = require("node:assert/strict");
const onredWorld = require("../js/onredWorld.js");

test("ONREDWorld exposes the viewport and canvas api", () => {
    assert.equal(typeof onredWorld.getWorld, "function");
    assert.equal(typeof onredWorld.resize, "function");
    assert.equal(typeof onredWorld.getScale, "function");
    assert.equal(typeof onredWorld.getDpr, "function");
    assert.equal(typeof onredWorld.getCanvasSize, "function");
});

test("logical world follows the viewport without scaling gameplay", () => {
    globalThis.innerWidth = 390;
    globalThis.innerHeight = 844;
    onredWorld.resize();

    assert.deepEqual(onredWorld.getWorld(), { width: 390, height: 844 });
    assert.equal(onredWorld.getScale(), 1);

    globalThis.innerWidth = 780;
    globalThis.innerHeight = 1688;
    onredWorld.resize();

    assert.deepEqual(onredWorld.getWorld(), { width: 780, height: 1688 });
    assert.equal(onredWorld.getScale(), 1);
});

test("landscape and narrow viewports keep scale 1 and use their real dimensions", () => {
    globalThis.innerWidth = 844;
    globalThis.innerHeight = 390;
    onredWorld.resize();

    assert.deepEqual(onredWorld.getWorld(), { width: 844, height: 390 });
    assert.equal(onredWorld.getScale(), 1);

    globalThis.innerWidth = 320;
    globalThis.innerHeight = 568;
    onredWorld.resize();

    assert.deepEqual(onredWorld.getWorld(), { width: 320, height: 568 });
    assert.equal(onredWorld.getScale(), 1);
});

test("world and screen coordinates remain identical", () => {
    globalThis.innerWidth = 1366;
    globalThis.innerHeight = 768;
    onredWorld.resize();

    const point = { x: 683, y: 384 };
    assert.deepEqual(onredWorld.worldToScreen(point), point);
    assert.deepEqual(onredWorld.screenToWorld(point), point);
    assert.equal(onredWorld.sizeToScreen(15), 15);
    assert.equal(onredWorld.sizeToWorld(15), 15);
});

test("DPR changes canvas backing resolution without changing logical world", () => {
    globalThis.devicePixelRatio = 2;
    globalThis.innerWidth = 390;
    globalThis.innerHeight = 844;
    onredWorld.resize();

    assert.deepEqual(onredWorld.getWorld(), { width: 390, height: 844 });
    assert.deepEqual(onredWorld.getCanvasSize(), {
        width: 780,
        height: 1688,
        dpr: 2,
        scale: 1
    });
});

test("fractional DPR rounds the physical canvas dimensions", () => {
    globalThis.devicePixelRatio = 1.5;
    globalThis.innerWidth = 390;
    globalThis.innerHeight = 844;
    onredWorld.resize();

    const size = onredWorld.getCanvasSize();
    assert.equal(size.width, 585);
    assert.equal(size.height, 1266);
    assert.equal(size.scale, 1);
});

test("obstacle count and spawn interval stay fixed across viewport areas", () => {
    const viewports = [
        [320, 568],
        [390, 844],
        [780, 844],
        [1366, 768],
        [1920, 1080]
    ];

    for (const [width, height] of viewports) {
        globalThis.innerWidth = width;
        globalThis.innerHeight = height;
        onredWorld.resize();

        const world = onredWorld.getWorld();
        const density = onredWorld.getObstacleDensity(world.width, world.height);
        assert.equal(density.maxObstacles, 5, `max obstacles at ${width}x${height}`);
        assert.equal(density.spawnInterval, 1.8, `spawn interval at ${width}x${height}`);
    }
});

test("obstacle configuration reference remains the original mobile baseline", () => {
    assert.deepEqual(onredWorld.getObstacleDensityReference(), {
        width: 390,
        height: 844,
        maxObstacles: 5,
        spawnInterval: 1.8
    });
});

test("invalid viewport dimensions do not introduce a non-unit scale", () => {
    globalThis.innerWidth = 0;
    globalThis.innerHeight = 0;
    onredWorld.resize();

    assert.equal(onredWorld.getScale(), 1);
    assert.deepEqual(onredWorld.getWorld(), { width: 0, height: 0 });
});
