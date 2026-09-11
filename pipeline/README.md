# Pipeline do `mortality-indexed.json` (rev 15)

Reconstrói o arquivo do zero a partir dos microdados do SIM e das projeções do IBGE.
Requer Python 3.11 com `pandas`, `numpy` e `pyarrow`, e R 4.5 com `jsonlite` e `data.table`.

```bash
python3 01_baixar.py            data/raw        # 26 anuais do SIM + planilha do IBGE (~2 GB)
sha256sum -c MANIFEST.sha256                    # confere os 27 insumos antes de processar
python3 02_ingerir.py           data/raw data/interim      # descompacta e converte em Parquet
python3 03_classificar.py                                  # CID-10 -> grupo, subgrupo, meio
python3 04_agregar.py                                      # 28 locais x 3 sexos x 26 anos
python3 05_montar_indexed.py    agregados.json ibge.parquet modelo.json rev14.json
python3 06_correcoes_rev15.py   rev14.json rev15.json --parquet data/interim/SIM
Rscript -e 'source("07a_atomizar.R"); source("07b_exportar.R"); source("08_assercoes.R");
            Z <- ler_indexed("rev15.json"); stopifnot(all(verificar(Z, gate=TRUE)$violacoes==0
              | verificar(Z)$tipo=="alerta")); exportar_indexed(Z, "mortality-indexed.json")'
```

O passo 05 usa um `mortality-indexed.json` existente como molde: dele vêm `dimensions` e a
tabela `coverage`, que é da RIPSA e não do SIM. O passo 07b é quem define a forma canônica do
arquivo — o 06 grava um intermediário com `6.0` onde o exportador grava `6`.

Cada etapa é verificável: 05 seguido de 07b reproduz a rev 14 byte a byte a partir dos
agregados, e 06 seguido de 07b reproduz a rev 15. O 08 separa identidades, que têm de fechar
exatamente, de alertas, que só apontam onde olhar.
