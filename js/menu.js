
/*
 * ON RED
 * MENU MODULE
 * Version: 1.0
 */

const ONREDMenu = (() => {

    const elements = {
        container: document.getElementById("mainMenu"),
        play: document.getElementById("playButton"),
        settings: document.getElementById("settingsButton"),
        settingsPanel: document.getElementById("settingsPanel"),
        back: document.getElementById("backButton"),
        bestScore: document.getElementById("bestScore")
    };

    function loadBestScore() {

        const score = Number(
            localStorage.getItem("onRedBestScore") || 0
        );

        elements.bestScore.textContent =
            String(score).padStart(6, "0");
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

        hideMenu();

        document.dispatchEvent(
            new Event("onred:start")
        );
    }

    function initialize() {

        elements.play.addEventListener(
            "click",
            startGame
        );

        elements.settings.addEventListener(
            "click",
            openSettings
        );

        elements.back.addEventListener(
            "click",
            closeSettings
        );

        showMenu();
    }

    return {
        initialize,
        showMenu,
        hideMenu
    };

})();

ONREDMenu.initialize();
