
/*
 * ON RED
 * MAIN GAME
 * Version: 1.3
 *
 * Canvas 2D
 * Joystick virtual
 * Perfect Timing
 * Obstáculos com perseguição e separação
 * Limites físicos da arena
 * Sistema de colisão e dano
 * Feedback visual de impacto
 * Score por sobrevivência + best score
 * Game Over
 * Restart / Main Menu
 */

// ==========================================
// CONFIGURAÇÃO INICIAL
// ==========================================

const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

// ==========================================
// ELEMENTOS DA INTERFACE
// ==========================================

const mainMenu = document.getElementById("mainMenu");
const settingsPanel = document.getElementById("settingsPanel");

const gameOverScreen = document.getElementById("gameOverScreen");
const retryButton = document.getElementById("retryButton");
const gameOverMenuButton = document.getElementById("gameOverMenuButton");
const finalScoreLabel = document.getElementById("finalScore");
const bestScoreGameOverLabel = document.getElementById("bestScoreGameOver");
const menuBestScoreLabel = document.getElementById("bestScore");

// ==========================================
// SCORE
// ==========================================

const scoreState = {
    value: 0,
    pointsPerSecond: 100,
    storageKey: "onRedBestScore",
    best: 0
};

function loadBestScore() {

    try {
        scoreState.best =
            Number(localStorage.getItem(scoreState.storageKey) || 0) || 0;
    } catch (error) {
        scoreState.best = 0;
    }

    return scoreState.best;
}

function saveBestScore(finalScore) {

    if (finalScore <= scoreState.best) {
        return false;
    }

    scoreState.best = finalScore;

    try {
        localStorage.setItem(
            scoreState.storageKey,
            String(finalScore)
        );
    } catch (error) {
        return false;
    }

    return true;
}

function formatScore(value) {
    return String(Math.floor(value)).padStart(6, "0");
}

function refreshBestScoreDisplays() {

    if (bestScoreGameOverLabel) {
        bestScoreGameOverLabel.textContent =
            formatScore(scoreState.best);
    }

    if (menuBestScoreLabel) {
        menuBestScoreLabel.textContent =
            formatScore(scoreState.best);
    }
}

// ==========================================
// ESTADOS DO JOGO
// ==========================================

const GAME_STATE = {
    MENU: "MENU",
    PLAYING: "PLAYING",
    GAME_OVER: "GAME_OVER"
};

let gameState = GAME_STATE.MENU;
let gameStarted = false;
let loopRunning = false;

// ==========================================
// JOGADOR
// ==========================================

const player = {
    x: 0,
    y: 0,
    radius: 15,
    speed: 3.5
};

// ==========================================
// JOYSTICK
// ==========================================

const joystick = {
    baseX: 85,
    baseY: 0,
    knobX: 85,
    knobY: 0,
    radius: 55,
    knobRadius: 22,
    x: 0,
    y: 0,
    active: false,
    pointerId: null
};

// ==========================================
// BOTÃO PERFECT TIMING
// ==========================================

const perfectButton = {
    size: 64,
    margin: 28,
    charge: 1,
    cooldown: 5,
    activationFlash: 0,
    x: 0,
    y: 0
};

const perfectWave = { duration: 0.4, timer: 0 };
const perfectTimingConfig = {
    scorePerElimination: 500, requestWindow: 0.25, positiveChance: 0.7,
    effectDuration: 5, playerSpeedBoost: 1.35, playerSpeedPenalty: 0.75,
    obstacleSlowdown: 0.75, obstacleSpeedBoost: 1.25,
    scoreMultiplier: 2, healAmount: 25
};
const perfectTimingRuntime = {
    requestTimer: 0, effect: null, effectTimer: 0, feedback: "", feedbackTimer: 0
};

function updatePerfectButtonPosition() {

    perfectButton.x =
        canvas.width - perfectButton.margin - perfectButton.size;

    perfectButton.y =
        canvas.height - perfectButton.margin - perfectButton.size;
}

function activatePerfectTiming() {
    if (gameState !== GAME_STATE.PLAYING || perfectButton.charge < 1) return false;
    perfectTimingRuntime.requestTimer = perfectTimingConfig.requestWindow;
    perfectTimingRuntime.feedback = "PERFECT TIMING ARMED";
    perfectTimingRuntime.feedbackTimer = 0.45;
    return true;
}

