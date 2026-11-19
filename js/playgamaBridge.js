/* ON RED · Playgama Bridge integration */
(() => {
    "use strict";

    let bridge = null;
    let initialized = false;
    let rewardedResolver = null;

    function showMenuBanner() {
        if (!initialized || !bridge?.advertisement) return false;
        if (!bridge.advertisement.isBannerSupported) return false;

        try {
            bridge.advertisement.showBanner("bottom", "menu_banner");
            return true;
        } catch (error) {
            console.warn("[ON RED] Não foi possível exibir o banner:", error);
            return false;
        }
    }

    function hideMenuBanner() {
        if (!initialized || !bridge?.advertisement) return false;
        try {
            bridge.advertisement.hideBanner();
            return true;
        } catch (error) {
            console.warn("[ON RED] Não foi possível ocultar o banner:", error);
            return false;
        }
    }

    function isRewardedSupported() {
        return Boolean(
            initialized &&
            bridge?.advertisement &&
            bridge.advertisement.isRewardedSupported &&
            typeof bridge.advertisement.showRewarded === "function"
        );
    }

    function showRewarded(placement = "revive") {
        if (!isRewardedSupported()) {
            return Promise.resolve(false);
        }

        if (rewardedResolver) return Promise.resolve(false);

        return new Promise(resolve => {
            rewardedResolver = resolve;
            try {
                bridge.advertisement.showRewarded(placement);
            } catch (error) {
                console.warn("[ON RED] Falha ao solicitar anúncio recompensado:", error);
                const finish = rewardedResolver;
                rewardedResolver = null;
                finish(false);
            }
        });
    }

    async function initialize() {
        if (!window.bridge || typeof window.bridge.initialize !== "function") {
            console.info("[ON RED] Playgama Bridge indisponível neste ambiente.");
            return false;
        }

        bridge = window.bridge;

        try {
            await bridge.initialize();
            initialized = true;

            if (bridge.advertisement &&
                bridge.EVENT_NAME &&
                bridge.EVENT_NAME.REWARDED_STATE_CHANGED) {
                bridge.advertisement.on(
                    bridge.EVENT_NAME.REWARDED_STATE_CHANGED,
                    state => {
                        if (!rewardedResolver) return;

                        if (state === "rewarded") {
                            const finish = rewardedResolver;
                            rewardedResolver = null;
                            finish(true);
                        } else if (state === "closed" || state === "failed") {
                            const finish = rewardedResolver;
                            rewardedResolver = null;
                            finish(false);
                        }
                    }
                );
            }

            if (bridge.advertisement &&
                bridge.EVENT_NAME &&
                bridge.EVENT_NAME.BANNER_STATE_CHANGED) {
                bridge.advertisement.on(
                    bridge.EVENT_NAME.BANNER_STATE_CHANGED,
                    state => console.info("[ON RED] Banner:", state)
                );
            }

            const menu = document.getElementById("mainMenu");
            if (menu && !menu.classList.contains("hidden")) showMenuBanner();

            document.dispatchEvent(new Event("onred:bridge-ready"));
            console.info("[ON RED] Playgama Bridge inicializada.");
            return true;
        } catch (error) {
            initialized = false;
            console.warn("[ON RED] Falha ao inicializar Playgama Bridge:", error);
            return false;
        }
    }

    document.addEventListener("onred:menu-show", showMenuBanner);
    document.addEventListener("onred:menu-hide", hideMenuBanner);

    window.ONREDPlaygama = {
        initialize,
        showMenuBanner,
        hideMenuBanner,
        showRewarded,
        isRewardedSupported,
        isReady: () => initialized
    };

    initialize();
})();
