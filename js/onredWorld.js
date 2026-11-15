/*
 * ON RED
 * ONREDWorld — CAMADA CENTRAL DO MUNDO RESPONSIVO (ETAPA 1)
 * Wrapper do mundo: centraliza mundo logico, escala, conversões e leitura de viewport.
 *
 * Etapa 1: mundo = janela; comportamento atual preservado (mundo == tela, escala 1).
 * Etapas seguintes: DPR (2), escala global central (3), densidade por area (4),
 * expansao desktop (5), perfis DISPLAY_PROFILES (6), audio (7), platform adapter (8).
 */

(function (root) {
    "use strict";

    const state = {
        world: { width: 0, height: 0 },
        view: { scale: 1, offsetX: 0, offsetY: 0, dpr: 1 }
    };

    function readWindow() {
        const scope = typeof window !== "undefined" ? window : globalThis;
        const width = Number(scope.innerWidth) || 0;
        const height = Number(scope.innerHeight) || 0;
        state.world = { width, height };
        return state.world;
    }

    function resize() {
        return readWindow();
    }

    function getWorld() {
        if (!state.world || !state.world.width || !state.world.height) {
            return readWindow();
        }
        return { width: state.world.width, height: state.world.height };
    }

    function worldToScreen(point) {
        const x = Number(point && point.x) + state.view.offsetX;
        const y = Number(point && point.y) + state.view.offsetY;
        return { x, y };
    }

    function screenToWorld(point) {
        const x = Number(point && point.x) - state.view.offsetX;
        const y = Number(point && point.y) - state.view.offsetY;
        return { x, y };
    }

    function fit(profile, win) {
        const scope = (win && typeof win === "object") ? win : (typeof window !== "undefined" ? window : globalThis);
        const width = Number((scope && scope.innerWidth) || state.world.width || 0);
        const height = Number((scope && scope.innerHeight) || state.world.height || 0);
        return { width, height };
    }

    const api = {
        state,
        resize,
        getWorld,
        worldToScreen,
        screenToWorld,
        fit
    };

    if (typeof module !== "undefined" && module.exports) {
        module.exports = api;
    }
    if (root) {
        root.ONREDWorld = api;
    }

    console.log("[ON RED] ONREDWorld carregado.");
})(typeof window !== "undefined" ? window : globalThis);
