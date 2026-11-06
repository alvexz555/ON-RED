
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
    }
};

