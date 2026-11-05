
const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

const player = {
    x: 0,
    y: 0,
    radius: 14,
    color: "#ff3030"
};

let score = 0;
let health = 100;

function resizeCanvas() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    canvas.width = window.innerWidth * dpr;
    canvas.height = window.innerHeight * dpr;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    player.x = window.innerWidth / 2;
    player.y = window.innerHeight / 2;
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

    ctx.fillStyle = player.color;
    ctx.fill();

    ctx.closePath();
}

function updateHUD() {
    document.getElementById("score").textContent =
        `SCORE: ${score}`;

    document.getElementById("health").textContent =
        `HP: ${health}`;
}

function gameLoop() {
    ctx.clearRect(
        0,
        0,
        window.innerWidth,
        window.innerHeight
    );

    drawPlayer();
    updateHUD();

    requestAnimationFrame(gameLoop);
}

window.addEventListener("resize", resizeCanvas);

resizeCanvas();
gameLoop();
