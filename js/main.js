/*
 * ON RED
 * MAIN GAME
 * Version: 1.1
 *
 * Canvas 2D
 * Joystick virtual
 * Perfect Timing
 * Obstáculos com perseguição e separação
 * Limites físicos da arena
 */

// ==========================================
// CONFIGURAÇÃO INICIAL
// ==========================================

const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

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

function updatePerfectButtonPosition() {
    perfectButton.x =
        canvas.width - perfectButton.margin - perfectButton.size;

    perfectButton.y =
        canvas.height - perfectButton.margin - perfectButton.size;
}


function activatePerfectTiming() {

    if (perfectButton.charge < 1) {
        return false;
    }

    perfectButton.charge = 0;
    perfectButton.activationFlash = 0.2;

    console.log("[ON RED] PERFECT TIMING ativado!");

    // Integração com colisões preservada.

    return true;
}

// ==========================================
// SPAWN INICIAL DO JOGADOR
// ==========================================

function spawnPlayer() {

    player.x = canvas.width / 2;
    player.y = canvas.height / 2;

    console.log(
        "[ON RED] Player spawned:",
        player.x,
        player.y
    );
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
    event.preventDefault();

    // Ignorar entradas que não sejam toque ou mouse.
    if (
        event.pointerType !== "touch" &&
        event.pointerType !== "mouse" &&
        event.pointerType !== "pen"
    ) {
        return;
    }

    const pos = getPosition(event);

    // ÁREA DE TOQUE AMPLIADA
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

    // JOYSTICK
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
}

// ==========================================
// DIMENSÕES DA TELA
// ==========================================
function resizeCanvas() {

    // REMOVER MARGENS E ROLAGEM DO NAVEGADOR

    document.documentElement.style.margin = "0";
    document.documentElement.style.padding = "0";
    document.documentElement.style.overflow = "hidden";

    document.body.style.margin = "0";
    document.body.style.padding = "0";
    document.body.style.overflow = "hidden";

    // FIXAR CANVAS NA ÁREA VISÍVEL

    canvas.style.position = "fixed";
    canvas.style.left = "0";
    canvas.style.top = "0";
    canvas.style.zIndex = "0";
    canvas.style.pointerEvents = "auto";
    canvas.style.display = "block";
    canvas.style.margin = "0";
    canvas.style.padding = "0";

    // DIMENSÕES REAIS DA TELA

    const screenWidth = window.innerWidth;
    const screenHeight = window.innerHeight;

    canvas.style.width = `${screenWidth}px`;
    canvas.style.height = `${screenHeight}px`;

    canvas.width = screenWidth;
    canvas.height = screenHeight;

    // POSICIONAR CONTROLES

    joystick.baseY = canvas.height - 90;

    updatePerfectButtonPosition();

    resetJoystick();

    // REAPLICAR LIMITES FÍSICOS

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

    if (
        perfectObstacles.length >=
        obstacleConfig.maxObstacles
    ) {
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

    perfectObstacles.push({
        x,
        y,
        vx: 0,
        vy: 0,
        role: "pressure"
    });

    ObstacleAI.updateRoles(perfectObstacles);

    if (!ObstacleAI.attacker) {
        ObstacleAI.selectAttacker(perfectObstacles);
    }
}

// ==========================================
// ATUALIZAÇÃO DOS OBSTÁCULOS
// ==========================================

function updatePerfectObstacles(deltaTime) {

    // CONTROLE DE SPAWN

    spawnTimer += deltaTime;

    if (spawnTimer >= obstacleConfig.spawnInterval) {

        spawnTimer = 0;

        spawnPerfectObstacle();
    }

    // CALCULAR REPULSÃO

    const repulsions = ObstaclePhysics.calculateRepulsion(
        perfectObstacles,
        obstacleConfig.size
    );

    // PERSEGUIÇÃO INDIVIDUAL

    perfectObstacles.forEach((obstacle, index) => {

        const desired = ObstacleAI.getDesiredVelocity(
            obstacle,
            index,
            player,
            obstacleConfig.speed
        );

        const chaseX = desired.x;
        const chaseY = desired.y;

        // COMBINAR PERSEGUIÇÃO E REPULSÃO

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

        // MOVIMENTAÇÃO

        obstacle.x += obstacle.vx * deltaTime;
        obstacle.y += obstacle.vy * deltaTime;

    });

    // SEPARAÇÃO FÍSICA

    ObstaclePhysics.separate(
        perfectObstacles,
        obstacleConfig.size,
        deltaTime
    );

    // LIMITES APLICADOS APÓS TODA A FÍSICA

    constrainObstaclesToArena();
}

// ==========================================
// ATUALIZAÇÃO GERAL
// ==========================================

function update(deltaTime) {

    // MOVIMENTO DO JOGADOR

    player.x +=
        joystick.x * player.speed * deltaTime * 60;

    player.y +=
        joystick.y * player.speed * deltaTime * 60;

    // LIMITES DO JOGADOR

    constrainPlayerToArena();

    // SISTEMAS DO JOGO

    updatePerfectObstacles(deltaTime);

    updatePerfectButton(deltaTime);
}

// ==========================================
// DESENHO DA ARENA
// ==========================================

function drawArena() {

    // FUNDO BASE OPACO

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

    // BASE

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

    // CONTROLE

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

    // FUNDO

    ctx.fillStyle = "#101820";

    ctx.fillRect(
        x,
        y,
        size,
        size
    );

    // PREENCHIMENTO DE CARGA

    ctx.fillStyle = perfectButton.charge >= 1
        ? "#168BFF"
        : "#07539C";

    ctx.fillRect(
        x + padding,
        y + size - padding - fillHeight,
        innerSize,
        fillHeight
    );

    // CONTORNO

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

    // TEXTO

    ctx.fillStyle = "#FFFFFF";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = "bold 12px Arial";

    ctx.fillText(
        perfectButton.charge >= 1
            ? "READY"
            : `${Math.floor(perfectButton.charge * 100)}%`,
        x + size / 2,
        y + size / 2
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
    drawPlayer();
    drawJoystick();
    drawPerfectButton();

    // HEALTH UI
    if (window.ONREDHealthUI) {
        window.ONREDHealthUI.draw(ctx, canvas);
    }
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

    update(deltaTime);
    draw();

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
// INTEGRAÇÃO DO MENU COM O JOGO
// ==========================================

let gameStarted = false;

window.startONREDGame = function () {
    if (gameStarted) return;

    gameStarted = true;

    resizeCanvas();
    spawnPlayer();

    lastFrameTime = 0;

    console.log("[ON RED] Arena iniciada.");

    requestAnimationFrame(gameLoop);
};

// ==========================================
// INICIALIZAÇÃO
// ==========================================

resizeCanvas();
