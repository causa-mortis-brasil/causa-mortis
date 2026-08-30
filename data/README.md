# Dados de mortalidade

`mortality-indexed.json` é a base bruta usada pelos gráficos do site (mesmos dados
do painel original, aninhados por índice — ver `dimensions` para resolver cada
índice ao rótulo correspondente).

`br-states-simplified.geojson` é a malha dos estados usada pelo mapa do site,
simplificada uma vez a partir de `public/data/geo/br-states.geojson` (mantida
intacta para a seção de download) com:

```
npx mapshaper public/data/geo/br-states.geojson \
  -simplify weighted 5% keep-shapes \
  -clean \
  -o data/br-states-simplified.geojson format=geojson precision=0.0001
```

Regenere esse arquivo só se a malha original mudar — não faz parte do
`npm run data:generate` de rotina.

Nenhum desses arquivos-fonte é servido ao navegador. `scripts/generate-mortality-data.ts`
os lê e gera, em `public/data/mortality/`:

- as tabelas completas (`*.json`/`*.csv`, todos os territórios juntos), usadas
  pela seção de download do site;
- fatias por território em `by-location/<versão>/<tabela>/<território>.json`,
  usadas pelos gráficos que só olham para o território ativo no filtro (todos
  menos o mapa, que precisa comparar todos os territórios ao mesmo tempo).

O `<versão>` é um hash do conteúdo de `mortality-indexed.json`, o que permite
cachear essas fatias de forma imutável no navegador sem risco de servir dado
desatualizado após uma nova geração. O mesmo vale para a cópia versionada do
geojson simplificado em `public/data/geo/versioned/<hash>/`.

`src/lib/mortality/data-manifest.json` guarda a versão atual e é lido pelo
código do site para montar essas URLs — não editar à mão.

Rodar sempre que `mortality-indexed.json` for atualizado:

```
npm run data:generate
```
