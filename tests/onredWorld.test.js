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
