
const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const player = {
    x: 0,
    y: 0,
    radius: 15,
    speed: 3.5
};

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

function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    player.x = canvas.width / 2;
    player.y = canvas.height / 2;

    joystick.baseY = canvas.height - 85;

    resetJoystick();
}

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

function pointerDown(event) {
    event.preventDefault();

    if (joystick.active) return;

    const pos = getPosition(event);

    const dx = pos.x - joystick.baseX;
    const dy = pos.y - joystick.baseY;

    const distance = Math.hypot(dx, dy);

    // Aceita toque na região do joystick
    if (distance > 100) return;

    joystick.active = true;
    joystick.pointerId = event.pointerId;

    canvas.setPointerCapture(event.pointerId);

    moveJoystick(event);
}

function moveJoystick(event) {
    if (!joystick.active) return;
    if (event.pointerId !== joystick.pointerId) return;

    event.preventDefault();

    const pos = getPosition(event);

    const dx = pos.x - joystick.baseX;
    const dy = pos.y - joystick.baseY;

    const distance = Math.hypot(dx, dy);
    const angle = Math.atan2(dy, dx);

    const limitedDistance = Math.min(
        distance,
        joystick.radius
    );

    joystick.knobX =
        joystick.baseX + Math.cos(angle) * limitedDistance;

    joystick.knobY =
        joystick.baseY + Math.sin(angle) * limitedDistance;

    if (distance > 5) {
        joystick.x = dx / distance;
        joystick.y = dy / distance;
    } else {
        joystick.x = 0;
        joystick.y = 0;
    }
}

function pointerUp(event) {
    if (event.pointerId !== joystick.pointerId) return;

    resetJoystick();
}

function update() {
    player.x += joystick.x * player.speed;
    player.y += joystick.y * player.speed;
}

function drawArena() {
    ctx.fillStyle = "#151515";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
}

function drawPlayer() {
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
}

function drawJoystick() {
    ctx.globalAlpha = 0.35;

    ctx.beginPath();
    ctx.arc(
        joystick.baseX,
        joystick.baseY,
        joystick.radius,
        0,
        Math.PI * 2
    );

    ctx.fillStyle = "#aaaaaa";
    ctx.fill();

    ctx.globalAlpha = 1;

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

function draw() {
    drawArena();
    drawPlayer();
    drawJoystick();
}

function gameLoop() {
    update();
    draw();

    requestAnimationFrame(gameLoop);
}

canvas.addEventListener("pointerdown", pointerDown, {
    passive: false
});

canvas.addEventListener("pointermove", moveJoystick, {
    passive: false
});

canvas.addEventListener("pointerup", pointerUp);
canvas.addEventListener("pointercancel", pointerUp);
canvas.addEventListener("lostpointercapture", pointerUp);

window.addEventListener("resize", resizeCanvas);

resizeCanvas();
gameLoop();
