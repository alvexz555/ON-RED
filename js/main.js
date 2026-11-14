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
const victoryFinalScoreLabel = document.getElementById("victoryFinalScore");
const victoryBestScoreLabel = document.getElementById("victoryBestScore");
const menuBestScoreLabel = document.getElementById("bestScore");
const victoryScreen = document.getElementById("victoryScreen");
const victoryRetryButton = document.getElementById("victoryRetryButton");
const victoryMenuButton = document.getElementById("victoryMenuButton");
const victoryDifficulty = document.getElementById("victoryDifficulty");
const pauseButton = document.getElementById("pauseButton");
const pauseScreen = document.getElementById("pauseScreen");
const resumeButton = document.getElementById("resumeButton");
const pauseRestartButton = document.getElementById("pauseRestartButton");
const pauseMenuButton = document.getElementById("pauseMenuButton");

// Dificuldade da Fase 1 selecionada após vencer o Boss (padrão NORMAL).
let bossDifficulty = "NORMAL";

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

    if (victoryBestScoreLabel) {
        victoryBestScoreLabel.textContent =
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
    PAUSED: "PAUSED",
    GAME_OVER: "GAME_OVER",
    VICTORY: "VICTORY"
};

let gameState = GAME_STATE.MENU;
let gameStarted = false;
let loopRunning = false;
let bossPhase = "IDLE";
let scoreFreezeTimer = 0;

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
    baseX: 115,
    baseY: 0,
    knobX: 115,
    knobY: 0,
    radius: 55,
    knobRadius: 22,
    x: 0,
    y: 0,
    active: false,
    pointerId: null
};

// O joystick é um controle de toque: aparece e responde apenas em
// dispositivos com entrada por toque (celular, tablet, telas híbridas).
// Desktop com teclado/mouse usa o teclado e não vê o joystick.
const hasTouchInput =
    (navigator.maxTouchPoints > 0) ||
    ("ontouchstart" in window);

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
    scorePerElimination: 500,
    positiveChance: 0.7,
    playerSpeedBoost: 1.4,
    playerSpeedPenalty: 0.75,
    obstacleSlowdown: 0.75,
    obstacleSpeedBoost: 1.25,
    effectDurations: {
        low_visibility: 10,
        obstacle_slow: 15,
        speed_down: 10,
        obstacle_fast: 5
    }
};
const perfectTimingRuntime = {
    effect: null, effectTimer: 0, feedback: "", feedbackTimer: 0
};

if (window.ONREDHealthSystem &&
    typeof window.ONREDHealthSystem.setDamageListener === "function") {
    window.ONREDHealthSystem.setDamageListener(() => {
        if (perfectTimingRuntime.effect === "speed_up") {
            perfectTimingRuntime.effect = null;
            perfectTimingRuntime.effectTimer = 0;
        }
    });
}

function updatePerfectButtonPosition() {

    perfectButton.x =
        canvas.width - perfectButton.margin - perfectButton.size;

    perfectButton.y =
        canvas.height - perfectButton.margin - perfectButton.size;
}

function activatePerfectTiming() {
    if (gameState !== GAME_STATE.PLAYING || perfectButton.charge < 1) return false;

    // Durante a luta do Boss, o Perfect Timing vira rebatida de projétil.
    const boss = window.ONREDBossSystem;
    if (boss && boss.getState().phase === "FIGHT") {
        const parry = boss.tryParry(player);
        if (parry.applied) {
            perfectButton.charge = 0;
            perfectButton.activationFlash = 0.25;
            perfectTimingRuntime.feedback =
                "PERFECT! " + boss.getConfig().damagePerParry + " HITS INBOUND";
            perfectTimingRuntime.feedbackTimer = 1.2;
            return true;
        }
    }

    // O botão só ativa quando um obstáculo está efetivamente encostando no jogador.
    const targetObstacle = findCollidingPerfectObstacle();
    if (!targetObstacle) {
        perfectTimingRuntime.feedback = "WAIT FOR CONTACT";
        perfectTimingRuntime.feedbackTimer = 0.6;
        return false;
    }

    return completePerfectTiming(targetObstacle);
}

