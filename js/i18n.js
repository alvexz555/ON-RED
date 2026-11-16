/*
 * ON RED · INTERNATIONALIZATION
 * Idiomas disponíveis: Português (Brasil) e English.
 * A tradução atua somente na interface e não altera a lógica do jogo.
 */
(() => {
    "use strict";

    const STORAGE_KEY = "onRedLanguage";
    const translations = {
        "ARCADE SURVIVAL · TESTE SEUS LIMITES": "ARCADE SURVIVAL · TEST YOUR LIMITS",
        "INICIAR JOGO": "START GAME",
        "FASES": "PHASES",
        "RECORDES": "RECORDS",
        "INSTRUÇÕES E CONTROLES": "INSTRUCTIONS & CONTROLS",
        "CONFIGURAÇÕES": "SETTINGS",
        "SEU RECORDE": "YOUR BEST",
        "PROGRESSÃO": "PROGRESSION",
        "SELECIONE UMA FASE": "SELECT A PHASE",
        "FASE 01": "PHASE 01",
        "Sobreviva, domine os sistemas e enfrente o Boss.": "Survive, master the systems, and face the Boss.",
        "DISPONÍVEL": "AVAILABLE",
        "JOGAR FASE 1": "PLAY PHASE 1",
        "FASE 02": "PHASE 02",
        "EM DESENVOLVIMENTO": "IN DEVELOPMENT",
        "Novos perigos e mecânicas estão sendo preparados.": "New dangers and mechanics are in the works.",
        "ATUALIZAÇÕES EM BREVE": "COMING SOON",
        "As fases futuras serão liberadas por atualização.": "Future phases will be released in updates.",
        "VOLTAR": "BACK",
        "DESEMPENHO": "PERFORMANCE",
        "MELHOR PONTUAÇÃO": "HIGH SCORE",
        "Recorde pessoal salvo neste dispositivo": "Personal best saved on this device",
        "RANKING MUNDIAL": "GLOBAL LEADERBOARD",
        "EM BREVE": "COMING SOON",
        "O placar online será adicionado em uma atualização futura.": "Online leaderboards will be added in a future update.",
        "APRENDA A JOGAR": "HOW TO PLAY",
        "CONTROLES": "CONTROLS",
        "COMPUTADOR": "DESKTOP",
        "Movimentar o jogador": "Move the player",
        "Movimentar (alternativa)": "Move (alternative)",
        "Para interagir com mecânicas do jogo.": "Use to interact with game mechanics.",
        "Pausar / continuar": "Pause / resume",
        "CELULAR": "MOBILE",
        "Use o joystick virtual para movimentar.": "Use the virtual joystick to move.",
        "Toque no botão Ready para interagir com mecânicas do jogo.": "Tap the Ready button to interact with game mechanics.",
        "Use o botão no canto superior para pausar.": "Use the button in the top corner to pause.",
        "Dica: sobreviva, evite os obstáculos e use o Perfect Timing no momento certo.": "Tip: survive, avoid obstacles, and use Perfect Timing at the right moment.",
        "PREFERÊNCIAS": "PREFERENCES",
        "VOLUME GERAL": "MASTER VOLUME",
        "Preferência salva neste dispositivo.": "Preference saved on this device.",
        "MUDO": "MUTE",
        "MÁXIMO": "MAX",
        "POSIÇÃO DO ANALÓGICO": "JOYSTICK POSITION",
        "Escolha o lado do controle na tela.": "Choose which side of the screen the joystick appears on.",
        "ESQUERDO": "LEFT",
        "DIREITO": "RIGHT",
        "O controle já salva seu nível de volume. Os efeitos sonoros do jogo ainda serão integrados.": "Your volume setting is saved on this device. Game sound effects are still being integrated.",
        "PARTIDA PAUSADA": "GAME PAUSED",
        "CONTINUAR": "RESUME",
        "REINICIAR": "RESTART",
        "MENU PRINCIPAL": "MAIN MENU",
        "P / ESC PARA CONTINUAR": "P / ESC TO RESUME",
        "SURVIVAL TERMINATED": "SURVIVAL TERMINATED",
        "YOUR RUN HAS ENDED": "YOUR RUN HAS ENDED",
        "CONTINUAÇÃO DISPONÍVEL": "REVIVE AVAILABLE",
        "Duas chances por partida. A primeira está disponível desde o início; a segunda é desbloqueada ao derrotar o Boss. Você retorna com 1 vida e 50 HP, mantendo pontos e progresso.": "Two revives per run. The first is available from the start; the second unlocks after defeating the Boss. Return with 1 life and 50 HP while keeping your score and progress.",
        "REVIVER GRATUITAMENTE": "FREE REVIVE",
        "REVIVER · 2ª CHANCE": "REVIVE · 2ND CHANCE",
        "REVIVE FREE": "FREE REVIVE",
        "CONTINUAÇÃO UTILIZADA · FIM DE JOGO": "REVIVE USED · GAME OVER",
        "AS DUAS CONTINUAÇÕES FORAM UTILIZADAS · FIM DE JOGO": "BOTH REVIVES USED · GAME OVER",
        "ENCERRAR PARTIDA": "END RUN",
        "MODO SOBREVIVÊNCIA INFINITA": "ENDLESS SURVIVAL MODE",
        "VOCÊ SOBREVIVEU.": "YOU SURVIVED.",
        "MAS ISSO NÃO ACABOU.": "BUT THIS IS NOT OVER.",
        "ATÉ ONDE VOCÊ CHEGA?.": "HOW FAR CAN YOU GO?",
        "Pausar partida": "Pause game",
        "Pausar (P ou Esc)": "Pause (P or Esc)"
    };
    const reverse = Object.fromEntries(Object.entries(translations).map(([pt, en]) => [en, pt]));
    let language = "pt-BR";
    let observer = null;

    function readLanguage() {
        try {
            return localStorage.getItem(STORAGE_KEY) === "en" ? "en" : "pt-BR";
        } catch (error) {
            return "pt-BR";
        }
    }

    function translateValue(value) {
        const trimmed = value.trim();
        if (!trimmed) return value;
        const source = language === "en" ? (reverse[trimmed] || trimmed) : (translations[trimmed] ? trimmed : (reverse[trimmed] || trimmed));
        const translated = language === "en" ? (translations[source] || source) : source;
        if (translated === trimmed) return value;
        const leading = value.match(/^\s*/)?.[0] || "";
        const trailing = value.match(/\s*$/)?.[0] || "";
        return leading + translated + trailing;
    }

    function translateNode(node) {
        if (node.nodeType === Node.TEXT_NODE) {
            const next = translateValue(node.nodeValue || "");
            if (next !== node.nodeValue) node.nodeValue = next;
            return;
        }
        if (node.nodeType !== Node.ELEMENT_NODE) return;
        if (node.matches("script, style, textarea, input")) return;
        for (const attribute of ["aria-label", "title", "data-text"]) {
            if (node.hasAttribute(attribute)) {
                const current = node.getAttribute(attribute);
                const next = translateValue(current);
                if (next !== current) node.setAttribute(attribute, next);
            }
        }
        for (const child of node.childNodes) translateNode(child);
    }

    function apply(nextLanguage) {
        language = nextLanguage === "en" ? "en" : "pt-BR";
        document.documentElement.lang = language;
        document.title = "ON RED";
        translateNode(document.body);
        const selector = document.getElementById("languageSelect");
        if (selector) selector.value = language;
        try {
            localStorage.setItem(STORAGE_KEY, language === "en" ? "en" : "pt-BR");
        } catch (error) {
            console.warn("[ON RED] Could not save language preference.", error);
        }
        window.dispatchEvent(new CustomEvent("onred:language-change", { detail: { language } }));
    }

    function initialize() {
        const selector = document.getElementById("languageSelect");
        if (selector) selector.addEventListener("change", event => apply(event.target.value));
        apply(readLanguage());
        if (observer) observer.disconnect();
        observer = new MutationObserver(records => {
            for (const record of records) {
                if (record.type === "characterData") translateNode(record.target);
                else record.addedNodes.forEach(translateNode);
                if (record.type === "attributes") translateNode(record.target);
            }
        });
        observer.observe(document.body, {
            subtree: true,
            childList: true,
            characterData: true,
            attributes: true,
            attributeFilter: ["aria-label", "title", "data-text"]
        });
    }

    window.ONREDLanguage = {
        get: () => language,
        set: apply,
        translate: value => translateValue(String(value))
    };

    initialize();
})();
