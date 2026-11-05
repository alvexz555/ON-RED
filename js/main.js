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

    joystick.baseY = canvas.height - 90;

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

function updateJoystick(event) {
    const pos = getPosition(event);

    const dx = pos.x - joystick.baseX;
    const dy = pos.y - joystick.baseY;

    const distance = Math.hypot(dx, dy);
    const limitedDistance = Math.min(distance, joystick.radius);

    if (distance > 0) {
        const angle = Math.atan2(dy, dx);

        joystick.knobX =
            joystick.baseX + Math.cos(angle) * limitedDistance;

        joystick.knobY =
            joystick.baseY + Math.sin(angle) * limitedDistance;

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

function pointerUp(event) {
    if (event.pointerId !== joystick.pointerId) return;

    resetJoystick();
}

function update() {
    player.x += joystick.x * player.speed;
    player.y += joystick.y * player.speed;
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

function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    drawPlayer();
    drawJoystick();
}

function gameLoop() {
    update();
    draw();

    requestAnimationFrame(gameLoop);
}

canvas.addEventListener("pointerdown", pointerDown);
canvas.addEventListener("pointermove", pointerMove);
canvas.addEventListener("pointerup", pointerUp);
canvas.addEventListener("pointercancel", pointerUp);
canvas.addEventListener("lostpointercapture", pointerUp);

window.addEventListener("resize", resizeCanvas);

document.addEventListener("touchmove", event => {
    event.preventDefault();
}, { passive: false });

resizeCanvas();
gameLoop();