function applyPerfectTimingEffect() {
    const health = window.ONREDHealthSystem;
    const positive = Math.random() < perfectTimingConfig.positiveChance;
    const choices = positive
        ? ["speed_up", "score_up", "heal", "obstacle_slow"]
        : ["speed_down", "obstacle_fast", "low_visibility"];
    const type = choices[Math.floor(Math.random() * choices.length)];
    perfectTimingRuntime.effect = type;
    perfectTimingRuntime.effectTimer = perfectTimingConfig.effectDuration;

    const labels = {
        speed_up: "SPEED BOOST", score_up: "SCORE x2", heal: "HP RESTORED",
        obstacle_slow: "OBSTACLES SLOWED", speed_down: "SPEED REDUCED",
        obstacle_fast: "OBSTACLES FASTER", low_visibility: "LOW VISIBILITY"
    };
    if (type === "heal" && health) health.heal(perfectTimingConfig.healAmount);
    perfectTimingRuntime.feedback = labels[type];
    perfectTimingRuntime.feedbackTimer = 1.5;
}

function completePerfectTiming(obstacle) {
    const system = window.ONREDPerfectTimingSystem;
    const health = window.ONREDHealthSystem;
    if (!system || !health || !obstacle || perfectButton.charge < 1) return false;

    const result = system.eliminate(obstacle, perfectObstacles);
    if (!result.applied) return false;

    perfectButton.charge = 0;
    perfectButton.activationFlash = 0.25;
    perfectTimingRuntime.requestTimer = 0;
    scoreState.value += perfectTimingConfig.scorePerElimination;
    ObstacleAI.updateRoles(perfectObstacles);
    ObstacleAI.selectAttacker(perfectObstacles);

    if (result.collectiveTriggered) {
        const state = health.getState();
        health.heal(state.maxHP - state.hp);
        if (Math.random() < 0.2) health.addExtraLife();
        perfectTimingRuntime.effect = null;
        perfectTimingRuntime.effectTimer = 0;
        perfectTimingRuntime.feedback = "5/5 ELIMINATED · HP RESTORED";
        perfectTimingRuntime.feedbackTimer = 2.5;
    } else {
        applyPerfectTimingEffect();
        perfectTimingRuntime.feedback = "OBSTACLE ELIMINATED · +" + perfectTimingConfig.scorePerElimination;
        perfectTimingRuntime.feedbackTimer = 1.5;
    }
    perfectWave.timer = perfectWave.duration;
    return true;
}

function findCollidingPerfectObstacle() {
    const collision = window.ONREDCollisionSystem;
    if (!collision || collision.getState().isInvulnerable) return null;
    for (const obstacle of perfectObstacles) {
        if (obstacle.state === "ACTIVE" &&
            collision.checkCollisions(player, [obstacle], obstacleConfig.size)) return obstacle;
    }
    return null;
}

// ==========================================
// SPAWN INICIAL DO JOGADOR
// ==========================================

function spawnPlayer() {

    player.x = canvas.width / 2;
    player.y = canvas.height / 2;
}

// ==========================================
// LIMITES DA ARENA
// ==========================================

function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

function constrainPlayerToArena() {

    const minX = player.radius;
    const maxX = canvas.width - player.radius;

    const minY = player.radius;
    const maxY = canvas.height - player.radius;

    player.x = clamp(player.x, minX, maxX);
    player.y = clamp(player.y, minY, maxY);
}

function constrainObstaclesToArena() {

    const half = obstacleConfig.size / 2;

    const minX = Math.min(half, canvas.width / 2);
    const maxX = Math.max(canvas.width - half, canvas.width / 2);

    const minY = Math.min(half, canvas.height / 2);
    const maxY = Math.max(canvas.height - half, canvas.height / 2);

    perfectObstacles.forEach(obstacle => {

        obstacle.x = clamp(obstacle.x, minX, maxX);
        obstacle.y = clamp(obstacle.y, minY, maxY);

    });
}

// ==========================================
// CONTROLES DE TOQUE
// ==========================================

