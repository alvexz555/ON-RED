
/*
 * ON RED
 * OBSTACLE PHYSICS
 * Version: 1.2
 *
 * Sistema de repulsão gradual entre quadrados.
 * Objetivo: manter espaçamento sem separação brusca.
 */

const ObstaclePhysics = {

    separate(obstacles, size, deltaTime) {

        // CONFIGURAÇÃO DE ESPAÇAMENTO

        const gap = 20;
        const minimumDistance = size + gap;

        // INTENSIDADE DA REPULSÃO

        const iterations = 2;
        const safeDelta = Math.max(0, Math.min(deltaTime, 0.05));
        const strength = Math.min(1, safeDelta * 24);

        // RESOLUÇÃO GRADUAL ENTRE OS PARES

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

                    // DISTÂNCIA SUFICIENTE

                    if (overlapX <= 0 || overlapY <= 0) {
                        continue;
                    }

                    // REPULSÃO NO EIXO DE MENOR PENETRAÇÃO

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
