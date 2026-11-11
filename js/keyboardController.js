
/*
 * ON RED
 * KEYBOARD CONTROLLER
 * Version: 1.0
 *
 * WASD + Arrow Keys
 * Diagonal movement normalized
 * Independent input module
 *
 * SHIFT reserved for Perfect Timing.
 */

(function () {
    "use strict";

    // ==========================================
    // CONFIGURATION
    // ==========================================

    const keys = new Set();

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

    // ==========================================
    // INPUT VALIDATION
    // ==========================================

    function isMovementKey(code) {
        return Object.prototype.hasOwnProperty.call(
            KEY_MAP,
            code
        );
    }

    // ==========================================
    // KEYBOARD EVENTS
    // ==========================================

    function handleKeyDown(event) {

        if (!isMovementKey(event.code)) return;

        // Prevent page scrolling during gameplay.
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

    // ==========================================
    // INPUT RESET
    // ==========================================

    function reset() {
        keys.clear();
    }

    // Clear keys when the browser loses focus.
    window.addEventListener("blur", reset);

    // Clear keys when the tab becomes hidden.
    document.addEventListener(
        "visibilitychange",
        function () {
            if (document.hidden) {
                reset();
            }
        }
    );

    // ==========================================
    // MOVEMENT VECTOR
    // ==========================================

    function getVector(isPlaying) {

        if (!isPlaying) {
            return { x: 0, y: 0 };
        }

        let x = 0;
        let y = 0;

        keys.forEach(code => {

            const direction = KEY_MAP[code];

            switch (direction) {

                case "up":
                    y -= 1;
                    break;

                case "down":
                    y += 1;
                    break;

                case "left":
                    x -= 1;
                    break;

                case "right":
                    x += 1;
                    break;
            }
        });

        // Normalize diagonal movement.
        const magnitude = Math.hypot(x, y);

        if (magnitude > 0) {
            x /= magnitude;
            y /= magnitude;
        }

        return { x, y };
    }

    // ==========================================
    // INITIALIZATION
    // ==========================================

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);

    // ==========================================
    // PUBLIC API
    // ==========================================

    window.ONREDKeyboardController = {
        getVector,
        reset
    };

    console.log("[ON RED] Keyboard Controller loaded.");

})();