function pointerDown(event) {

    if (gameState !== GAME_STATE.PLAYING) return;

    event.preventDefault();

    if (
        event.pointerType !== "touch" &&
        event.pointerType !== "mouse" &&
        event.pointerType !== "pen"
    ) {
        return;
    }

    const pos = getPosition(event);

    const hitboxPadding = 20;

    const insideButton =
        pos.x >= perfectButton.x - hitboxPadding &&
        pos.x <= perfectButton.x + perfectButton.size + hitboxPadding &&
        pos.y >= perfectButton.y - hitboxPadding &&
        pos.y <= perfectButton.y + perfectButton.size + hitboxPadding;

    if (insideButton) {
        activatePerfectTiming();
        return;
    }

    if (joystick.active) return;

    const dx = pos.x - joystick.baseX;
    const dy = pos.y - joystick.baseY;

    if (Math.hypot(dx, dy) > 90) return;

    joystick.active = true;
    joystick.pointerId = event.pointerId;

    canvas.setPointerCapture(event.pointerId);

    updateJoystick(event);
}

function pointerMove(event) {

    if (gameState !== GAME_STATE.PLAYING) return;

    if (!joystick.active) return;
    if (event.pointerId !== joystick.pointerId) return;

    event.preventDefault();
    updateJoystick(event);
}

function pointerUp(event) {

    if (event.pointerId !== joystick.pointerId) return;

    resetJoystick();
}

// ==========================================
// ATUALIZAÇÃO DO BOTÃO
// ==========================================

function updatePerfectButton(deltaTime) {
    perfectTimingRuntime.requestTimer = Math.max(0, perfectTimingRuntime.requestTimer - deltaTime);
    perfectTimingRuntime.feedbackTimer = Math.max(0, perfectTimingRuntime.feedbackTimer - deltaTime);
    perfectTimingRuntime.effectTimer = Math.max(0, perfectTimingRuntime.effectTimer - deltaTime);
    if (perfectTimingRuntime.effectTimer <= 0) perfectTimingRuntime.effect = null;

    if (perfectButton.charge < 1) {

        perfectButton.charge +=
            deltaTime / perfectButton.cooldown;

        perfectButton.charge =
            Math.min(perfectButton.charge, 1);
    }

    if (perfectButton.activationFlash > 0) {

        perfectButton.activationFlash -= deltaTime;

        perfectButton.activationFlash =
            Math.max(0, perfectButton.activationFlash);
    }

    if (perfectWave.timer > 0) {

        perfectWave.timer -= deltaTime;

        perfectWave.timer =
            Math.max(0, perfectWave.timer);
    }
}

// ==========================================
// DIMENSÕES DA TELA
// ==========================================

function resizeCanvas() {

    document.documentElement.style.margin = "0";
    document.documentElement.style.padding = "0";
    document.documentElement.style.overflow = "hidden";

    document.body.style.margin = "0";
    document.body.style.padding = "0";
    document.body.style.overflow = "hidden";

    canvas.style.position = "fixed";
    canvas.style.left = "0";
    canvas.style.top = "0";
    canvas.style.zIndex = "0";
    canvas.style.pointerEvents = "auto";
    canvas.style.display = "block";
    canvas.style.margin = "0";
    canvas.style.padding = "0";

    const screenWidth = window.innerWidth;
    const screenHeight = window.innerHeight;

    canvas.style.width = `${screenWidth}px`;
    canvas.style.height = `${screenHeight}px`;

    canvas.width = screenWidth;
    canvas.height = screenHeight;

    joystick.baseY = canvas.height - 90;

    updatePerfectButtonPosition();

    resetJoystick();

    constrainPlayerToArena();
    constrainObstaclesToArena();
}

// ==========================================
// FUNÇÕES DO JOYSTICK
// ==========================================

function resetJoystick() {

    joystick.x = 0;
    joystick.y = 0;

    joystick.knobX = joystick.baseX;
    joystick.knobY = joystick.baseY;

    joystick.active = false;
    joystick.pointerId = null;
}

function getPosition(event) {

    const rect = canvas.getBoundingClientRect();

    return {
        x: event.clientX - rect.left,
        y: event.clientY - rect.top
    };
}

