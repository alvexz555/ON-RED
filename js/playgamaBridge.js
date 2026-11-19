/*
 * ON RED · Playgama Bridge integration
 *
 * Initializes the Bridge without blocking the game.
 * Shows the configured sticky banner only while the main menu is visible.
 *
 * The "revive" rewarded placement is declared in the Bridge config, but is
 * intentionally not invoked here: Playgama's advertising requirements do not
 * allow rewarded ads to grant a life/continue that affects gameplay continuity.
 * Connect it only to a compliant, optional bonus after its design is approved.
 */
(function initONREDPlaygamaBridge() {
    "use strict";

    const menu = document.getElementById("mainMenu");
    const MENU_BANNER_PLACEMENT = "menu_banner";
    let sdk = null;
    let initialized = false;
    let menuObserver = null;

    function isMainMenuVisible() {
        return Boolean(menu && !menu.classList.contains("hidden"));
    }

    function syncMenuBanner() {
        if (!initialized || !sdk || !sdk.advertisement) return;

        const ads = sdk.advertisement;

        if (isMainMenuVisible()) {
            if (ads.isBannerSupported) {
                ads.showBanner("bottom", MENU_BANNER_PLACEMENT);
            }
            return;
        }

        ads.hideBanner();
    }

    async function initialize() {
        sdk = window.bridge || (typeof bridge !== "undefined" ? bridge : null);

        if (!sdk || typeof sdk.initialize !== "function") {
            console.warn("[ON RED] Playgama Bridge SDK não encontrado. O jogo continuará normalmente.");
            return;
        }

        try {
            await sdk.initialize();
            initialized = true;

            if (menu && typeof MutationObserver !== "undefined") {
                menuObserver = new MutationObserver(syncMenuBanner);
                menuObserver.observe(menu, {
                    attributes: true,
                    attributeFilter: ["class"]
                });
            }

            if (sdk.EVENT_NAME && sdk.EVENT_NAME.BANNER_STATE_CHANGED &&
                sdk.advertisement && typeof sdk.advertisement.on === "function") {
                sdk.advertisement.on(
                    sdk.EVENT_NAME.BANNER_STATE_CHANGED,
                    function onBannerStateChanged(state) {
                        // hideBanner() ignores the LOADING state. If the player
                        // leaves the menu while loading, hide as soon as it appears.
                        if (!isMainMenuVisible() && state === "shown") {
                            sdk.advertisement.hideBanner();
                        }
                    }
                );
            }

            syncMenuBanner();
            window.ONREDPlaygama = {
                ready: true,
                get platformId() {
                    return sdk.platform ? sdk.platform.id : null;
                }
            };
        } catch (error) {
            console.warn("[ON RED] Falha ao inicializar Playgama Bridge. O jogo continuará normalmente.", error);
            window.ONREDPlaygama = { ready: false };
        }
    }

    window.ONREDPlaygama = {
        ready: false,
        initialize
    };

    initialize();
})();
