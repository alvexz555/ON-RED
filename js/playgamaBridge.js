/*
 * ON RED · Playgama Bridge integration
 *
 * Sticky banner: main menu only.
 * Interstitial: Game Over, a natural break after the run ends.
 * Rewarded ads are intentionally not configured for revives/lives.
 */
(function initONREDPlaygamaBridge() {
    "use strict";

    const menu = document.getElementById("mainMenu");
    const MENU_BANNER_PLACEMENT = "menu_banner";
    const INTERSTITIAL_MIN_DELAY_SECONDS = 90;
    let sdk = null;
    let initialized = false;
    let menuObserver = null;
    let interstitialPending = false;

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

    function showInterstitialAtNaturalBreak() {
        if (!initialized || !sdk || !sdk.advertisement) return false;

        const ads = sdk.advertisement;
        if (!ads.isInterstitialSupported || interstitialPending) return false;

        interstitialPending = true;
        if (window.ONREDAudio && typeof window.ONREDAudio.pauseEffects === "function") {
            window.ONREDAudio.pauseEffects();
        }

        try {
            ads.showInterstitial();
            return true;
        } catch (error) {
            interstitialPending = false;
            if (window.ONREDAudio && typeof window.ONREDAudio.resumeEffects === "function") {
                window.ONREDAudio.resumeEffects();
            }
            console.warn("[ON RED] Não foi possível exibir o intersticial. A partida continuará normalmente.", error);
            return false;
        }
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

            const ads = sdk.advertisement;
            if (ads && typeof ads.setMinimumDelayBetweenInterstitial === "function") {
                ads.setMinimumDelayBetweenInterstitial(INTERSTITIAL_MIN_DELAY_SECONDS);
            }

            if (menu && typeof MutationObserver !== "undefined") {
                menuObserver = new MutationObserver(syncMenuBanner);
                menuObserver.observe(menu, {
                    attributes: true,
                    attributeFilter: ["class"]
                });
            }

            if (sdk.EVENT_NAME && ads && typeof ads.on === "function") {
                if (sdk.EVENT_NAME.BANNER_STATE_CHANGED) {
                    ads.on(sdk.EVENT_NAME.BANNER_STATE_CHANGED, function onBannerStateChanged(state) {
                        if (!isMainMenuVisible() && state === "shown") {
                            ads.hideBanner();
                        }
                    });
                }

                if (sdk.EVENT_NAME.INTERSTITIAL_STATE_CHANGED) {
                    ads.on(sdk.EVENT_NAME.INTERSTITIAL_STATE_CHANGED, function onInterstitialStateChanged(state) {
                        if (state === "closed" || state === "failed") {
                            interstitialPending = false;
                            if (window.ONREDAudio && typeof window.ONREDAudio.resumeEffects === "function") {
                                window.ONREDAudio.resumeEffects();
                            }
                        }
                    });
                }
            }

            syncMenuBanner();
            window.ONREDPlaygama = {
                ready: true,
                showInterstitialAtNaturalBreak,
                get platformId() {
                    return sdk.platform ? sdk.platform.id : null;
                }
            };
        } catch (error) {
            console.warn("[ON RED] Falha ao inicializar Playgama Bridge. O jogo continuará normalmente.", error);
            window.ONREDPlaygama = { ready: false, showInterstitialAtNaturalBreak: () => false };
        }
    }

    window.ONREDPlaygama = {
        ready: false,
        initialize,
        showInterstitialAtNaturalBreak: () => false
    };

    initialize();
})();
