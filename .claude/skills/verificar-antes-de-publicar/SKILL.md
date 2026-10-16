---
name: verificar-antes-de-publicar
description: Checagem completa do Raio-X da Fatura antes de commit, pull request ou release — npm test (lint, tipos, testes de lógica e de tela), faturas locais da pessoa, revisão visual e varredura de privacidade. Use ao terminar qualquer mudança ou quando pedirem para revisar, testar, publicar ou commitar.
---

# Verificar antes de publicar

Rode tudo na raiz do projeto e só declare pronto quando todos os itens passarem. Relate o resultado item a item.

## 1. HTML gerados atualizados

```bash
npm run montar
git status --short index.html exemplo.html
```
Se mudaram, entram no commit (nunca edite esses dois à mão). O CI falha se estiverem desatualizados.

## 2. Testes automáticos

```bash
npm test
```
Roda lint, tipos (`app/tipos.d.ts`), Vitest (`testes/unit`) e Playwright (`testes/tela`, 1280px e 390px). Tudo verde. Se falhar, corrija a causa, sem afrouxar o teste. Se a regra mudou de propósito, mude o teste junto e explique.

Mudança de comportamento sem teste novo? Escreva o teste. Bug corrigido sem teste que o reproduza? Escreva o teste.

## 3. Faturas e notas reais da pessoa (se houver, fora do repositório)

```bash
RX_FATURAS=../faturas npm run test:unit    # soma = total em cada fatura
RX_FATURAS=../faturas npm run test:tela    # lê todas pelo index.html, sem NaN/erros
```
Sem arquivos reais disponíveis, diga isso explicitamente em vez de pular em silêncio.

## 4. Olhar a tela

Os testes pegam erros, mas não feiura. Se mudou CSS ou layout, tire capturas com o Playwright (num script fora do repositório) e olhe com a ferramenta de leitura de imagens: texto cortado ou sobreposto, cards desalinhados, contraste no tema escuro, seções vazias sem explicação.

## 5. Privacidade (obrigatório)

```bash
git ls-files | grep -iE '\.(pdf|jpe?g|png|webp|heic|heif)$' && echo "PDF OU FOTO VERSIONADO!"
git ls-files | grep -iE '\.xml$' | grep -v '^testes/casos/notas/' && echo "XML FORA DOS CASOS FICTÍCIOS!"
git diff --cached | grep -nE '[0-9]{3}\.?[0-9]{3}\.?[0-9]{3}-?[0-9]{2}|\b[0-9]{4}[ .]?[0-9X]{4}[ .]?[0-9X]{4}[ .]?[0-9]{4}\b' && echo "Possível CPF ou cartão no diff"
```
Leia também o diff procurando nomes de pessoas, endereços ou trechos copiados de faturas ou notas reais. Isso vale especialmente para `testes/casos/`, que precisa ter só dados inventados, além de comentários, regex e `dados/exemplo.js`. `dados/exemplo.js` deve ser exatamente o que `python3 ferramentas/gerar-exemplo.py` gera.

## 6. Regras do projeto (revisão rápida do diff)

- Nada de `fetch`, `import`/`type="module"`, CDN ou URL externa em `app/` e nos HTML.
- Dados de fatura no DOM só por `textContent`/`d3.text()`; nenhum `innerHTML` com dados.
- Nenhum texto fixo sobre pessoa, banco ou loja no painel.
- Textos de interface em português do Brasil.
- `README.md`/`PLUGINS.md`/`CLAUDE.md` atualizados se mudou banco suportado, comando, contrato ou comportamento visível.

## Resultado

Responda com uma lista curta: ✓/✗ por item, o que falhou e o que foi corrigido.
