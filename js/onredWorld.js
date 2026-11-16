/*
 * ON RED
 * ONREDWorld — ESCALA GLOBAL POR PERFIL DE PLATAFORMA
 *
 * O gameplay usa unidades logicas. A escala global e aplicada uma unica
 * vez no canvas, mantendo desenho, hitboxes, coordenadas e controles
 * sincronizados. O perfil mobile preserva a referencia 390x844.
 */

(function (root) {
    "use strict";

    const REFERENCE = { width: 390, height: 844 };
    const SCALE_PROFILES = {
        mobile: 1,
        desktop: 1.5,
        poki: 1.5
    };

    const OBSTACLE_CONFIG = {
        maxObstacles: 5,
        spawnInterval: 1.8
    };

    const state = {
        world: { width: 0, height: 0 },
        view: { scale: 1, offsetX: 0, offsetY: 0, dpr: 1 },
        viewport: { width: 0, height: 0 },
        platformOverride: null,
        platform: "mobile"
    };

    function readViewport() {
        const scope = typeof window !== "undefined" ? window : root;
        state.viewport.width = Number(scope.innerWidth) || 0;
        state.viewport.height = Number(scope.innerHeight) || 0;
        return { ...state.viewport };
    }

    function isKnownPlatform(value) {
        return Object.prototype.hasOwnProperty.call(SCALE_PROFILES, value);
    }

    function getPlatform() {
        if (state.platformOverride && isKnownPlatform(state.platformOverride)) {
            return state.platformOverride;
        }

        const scope = typeof window !== "undefined" ? window : root;
        const requested = scope && scope.ONRED_PLATFORM;
        if (isKnownPlatform(requested)) return requested;

        const nav = scope && scope.navigator;
        const hasTouch = !!(
            (nav && Number(nav.maxTouchPoints) > 0) ||
            (scope && "ontouchstart" in scope)
        );

        return hasTouch ? "mobile" : "desktop";
    }

    function getScale() {
        const platform = getPlatform();
        const scale = Number(SCALE_PROFILES[platform]);
        return Number.isFinite(scale) && scale > 0 ? scale : 1;
    }

    function setPlatform(platform) {
        if (!isKnownPlatform(platform)) return false;
        state.platformOverride = platform;
        resize();
        return true;
    }

    function setProfileScale(platform, scale) {
        const value = Number(scale);
        if (!isKnownPlatform(platform) || !Number.isFinite(value) || value <= 0) {
            return false;
        }
        SCALE_PROFILES[platform] = value;
        if (getPlatform() === platform) resize();
        return true;
    }

    function resize() {
        readViewport();
        state.platform = getPlatform();
        state.view.dpr = getDpr();
        state.view.scale = getScale();
        state.view.offsetX = 0;
        state.view.offsetY = 0;

        state.world = {
            width: state.viewport.width / state.view.scale,
            height: state.viewport.height / state.view.scale
        };

        return { ...state.world };
    }

    function getWorld() {
        if (!state.world || !state.world.width || !state.world.height) {
            return resize();
        }
        return { width: state.world.width, height: state.world.height };
    }

    function getScaleReference() {
        return { ...REFERENCE };
    }

    function getDpr() {
        const scope = typeof window !== "undefined" ? window : root;
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
            scale: getScale()
        };
    }

    function worldToScreen(point) {
        const scale = getScale();
        return {
            x: Number(point && point.x) * scale + state.view.offsetX,
            y: Number(point && point.y) * scale + state.view.offsetY
        };
    }

    function screenToWorld(point) {
        const scale = getScale();
        return {
            x: (Number(point && point.x) - state.view.offsetX) / scale,
            y: (Number(point && point.y) - state.view.offsetY) / scale
        };
    }

    function sizeToScreen(size) {
        return Number(size) * getScale();
    }

    function sizeToWorld(size) {
        return Number(size) / getScale();
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
            : (typeof window !== "undefined" ? window : root);
        const width = Number((scope && scope.innerWidth) || state.viewport.width || 0);
        const height = Number((scope && scope.innerHeight) || state.viewport.height || 0);
        const scale = isKnownPlatform(profile) ? Number(SCALE_PROFILES[profile]) : getScale();
        return { width: width / scale, height: height / scale };
    }

    const api = {
        state,
        profiles: SCALE_PROFILES,
        resize,
        getWorld,
        getScale,
        getScaleReference,
        getPlatform,
        setPlatform,
        setProfileScale,
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

    console.log("[ON RED] ONREDWorld carregado (escala global por plataforma).");
})(typeof window !== "undefined" ? window : globalThis);
