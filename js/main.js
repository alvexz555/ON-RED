
const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const player = {
    x: 0,
    y: 0,
    radius: 15,
    speed: 3
};

const joystick = {
    x: 0,
    y: 0,
    active: false,
    baseX: 85,
    baseY: 0,
    knobX: 85,
    knobY: 0,
    radius: 55,
    knobRadius: 22,
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
    joystick.active = false;
    joystick.knobX = joystick.baseX;
    joystick.knobY = joystick.baseY;
    joystick.pointerId = null;
}

function handlePointerDown(event) {
    const dx = event.clientX - joystick.baseX;
    const dy = event.clientY - joystick.baseY;

    const distance = Math.hypot(dx, dy);

    if (distance > joystick.radius + 25) return;
    if (joystick.active) return;

    joystick.active = true;
    joystick.pointerId = event.pointerId;

    canvas.setPointerCapture(event.pointerId);

    updateJoystick(event);
}

function updateJoystick(event) {
    if (!joystick.active) return;
    if (event.pointerId !== joystick.pointerId) return;

    const dx = event.clientX - joystick.baseX;
    const dy = event.clientY - joystick.baseY;

    const distance = Math.hypot(dx, dy);
    const maxDistance = joystick.radius;

    const limitedDistance = Math.min(distance, maxDistance);

    const angle = Math.atan2(dy, dx);

    joystick.knobX = joystick.baseX + Math.cos(angle) * limitedDistance;
    joystick.knobY = joystick.baseY + Math.sin(angle) * limitedDistance;

    if (distance > 0) {
        joystick.x = dx / distance;
        joystick.y = dy / distance;
    } else {
        joystick.x = 0;
        joystick.y = 0;
    }
}

function handlePointerUp(event) {
    if (event.pointerId !== joystick.pointerId) return;
    resetJoystick();
}

function update() {
    player.x += joystick.x * player.speed;
    player.y += joystick.y * player.speed;
}

function drawJoystick() {
    ctx.globalAlpha = 0.4;

    ctx.beginPath();
    ctx.arc(
        joystick.baseX,
        joystick.baseY,
        joystick.radius,
        0,
        Math.PI * 2
    );
    ctx.fillStyle = "#888";
    ctx.fill();

    ctx.globalAlpha = 0.9;

    ctx.beginPath();
    ctx.arc(
        joystick.knobX,
        joystick.knobY,
        joystick.knobRadius,
        0,
        Math.PI * 2
    );
    ctx.fillStyle = "#fff";
    ctx.fill();

    ctx.globalAlpha = 1;
}

function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = "#ff2525";
    ctx.beginPath();
    ctx.arc(player.x, player.y, player.radius, 0, Math.PI * 2);
    ctx.fill();

    drawJoystick();
}

function gameLoop() {
    update();
    draw();

    requestAnimationFrame(gameLoop);
}

canvas.addEventListener("pointerdown", handlePointerDown);
canvas.addEventListener("pointermove", updateJoystick);
canvas.addEventListener("pointerup", handlePointerUp);
canvas.addEventListener("pointercancel", handlePointerUp);

window.addEventListener("resize", resizeCanvas);

resizeCanvas();
gameLoop();
