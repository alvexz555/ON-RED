/*
 * ON RED
 * OBSTACLE PHYSICS
 * Version: 1.0
 *
 * Responsabilidade:
 * Detectar e resolver sobreposição
 * entre obstáculos quadrados.
 */

const ObstaclePhysics = {

    // DISTÂNCIA ENTRE OS QUADRADOS

    separate(obstacles, size, deltaTime) {

        const minimumDistance = size;
        const separationStrength = 0.5;

        for (let i = 0; i < obstacles.length; i++) {

            for (let j = i + 1; j < obstacles.length; j++) {

                const a = obstacles[i];
                const b = obstacles[j];

                const dx = b.x - a.x;
                const dy = b.y - a.y;

                const distance = Math.hypot(dx, dy);

                if (distance >= minimumDistance) {
                    continue;
                }

                let normalX;
                let normalY;

                // EVITAR DIVISÃO POR ZERO

                if (distance === 0) {
                    normalX = 1;
                    normalY = 0;
                } else {
                    normalX = dx / distance;
                    normalY = dy / distance;
                }

                // CALCULAR SOBREPOSIÇÃO

                const overlap = minimumDistance - distance;

                const correction =
                    overlap * separationStrength;

                // SEPARAR OS QUADRADOS

                const movementX = normalX * correction;
                const movementY = normalY * correction;

                a.x -= movementX;
                a.y -= movementY;

                b.x += movementX;
                b.y += movementY;
            }
        }
    }
};
