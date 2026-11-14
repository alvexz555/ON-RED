/*
 * ON RED · MENU PRINCIPAL
 * Navegação, fases, recordes, instruções e preferências.
 */
(() => {
    "use strict";
    const $ = id => document.getElementById(id);
    const panels = ["phasesPanel", "recordsPanel", "instructionsPanel", "settingsPanel"].map($).filter(Boolean);
    const home = $("menuHome");
    const container = $("mainMenu");
    const bestScore = $("bestScore");
    const recordsBestScore = $("recordsBestScore");
    const volumeSlider = $("volumeSlider");
    const volumeValue = $("volumeValue");
    const VOLUME_KEY = "onRedVolume";

    function readBestScore() {
        try {
            const value = Number(localStorage.getItem("onRedBestScore") || 0);
            return Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
        } catch (error) {
            console.warn("[ON RED] Não foi possível ler o recorde.", error);
            return 0;
        }
    }
    function formatScore(value) { return String(value).padStart(6, "0"); }
    function refreshRecords() {
        const score = formatScore(readBestScore());
        if (bestScore) bestScore.textContent = score;
        if (recordsBestScore) recordsBestScore.textContent = score;
    }
    function readVolume() {
        try {
            const saved = Number(localStorage.getItem(VOLUME_KEY));
            return Number.isFinite(saved) ? Math.max(0, Math.min(100, saved)) : 70;
        } catch (error) { return 70; }
    }

    let masterVolume = readVolume() / 100;
    let masterGainNode = null;
    function applyVolume() {
        document.querySelectorAll("audio, video").forEach(media => { media.volume = masterVolume; });
        if (masterGainNode && masterGainNode.gain) masterGainNode.gain.value = masterVolume;
        if (volumeSlider) volumeSlider.value = String(Math.round(masterVolume * 100));
        if (volumeValue) volumeValue.textContent = Math.round(masterVolume * 100) + "%";
    }
    window.ONREDVolume = {
        get: () => masterVolume,
        set: value => {
            const numeric = Number(value);
            if (!Number.isFinite(numeric)) return;
            masterVolume = Math.max(0, Math.min(1, numeric));
            try { localStorage.setItem(VOLUME_KEY, String(Math.round(masterVolume * 100))); } catch (error) {}
            applyVolume();
        },
        connectGainNode: node => {
            if (!node || !node.gain) return false;
            masterGainNode = node;
            applyVolume();
            return true;
        }
    };

    function closePanels() {
        panels.forEach(panel => panel.classList.add("hidden"));
        if (home) home.classList.remove("hidden");
    }
    function openPanel(id) {
        if (home) home.classList.add("hidden");
        panels.forEach(panel => panel.classList.toggle("hidden", panel.id !== id));
        refreshRecords();
    }
    function showMenu() {
        if (container) container.classList.remove("hidden");
        closePanels();
        refreshRecords();
        applyVolume();
    }
    function hideMenu() { if (container) container.classList.add("hidden"); }
    function startGame() {
        if (typeof window.startONREDGame !== "function") {
            console.error("[ON RED] Função de início do jogo não encontrada.");
            return;
        }
        hideMenu();
        window.startONREDGame();
    }
    function initialize() {
        if (!container || !home) {
            console.error("[ON RED] Estrutura do menu não encontrada.");
            return;
        }
        $("playButton")?.addEventListener("click", startGame);
        $("phaseOneButton")?.addEventListener("click", startGame);
        $("phasesButton")?.addEventListener("click", () => openPanel("phasesPanel"));
        $("recordsButton")?.addEventListener("click", () => openPanel("recordsPanel"));
        $("instructionsButton")?.addEventListener("click", () => openPanel("instructionsPanel"));
        $("settingsButton")?.addEventListener("click", () => openPanel("settingsPanel"));
        document.querySelectorAll("[data-menu-back]").forEach(button => button.addEventListener("click", closePanels));
        if (volumeSlider) volumeSlider.addEventListener("input", event => window.ONREDVolume.set(Number(event.target.value) / 100));
        showMenu();
    }
    window.ONREDMenu = { initialize, showMenu, hideMenu, refreshRecords };
    initialize();
})();
