/*
 * ON RED · Playgama Bridge integration
 *
 * Initializes the Bridge without blocking gameplay, manages the menu banner,
 * and exposes a rewarded-video promise. The game grants the revive only after
 * the Bridge reports the "rewarded" state.
 */
(function initONREDPlaygamaBridge() {
    "use strict";

    const menu = document.getElementById("mainMenu");
    const MENU_BANNER_PLACEMENT = "menu_banner";
    let sdk = null;
    let initialized = false;
    let pendingReward = null;

    function isMainMenuVisible() {
        return Boolean(menu && !menu.classList.contains("hidden"));
    }

    function syncMenuBanner() {
        if (!initialized || !sdk || !sdk.advertisement) return;
        const ads = sdk.advertisement;

        if (isMainMenuVisible()) {
            if (ads.isBannerSupported && typeof ads.showBanner === "function") {
                ads.showBanner("bottom", MENU_BANNER_PLACEMENT);
            }
        } else if (typeof ads.hideBanner === "function") {
            ads.hideBanner();
        }
    }

    function finishRewardRequest(rewarded) {
        if (!pendingReward) return;
        const resolve = pendingReward.resolve;
        clearTimeout(pendingReward.timeout);
        pendingReward = null;
        resolve(Boolean(rewarded));
    }

    function handleRewardedState(state) {
        if (!pendingReward) return;

        if (state === "rewarded") {
            finishRewardRequest(true);
        } else if (state === "closed" || state === "failed") {
            finishRewardRequest(false);
        }
    }

    function showRewarded(placement) {
        const ads = sdk && sdk.advertisement;
        if (!initialized || !ads || !ads.isRewardedSupported ||
            typeof ads.showRewarded !== "function" || pendingReward) {
            return Promise.resolve(false);
        }

        return new Promise(resolve => {
            const timeout = setTimeout(() => finishRewardRequest(false), 45000);
            pendingReward = { resolve, timeout };

            try {
                ads.showRewarded(placement || "revive");
            } catch (error) {
                console.warn("[ON RED] Erro ao solicitar vídeo recompensado.", error);
                finishRewardRequest(false);
            }
        });
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
                const observer = new MutationObserver(syncMenuBanner);
                observer.observe(menu, {
                    attributes: true,
                    attributeFilter: ["class"]
                });
            }

            const ads = sdk.advertisement;
            if (sdk.EVENT_NAME && sdk.EVENT_NAME.BANNER_STATE_CHANGED &&
                ads && typeof ads.on === "function") {
                ads.on(sdk.EVENT_NAME.BANNER_STATE_CHANGED, state => {
                    if (!isMainMenuVisible() && state === "shown" &&
                        typeof ads.hideBanner === "function") {
                        ads.hideBanner();
                    }
                });
            }

            if (sdk.EVENT_NAME && sdk.EVENT_NAME.REWARDED_STATE_CHANGED &&
                ads && typeof ads.on === "function") {
                ads.on(sdk.EVENT_NAME.REWARDED_STATE_CHANGED, handleRewardedState);
            }

            window.ONREDPlaygama = {
                ready: true,
                get platformId() {
                    return sdk.platform ? sdk.platform.id : null;
                },
                get rewardedSupported() {
                    return Boolean(sdk.advertisement && sdk.advertisement.isRewardedSupported);
                },
                showRewarded
            };

            syncMenuBanner();
        } catch (error) {
            console.warn("[ON RED] Falha ao inicializar Playgama Bridge. O jogo continuará normalmente.", error);
            window.ONREDPlaygama = { ready: false, rewardedSupported: false };
        }
    }

    window.ONREDPlaygama = {
        ready: false,
        rewardedSupported: false,
        initialize
    };

    initialize();
})();
