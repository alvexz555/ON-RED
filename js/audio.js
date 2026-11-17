/* ON RED · AUDIO MANAGER
 * Música e efeitos independentes, com volume geral salvo pelo menu.
 */
(() => {
    "use strict";

    const ROOT = "./assets/audio/";
    const tracks = {
        gameplay: ROOT + "music/8-bit_loop_loop_.mp3",
        boss: ROOT + "music/An_Adventure_Awaits.mp3"
    };
    const effects = {
        damage: ROOT + "sfx/laserLarge_000.ogg",
        pong: ROOT + "sfx/laserSmall_004.ogg",
        merge: ROOT + "sfx/forceField_001.ogg",
        perfect: ROOT + "sfx/doorOpen_001.ogg",
        back: ROOT + "sfx/back_003.ogg",
        click: ROOT + "sfx/click_001.ogg",
        revive: ROOT + "sfx/confirmation_001.ogg",
        victory: ROOT + "sfx/Success3.mp3",
        gameOver: ROOT + "sfx/GameOver.mp3"
    };

    let music = null;
    let currentTrack = null;
    let unlocked = false;
    const lastPlayed = new Map();
    const activeEffects = new Set();

    function volume() {
        return window.ONREDVolume && typeof window.ONREDVolume.get === "function"
            ? window.ONREDVolume.get() : 0.7;
    }

    function safePlay(media) {
        if (!media) return;
        media.volume = volume();
        const result = media.play();
        if (result && typeof result.catch === "function") {
            result.catch(error => {
                if (error && error.name !== "NotAllowedError") {
                    console.warn("[ON RED] Audio playback failed:", error);
                }
            });
        }
    }

    function playMusic(name) {
        const source = tracks[name];
        if (!source) return false;
        if (currentTrack === name && music && !music.paused) return true;
        if (music) {
            music.pause();
            music.currentTime = 0;
        }
        music = new Audio(source);
        music.loop = true;
        music.preload = "auto";
        currentTrack = name;
        if (unlocked) safePlay(music);
        return true;
    }

    function pauseMusic() {
        if (music && !music.paused) music.pause();
    }

    function resumeMusic() {
        if (music && music.paused && unlocked) safePlay(music);
    }

    function stopMusic() {
        if (music) {
            music.pause();
            music.currentTime = 0;
        }
        currentTrack = null;
        music = null;
    }

    function play(name, options = {}) {
        const source = effects[name];
        if (!source) return false;
        const now = performance.now();
        const cooldown = Number.isFinite(options.cooldown) ? options.cooldown : 0;
        const previous = lastPlayed.get(name) || 0;
        if (cooldown > 0 && now - previous < cooldown) return false;
        lastPlayed.set(name, now);

        const media = new Audio(source);
        media.preload = "auto";
        media.volume = volume();
        activeEffects.add(media);
        media.addEventListener("ended", () => {
            activeEffects.delete(media);
            media.src = "";
        }, { once: true });
        safePlay(media);
        return true;
    }

    function unlock() {
        unlocked = true;
        if (music && music.paused) safePlay(music);
    }

    document.addEventListener("onred:volume-change", () => {
        if (music) music.volume = volume();
        activeEffects.forEach(media => { media.volume = volume(); });
    });
    document.addEventListener("pointerdown", unlock, { once: true, capture: true });
    document.addEventListener("keydown", unlock, { once: true, capture: true });

    document.addEventListener("click", event => {
        const button = event.target && event.target.closest
            ? event.target.closest("button") : null;
        if (!button || button.disabled || button.hidden) return;
        if (button.matches("[data-menu-back]")) play("back", { cooldown: 100 });
        else play("click", { cooldown: 70 });
    }, true);

    window.ONREDAudio = {
        play,
        playMusic,
        pauseMusic,
        resumeMusic,
        stopMusic,
        unlock,
        getCurrentTrack: () => currentTrack
    };
})();
