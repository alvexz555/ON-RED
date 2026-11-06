
/*
 * ON RED
 * OBSTACLE PHYSICS
 * Version: 1.4
 *
 * Sistema de repulsão radial por velocidade.
 * Objetivo:
 * - Evitar aglomeração.
 * - Criar movimento independente.
 * - Preservar a perseguição individual.
 */

const ObstaclePhysics = {

    // REPULSÃO RADIAL ENTRE OBSTÁCULOS

    calculateRepulsion(obstacles, size) {

        const influenceRadius = 70;
        const repulsionStrength = 260;

        const forces = obstacles.map(() => ({
            x: 0,
            y: 0
        }));

        for (let i = 0; i < obstacles.length; i++) {

            for (let j = i + 1; j < obstacles.length; j++) {

                const a = obstacles[i];
                const b = obstacles[j];

                const dx = a.x - b.x;
                const dy = a.y - b.y;

                const distance = Math.hypot(dx, dy);

                if (distance >= influenceRadius) {
                    continue;
                }

                // EVITAR DIVISÃO POR ZERO

                if (distance < 0.001) {

                    const angle = Math.random() * Math.PI * 2;

                    const directionX = Math.cos(angle);
                    const directionY = Math.sin(angle);

                    forces[i].x += directionX * repulsionStrength;
                    forces[i].y += directionY * repulsionStrength;

                    forces[j].x -= directionX * repulsionStrength;
                    forces[j].y -= directionY * repulsionStrength;

                    continue;
                }

                // DIREÇÃO DE AFASTAMENTO

                const directionX = dx / distance;
                const directionY = dy / distance;

                // INTENSIDADE GRADUAL

                const intensity =
                    (1 - distance / influenceRadius) *
                    repulsionStrength;

                const forceX = directionX * intensity;
                const forceY = directionY * intensity;

                forces[i].x += forceX;
                forces[i].y += forceY;

                forces[j].x -= forceX;
                forces[j].y -= forceY;
            }
        }

        return forces;
    },


    // SEPARAÇÃO DIRETA (MÉTODO ANTIGO)

    separate(obstacles, size, deltaTime) {

        const gap = 20;
        const minimumDistance = size + gap;
        const iterations = 2;

        const safeDelta = Math.max(
            0,
            Math.min(deltaTime, 0.05)
        );

        const strength = Math.min(
            1,
            safeDelta * 24
        );

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
