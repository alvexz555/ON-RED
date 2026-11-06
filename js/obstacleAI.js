
/*
 * ON RED
 * OBSTACLE AI
 * Version: 1.0
 *
 * Gerenciamento de comportamento dos obstáculos.
 */

const ObstacleAI = {

    attacker: null,

    // INICIALIZAR A INTELIGÊNCIA

    initialize(obstacles) {
        this.attacker = null;
        this.selectAttacker(obstacles);
    },

    // ESCOLHER O ATACANTE

    selectAttacker(obstacles) {

        if (!obstacles.length) {
            this.attacker = null;
            return;
        }

        let closest = obstacles[0];
        let shortestDistance = Infinity;

        obstacles.forEach(obstacle => {

            const dx = player.x - obstacle.x;
            const dy = player.y - obstacle.y;

            const distance = Math.hypot(dx, dy);

            if (distance < shortestDistance) {
                shortestDistance = distance;
                closest = obstacle;
            }
        });

        this.attacker = closest;
        closest.role = "attacker";
    },

    // IDENTIFICAR OS PRESSURIZADORES

    updateRoles(obstacles) {

        obstacles.forEach(obstacle => {
            obstacle.role =
                obstacle === this.attacker
                    ? "attacker"
                    : "pressure";
        });
    },
    
    // CALCULAR MOVIMENTO DE CADA OBSTÁCULO

    getDesiredVelocity(obstacle, index, player, speed) {

        const dx = player.x - obstacle.x;
        const dy = player.y - obstacle.y;

        const distance = Math.hypot(dx, dy);

        if (distance === 0) {
            return { x: 0, y: 0 };
        }

        const nx = dx / distance;
        const ny = dy / distance;

        // ATACANTE: PERSEGUIÇÃO DIRETA

        if (obstacle.role === "attacker") {
           const aggression = 1.4;

           return {
             x: nx * speed * aggression,
             y: ny * speed * aggression
           };
        }

        // PRESSURIZADORES: APROXIMAÇÃO E REPOSICIONAMENTO

        const pressureRadius = 130;
        const orbitSpeed = 35;

        const radialError = distance - pressureRadius;

        const radialSpeed = Math.max(
            -speed * 0.55,
            Math.min(speed * 0.55, radialError * 1.2)
        );

        const direction = obstacle.orbitDirection ??
            (index % 2 === 0 ? 1 : -1);

        const tangentX = -ny * direction;
        const tangentY = nx * direction;

        return {
            x: nx * radialSpeed + tangentX * orbitSpeed,
            y: ny * radialSpeed + tangentY * orbitSpeed
        };
}
};

