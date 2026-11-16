const test = require("node:test");
const assert = require("node:assert/strict");
const onredWorld = require("../js/onredWorld.js");

test("ONREDWorld exposes viewport, scale profiles and conversion api", () => {
    assert.equal(typeof onredWorld.getWorld, "function");
    assert.equal(typeof onredWorld.resize, "function");
    assert.equal(typeof onredWorld.getScale, "function");
    assert.equal(typeof onredWorld.getPlatform, "function");
    assert.equal(typeof onredWorld.setPlatform, "function");
    assert.equal(typeof onredWorld.setProfileScale, "function");
    assert.equal(typeof onredWorld.getCanvasSize, "function");
});

test("mobile profile preserves the existing 390x844 gameplay baseline", () => {
    onredWorld.setPlatform("mobile");
    globalThis.innerWidth = 390;
    globalThis.innerHeight = 844;
    onredWorld.resize();

    assert.equal(onredWorld.getScale(), 1);
    assert.deepEqual(onredWorld.getWorld(), { width: 390, height: 844 });
    assert.deepEqual(onredWorld.getCanvasSize(), {
        width: 390,
        height: 844,
        dpr: 1,
        scale: 1
    });
});

test("desktop profile scales the complete world while filling the viewport", () => {
    onredWorld.setPlatform("desktop");
    globalThis.innerWidth = 1366;
    globalThis.innerHeight = 768;
    onredWorld.resize();

    assert.equal(onredWorld.getScale(), 1.5);
    assert.deepEqual(onredWorld.getWorld(), {
        width: 1366 / 1.5,
        height: 768 / 1.5
    });
    assert.deepEqual(onredWorld.getCanvasSize(), {
        width: 1366,
        height: 768,
        dpr: 1,
        scale: 1.5
    });
});

test("world and screen coordinates and object sizes use inverse conversions", () => {
    onredWorld.setPlatform("desktop");
    globalThis.innerWidth = 1366;
    globalThis.innerHeight = 768;
    onredWorld.resize();

    const point = { x: 100, y: 80 };
    assert.deepEqual(onredWorld.worldToScreen(point), { x: 150, y: 120 });
    assert.deepEqual(onredWorld.screenToWorld({ x: 150, y: 120 }), point);
    assert.equal(onredWorld.sizeToScreen(15), 22.5);
    assert.equal(onredWorld.sizeToWorld(22.5), 15);
});

test("landscape mobile remains at scale 1", () => {
    onredWorld.setPlatform("mobile");
    globalThis.innerWidth = 844;
    globalThis.innerHeight = 390;
    onredWorld.resize();

    assert.equal(onredWorld.getScale(), 1);
    assert.deepEqual(onredWorld.getWorld(), { width: 844, height: 390 });
});

test("DPR changes backing resolution without changing logical scale", () => {
    onredWorld.setPlatform("mobile");
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

test("fractional DPR and desktop scale compose without changing CSS viewport", () => {
    onredWorld.setPlatform("desktop");
    globalThis.devicePixelRatio = 1.5;
    globalThis.innerWidth = 1366;
    globalThis.innerHeight = 768;
    onredWorld.resize();

    const size = onredWorld.getCanvasSize();
    assert.equal(size.width, 2049);
    assert.equal(size.height, 1152);
    assert.equal(size.scale, 1.5);
});

test("scale profiles can be adjusted independently for future platform tuning", () => {
    onredWorld.setProfileScale("poki", 1.25);
    onredWorld.setPlatform("poki");
    globalThis.innerWidth = 1366;
    globalThis.innerHeight = 768;
    onredWorld.resize();

    assert.equal(onredWorld.getScale(), 1.25);
    assert.deepEqual(onredWorld.getWorld(), {
        width: 1366 / 1.25,
        height: 768 / 1.25
    });

    onredWorld.setProfileScale("poki", 1.5);
    onredWorld.setPlatform("mobile");
});

test("obstacle count and spawn interval stay fixed across platform profiles", () => {
    const viewports = [
        ["mobile", 320, 568],
        ["mobile", 390, 844],
        ["desktop", 1366, 768],
        ["desktop", 1920, 1080],
        ["poki", 1366, 768]
    ];

    for (const [platform, width, height] of viewports) {
        onredWorld.setPlatform(platform);
        globalThis.innerWidth = width;
        globalThis.innerHeight = height;
        onredWorld.resize();

        const world = onredWorld.getWorld();
        const density = onredWorld.getObstacleDensity(world.width, world.height);
        assert.equal(density.maxObstacles, 5);
        assert.equal(density.spawnInterval, 1.8);
    }
});

test("invalid viewport dimensions keep the selected platform profile", () => {
    onredWorld.setPlatform("desktop");
    globalThis.innerWidth = 0;
    globalThis.innerHeight = 0;
    onredWorld.resize();

    assert.equal(onredWorld.getScale(), 1.5);
    assert.deepEqual(onredWorld.getWorld(), { width: 0, height: 0 });
    onredWorld.setPlatform("mobile");
});
