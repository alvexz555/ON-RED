
/*
 * ON RED
 * KEYBOARD CONTROLLER
 * Version: 1.1
 *
 * WASD + Arrow Keys
 * SHIFT: one-shot Perfect Timing request
 * Diagonal movement normalized
 */

(function () {
    "use strict";

    const keys = new Set();
    let perfectTimingRequested = false;

    const KEY_MAP = {
        KeyW: "up",
        ArrowUp: "up",
        KeyS: "down",
        ArrowDown: "down",
        KeyA: "left",
        ArrowLeft: "left",
        KeyD: "right",
        ArrowRight: "right"
    };

    function isMovementKey(code) {
        return Object.prototype.hasOwnProperty.call(KEY_MAP, code);
    }

    function handleKeyDown(event) {

        // SHIFT dispara uma solicitação única, sem repetir enquanto segurado.
        if (event.code === "ShiftLeft" || event.code === "ShiftRight") {
            if (!event.repeat) {
                perfectTimingRequested = true;
            }
            return;
        }

        if (!isMovementKey(event.code)) return;

        if (event.code.startsWith("Arrow")) {
            event.preventDefault();
        }

        keys.add(event.code);
    }

    function handleKeyUp(event) {
        if (!isMovementKey(event.code)) return;

        if (event.code.startsWith("Arrow")) {
            event.preventDefault();
        }

        keys.delete(event.code);
    }

    function reset() {
        keys.clear();
        perfectTimingRequested = false;
    }

    function consumePerfectTimingRequest(isPlaying) {
        const requested = perfectTimingRequested;
        perfectTimingRequested = false;
        return Boolean(isPlaying && requested);
    }

    window.addEventListener("blur", reset);

    document.addEventListener("visibilitychange", function () {
        if (document.hidden) reset();
    });

    function getVector(isPlaying) {
        if (!isPlaying) return { x: 0, y: 0 };

        let x = 0;
        let y = 0;

        keys.forEach(code => {
            switch (KEY_MAP[code]) {
                case "up": y -= 1; break;
                case "down": y += 1; break;
                case "left": x -= 1; break;
                case "right": x += 1; break;
            }
        });

        const magnitude = Math.hypot(x, y);
        if (magnitude > 0) {
            x /= magnitude;
            y /= magnitude;
        }

        return { x, y };
    }

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);

    window.ONREDKeyboardController = {
        getVector,
        consumePerfectTimingRequest,
        reset
    };

    console.log("[ON RED] Keyboard Controller loaded.");
})();
