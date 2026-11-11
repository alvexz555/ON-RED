
/*
 * ON RED
 * MENU MODULE
 * Version: 1.2 - Direct Integration
 */
document.addEventListener("click", function (event) {
    console.log(
        "[CLICK TEST]",
        "Elemento:",
        event.target,
        "ID:",
        event.target.id,
        "Classe:",
        event.target.className
    );
}, true);
const ONREDMenu = (() => {
    const elements = {
        container: document.getElementById("mainMenu"),
        play: document.getElementById("playButton"),
        settings: document.getElementById("settingsButton"),
        settingsPanel: document.getElementById("settingsPanel"),
        back: document.getElementById("backButton"),
        bestScore: document.getElementById("bestScore")
    };

    function checkElements() {
        for (const [name, element] of Object.entries(elements)) {
            if (!element) {
                console.error(`[ON RED] Elemento não encontrado: ${name}`);
                return false;
            }
        }
        return true;
    }

    function loadBestScore() {
        let score = 0;

        try {
            score = Number(localStorage.getItem("onRedBestScore") || 0);
        } catch (error) {
            console.warn("[ON RED] Erro ao carregar recorde:", error);
        }

        elements.bestScore.textContent = String(score).padStart(6, "0");
    }

    function showMenu() {
        elements.container.classList.remove("hidden");
        elements.settingsPanel.classList.add("hidden");
        loadBestScore();
    }

    function hideMenu() {
        elements.container.classList.add("hidden");
    }

    function openSettings() {
        elements.settingsPanel.classList.remove("hidden");
    }

    function closeSettings() {
        elements.settingsPanel.classList.add("hidden");
    }

    function startGame() {
        if (typeof window.startONREDGame !== "function") {
            console.error("[ON RED] Função de início do jogo não encontrada.");
            return;
        }

        window.startONREDGame();
        hideMenu();
    }

    function initialize() {
        if (!checkElements()) return;

        elements.play.addEventListener("click", startGame);
        elements.settings.addEventListener("click", openSettings);
        elements.back.addEventListener("click", closeSettings);

        showMenu();

        console.log("[ON RED] Menu inicializado.");
    }

    return {
        initialize,
        showMenu,
        hideMenu
    };
})();

ONREDMenu.initialize();