function applyPerfectTimingShockwave() {
    // Recupera o impulso radial original do Perfect Timing.
    perfectObstacles.forEach(obstacle => {
        const dx = obstacle.x - player.x;
        const dy = obstacle.y - player.y;
        const distance = Math.hypot(dx, dy) || 1;
        const nx = dx / distance;
        const ny = dy / distance;
        const force = 140 + 340 * (1 - Math.min(distance / 500, 1));

        obstacle.vx = nx * force;
        obstacle.vy = ny * force;
        obstacle.role = "pressure";
    });

    if (ObstacleAI.attacker) {
        ObstacleAI.selectAttacker(perfectObstacles);
    }
}

function applyPerfectTimingEffect() {
    const health = window.ONREDHealthSystem;
    const positive = Math.random() < perfectTimingConfig.positiveChance;
    const choices = positive
        ? ["speed_up", "extra_life", "obstacle_slow"]
        : ["speed_down", "obstacle_fast", "low_visibility"];
    const type = choices[Math.floor(Math.random() * choices.length)];

    const labels = {
        speed_up: "SPEED BOOST +40%",
        extra_life: "EXTRA LIFE",
        obstacle_slow: "OBSTACLES SLOWED",
        speed_down: "SPEED REDUCED",
        obstacle_fast: "OBSTACLES FASTER",
        low_visibility: "ENEMIES HARDER TO SEE"
    };

    if (type === "extra_life") {
        if (health) health.addExtraLife();
        perfectTimingRuntime.effect = null;
        perfectTimingRuntime.effectTimer = 0;
    } else {
        perfectTimingRuntime.effect = type;
        perfectTimingRuntime.effectTimer = type === "speed_up"
            ? 0
            : perfectTimingConfig.effectDurations[type];
    }

    perfectTimingRuntime.feedback = labels[type];
    perfectTimingRuntime.feedbackTimer = 1.5;
    return labels[type];
}

function completePerfectTiming(obstacle) {
    const system = window.ONREDPerfectTimingSystem;
    const health = window.ONREDHealthSystem;
    const collision = window.ONREDCollisionSystem;
    if (!system || !health || !collision || !obstacle || perfectButton.charge < 1) return false;

    const result = system.eliminate(obstacle, perfectObstacles);
    if (!result.applied) return false;

    // Afasta os obstáculos restantes e inicia a proteção contra dano.
    applyPerfectTimingShockwave();
    collision.registerCollision();

    perfectButton.charge = 0;
    perfectButton.activationFlash = 0.25;
    scoreState.value += perfectTimingConfig.scorePerElimination;
    ObstacleAI.updateRoles(perfectObstacles);
    ObstacleAI.selectAttacker(perfectObstacles);

    if (result.collectiveTriggered) {
        const state = health.getState();
        health.heal(state.maxHP - state.hp);
        health.addExtraLife();
        health.addExtraLife();
        perfectTimingRuntime.effect = null;
        perfectTimingRuntime.effectTimer = 0;
        perfectTimingRuntime.feedback = "5/5 ELIMINATED · +2 EXTRA LIVES";
        perfectTimingRuntime.feedbackTimer = 2.5;
    } else {
        const effectLabel = applyPerfectTimingEffect();
        perfectTimingRuntime.feedback =
            "ELIMINATED +" + perfectTimingConfig.scorePerElimination + " · " + effectLabel;
        perfectTimingRuntime.feedbackTimer = 1.8;
    }
    perfectWave.timer = perfectWave.duration;
    return true;
}

