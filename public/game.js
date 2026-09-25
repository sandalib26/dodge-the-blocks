const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const scoreElement = document.getElementById("score");
const restartBtn = document.getElementById("restartBtn");
const gameMessage = document.getElementById("gameMessage");

const player = {
    x: 275,
    y: 440,
    width: 50,
    height: 30,
    speed: 7
};

let blocks = [];
let score = 0;
let gameOver = false;
let keys = {};

document.addEventListener("keydown", (event) => {
    keys[event.key] = true;
});

document.addEventListener("keyup", (event) => {
    keys[event.key] = false;
});

function createBlock() {
    const size = 30 + Math.random() * 30;

    blocks.push({
        x: Math.random() * (canvas.width - size),
        y: -size,
        width: size,
        height: size,
        speed: 3 + Math.random() * 3
    });
}

function movePlayer() {
    if (keys["ArrowLeft"] && player.x > 0) {
        player.x -= player.speed;
    }

    if (keys["ArrowRight"] && player.x < canvas.width - player.width) {
        player.x += player.speed;
    }
}

function moveBlocks() {
    blocks.forEach((block) => {
        block.y += block.speed;
    });

    blocks = blocks.filter((block) => {
        if (block.y > canvas.height) {
            score++;
            scoreElement.textContent = score;
            return false;
        }

        return true;
    });
}

function checkCollision(player, block) {
    return (
        player.x < block.x + block.width &&
        player.x + player.width > block.x &&
        player.y < block.y + block.height &&
        player.y + player.height > block.y
    );
}

function checkGameOver() {
    for (const block of blocks) {
        if (checkCollision(player, block)) {
            gameOver = true;
            gameMessage.textContent = `Game Over! Score: ${score}`;
            return;
        }
    }
}

function drawPlayer() {
    ctx.fillStyle = "#22c55e";
    ctx.fillRect(
        player.x,
        player.y,
        player.width,
        player.height
    );
}

function drawBlocks() {
    ctx.fillStyle = "#ef4444";

    blocks.forEach((block) => {
        ctx.fillRect(
            block.x,
            block.y,
            block.width,
            block.height
        );
    });
}

function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    drawPlayer();
    drawBlocks();
}

let blockTimer = 0;

function gameLoop() {
    if (gameOver) {
        return;
    }

    movePlayer();
    moveBlocks();
    checkGameOver();

    blockTimer++;

    if (blockTimer > 40) {
        createBlock();
        blockTimer = 0;
    }

    draw();

    requestAnimationFrame(gameLoop);
}

function restartGame() {
    player.x = 275;
    blocks = [];
    score = 0;
    gameOver = false;
    blockTimer = 0;

    scoreElement.textContent = "0";
    gameMessage.textContent = "";

    gameLoop();
}

restartBtn.addEventListener("click", restartGame);

gameLoop();