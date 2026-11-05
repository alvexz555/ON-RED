
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
    active: false
};

function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    player.x = canvas.width / 2;
    player.y = canvas.height / 2;
}

function update() {
    player.x += joystick.x * player.speed;
    player.y += joystick.y * player.speed;
}

function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = "#ff2525";
    ctx.beginPath();
    ctx.arc(player.x, player.y, player.radius, 0, Math.PI * 2);
    ctx.fill();
}

function gameLoop() {
    update();
    draw();
    requestAnimationFrame(gameLoop);
}

window.addEventListener("resize", resizeCanvas);

resizeCanvas();
gameLoop();
