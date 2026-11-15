/*
 * ON RED
 * ONREDWorld — CAMADA CENTRAL DO MUNDO RESPONSIVO (ETAPAS 1, 2 E 3)
 * Wrapper do mundo: centraliza mundo logico, escala, conversões, DPR e leitura de viewport.
 *
 * Etapa 1: mundo = janela; comportamento atual preservado (mundo == tela, escala 1).
 * Etapa 2: DPR suportado — mundo logico, dims visuais da viewport e resolucao fisica do canvas separadas.
 * Etapa 3: ESCALA CENTRAL — o mundo logico usa a experiencia mobile aprovada como
 *          referencia (390x844 = escala 1); viewports maiores/menores recebem uma
 *          escala uniforme (sem deformar) e o mundo logico se ajusta para cobrir
 *          a viewport inteira. DPR e escala central sao independentes e se
 *          combinam uma unica vez no transform do canvas (dpr * escala).
 * Etapas seguintes: densidade por area (4), expansao desktop (5),
 * perfis DISPLAY_PROFILES (6), audio (7), platform adapter (8).
 */

(function (root) {
    "use strict";

    // Referencia obrigatoria: experiencia mobile aprovada (escala 1).
    const REFERENCE = { width: 390, height: 844 };

    const state = {
        world: { width: 0, height: 0 },
        view: { scale: 1, offsetX: 0, offsetY: 0, dpr: 1 },
        viewport: { width: 0, height: 0 }
    };

    function readViewport() {
        const scope = typeof window !== "undefined" ? window : globalThis;
        state.viewport.width = Number(scope.innerWidth) || 0;
        state.viewport.height = Number(scope.innerHeight) || 0;
        return { ...state.viewport };
    }

    // Escala central: uniforme, preserva proporcoes e usa a menor dimensao
    // relativa a referencia — a viewport inteira fica coberta, sem letra.
    function computeScale(viewportWidth, viewportHeight) {
        if (!(viewportWidth > 0) || !(viewportHeight > 0)) return 1;
        return Math.min(
            viewportWidth / REFERENCE.width,
            viewportHeight / REFERENCE.height
        );
    }

    function resize() {
        readViewport();
        state.view.dpr = getDpr();
        const scale = computeScale(state.viewport.width, state.viewport.height);
        state.view.scale = scale;
        state.view.offsetX = 0;
        state.view.offsetY = 0;
        state.world = {
            width: state.viewport.width / scale,
            height: state.viewport.height / scale
        };
        return state.world;
    }

    function getWorld() {
        if (!state.world || !state.world.width || !state.world.height) {
            return resize();
        }
        return { width: state.world.width, height: state.world.height };
    }

    function getScale() {
        return state.view.scale;
    }

    function getScaleReference() {
        return { ...REFERENCE };
    }

    function getDpr() {
        const scope = typeof window !== "undefined" ? window : globalThis;
        const dpr = Number(scope.devicePixelRatio) || 1;
        state.view.dpr = dpr;
        return dpr;
    }

    // Resolucao fisica do canvas: viewport (mundo x escala) x DPR.
    // O transform do contexto aplica dpr * escala UMA vez (em main.js).
    function getCanvasSize() {
        const dpr = getDpr();
        return {
            width: Math.round(state.viewport.width * dpr),
            height: Math.round(state.viewport.height * dpr),
            dpr: dpr,
            scale: state.view.scale
        };
    }

    function worldToScreen(point) {
        const scale = state.view.scale;
        const x = (Number(point && point.x) + state.view.offsetX) * scale;
        const y = (Number(point && point.y) + state.view.offsetY) * scale;
        return { x, y };
    }

    function screenToWorld(point) {
        const scale = state.view.scale || 1;
        const x = (Number(point && point.x) - state.view.offsetX) / scale;
        const y = (Number(point && point.y) - state.view.offsetY) / scale;
        return { x, y };
    }

    function sizeToScreen(size) {
        return Number(size) * state.view.scale;
    }

    function sizeToWorld(size) {
        return Number(size) / (state.view.scale || 1);
    }

    function fit(profile, win) {
        const scope = (win && typeof win === "object") ? win : (typeof window !== "undefined" ? window : globalThis);
        const width = Number((scope && scope.innerWidth) || state.viewport.width || 0);
        const height = Number((scope && scope.innerHeight) || state.viewport.height || 0);
        return { width, height };
    }

    const api = {
        state,
        resize,
        getWorld,
        getScale,
        getScaleReference,
        getDpr,
        getCanvasSize,
        worldToScreen,
        screenToWorld,
        sizeToScreen,
        sizeToWorld,
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