function updateJoystick(event) {

    const pos = getPosition(event);

    const dx = pos.x - joystick.baseX;
    const dy = pos.y - joystick.baseY;

    const distance = Math.hypot(dx, dy);

    const limitedDistance = Math.min(
        distance,
        joystick.radius
    );

    if (distance > 0) {

        const angle = Math.atan2(dy, dx);

        joystick.knobX =
            joystick.baseX +
            Math.cos(angle) * limitedDistance;

        joystick.knobY =
            joystick.baseY +
            Math.sin(angle) * limitedDistance;

        const strength = Math.min(
            distance / joystick.radius,
            1
        );

        joystick.x = (dx / distance) * strength;
        joystick.y = (dy / distance) * strength;

    } else {

        joystick.x = 0;
        joystick.y = 0;

        joystick.knobX = joystick.baseX;
        joystick.knobY = joystick.baseY;
    }
}

// ==========================================
// OBSTÁCULOS
// ==========================================

const perfectObstacles = [];

const obstacleConfig = {
    size: 34,
    speed: 85,
    spawnInterval: 1.8,
    maxObstacles: 5
};

let spawnTimer = 0;

// ==========================================
// CRIAÇÃO DOS OBSTÁCULOS
// ==========================================

function spawnPerfectObstacle() {

    const lifecycle = window.ONREDPerfectTimingSystem
        ? ONREDPerfectTimingSystem.getState()
        : { eliminatedCount: 0 };
    if (perfectObstacles.length + lifecycle.eliminatedCount >= obstacleConfig.maxObstacles) {
        return;
    }

    const side = Math.floor(Math.random() * 4);

    let x;
    let y;

    switch (side) {

        case 0:
            x = Math.random() * canvas.width;
            y = -40;
            break;

        case 1:
            x = canvas.width + 40;
            y = Math.random() * canvas.height;
            break;

        case 2:
            x = Math.random() * canvas.width;
            y = canvas.height + 40;
            break;

        case 3:
            x = -40;
            y = Math.random() * canvas.height;
            break;
    }

    const obstacle = window.ONREDPerfectTimingSystem
        ? ONREDPerfectTimingSystem.registerObstacle({ x, y, vx: 0, vy: 0, role: "pressure" })
        : { x, y, vx: 0, vy: 0, role: "pressure", state: "ACTIVE" };
    perfectObstacles.push(obstacle);

    ObstacleAI.updateRoles(perfectObstacles);

    if (!ObstacleAI.attacker) {
        ObstacleAI.selectAttacker(perfectObstacles);
    }
}

// ==========================================
// ATUALIZAÇÃO DOS OBSTÁCULOS
// ==========================================

function updatePerfectObstacles(deltaTime) {

    spawnTimer += deltaTime;

    if (spawnTimer >= obstacleConfig.spawnInterval) {

        spawnTimer = 0;

        spawnPerfectObstacle();
    }

    if (window.ONREDPerfectTimingSystem) {
        ONREDPerfectTimingSystem.update(deltaTime, canvas, player, obstacleConfig.size, perfectObstacles);
        ObstacleAI.updateRoles(perfectObstacles);
        if (!ObstacleAI.attacker && perfectObstacles.length) ObstacleAI.selectAttacker(perfectObstacles);
    }

    const effect = perfectTimingRuntime.effect;
    const obstacleSpeedMultiplier = effect === "obstacle_slow"
        ? perfectTimingConfig.obstacleSlowdown
        : effect === "obstacle_fast" ? perfectTimingConfig.obstacleSpeedBoost : 1;

    const repulsions = ObstaclePhysics.calculateRepulsion(
        perfectObstacles,
        obstacleConfig.size
    );

    perfectObstacles.forEach((obstacle, index) => {

        const desired = ObstacleAI.getDesiredVelocity(
            obstacle,
            index,
            player,
            obstacleConfig.speed * obstacleSpeedMultiplier
        );

        const chaseX = desired.x;
        const chaseY = desired.y;

        const repulsion = repulsions[index];

        const desiredX = chaseX + repulsion.x;
        const desiredY = chaseY + repulsion.y;

        const response = Math.min(
            1,
            deltaTime * 8
        );

        obstacle.vx +=
            (desiredX - obstacle.vx) * response;

        obstacle.vy +=
            (desiredY - obstacle.vy) * response;

        obstacle.x += obstacle.vx * deltaTime;
        obstacle.y += obstacle.vy * deltaTime;

    });

    ObstaclePhysics.separate(
        perfectObstacles,
        obstacleConfig.size,
        deltaTime
    );

    constrainObstaclesToArena();
}

