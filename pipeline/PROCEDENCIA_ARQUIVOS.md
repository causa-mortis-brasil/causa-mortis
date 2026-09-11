# Arquivos do SIM no Portal de Dados Abertos do SUS

**Sondagem:** 08/09/2026 · **145 arquivos vivos**, 1979–2026, 7,39 GB publicados.
Tabela completa em `arquivos_sim_datasus.csv`.

## 1. Onde ficam, e a armadilha do caminho

Os arquivos moraram em `SIM/<nome>` e foram movidos para prefixos por formato:
`SIM/csv/`, `SIM/json/` e `SIM/xml/`. **Nenhum caminho no prefixo raiz responde mais.**

A armadilha: o bucket não concede `s3:ListBucket`, e nesse caso o S3 responde
**403 AccessDenied para chave inexistente** — indistinguível de falta de permissão.
Pedir o caminho antigo devolve 403 com `Server: AmazonS3` e `x-amz-request-id`, o que
parece perda de acesso público e é apenas caminho errado. Um teste desfaz a ambiguidade:
pedir uma chave sabidamente inexistente; se ela também devolver 403, o código não
distingue os dois casos e a conclusão "fora do ar" não se sustenta.

## 2. Duas formas de endereço para o mesmo objeto

| Forma                                 | Exemplo                                                            | Observação                                                            |
| ------------------------------------- | ------------------------------------------------------------------ | --------------------------------------------------------------------- |
| _path-style_ (a que o portal publica) | `https://s3.sa-east-1.amazonaws.com/ckan.saude.gov.br/SIM/csv/...` | funciona no navegador, com HTTPS                                      |
| _virtual-hosted_                      | `http://ckan.saude.gov.br.s3.sa-east-1.amazonaws.com/SIM/csv/...`  | HTTPS falha: o certificado da AWS não cobre nome de bucket com pontos |

A tabela traz as duas em colunas separadas. Para download manual, use a primeira.

## 3. Cobertura por formato

| Formato | Arquivos | Anos                       |
| ------- | -------- | -------------------------- |
| CSV     | 49       | 1979–2026, **exceto 2022** |
| JSON    | 48       | 1979–2026                  |
| XML     | 48       | 1979–2026                  |

**2022 não tem variante CSV.** A variante JSON contém os fragmentos `DO22OPEN_*.json`.

## 4. O que a revisão usa, e por quê

| Ano       | Arquivo                           | Formato | Registros | vs TabNet                  |
| --------- | --------------------------------- | ------- | --------- | -------------------------- |
| 2000–2021 | `Mortalidade_Geral_AAAA_csv.zip`  | csv     | —         | exato, 84 recortes por ano |
| 2022      | `Mortalidade_Geral_2022_json.zip` | json    | 1.544.266 | exato, 84 recortes         |
| 2023      | `Mortalidade_Geral_2023_json.zip` | json    | 1.465.610 | exato, 84 recortes         |
| 2024      | `DO24OPEN_csv.zip`                | csv     | 1.532.015 | exato, 84 recortes         |
| 2025      | `DO25OPEN_csv.zip`                | csv     | 1.507.424 | −1,8%, nos 84 recortes     |

A coluna acima dizia "não verificado" para 2000, 2001, 2020 e 2021, e "—" para 2002–2019.
Estava **desatualizada**: foi escrita no momento do download, quando só os anos recentes
tinham sido conferidos. A conferência completa veio depois e cobre a série inteira —
26 anos × 28 localidades × 3 sexos = **2.184 recortes**, dos quais 2.100 idênticos ao
registro. Os 84 divergentes são todos de 2025, por instantâneo distinto. O detalhe está
em `crosscheck_tabnet_rev15.csv`, e a conferência por capítulo, em
`crosscheck_capitulos_rev15.csv`, cobre 2000–2024 com 18.892 de 18.900 idênticas.

Três escolhas não são óbvias e ficam registradas:

**2022 e 2023 vêm do JSON, não do CSV.** O CSV de 2023 que ainda existe tem 1.400.590
registros, **65.020 abaixo** do TabNet — é a publicação incompleta que já havíamos
rejeitado. O `DO23OPEN.csv` sumiu do bucket, mas a variante JSON de 2023 contém os
fragmentos `DO23OPEN_00001.json` a `DO23OPEN_00008.json`, com 1.465.610 registros,
igual ao TabNet ao registro. Mesmo arquivo, outro formato.

**2024 usa `DO24OPEN_csv.zip`**, que reproduz 1.532.015 — exato. O
`Mortalidade_Geral_2024_csv.zip` tem 1.527.369, 4.646 a menos.

**2025 usa `DO25OPEN_csv.zip`.** O `Mortalidade_Geral_2025_csv.zip` foi **republicado**
desde 18/08 — hash diferente — e hoje tem 937.033 registros, 38,9% abaixo do TabNet.
O `DO25OPEN` tem 1.507.424, 1,8% abaixo. Ano preliminar, ainda em consolidação.

## 5. Integridade

`sha256` está preenchido para os 29 arquivos baixados. Comparando com o manifesto de
18/08/2026: **23 dos 26 arquivos da série são byte-idênticos**. Mudaram apenas os três
anos recentes — 2022 e 2023 por troca de formato, 2025 por republicação. A série
histórica de 2000 a 2021 não foi alterada pela fonte em três semanas.

O transporte é HTTP e não é autenticado, então o hash é a compensação: qualquer
reprocessamento futuro deve conferir contra esta tabela antes de usar o arquivo.
