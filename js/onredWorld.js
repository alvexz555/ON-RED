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

    // Densidade centralizada de obstaculos por area logica da arena (ETAPA 4).
    // A dificuldade acompanha a area logica, nao a resolucao fisica nem o DPR.
    const OBSTACLE_DENSITY_REFERENCE = {
        width: 390,
        height: 844,
        maxObstacles: 5,
        spawnInterval: 1.8
    };

    // Limites coerentes: impedem crescimento descontrolado em telas largas
    // e arenas vazias em telas pequenas, sem alterar a referencia mobile.
    const OBSTACLE_DENSITY_MIN = 3;
    const OBSTACLE_DENSITY_MAX = 10;

    function clampDensity(value, min, max) {
        return Math.max(min, Math.min(max, value));
    }

    // Calcula a quantidade maxima de obstaculos simultaneos proporcional a
    // area logica da arena, referenciada ao mobile 390x844 (escala 1).
    function getObstacleDensity(worldWidth, worldHeight) {
        const width = Number(worldWidth) || 0;
        const height = Number(worldHeight) || 0;
        const area = width * height;
        const referenceArea =
            OBSTACLE_DENSITY_REFERENCE.width * OBSTACLE_DENSITY_REFERENCE.height;
        const ratio = referenceArea > 0 ? area / referenceArea : 1;
        const target = Math.round(
            OBSTACLE_DENSITY_REFERENCE.maxObstacles * ratio
        );
        const maxObstacles = clampDensity(
            target,
            OBSTACLE_DENSITY_MIN,
            OBSTACLE_DENSITY_MAX
        );
        // Intervalo de spawn adaptativo conforme a area logica da arena:
        // ajusta o intervalo proporcional ao limite de obstaculos simultaneos
        // suportado, mantendo a mesma taxa de chegada por unidade de area da
        // referencia mobile (390x844 = escala 1, 5 obstaculos / 1.8s).
        const spawnInterval = Number(
            (OBSTACLE_DENSITY_REFERENCE.spawnInterval * OBSTACLE_DENSITY_REFERENCE.maxObstacles) / maxObstacles
        );
        return {
            area,
            referenceArea,
            ratio: Number(ratio.toFixed(6)),
            maxObstacles,
            spawnInterval,
            min: OBSTACLE_DENSITY_MIN,
            max: OBSTACLE_DENSITY_MAX
        };
    }

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
        getObstacleDensity,
        getObstacleDensityReference: () => ({ ...OBSTACLE_DENSITY_REFERENCE }),
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
