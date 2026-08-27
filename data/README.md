# Dados de mortalidade

`mortality-indexed.json` é a base bruta usada pelos gráficos do site (mesmos dados
do painel original, aninhados por índice — ver `dimensions` para resolver cada
índice ao rótulo correspondente).

Este arquivo não é servido ao navegador. `scripts/generate-mortality-data.ts`
o lê e separa cada tabela em `public/data/mortality/*.json`, para que cada
gráfico busque sob demanda só as tabelas de que precisa (nenhum gráfico carrega
o dataset inteiro). Rodar sempre que `mortality-indexed.json` for atualizado:

```
npm run data:generate
```
