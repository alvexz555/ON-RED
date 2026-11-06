
/*
 * ON RED
 * OBSTACLE PHYSICS
 * Version: 1.3
 *
 * Sistema de repulsão por velocidade.
 * Objetivo: manter espaçamento com movimento individual.
 */

const ObstaclePhysics = {

    // CALCULAR REPULSÃO ENTRE OBSTÁCULOS

    calculateRepulsion(obstacles, size) {

        const gap = 20;
        const minimumDistance = size + gap;
        const repulsionGain = 25;
        const maxRepulsion = 300;

        const forces = obstacles.map(() => ({
            x: 0,
            y: 0
        }));

        for (let i = 0; i < obstacles.length; i++) {

            for (let j = i + 1; j < obstacles.length; j++) {

                const a = obstacles[i];
                const b = obstacles[j];

                const dx = b.x - a.x;
                const dy = b.y - a.y;

                const overlapX =
                    minimumDistance - Math.abs(dx);

                const overlapY =
                    minimumDistance - Math.abs(dy);

                if (overlapX <= 0 || overlapY <= 0) {
                    continue;
                }

                if (overlapX < overlapY) {

                    const direction = dx === 0
                        ? (i % 2 === 0 ? 1 : -1)
                        : Math.sign(dx);

                    const force = Math.min(
                        maxRepulsion,
                        overlapX * repulsionGain
                    );

                    forces[i].x -= direction * force;
                    forces[j].x += direction * force;

                } else {

                    const direction = dy === 0
                        ? (i % 2 === 0 ? 1 : -1)
                        : Math.sign(dy);

                    const force = Math.min(
                        maxRepulsion,
                        overlapY * repulsionGain
                    );

                    forces[i].y -= direction * force;
                    forces[j].y += direction * force;
                }
            }
        }

        return forces;
    },

    // SISTEMA ANTIGO MANTIDO POR COMPATIBILIDADE

    separate(obstacles, size, deltaTime) {

        const gap = 20;
        const minimumDistance = size + gap;

        const iterations = 2;
        const safeDelta = Math.max(0, Math.min(deltaTime, 0.05));
        const strength = Math.min(1, safeDelta * 24);

        for (let iteration = 0; iteration < iterations; iteration++) {

            for (let i = 0; i < obstacles.length; i++) {

                for (let j = i + 1; j < obstacles.length; j++) {

                    const a = obstacles[i];
                    const b = obstacles[j];

                    const dx = b.x - a.x;
                    const dy = b.y - a.y;

                    const overlapX =
                        minimumDistance - Math.abs(dx);

                    const overlapY =
                        minimumDistance - Math.abs(dy);

                    if (overlapX <= 0 || overlapY <= 0) {
                        continue;
                    }

                    if (overlapX < overlapY) {

                        const direction = dx === 0
                            ? (i % 2 === 0 ? 1 : -1)
                            : Math.sign(dx);

                        const correction =
                            (overlapX * strength) / 2;

                        a.x -= direction * correction;
                        b.x += direction * correction;

                    } else {

                        const direction = dy === 0
                            ? (i % 2 === 0 ? 1 : -1)
                            : Math.sign(dy);

                        const correction =
                            (overlapY * strength) / 2;

                        a.y -= direction * correction;
                        b.y += direction * correction;
                    }
                }
            }
        }
    }
};