// ==========================================
// GAME OVER
// ==========================================

function triggerGameOver() {

    if (gameState === GAME_STATE.GAME_OVER) return;

    gameState = GAME_STATE.GAME_OVER;

    resetJoystick();

    const finalScore = Math.floor(scoreState.value);

    const isRecord = saveBestScore(finalScore);

    if (finalScoreLabel) {
        finalScoreLabel.textContent =
            formatScore(finalScore);
    }

    refreshBestScoreDisplays();

    if (gameOverScreen) {
        gameOverScreen.classList.add("active");
        gameOverScreen.setAttribute("aria-hidden", "false");
    }
}

// ==========================================
// SISTEMA DE COLISÃO E DANO
// ==========================================

function handlePlayerCollision() {

    const collision = window.ONREDCollisionSystem;
    const health = window.ONREDHealthSystem;

    if (!collision || !health) return;

    if (gameState !== GAME_STATE.PLAYING) return;

    const healthState = health.getState();

    if (healthState.gameOver) {
        triggerGameOver();
        return;
    }

    const targetObstacle = findCollidingPerfectObstacle();
    if (!targetObstacle) return;

    if (perfectTimingRuntime.requestTimer > 0 &&
        perfectButton.charge >= 1 &&
        completePerfectTiming(targetObstacle)) return;

    const registered = collision.registerCollision();

    if (!registered) return;

    const result = health.applyDamage(
        collision.getState().damage
    );

    if (!result.applied) return;

    if (result.gameOver) {
        triggerGameOver();
    }
}

// ==========================================
// ATUALIZAÇÃO GERAL
// ==========================================

function update(deltaTime) {

    if (gameState !== GAME_STATE.PLAYING) return;

    // SHIFT: solicita Perfect Timing uma única vez por pressionamento.
    if (
        window.ONREDKeyboardController &&
        window.ONREDKeyboardController.consumePerfectTimingRequest(
            gameState === GAME_STATE.PLAYING
        )
    ) {
        activatePerfectTiming();
    }

    // ==========================================
// MOVIMENTO DO JOGADOR
// JOYSTICK + TECLADO
// ==========================================

const keyboard = window.ONREDKeyboardController
    ? window.ONREDKeyboardController.getVector(
        gameState === GAME_STATE.PLAYING
    )
    : { x: 0, y: 0 };

// Combina os dois controles.
let moveX = joystick.x + keyboard.x;
let moveY = joystick.y + keyboard.y;

// Normaliza para impedir velocidade excessiva.
const movementMagnitude = Math.hypot(moveX, moveY);

if (movementMagnitude > 1) {
    moveX /= movementMagnitude;
    moveY /= movementMagnitude;
}

// Aplica o movimento. Após um impacto do Ping Pong, a influência
// do joystick/teclado começa reduzida e retorna gradualmente em 1 segundo.
const controlMultiplier =
    window.ONREDPingPong &&
    typeof window.ONREDPingPong.getControlMultiplier === "function"
        ? window.ONREDPingPong.getControlMultiplier()
        : 1;

const effectSpeedMultiplier = perfectTimingRuntime.effect === "speed_up"
    ? perfectTimingConfig.playerSpeedBoost
    : perfectTimingRuntime.effect === "speed_down" ? perfectTimingConfig.playerSpeedPenalty : 1;
player.x += moveX * player.speed * controlMultiplier * effectSpeedMultiplier * deltaTime * 60;
player.y += moveY * player.speed * controlMultiplier * effectSpeedMultiplier * deltaTime * 60;

    // LIMITES DO JOGADOR

    constrainPlayerToArena();

    // SISTEMAS DO JOGO

    updatePerfectObstacles(deltaTime);

    updatePerfectButton(deltaTime);

    // SCORE POR SOBREVIVÊNCIA

    const scoreMultiplier = perfectTimingRuntime.effect === "score_up"
        ? perfectTimingConfig.scoreMultiplier : 1;
    scoreState.value += deltaTime * scoreState.pointsPerSecond * scoreMultiplier;

    // SISTEMA DE COLISÃO

    if (window.ONREDCollisionSystem) {

        ONREDCollisionSystem.update(deltaTime);

        handlePlayerCollision();
    }

    // INIMIGO PING PONG
    if (window.ONREDPingPong) {
        ONREDPingPong.update(
            deltaTime,
            player,
            canvas,
            window.ONREDHealthSystem,
            window.ONREDCollisionSystem,
            perfectObstacles,
            obstacleConfig.size
        );
    }

        // SISTEMA MERGE (ESFERAS VERMELHAS)

    if (window.ONREDMergeSystem) {

       
const mergeResults = ONREDMergeSystem.update(
    deltaTime,
    player,
    canvas,
    window.ONREDHealthSystem
);

// APLICA BÔNUS DE PONTUAÇÃO DO MERGE.

mergeResults.forEach(result => {

    if (
        result.type === "bonus_score" &&
        result.applied
    ) {
        scoreState.value += result.points;
    }

});

    }
}

