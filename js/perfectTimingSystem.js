/*
 * ON RED
 * PERFECT TIMING SYSTEM
 * Lifecycle for the five pressure obstacles.
 *
 * ACTIVE -> ELIMINATED -> RESPAWNING -> ACTIVE
 */
(function (root) {
    "use strict";

    const CONFIG = {
        maxObstacles: 5,
        respawnDelay: 12,
        playerSafeMargin: 80,
        obstacleGap: 20,
        spawnAttempts: 100,
        retryInterval: 0.25
    };

    let nextObstacleId = 1;
    let eliminated = new Map();
    let collectiveTimer = null;
    let collectiveRetryTimer = 0;

    function registerObstacle(obstacle) {
        if (!obstacle || typeof obstacle !== "object") {
            throw new TypeError("Obstacle must be an object.");
        }

        if (!Number.isInteger(obstacle.id)) {
            obstacle.id = nextObstacleId++;
        }

        obstacle.state = "ACTIVE";
        return obstacle;
    }

    function findImpactTarget(player, obstacles, obstacleSize) {
        if (!player || !Array.isArray(obstacles) || !Number.isFinite(obstacleSize)) return null;
        const half = obstacleSize / 2;
        let selected = null, bestApproach = -Infinity, bestPenetration = -Infinity;

        for (const obstacle of obstacles) {
            if (!obstacle || obstacle.state !== "ACTIVE") continue;
            const closestX = Math.max(obstacle.x - half, Math.min(player.x, obstacle.x + half));
            const closestY = Math.max(obstacle.y - half, Math.min(player.y, obstacle.y + half));
            const ox = player.x - closestX, oy = player.y - closestY;
            const distanceSquared = ox * ox + oy * oy;
            if (distanceSquared > player.radius * player.radius) continue;

            const distance = Math.sqrt(distanceSquared);
            const cx = player.x - obstacle.x, cy = player.y - obstacle.y;
            const centerDistance = Math.hypot(cx, cy) || 1;
            const approach = ((Number(obstacle.vx) || 0) * cx +
                (Number(obstacle.vy) || 0) * cy) / centerDistance;
            const penetration = player.radius - distance;

            if (approach > bestApproach ||
                (Math.abs(approach - bestApproach) < 0.000001 &&
                 penetration > bestPenetration)) {
                selected = obstacle;
                bestApproach = approach;
                bestPenetration = penetration;
            }
        }
        return selected;
    }

    function eliminate(obstacle, activeObstacles) {
        if (!obstacle || !Array.isArray(activeObstacles)) {
            return { applied: false, reason: "invalid_input" };
        }

        const index = activeObstacles.indexOf(obstacle);
        if (index < 0 || obstacle.state !== "ACTIVE") {
            return { applied: false, reason: "not_active" };
        }

        activeObstacles.splice(index, 1);
        obstacle.state = "ELIMINATED";
        eliminated.set(obstacle.id, {
            obstacle,
            remaining: CONFIG.respawnDelay
        });

        const collectiveTriggered =
            activeObstacles.length === 0 &&
            eliminated.size === CONFIG.maxObstacles;

        if (collectiveTriggered) {
            collectiveTimer = CONFIG.respawnDelay;
            collectiveRetryTimer = 0;

            eliminated.forEach(record => {
                record.remaining = null;
                record.obstacle.state = "ELIMINATED";
            });
        }

        return {
            applied: true,
            obstacle,
            eliminatedCount: eliminated.size,
            collectiveTriggered
        };
    }

    function isSafePosition(x, y, arena, player, obstacleSize, obstacles, reserved) {
        const half = obstacleSize / 2;
        const min = half + 4;

        if (
            x < min || y < min ||
            x > arena.width - min ||
            y > arena.height - min
        ) {
            return false;
        }

        if (player) {
            const minimumPlayerDistance =
                (player.radius || 0) + half + CONFIG.playerSafeMargin;
            if (
                Math.hypot(x - player.x, y - player.y) <
                minimumPlayerDistance
            ) {
                return false;
            }
        }

        const minimumObstacleDistance = obstacleSize + CONFIG.obstacleGap;
        const allObstacles = obstacles.concat(reserved);

        for (const other of allObstacles) {
            if (
                Math.abs(x - other.x) < minimumObstacleDistance &&
                Math.abs(y - other.y) < minimumObstacleDistance
            ) {
                return false;
            }
        }

        return true;
    }

    function findSafePositions(count, arena, player, obstacleSize, activeObstacles) {
        if (
            !arena ||
            !Number.isFinite(arena.width) ||
            !Number.isFinite(arena.height) ||
            arena.width < obstacleSize + 8 ||
            arena.height < obstacleSize + 8
        ) {
            return null;
        }

        const positions = [];
        const obstacles = activeObstacles.slice();

        for (let i = 0; i < count; i++) {
            let candidate = null;

            for (let attempt = 0; attempt < CONFIG.spawnAttempts; attempt++) {
                const x = obstacleSize / 2 + 4 +
                    Math.random() * Math.max(0, arena.width - obstacleSize - 8);
                const y = obstacleSize / 2 + 4 +
                    Math.random() * Math.max(0, arena.height - obstacleSize - 8);

                if (
                    isSafePosition(
                        x, y, arena, player, obstacleSize, obstacles, positions
                    )
                ) {
                    candidate = { x, y };
                    break;
                }
            }

            if (!candidate) return null;
            positions.push(candidate);
        }

        return positions;
    }

    function restoreObstacle(record, position) {
        const obstacle = record.obstacle;
        obstacle.x = position.x;
        obstacle.y = position.y;
        obstacle.vx = 0;
        obstacle.vy = 0;
        obstacle.role = "pressure";
        obstacle.state = "ACTIVE";
        return obstacle;
    }

    function update(deltaTime, arena, player, obstacleSize, activeObstacles) {
        const respawned = [];

        if (
            !Number.isFinite(deltaTime) ||
            deltaTime < 0 ||
            !Array.isArray(activeObstacles)
        ) {
            return respawned;
        }

        if (collectiveTimer !== null) {
            collectiveTimer = Math.max(0, collectiveTimer - deltaTime);

            if (collectiveTimer <= 0) {
                collectiveRetryTimer -= deltaTime;

                if (collectiveRetryTimer <= 0) {
                    const records = Array.from(eliminated.values());
                    records.forEach(record => {
                        record.obstacle.state = "RESPAWNING";
                    });
                    const positions = findSafePositions(
                        records.length,
                        arena,
                        player,
                        obstacleSize,
                        activeObstacles
                    );

                    if (positions && activeObstacles.length + records.length <= CONFIG.maxObstacles) {
                        records.forEach((record, index) => {
                            respawned.push(restoreObstacle(record, positions[index]));
                        });

                        eliminated.clear();
                        collectiveTimer = null;
                        collectiveRetryTimer = 0;
                        activeObstacles.push(...respawned);
                    } else {
                        collectiveRetryTimer = CONFIG.retryInterval;
                    }
                }
            }

            return respawned;
        }

        for (const [id, record] of eliminated) {
            record.remaining = Math.max(0, record.remaining - deltaTime);

            if (record.remaining > 0) continue;

            record.obstacle.state = "RESPAWNING";
            const positions = findSafePositions(
                1,
                arena,
                player,
                obstacleSize,
                activeObstacles
            );

            if (!positions || activeObstacles.length >= CONFIG.maxObstacles) {
                record.remaining = CONFIG.retryInterval;
                continue;
            }

            const obstacle = restoreObstacle(record, positions[0]);
            activeObstacles.push(obstacle);
            respawned.push(obstacle);
            eliminated.delete(id);
        }

        return respawned;
    }

    function getState() {
        const individual = Array.from(eliminated.values())
            .filter(record => record.remaining !== null)
            .map(record => ({
                id: record.obstacle.id,
                state: record.obstacle.state,
                remaining: record.remaining
            }));

        return {
            maxObstacles: CONFIG.maxObstacles,
            eliminatedCount: eliminated.size,
            individual,
            collectiveActive: collectiveTimer !== null,
            collectiveRemaining: collectiveTimer,
            nextObstacleId
        };
    }

    function reset() {
        nextObstacleId = 1;
        eliminated = new Map();
        collectiveTimer = null;
        collectiveRetryTimer = 0;
    }

    const api = {
        registerObstacle,
        findImpactTarget,
        eliminate,
        update,
        getState,
        reset,
        getConfig: () => ({ ...CONFIG })
    };

    if (typeof module !== "undefined" && module.exports) {
        module.exports = api;
    }
    if (root) {
        root.ONREDPerfectTimingSystem = api;
    }
})(typeof window !== "undefined" ? window : globalThis);
