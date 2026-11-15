/*
 * ON RED
 * ONREDWorld — CAMADA CENTRAL DO MUNDO RESPONSIVO (ETAPAS 1, 2 E 3)
 * Wrapper do mundo: centraliza mundo logico, escala, conversões, DPR e leitura de viewport.
 *
 * Etapa 1: mundo = janela; comportamento atual preservado (mundo == tela, escala 1).
 * Etapa 2: DPR suportado — mundo logico, dims visuais da viewport e resolucao fisica
 *          do canvas separadas.
 * Etapa 3: ESCALA CENTRAL — referencia mobile aprovada (390x844, escala 1).
 *          A escala e uniforme (menor razao entre viewport e referencia), entao
 *          nada e deformado. O mundo logico passa a ser viewport / escala: em
 *          qualquer formato a viewport e coberta e a altura logica fica estavel.
 *          DPR e escala sao independentes e se combinam UMA unica vez no
 *          transform do canvas (pixelRatio = dpr * escala).
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

    function scope() {
        return typeof window !== "undefined" ? window : globalThis;
    }

    function readViewport() {
        const view = scope();
        state.viewport.width = Number(view.innerWidth) || 0;
        state.viewport.height = Number(view.innerHeight) || 0;
        return { ...state.viewport };
    }

    // Escala central: uniforme, sem deformacao. Usa a menor razao em relacao
    // a referencia mobile para que a viewport inteira seja coberta.
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

        const scale = computeScale(
            state.viewport.width,
            state.viewport.height
        );

        state.view.scale = scale;
        state.view.offsetX = 0;
        state.view.offsetY = 0;

        state.world = {
            width: state.viewport.width / scale,
            height: state.viewport.height / scale
        };

        return { ...state.world };
    }

    function getWorld() {
        if (!state.world || !state.world.width || !state.world.height) {
            return resize();
        }
        return { ...state.world };
    }

    function getScale() {
        return state.view.scale;
    }

    function getScaleReference() {
        return { ...REFERENCE };
    }

    function getDpr() {
        const dpr = Number(scope().devicePixelRatio) || 1;
        state.view.dpr = dpr;
        return dpr;
    }

    // Fator unico de renderizacao: mundo logico -> pixels fisicos do canvas.
    // Deve ser aplicado UMA vez (ctx.setTransform); nunca somar com DPR de novo.
    function getPixelRatio() {
        return getDpr() * state.view.scale;
    }

    // Tamanho visual (CSS px) do mundo na tela. Como o mundo cobre a
    // viewport, coincide com a viewport.
    function getCssSize() {
        const viewport = readViewport();
        return { width: viewport.width, height: viewport.height };
    }

    // Resolucao fisica do canvas: viewport x DPR.
    function getCanvasSize() {
        const viewport = readViewport();
        const dpr = getDpr();
        return {
            width: Math.round(viewport.width * dpr),
            height: Math.round(viewport.height * dpr),
            dpr: dpr,
            scale: state.view.scale,
            pixelRatio: dpr * state.view.scale
        };
    }

    function worldToScreen(point) {
        const scale = state.view.scale;
        return {
            x: (Number(point && point.x) + state.view.offsetX) * scale,
            y: (Number(point && point.y) + state.view.offsetY) * scale
        };
    }

    // Converte entrada de tela (CSS) para o mundo logico. `rect` e opcional:
    // quando o canvas tem deslocamento/zoom CSS, o chamador passa o rect.
    function screenToWorld(point, rect) {
        const scale = state.view.scale || 1;
        const left = Number(rect && rect.left) || 0;
        const top = Number(rect && rect.top) || 0;
        return {
            x: ((Number(point && point.x) || 0) - left) / scale - state.view.offsetX,
            y: ((Number(point && point.y) || 0) - top) / scale - state.view.offsetY
        };
    }

    function sizeToScreen(size) {
        return Number(size) * state.view.scale;
    }

    function sizeToWorld(size) {
        return Number(size) / (state.view.scale || 1);
    }

    function fit(profile, win) {
        const view = (win && typeof win === "object") ? win : scope();
        const width = Number((view && view.innerWidth) || state.viewport.width || 0);
        const height = Number((view && view.innerHeight) || state.viewport.height || 0);
        return { width, height };
    }

    const api = {
        state,
        resize,
        getWorld,
        computeScale,
        getScale,
        getScaleReference,
        getDpr,
        getPixelRatio,
        getCssSize,
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