// ==========================================
// DESENHO DA ARENA
// ==========================================

function drawArena() {

    ctx.fillStyle = "#03060d";

    ctx.fillRect(
        0,
        0,
        canvas.width,
        canvas.height
    );

    const hexSize = 28;
    const hexWidth = Math.sqrt(3) * hexSize;
    const hexHeight = hexSize * 1.5;

    for (
        let row = -1;
        row < canvas.height / hexHeight + 2;
        row++
    ) {

        for (
            let col = -1;
            col < canvas.width / hexWidth + 2;
            col++
        ) {

            const x = col * hexWidth +
                (row % 2) * hexWidth / 2;

            const y = row * hexHeight;

            ctx.beginPath();

            for (let i = 0; i < 6; i++) {

                const angle =
                    (Math.PI / 180) * (60 * i - 30);

                const px = x + hexSize * Math.cos(angle);
                const py = y + hexSize * Math.sin(angle);

                if (i === 0) {
                    ctx.moveTo(px, py);
                } else {
                    ctx.lineTo(px, py);
                }
            }

            ctx.closePath();

            ctx.fillStyle = "#080D16";
            ctx.fill();

            ctx.strokeStyle = "rgba(22, 139, 255, 0.22)";
            ctx.lineWidth = 1;

            ctx.stroke();
        }
    }
}

// ==========================================
// DESENHO DO JOGADOR
// ==========================================

function drawPlayer() {

    ctx.save();

    ctx.shadowColor = "#ff2525";
    ctx.shadowBlur = 22;

    ctx.beginPath();

    ctx.arc(
        player.x,
        player.y,
        player.radius,
        0,
        Math.PI * 2
    );

    ctx.fillStyle = "#ff2525";
    ctx.fill();

    ctx.shadowBlur = 0;

    ctx.beginPath();

    ctx.arc(
        player.x - 4,
        player.y - 4,
        player.radius * 0.3,
        0,
        Math.PI * 2
    );

    ctx.fillStyle = "rgba(255,255,255,0.65)";
    ctx.fill();

    ctx.restore();
}

// ==========================================
// DESENHO DOS OBSTÁCULOS
// ==========================================

function drawPerfectObstacles() {

    perfectObstacles.forEach(obstacle => {
        if (obstacle.state !== "ACTIVE") return;
        const half = obstacleConfig.size / 2;

        ctx.beginPath();

        ctx.rect(
            obstacle.x - half,
            obstacle.y - half,
            obstacleConfig.size,
            obstacleConfig.size
        );

        ctx.strokeStyle = "#168BFF";
        ctx.lineWidth = 3;

        ctx.stroke();
    });
}

// ==========================================
// DESENHO DO JOYSTICK
// ==========================================

function drawJoystick() {

    ctx.beginPath();

    ctx.arc(
        joystick.baseX,
        joystick.baseY,
        joystick.radius,
        0,
        Math.PI * 2
    );

    ctx.fillStyle = "rgba(180,180,180,0.3)";
    ctx.fill();

    ctx.beginPath();

    ctx.arc(
        joystick.knobX,
        joystick.knobY,
        joystick.knobRadius,
        0,
        Math.PI * 2
    );

    ctx.fillStyle = "#ffffff";
    ctx.fill();
}

// ==========================================
// DESENHO DO BOTÃO PERFECT TIMING
// ==========================================

