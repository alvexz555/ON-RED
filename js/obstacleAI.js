
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
        const candidates = obstacles.filter(obstacle =>
            obstacle && obstacle.state !== "ELIMINATED" &&
            obstacle.state !== "RESPAWNING"
        );

        if (!candidates.length) {
            this.attacker = null;
            obstacles.forEach(obstacle => { obstacle.role = "pressure"; });
            return;
        }

        let closest = candidates[0];
        let shortestDistance = Infinity;

        candidates.forEach(obstacle => {
            const dx = player.x - obstacle.x;
            const dy = player.y - obstacle.y;
            const distance = Math.hypot(dx, dy);

            if (distance < shortestDistance) {
                shortestDistance = distance;
                closest = obstacle;
            }
        });

        this.attacker = closest;
        obstacles.forEach(obstacle => {
            obstacle.role = obstacle === closest ? "attacker" : "pressure";
        });
    },

    // IDENTIFICAR O ATACANTE E OS PRESSURIZADORES

    updateRoles(obstacles) {
        // O atacante pode ter sido eliminado ou removido entre atualizações.
        // Nunca deixe a partida inteira sem um perseguidor ativo.
        if (!this.attacker || !obstacles.includes(this.attacker) ||
            this.attacker.state === "ELIMINATED" ||
            this.attacker.state === "RESPAWNING") {
            this.selectAttacker(obstacles);
            return;
        }

        obstacles.forEach(obstacle => {
            obstacle.role = obstacle === this.attacker ? "attacker" : "pressure";
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

