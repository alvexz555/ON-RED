
/*
 * ON RED
 * OBSTACLE PHYSICS
 * Version: 1.1
 *
 * Sistema AABB de separação entre quadrados.
 */

const ObstaclePhysics = {

    separate(obstacles, size, deltaTime) {

        const gap = 12;
        const minimumDistance = size + gap;
        const iterations = 4;

        // REPETIR A RESOLUÇÃO PARA ESTABILIZAR OS PARES

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

                    // NÃO EXISTE SOBREPOSIÇÃO OU PROXIMIDADE EXCESSIVA

                    if (overlapX <= 0 || overlapY <= 0) {
                        continue;
                    }

                    // ESCOLHER O EIXO DE MENOR PENETRAÇÃO

                    if (overlapX < overlapY) {

                        const direction = dx === 0
                            ? (i % 2 === 0 ? 1 : -1)
                            : Math.sign(dx);

                        const correction = overlapX / 2;

                        a.x -= direction * correction;
                        b.x += direction * correction;

                    } else {

                        const direction = dy === 0
                            ? (i % 2 === 0 ? 1 : -1)
                            : Math.sign(dy);

                        const correction = overlapY / 2;

                        a.y -= direction * correction;
                        b.y += direction * correction;
                    }
                }
            }
        }
    }
};