function drawPerfectButton() {

    const x = perfectButton.x;
    const y = perfectButton.y;
    const size = perfectButton.size;

    const padding = 5;
    const innerSize = size - padding * 2;

    const fillHeight =
        innerSize * perfectButton.charge;

    ctx.fillStyle = "#101820";

    ctx.fillRect(
        x,
        y,
        size,
        size
    );

    ctx.fillStyle = perfectButton.charge >= 1
        ? "#168BFF"
        : "#07539C";

    ctx.fillRect(
        x + padding,
        y + size - padding - fillHeight,
        innerSize,
        fillHeight
    );

    ctx.strokeStyle =
        perfectButton.activationFlash > 0
            ? "#FFFFFF"
            : "#168BFF";

    ctx.lineWidth = 3;

    ctx.strokeRect(
        x,
        y,
        size,
        size
    );

    ctx.fillStyle = "#FFFFFF";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = "bold 12px Arial";

    ctx.fillText(
        perfectTimingRuntime.requestTimer > 0 ? "ARMED" :
        perfectButton.charge >= 1 ? "READY" : `${Math.floor(perfectButton.charge * 100)}%`,
        x + size / 2, y + size / 2
    );
}

// ==========================================
// DESENHO GERAL
// ==========================================

function draw() {

    ctx.clearRect(
        0,
        0,
        canvas.width,
        canvas.height
    );

    drawArena();
    drawPerfectObstacles();

    if (window.ONREDPingPong) {
        ONREDPingPong.draw(ctx);
    }

    if (window.ONREDMergeSystem) {
        ONREDMergeSystem.draw(ctx);
    }

    drawPlayer();

    if (window.ONREDCollisionSystem) {

        ONREDCollisionSystem.drawImpact(
            ctx,
            player
        );
    }

    drawJoystick();
    drawPerfectButton();

    drawScore();

    if (window.ONREDHealthUI) {
        ONREDHealthUI.draw(ctx, canvas);
    }
}

// ==========================================
// DESENHO DO SCORE E DA ONDA DE CHOQUE
// ==========================================

function drawScore() {

    if (gameState === GAME_STATE.PLAYING) {

        ctx.fillStyle = "#FFFFFF";
        ctx.textAlign = "center";
        ctx.textBaseline = "top";
        ctx.font = "bold 18px Arial";

        ctx.fillText(
            formatScore(scoreState.value),
            canvas.width / 2,
            18
        );
    }

    if (perfectTimingRuntime.feedbackTimer > 0) {
        ctx.save();
        ctx.fillStyle = "#FFFFFF";
        ctx.textAlign = "center";
        ctx.textBaseline = "top";
        ctx.font = "bold 12px Arial";
        ctx.shadowColor = "#168BFF";
        ctx.shadowBlur = 12;
        ctx.fillText(perfectTimingRuntime.feedback, canvas.width / 2, 44);
        ctx.restore();
    }

    if (window.ONREDPerfectTimingSystem) {
        const state = ONREDPerfectTimingSystem.getState();
        if (state.collectiveActive) {
            ctx.save();
            ctx.fillStyle = "#FFFFFF";
            ctx.textAlign = "center";
            ctx.textBaseline = "top";
            ctx.font = "bold 13px Arial";
            ctx.fillText("5/5 RETURN IN " + Math.ceil(state.collectiveRemaining) + "s", canvas.width / 2, 62);
            ctx.restore();
        }
    }

    if (perfectWave.timer > 0) {

        const progress =
            1 - perfectWave.timer / perfectWave.duration;

        const radius =
            player.radius + progress * 320;

        ctx.save();

        ctx.globalAlpha = 1 - progress;

        ctx.beginPath();

        ctx.arc(
            player.x,
            player.y,
            radius,
            0,
            Math.PI * 2
        );

        ctx.strokeStyle = "#168BFF";
        ctx.lineWidth = 4;
        ctx.shadowColor = "#168BFF";
        ctx.shadowBlur = 20;
        ctx.stroke();

        ctx.restore();
    }
}

// ==========================================
// RESET COMPLETO DA PARTIDA
// ==========================================

