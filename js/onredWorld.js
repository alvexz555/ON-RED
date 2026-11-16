/*
 * ON RED
 * ONREDWorld — VIEWPORT + DPR, SEM ESCALA GLOBAL DE GAMEPLAY
 *
 * Mantem a area logica igual a viewport CSS (mundo = tela) e escala de
 * gameplay fixa em 1. O canvas usa DPR apenas para nitidez, sem alterar
 * tamanhos, velocidades, coordenadas ou dificuldade.
 *
 * Configuracao restaurada:
 * - escala de gameplay fixa: 1
 * - limite de obstaculos: 5
 * - intervalo de spawn: 1.8s
 * - dimensoes logicas acompanham a viewport
 */

(function (root) {
    "use strict";

    const REFERENCE = { width: 390, height: 844 };

    const OBSTACLE_CONFIG = {
        maxObstacles: 5,
        spawnInterval: 1.8
    };

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

    function resize() {
        readViewport();
        state.view.dpr = getDpr();
        state.view.scale = 1;
        state.view.offsetX = 0;
        state.view.offsetY = 0;
        state.world = {
            width: state.viewport.width,
            height: state.viewport.height
        };
        return { ...state.world };
    }

    function getWorld() {
        if (!state.world || !state.world.width || !state.world.height) {
            return resize();
        }
        return { width: state.world.width, height: state.world.height };
    }

    function getScale() {
        return 1;
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

    function getCanvasSize() {
        const dpr = getDpr();
        return {
            width: Math.round(state.viewport.width * dpr),
            height: Math.round(state.viewport.height * dpr),
            dpr,
            scale: 1
        };
    }

    function worldToScreen(point) {
        return {
            x: Number(point && point.x),
            y: Number(point && point.y)
        };
    }

    function screenToWorld(point) {
        return {
            x: Number(point && point.x),
            y: Number(point && point.y)
        };
    }

    function sizeToScreen(size) {
        return Number(size);
    }

    function sizeToWorld(size) {
        return Number(size);
    }

    function getObstacleDensity(worldWidth, worldHeight) {
        const width = Number(worldWidth) || 0;
        const height = Number(worldHeight) || 0;
        const area = width * height;
        const referenceArea = REFERENCE.width * REFERENCE.height;

        return {
            area,
            referenceArea,
            ratio: referenceArea > 0 ? Number((area / referenceArea).toFixed(6)) : 1,
            maxObstacles: OBSTACLE_CONFIG.maxObstacles,
            spawnInterval: OBSTACLE_CONFIG.spawnInterval,
            min: OBSTACLE_CONFIG.maxObstacles,
            max: OBSTACLE_CONFIG.maxObstacles
        };
    }

    function getObstacleDensityReference() {
        return {
            width: REFERENCE.width,
            height: REFERENCE.height,
            maxObstacles: OBSTACLE_CONFIG.maxObstacles,
            spawnInterval: OBSTACLE_CONFIG.spawnInterval
        };
    }

    function fit(profile, win) {
        const scope = (win && typeof win === "object")
            ? win
            : (typeof window !== "undefined" ? window : globalThis);
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
        getObstacleDensityReference,
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

    console.log("[ON RED] ONREDWorld carregado (escala fixa 1, DPR ativo).");
})(typeof window !== "undefined" ? window : globalThis);
