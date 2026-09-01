# Causa Mortis

Infográfico interativo sobre mortalidade no Brasil, construído com [Astro](https://astro.build). O site reúne dados oficiais de óbitos (SIM/DATASUS) e projeções populacionais (IBGE) em visualizações que permitem explorar a evolução das taxas, as principais causas de morte, a distribuição geográfica, a composição por idade e a pirâmide de mortalidade por sexo. Gráficos renderizados com [ECharts](https://echarts.apache.org/).

## Fontes dos dados

- **Óbitos:** SIM (Sistema de Informações sobre Mortalidade), microdados do Portal de Dados Abertos do SUS.
- **População:** IBGE, projeções revisão 2024.
- **Cobertura do SIM:** indicador DEM.4.02 da RIPSA.
- **Padronização:** NT nº 51/2025-CGIAE — direta, 18 faixas, população-padrão Brasil 2022.
- **Causas:** fichas MRT.3.01, MRT.4.01–04, MRT.5.02 e MRT.5.04.

Este painel tem finalidade didática e de divulgação. Para análise técnica e formulação de política pública, recomenda-se a extração dos dados diretamente no DataSUS e no IBGE, onde estão disponíveis os microdados completos, as revisões posteriores e as notas técnicas de cada base.
