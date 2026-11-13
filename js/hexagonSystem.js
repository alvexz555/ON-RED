/*
 * ON RED
 * HEXAGON OCCUPANCY SYSTEM
 * Static arena obstacles with player, pursuer and Ping Pong collisions.
 */
(function (root) {
    "use strict";

    const CONFIG = {
        radius: 42,
        maxHexagons: 3,
        spawnInterval: 14,
        spawnAttempts: 60,
        playerSafeMargin: 90,
        obstacleGap: 8,
        initialHealth: 3,
        pingPongDamage: 1,
        fillColor: "#087BEB",
        strokeColor: "#65B8FF"
    };

    const hexagons = [];
    let spawnTimer = 0;
    let nextId = 1;

    function clamp(value, min, max) {
        return Math.max(min, Math.min(max, value));
    }

    function vertices(hex) {
        const points = [];
        for (let i = 0; i < 6; i++) {
            const angle = -Math.PI / 6 + i * Math.PI / 3;
            points.push({
                x: hex.x + Math.cos(angle) * hex.radius,
                y: hex.y + Math.sin(angle) * hex.radius
            });
        }
        return points;
    }

    function pointInPolygon(point, polygon) {
        let inside = false;
        for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
            const a = polygon[i], b = polygon[j];
            const crosses = ((a.y > point.y) !== (b.y > point.y)) &&
                (point.x < (b.x - a.x) * (point.y - a.y) / ((b.y - a.y) || 1e-9) + a.x);
            if (crosses) inside = !inside;
        }
        return inside;
    }

    function closestPointOnSegment(point, a, b) {
        const dx = b.x - a.x, dy = b.y - a.y;
        const lengthSquared = dx * dx + dy * dy;
        const t = lengthSquared > 0
            ? clamp(((point.x - a.x) * dx + (point.y - a.y) * dy) / lengthSquared, 0, 1)
            : 0;
        return { x: a.x + dx * t, y: a.y + dy * t };
    }

    function circlePolygonContact(circle, polygon) {
        let closest = null;
        let minDistanceSquared = Infinity;
        for (let i = 0; i < polygon.length; i++) {
            const candidate = closestPointOnSegment(
                circle, polygon[i], polygon[(i + 1) % polygon.length]
            );
            const dx = circle.x - candidate.x, dy = circle.y - candidate.y;
            const distanceSquared = dx * dx + dy * dy;
            if (distanceSquared < minDistanceSquared) {
                minDistanceSquared = distanceSquared;
                closest = candidate;
            }
        }

        const inside = pointInPolygon(circle, polygon);
        const radius = Math.max(0, Number(circle.radius) || 0);
        if (!inside && minDistanceSquared > radius * radius) return null;

        let nx = inside ? closest.x - circle.x : circle.x - closest.x;
        let ny = inside ? closest.y - circle.y : circle.y - closest.y;
        let distance = Math.hypot(nx, ny);

        if (distance < 1e-8) {
            nx = circle.x - polygon.reduce((sum, p) => sum + p.x, 0) / polygon.length;
            ny = circle.y - polygon.reduce((sum, p) => sum + p.y, 0) / polygon.length;
            distance = Math.hypot(nx, ny) || 1;
        }

        nx /= distance;
        ny /= distance;
        return {
            nx, ny, closest,
            penetration: inside ? radius + distance : radius - distance,
            inside
        };
    }

    function polygonAxes(polygon) {
        const axes = [];
        for (let i = 0; i < polygon.length; i++) {
            const a = polygon[i], b = polygon[(i + 1) % polygon.length];
            const dx = b.x - a.x, dy = b.y - a.y;
            const length = Math.hypot(dx, dy) || 1;
            axes.push({ x: -dy / length, y: dx / length });
        }
        return axes;
    }

    function project(polygon, axis) {
        let min = Infinity, max = -Infinity;
        for (const point of polygon) {
            const value = point.x * axis.x + point.y * axis.y;
            min = Math.min(min, value);
            max = Math.max(max, value);
        }
        return { min, max };
    }

    function polygonCollision(a, b) {
        let smallestOverlap = Infinity;
        let smallestAxis = null;
        const axes = polygonAxes(a).concat(polygonAxes(b));
        for (const axis of axes) {
            const pa = project(a, axis), pb = project(b, axis);
            const overlap = Math.min(pa.max - pb.min, pb.max - pa.min);
            if (overlap <= 0) return null;
            if (overlap < smallestOverlap) {
                smallestOverlap = overlap;
                smallestAxis = axis;
            }
        }

        const centerA = a.reduce((s, p) => ({ x: s.x + p.x / a.length, y: s.y + p.y / a.length }), {x:0,y:0});
        const centerB = b.reduce((s, p) => ({ x: s.x + p.x / b.length, y: s.y + p.y / b.length }), {x:0,y:0});
        if ((centerB.x - centerA.x) * smallestAxis.x +
            (centerB.y - centerA.y) * smallestAxis.y < 0) {
            smallestAxis = { x: -smallestAxis.x, y: -smallestAxis.y };
        }
        return { overlap: smallestOverlap, nx: smallestAxis.x, ny: smallestAxis.y };
    }

    function rectangleVertices(rectangle, size) {
        const half = size / 2;
        return [
            {x: rectangle.x-half, y: rectangle.y-half},
            {x: rectangle.x+half, y: rectangle.y-half},
            {x: rectangle.x+half, y: rectangle.y+half},
            {x: rectangle.x-half, y: rectangle.y+half}
        ];
    }

    function circleRectOverlap(circle, rectangle, size) {
        const half = size / 2;
        const x = clamp(circle.x, rectangle.x-half, rectangle.x+half);
        const y = clamp(circle.y, rectangle.y-half, rectangle.y+half);
        const dx = circle.x-x, dy = circle.y-y;
        return dx*dx + dy*dy < circle.radius*circle.radius;
    }

    function isPositionClear(x, y, arena, player, obstacles, obstacleSize, pingPongState) {
        const radius = CONFIG.radius;
        if (x < radius + 4 || y < radius + 4 ||
            x > arena.width - radius - 4 || y > arena.height - radius - 4) return false;

        if (player && Math.hypot(x-player.x, y-player.y) <
            radius + (player.radius || 0) + CONFIG.playerSafeMargin) return false;

        for (const obstacle of obstacles || []) {
            if (!obstacle || obstacle.state === "ELIMINATED" || obstacle.state === "RESPAWNING") continue;
            if (circleRectOverlap({x,y,radius:radius+CONFIG.obstacleGap}, obstacle, obstacleSize)) return false;
        }

        for (const other of hexagons) {
            if (Math.hypot(x-other.x, y-other.y) <
                radius + other.radius + CONFIG.obstacleGap) return false;
        }

        const ball = pingPongState && pingPongState.ball;
        if (ball && Math.hypot(x-ball.x, y-ball.y) <
            radius + ball.radius + CONFIG.obstacleGap) return false;

        return true;
    }

    function spawn(arena, player, obstacles, obstacleSize, pingPongState) {
        if (!arena || !Number.isFinite(arena.width) || !Number.isFinite(arena.height) ||
            hexagons.length >= CONFIG.maxHexagons ||
            arena.width < CONFIG.radius * 2 + 8 || arena.height < CONFIG.radius * 2 + 8) return null;

        for (let attempt = 0; attempt < CONFIG.spawnAttempts; attempt++) {
            const x = CONFIG.radius + 4 + Math.random() * (arena.width - CONFIG.radius * 2 - 8);
            const y = CONFIG.radius + 4 + Math.random() * (arena.height - CONFIG.radius * 2 - 8);
            if (!isPositionClear(x, y, arena, player, obstacles, obstacleSize, pingPongState)) continue;

            const hex = {
                id: nextId++,
                x, y,
                radius: CONFIG.radius,
                maxHealth: CONFIG.initialHealth,
                health: CONFIG.initialHealth,
                destroyed: false
            };
            hexagons.push(hex);
            return hex;
        }
        return null;
    }

    function update(deltaTime, arena, player, obstacles, obstacleSize, pingPongState) {
        if (!Number.isFinite(deltaTime) || deltaTime < 0 || !arena) return;
        spawnTimer += deltaTime;
        if (spawnTimer >= CONFIG.spawnInterval && hexagons.length < CONFIG.maxHexagons) {
            const created = spawn(arena, player, obstacles, obstacleSize, pingPongState);
            if (created) spawnTimer = 0;
            else spawnTimer = Math.min(spawnTimer, CONFIG.spawnInterval);
        }
    }

    function damage(hex, amount) {
        if (!hex || hex.destroyed || !hexagons.includes(hex) ||
            !Number.isFinite(amount) || amount <= 0) return false;
        hex.health = Math.max(0, hex.health - amount);
        if (hex.health <= 0) {
            hex.destroyed = true;
            const index = hexagons.indexOf(hex);
            if (index >= 0) hexagons.splice(index, 1);
        }
        return true;
    }

    function resolvePlayer(player, healthSystem, collisionSystem) {
        if (!player) return false;
        let touching = false;

        for (const hex of hexagons) {
            const contact = circlePolygonContact(player, vertices(hex));
            if (!contact) continue;
            touching = true;
            player.x += contact.nx * (contact.penetration + 0.5);
            player.y += contact.ny * (contact.penetration + 0.5);

            const registered = collisionSystem ? collisionSystem.registerCollision() : true;
            if (registered && healthSystem) {
                const damageAmount = collisionSystem
                    ? collisionSystem.getState().damage
                    : 25;
                const result = healthSystem.applyDamage(damageAmount);
                if (result.gameOver && typeof root.triggerGameOver === "function") root.triggerGameOver();
            }
        }
        return touching;
    }

    function resolveObstacles(obstacles, obstacleSize) {
        if (!Array.isArray(obstacles)) return 0;
        let resolved = 0;
        for (const obstacle of obstacles) {
            if (!obstacle || obstacle.state === "ELIMINATED" || obstacle.state === "RESPAWNING") continue;
            for (const hex of hexagons) {
                const collision = polygonCollision(vertices(hex), rectangleVertices(obstacle, obstacleSize));
                if (!collision) continue;
                obstacle.x += collision.nx * (collision.overlap + 0.5);
                obstacle.y += collision.ny * (collision.overlap + 0.5);
                resolved++;
            }
        }
        return resolved;
    }

    function resolvePingPongCollision(ball) {
        if (!ball) return false;
        let collided = false;
        for (const hex of hexagons) {
            const contact = circlePolygonContact(ball, vertices(hex));
            if (!contact) continue;

            ball.x += contact.nx * (contact.penetration + 0.5);
            ball.y += contact.ny * (contact.penetration + 0.5);

            const velocityAlongNormal = ball.vx * contact.nx + ball.vy * contact.ny;
            if (velocityAlongNormal < 0) {
                ball.vx -= 2 * velocityAlongNormal * contact.nx;
                ball.vy -= 2 * velocityAlongNormal * contact.ny;
            }

            damage(hex, CONFIG.pingPongDamage);
            collided = true;
            break;
        }
        return collided;
    }

    function isCirclePositionClear(circle) {
        if (!circle) return true;
        return !hexagons.some(hex =>
            circlePolygonContact(circle, vertices(hex)) !== null
        );
    }

    function constrainToArena(arena) {
        if (!arena) return;
        for (const hex of hexagons) {
            hex.x = clamp(hex.x, hex.radius + 4, Math.max(hex.radius + 4, arena.width - hex.radius - 4));
            hex.y = clamp(hex.y, hex.radius + 4, Math.max(hex.radius + 4, arena.height - hex.radius - 4));
        }
    }

    function draw(ctx) {
        if (!ctx) return;
        for (const hex of hexagons) {
            const points = vertices(hex);
            ctx.save();
            ctx.beginPath();
            points.forEach((point, index) => {
                if (index === 0) ctx.moveTo(point.x, point.y);
                else ctx.lineTo(point.x, point.y);
            });
            ctx.closePath();
            ctx.fillStyle = CONFIG.fillColor;
            ctx.shadowColor = CONFIG.fillColor;
            ctx.shadowBlur = 16;
            ctx.fill();
            ctx.shadowBlur = 0;
            ctx.strokeStyle = CONFIG.strokeColor;
            ctx.lineWidth = 2;
            ctx.stroke();

            const barWidth = hex.radius * 1.25;
            const barY = hex.y - hex.radius - 10;
            ctx.fillStyle = "rgba(0,0,0,0.65)";
            ctx.fillRect(hex.x - barWidth/2, barY, barWidth, 4);
            ctx.fillStyle = "#FFFFFF";
            ctx.fillRect(hex.x - barWidth/2, barY, barWidth * (hex.health / hex.maxHealth), 4);
            ctx.restore();
        }
    }

    function reset() {
        hexagons.length = 0;
        spawnTimer = 0;
        nextId = 1;
    }

    function configure(options) {
        if (!options || typeof options !== "object") return getConfig();
        for (const key of ["radius","maxHexagons","spawnInterval","spawnAttempts",
            "playerSafeMargin","obstacleGap","initialHealth","pingPongDamage"]) {
            if (Object.prototype.hasOwnProperty.call(options,key) &&
                Number.isFinite(options[key]) && options[key] > 0) CONFIG[key] = options[key];
        }
        return getConfig();
    }

    function getConfig() { return { ...CONFIG }; }
    function getState() {
        return {
            count: hexagons.length,
            spawnTimer,
            hexagons: hexagons.map(hex => ({...hex}))
        };
    }
    function getHexagons() { return hexagons.slice(); }

    const api = {
        update, spawn, draw, reset, configure, getConfig, getState, getHexagons,
        vertices, circlePolygonContact, polygonCollision, rectangleVertices,
        resolvePlayer, resolveObstacles, resolvePingPongCollision,
        isCirclePositionClear, constrainToArena, damage
    };

    if (typeof module !== "undefined" && module.exports) module.exports = api;
    if (root) root.ONREDHexagonSystem = api;
})(typeof window !== "undefined" ? window : globalThis);
