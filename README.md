# ON RED

**ON RED** é um jogo arcade de sobrevivência desenvolvido em HTML5, CSS e JavaScript puro, com renderização Canvas 2D.

## Executar

O projeto é estático. Sirva a raiz do repositório por HTTP/HTTPS ou publique no GitHub Pages. Abra `index.html` para iniciar o jogo.

## Estrutura

- `index.html`: interface principal e ordem de carregamento dos sistemas.
- `css/`: estilos da gameplay e dos menus.
- `js/`: motor do jogo, controles, física, colisões, vida, obstáculos, MERGE, Perfect Timing, Ping Pong, Boss, áudio e mundo responsivo.
- `assets/audio/music/`: trilhas de gameplay e Boss.
- `assets/audio/sfx/`: efeitos sonoros.
- `tests/`: testes automatizados dos sistemas.
- `.github/workflows/`: publicação no GitHub Pages e validações automatizadas.

## Testes

Os testes usam Node.js (versão 20) e o runner nativo:

```bash
node --test tests/*.test.js
```

A checagem de sintaxe dos módulos principais também é executada pelo GitHub Actions.

## Publicação

O workflow `Deploy ON RED to GitHub Pages` publica o conteúdo da raiz do repositório quando há push nas branches configuradas ou execução manual.

## Estado do projeto

Versão pública da Fase 1. A Fase 2 permanece indicada no jogo como atualização futura.

## Áudio

Os arquivos de áudio utilizados pelo jogo estão em `assets/audio/`. O mapeamento dos arquivos e seus eventos fica em `js/audio.js`.