function findCollidingPerfectObstacle() {
    const collision = window.ONREDCollisionSystem;
    if (!collision) return null;
    if (window.ONREDPerfectTimingSystem &&
        typeof ONREDPerfectTimingSystem.findImpactTarget === "function") {
        return ONREDPerfectTimingSystem.findImpactTarget(player, perfectObstacles, obstacleConfig.size);
    }
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

    // Sem toque no dispositivo, o joystick não é um controle disponível.
    if (!hasTouchInput) return;

    // Mesmo com tela de toque, o joystick responde apenas a dedo/caneta;
    // o mouse continua livre para o botão de Perfect Timing.
    if (
        event.pointerType !== "touch" &&
        event.pointerType !== "pen"
    ) {
        return;
    }

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

function updatePerfectButton(deltaTime, timerDeltaTime = deltaTime) {
    // Relógios de habilidade usam tempo real; animações/física continuam limitadas pelo frame.
    perfectTimingRuntime.feedbackTimer = Math.max(0, perfectTimingRuntime.feedbackTimer - timerDeltaTime);
    if (perfectTimingRuntime.effectTimer > 0) {
        perfectTimingRuntime.effectTimer = Math.max(
            0,
            perfectTimingRuntime.effectTimer - timerDeltaTime
        );
        if (perfectTimingRuntime.effectTimer <= 0) {
            perfectTimingRuntime.effect = null;
        }
    }

    if (perfectButton.charge < 1) {

        perfectButton.charge +=
            timerDeltaTime / perfectButton.cooldown;

        perfectButton.charge =
            Math.min(perfectButton.charge, 1);
    }

    if (perfectButton.activationFlash > 0) {

        perfectButton.activationFlash -= timerDeltaTime;

        perfectButton.activationFlash =
            Math.max(0, perfectButton.activationFlash);
    }

    if (perfectWave.timer > 0) {

        perfectWave.timer -= timerDeltaTime;

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

    joystick.baseY = canvas.height - 115;

    updatePerfectButtonPosition();

    resetJoystick();

    constrainPlayerToArena();
    constrainObstaclesToArena();
    if (window.ONREDHexagonSystem) ONREDHexagonSystem.constrainToArena(canvas);
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

function updatePerfectObstacles(deltaTime, timerDeltaTime = deltaTime) {

    spawnTimer += deltaTime;

    if (spawnTimer >= obstacleConfig.spawnInterval) {

        spawnTimer = 0;

        spawnPerfectObstacle();
    }

    if (window.ONREDPerfectTimingSystem) {
        ONREDPerfectTimingSystem.update(timerDeltaTime, canvas, player, obstacleConfig.size, perfectObstacles);
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

function triggerVictory() {

    const bonus = window.ONREDBossSystem
        ? window.ONREDBossSystem.getConfig().victoryBonusScore
        : 5000;
    const finalScore = Math.floor(scoreState.value + bonus);

    scoreState.value = finalScore;

    saveBestScore(finalScore);
    refreshBestScoreDisplays();

    if (victoryFinalScoreLabel) {
        victoryFinalScoreLabel.textContent = formatScore(finalScore);
    }

    gameState = GAME_STATE.VICTORY;

    if (victoryScreen) {
        victoryScreen.classList.add("active");
        victoryScreen.setAttribute("aria-hidden", "false");
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

    // Os obstáculos comuns ficam congelados durante WARNING/FIGHT/DEFEATED.
    // Não podem continuar causando dano fora da arena de combate normal.
    if (window.ONREDBossSystem && window.ONREDBossSystem.getState().phase !== "IDLE") return;

    const targetObstacle = findCollidingPerfectObstacle();
    if (!targetObstacle) return;

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

function update(deltaTime, timerDeltaTime = deltaTime) {

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
const commonPongControlMultiplier = window.ONREDPingPong && typeof window.ONREDPingPong.getControlMultiplier === "function" ? window.ONREDPingPong.getControlMultiplier() : 1;
const bossElectricControlMultiplier = window.ONREDBossSystem && typeof window.ONREDBossSystem.getControlMultiplier === "function" ? window.ONREDBossSystem.getControlMultiplier() : 1;
const controlMultiplier = Math.min(commonPongControlMultiplier, bossElectricControlMultiplier);

const effectSpeedMultiplier = perfectTimingRuntime.effect === "speed_up"
    ? perfectTimingConfig.playerSpeedBoost
    : perfectTimingRuntime.effect === "speed_down" ? perfectTimingConfig.playerSpeedPenalty : 1;
player.x += moveX * player.speed * controlMultiplier * effectSpeedMultiplier * deltaTime * 60;
player.y += moveY * player.speed * controlMultiplier * effectSpeedMultiplier * deltaTime * 60;

    // LIMITES DO JOGADOR

    constrainPlayerToArena();

    // BOSS FINAL DA FASE 1

    let bossPhaseNow = bossPhase;

    if (window.ONREDBossSystem) {

        const previousBossPhase = bossPhase;

        bossPhase = window.ONREDBossSystem.update(
            deltaTime,
            canvas,
            player,
            window.ONREDHealthSystem,
            window.ONREDCollisionSystem
        ).phase;

        if (window.ONREDHealthSystem && window.ONREDHealthSystem.getState().gameOver) {
            triggerGameOver();
        }

        if (previousBossPhase === "DEFEATED" && bossPhase === "IDLE") {
            triggerVictory();
        }

        bossPhaseNow = bossPhase;
    }

    if (bossPhaseNow === "IDLE") {

    // SISTEMAS DO JOGO (pausados durante a luta do Boss)

    updatePerfectObstacles(deltaTime, timerDeltaTime);

    if (window.ONREDHexagonSystem) {
        ONREDHexagonSystem.update(
            deltaTime, canvas, player, perfectObstacles, obstacleConfig.size,
            window.ONREDPingPong ? ONREDPingPong.getState() : null
        );
        ONREDHexagonSystem.resolveObstacles(perfectObstacles, obstacleConfig.size);
        ONREDHexagonSystem.resolvePlayer(
            player, window.ONREDHealthSystem, window.ONREDCollisionSystem
        );
        constrainPlayerToArena();
    }
    }

    // BOTÃO DE PERFECT TIMING SEMPRE ATUALIZADO: a rebatida do Boss
    // depende da recarga do cooldown, inclusive durante a luta.

    updatePerfectButton(deltaTime, timerDeltaTime);

    // SCORE POR SOBREVIVÊNCIA (freeze só na transição de aviso;
    // a pontuação continua correndo durante a batalha)

    if (scoreFreezeTimer > 0) {
        scoreFreezeTimer -= deltaTime;
    }

    if (scoreFreezeTimer <= 0) {
        scoreState.value += deltaTime * scoreState.pointsPerSecond;
    }

    // DISPARO DO BOSS FINAL (FASE 1) — gatilho por pontuação.

    if (
        window.ONREDBossSystem &&
        window.ONREDBossSystem.getState().phase === "IDLE" &&
        window.ONREDBossSystem.shouldStart(scoreState.value)
    ) {
        window.ONREDBossSystem.start(canvas, player);
        scoreFreezeTimer = window.ONREDBossSystem.getConfig().warningDuration;
    }

    // SISTEMA DE COLISÃO SEMPRE ATUALIZADO: a janela de invulnerabilidade
    // precisa expirar também durante a luta do Boss.

    if (window.ONREDCollisionSystem) {

        ONREDCollisionSystem.update(deltaTime);

        handlePlayerCollision();
    }

    if (bossPhaseNow === "IDLE") {

        // Pong comum e sistemas de obstáculos ficam suspensos na Boss Fight.
        if (window.ONREDPingPong) {
            ONREDPingPong.update(
                deltaTime,
                player,
                canvas,
                window.ONREDHealthSystem,
                window.ONREDCollisionSystem,
                perfectObstacles,
                obstacleConfig.size,
                window.ONREDHexagonSystem
            );
        }
    }

    // MERGE continua ativo durante a Boss Fight: somente o spawn fica mais lento.
    if (window.ONREDMergeSystem) {
        const mergeSpawnIntervalMultiplier = bossPhaseNow === "IDLE" ? 1 : 2;
        const mergeResults = ONREDMergeSystem.update(
            deltaTime,
            player,
            canvas,
            window.ONREDHealthSystem,
            { spawnIntervalMultiplier: mergeSpawnIntervalMultiplier }
        );

        mergeResults.forEach(result => {
            if (result.type === "bonus_score" && result.applied) {
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

    ctx.save();
    if (perfectTimingRuntime.effect === "low_visibility") {
        ctx.globalAlpha = 0.18;
    }

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

    ctx.restore();
}

// ==========================================
// DESENHO DO JOYSTICK
// ==========================================

function drawJoystick() {

    // Em desktop sem toque o joystick não existe: nada é desenhado.
    if (!hasTouchInput) return;

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
        perfectButton.charge >= 1
            ? "READY"
            : `${Math.floor(perfectButton.charge * 100)}%`,
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

    // Usa o estado real do Boss para evitar um frame residual de obstáculos
    // quando a transição para WARNING/FIGHT começa.
    const currentBossPhase = window.ONREDBossSystem
        ? window.ONREDBossSystem.getState().phase
        : bossPhase;
    const levelSystemsVisible = currentBossPhase === "IDLE";

    if (levelSystemsVisible) {
        drawPerfectObstacles();

        if (window.ONREDHexagonSystem) ONREDHexagonSystem.draw(ctx);

        if (window.ONREDPingPong) {
            ONREDPingPong.draw(ctx, player);
        }
    }

    // MERGE permanece visível e coletável durante a Boss Fight.
    if (window.ONREDMergeSystem) {
        window.ONREDMergeSystem.draw(ctx);
    }

    if (window.ONREDBossSystem && currentBossPhase !== "IDLE") {
        window.ONREDBossSystem.draw(ctx, canvas, player);
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

    if (window.ONREDBossSystem && bossPhase === "FIGHT") {
        window.ONREDBossSystem.drawHUD(ctx, canvas);
    }

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

        // BARRA DE APRESENTAÇÃO DO BOSS FINAL (FASE 1) — visível a partir de 5.000, pisca em 18.000.
        if (window.ONREDBossSystem) {
            const appearanceFrom = 5000;
            const blinkAt = 18000;
            const ratio = Math.min(1, scoreState.value / window.ONREDBossSystem.getConfig().triggerScore);
            if (scoreState.value >= appearanceFrom) {
                ctx.globalAlpha = scoreState.value >= blinkAt
                    ? (Math.sin(Date.now() / 250) > 0 ? 0.95 : 0.15)
                    : 0.95;
                ctx.fillStyle = "#168BFF";
                ctx.fillRect(0, 6, canvas.width * ratio, 2);
                ctx.globalAlpha = 1;
            }
        }
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
    if (window.ONREDHexagonSystem) ONREDHexagonSystem.reset();

    spawnTimer = 0;

    resetJoystick();

    perfectButton.charge = 1;
    perfectButton.activationFlash = 0;

    perfectWave.timer = 0;
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

    if (window.ONREDBossSystem) {
        window.ONREDBossSystem.reset();
    }

    bossPhase = "IDLE";
    scoreFreezeTimer = 0;

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

    if (gameState !== GAME_STATE.GAME_OVER && gameState !== GAME_STATE.VICTORY && gameState !== GAME_STATE.PAUSED) return;

    gameStarted = true;
    gameState = GAME_STATE.PLAYING;

    if (pauseScreen) {
        pauseScreen.classList.remove("active");
        pauseScreen.setAttribute("aria-hidden", "true");
    }

    if (gameOverScreen) {
        gameOverScreen.classList.remove("active");
        gameOverScreen.setAttribute("aria-hidden", "true");
    }

    if (victoryScreen) {
        victoryScreen.classList.remove("active");
        victoryScreen.setAttribute("aria-hidden", "true");
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

    if (gameState !== GAME_STATE.GAME_OVER && gameState !== GAME_STATE.VICTORY) return;

    gameState = GAME_STATE.MENU;
    gameStarted = false;

    if (gameOverScreen) {
        gameOverScreen.classList.remove("active");
        gameOverScreen.setAttribute("aria-hidden", "true");
    }

    if (victoryScreen) {
        victoryScreen.classList.remove("active");
        victoryScreen.setAttribute("aria-hidden", "true");
    }

    if (pauseScreen) {
        pauseScreen.classList.remove("active");
        pauseScreen.setAttribute("aria-hidden", "true");
    }

    resetJoystick();

    perfectObstacles.length = 0;
    spawnTimer = 0;
    if (window.ONREDHexagonSystem) ONREDHexagonSystem.reset();

    if (window.ONREDPingPong) {
        ONREDPingPong.reset(canvas, player);
    }

    if (window.ONREDBossSystem) {
        window.ONREDBossSystem.reset();
    }

    bossPhase = "IDLE";
    scoreFreezeTimer = 0;

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
 // PAUSE SYSTEM
 // ==========================================

function pauseONREDGame() {
    if (gameState !== GAME_STATE.PLAYING) return false;

    gameState = GAME_STATE.PAUSED;
    resetJoystick();

    if (window.ONREDKeyboardController) {
        window.ONREDKeyboardController.reset();
    }

    if (pauseScreen) {
        pauseScreen.classList.add("active");
        pauseScreen.setAttribute("aria-hidden", "false");
    }

    return true;
}

function resumeONREDGame() {
    if (gameState !== GAME_STATE.PAUSED) return false;

    if (pauseScreen) {
        pauseScreen.classList.remove("active");
        pauseScreen.setAttribute("aria-hidden", "true");
    }

    gameState = GAME_STATE.PLAYING;
    lastFrameTime = 0;
    return true;
}

// ==========================================
// EVENTOS DOS BOTÕES
// ==========================================

if (pauseButton) pauseButton.addEventListener("click", pauseONREDGame);
if (resumeButton) resumeButton.addEventListener("click", resumeONREDGame);
if (pauseRestartButton) pauseRestartButton.addEventListener("click", restartONREDGame);
if (pauseMenuButton) pauseMenuButton.addEventListener("click", returnToMainMenu);

document.addEventListener("keydown", event => {
    if ((event.code === "Escape" || event.code === "KeyP") && !event.repeat) {
        if (gameState === GAME_STATE.PLAYING) {
            event.preventDefault();
            pauseONREDGame();
        } else if (gameState === GAME_STATE.PAUSED) {
            event.preventDefault();
            resumeONREDGame();
        }
    }
});

document.addEventListener("visibilitychange", () => {
    if (document.hidden && gameState === GAME_STATE.PLAYING) {
        pauseONREDGame();
    }
});

if (retryButton) {
    retryButton.addEventListener("click", restartONREDGame);
}

if (gameOverMenuButton) {
    gameOverMenuButton.addEventListener("click", returnToMainMenu);
}

if (victoryRetryButton) {
    victoryRetryButton.addEventListener("click", restartONREDGame);
}

if (victoryMenuButton) {
    victoryMenuButton.addEventListener("click", returnToMainMenu);
}

// SELEÇÃO DE DIFICULDADE DA FASE 1 (liberada após vencer o Boss).

function applyBossDifficulty(name) {

    bossDifficulty = name;

    if (window.ONREDBossSystem && window.ONREDBossSystem.setDifficulty) {
        window.ONREDBossSystem.setDifficulty(name);
    }

    if (victoryDifficulty) {
        victoryDifficulty
            .querySelectorAll(".difficulty-option")
            .forEach(button => {
                button.classList.toggle(
                    "selected",
                    button.getAttribute("data-difficulty") === name
                );
            });
    }
}

if (victoryDifficulty) {
    victoryDifficulty
        .querySelectorAll(".difficulty-option")
        .forEach(button => {
            button.addEventListener("click", () => {
                applyBossDifficulty(button.getAttribute("data-difficulty"));
            });
        });
}

// ==========================================
// LOOP PRINCIPAL
// ==========================================

let lastFrameTime = 0;

function gameLoop(timestamp) {

    const elapsedTime = lastFrameTime
        ? Math.max(0, (timestamp - lastFrameTime) / 1000)
        : 0;

    // Física e movimento mantêm o limite de 50 ms para evitar saltos.
    // Cooldown e respawn recebem o tempo decorrido real, sem perder segundos.
    const deltaTime = Math.min(elapsedTime, 0.05);

    lastFrameTime = timestamp;

    if (gameState === GAME_STATE.PLAYING) {
        update(deltaTime, elapsedTime);
        draw();
    } else if (gameState === GAME_STATE.PAUSED) {
        // O loop visual continua agendado, mas nenhum sistema é atualizado.
    } else if (gameState === GAME_STATE.VICTORY) {
        // Mantém o último frame desenhado até o overlay de vitória.
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