function resetGame() {

    perfectObstacles.length = 0;

    spawnTimer = 0;

    resetJoystick();

    perfectButton.charge = 1;
    perfectButton.activationFlash = 0;

    perfectWave.timer = 0;
    perfectTimingRuntime.requestTimer = 0;
    perfectTimingRuntime.effect = null;
    perfectTimingRuntime.effectTimer = 0;
    perfectTimingRuntime.feedback = "";
    perfectTimingRuntime.feedbackTimer = 0;
    if (window.ONREDPerfectTimingSystem) ONREDPerfectTimingSystem.reset();

    scoreState.value = 0;

    resizeCanvas();
    spawnPlayer();

    if (window.ONREDHealthSystem) {
        ONREDHealthSystem.reset();
    }

    if (window.ONREDCollisionSystem) {
        ONREDCollisionSystem.reset();
    }

    if (window.ONREDMergeSystem) {
        ONREDMergeSystem.reset(canvas, player);
    }

    if (window.ONREDPingPong) {
        ONREDPingPong.reset(canvas, player);
    }

    lastFrameTime = 0;
}

// ==========================================
// INICIAR PARTIDA
// ==========================================

window.startONREDGame = function () {

    if (gameStarted) return;

    gameStarted = true;
    gameState = GAME_STATE.PLAYING;

    resetGame();

    if (mainMenu) {
        mainMenu.classList.add("hidden");
    }

    if (gameOverScreen) {
        gameOverScreen.classList.remove("active");
        gameOverScreen.setAttribute("aria-hidden", "true");
    }

    if (!loopRunning) {
        loopRunning = true;
        requestAnimationFrame(gameLoop);
    }
};

// Compatibilidade com menu.js que dispara o evento onred:start.
document.addEventListener("onred:start", function () {
    window.startONREDGame();
});

// ==========================================
// REINICIAR PARTIDA
// ==========================================

function restartONREDGame() {

    if (gameState !== GAME_STATE.GAME_OVER) return;

    gameStarted = true;
    gameState = GAME_STATE.PLAYING;

    if (gameOverScreen) {
        gameOverScreen.classList.remove("active");
        gameOverScreen.setAttribute("aria-hidden", "true");
    }

    if (mainMenu) {
        mainMenu.classList.add("hidden");
    }

    resetGame();

    if (!loopRunning) {
        loopRunning = true;
        requestAnimationFrame(gameLoop);
    }
}

// ==========================================
// RETORNAR AO MENU PRINCIPAL
// ==========================================

function returnToMainMenu() {

    if (gameState !== GAME_STATE.GAME_OVER) return;

    gameState = GAME_STATE.MENU;
    gameStarted = false;

    resetJoystick();

    perfectObstacles.length = 0;
    spawnTimer = 0;

    if (window.ONREDPingPong) {
        ONREDPingPong.reset(canvas, player);
    }

    if (gameOverScreen) {
        gameOverScreen.classList.remove("active");
        gameOverScreen.setAttribute("aria-hidden", "true");
    }

    if (settingsPanel) {
        settingsPanel.classList.add("hidden");
    }

    if (mainMenu) {
        mainMenu.classList.remove("hidden");
    }
}

// ==========================================
// EVENTOS DOS BOTÕES
// ==========================================

if (retryButton) {
    retryButton.addEventListener("click", restartONREDGame);
}

if (gameOverMenuButton) {
    gameOverMenuButton.addEventListener("click", returnToMainMenu);
}

// ==========================================
// LOOP PRINCIPAL
// ==========================================

let lastFrameTime = 0;

function gameLoop(timestamp) {

    const deltaTime = lastFrameTime
        ? Math.min(
            (timestamp - lastFrameTime) / 1000,
            0.05
        )
        : 0;

    lastFrameTime = timestamp;

    if (gameState === GAME_STATE.PLAYING) {
        update(deltaTime);
        draw();
    }

    requestAnimationFrame(gameLoop);
}

// ==========================================
// EVENTOS
// ==========================================

canvas.addEventListener("pointerdown", pointerDown);
canvas.addEventListener("pointermove", pointerMove);
canvas.addEventListener("pointerup", pointerUp);
canvas.addEventListener("pointercancel", pointerUp);
canvas.addEventListener("lostpointercapture", pointerUp);

window.addEventListener("resize", resizeCanvas);

document.addEventListener(
    "touchmove",
    event => {
        event.preventDefault();
    },
    { passive: false }
);

// ==========================================
// INICIALIZAÇÃO
// ==========================================

resizeCanvas();

loadBestScore();
