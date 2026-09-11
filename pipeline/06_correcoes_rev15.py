# -*- coding: utf-8 -*-
"""Aplica as duas correções de dado da rev 15 sobre um mortality-indexed.json rev 14.

    python3 06_correcoes_rev15.py <rev14.json> <saida.json> [--parquet DIR]

CORREÇÃO 1 — lesão autoprovocada volta ao denominador de 5 anos e mais
A ficha MRT.4.02 mede a taxa sobre a população de 5 anos e mais; a rev 14 usava
população total e por isso saía 8,03 em BR/Ambos/2023 contra os 8,58 publicados.

O numerador merece atenção. A regra escrita pedia "óbitos com idade >= 5", e ao pé
da letra isso descarta também os de IDADE IGNORADA, que não são poucos: 2.558 na
série. Fazendo assim, BR/Ambos/2023 dá 8,57 — não os 8,58 da ficha nem da rev 13.
O que reproduz o valor publicado é excluir apenas os óbitos abaixo de 5 anos e
manter os de idade ignorada, que é também a convenção de toda taxa bruta deste
arquivo: numerador = total do recorte. Óbitos abaixo de 5 anos nessa causa são 48
em toda a série, em 34 recortes — poucos, mas não zero, então a subtração importa.

A padronizada usa só idade conhecida, por construção, com pesos e população
restritos às 16 faixas de 5+.

Os outros quatro tipos de causa externa continuam com população total.

CORREÇÃO 2 — neoplasias com sexo incompatível com o código
O SIM tem registros de C61 (próstata) com sexo feminino e C53 (colo de útero) com
sexo masculino. A rev 14 anulava a célula inteira nesses estratos, e com isso os
registros sumiam da partição: em 20 recortes a soma dos subgrupos ficava abaixo do
capítulo II, por 1 a 25 óbitos.

A célula específica continua null — exibir "Próstata" em Mulheres seria pior que a
lacuna. Mas os registros passam a ser somados a "Demais localizações" do mesmo
estrato, o que fecha a partição sem inventar categoria nem descartar óbito.

Isto exige os microdados: a realocação precisa da distribuição etária dos
registros, que o JSON não guarda por código de causa. Sem --parquet o script
recusa a correção 2 em vez de estimá-la.
"""
import collections
import json
import pathlib
import sys

import numpy as np
import pandas as pd

UFCOD = {11:"RO",12:"AC",13:"AM",14:"RR",15:"PA",16:"AP",17:"TO",21:"MA",22:"PI",
         23:"CE",24:"RN",25:"PB",26:"PE",27:"AL",28:"SE",29:"BA",31:"MG",32:"ES",
         33:"RJ",35:"SP",41:"PR",42:"SC",43:"RS",50:"MS",51:"MT",52:"GO",53:"DF"}
I_AUTO = 3          # índice de "Lesão autoprovocada" em external_cause_types
I_DEMAIS = 5        # índice de "Demais localizações" em detailed_subgroups
CASAS_EXT, CASAS_SUB = 2, 3


def faixa_de(anos):
    """Índice da faixa etária do painel, -1 para idade ignorada."""
    v = np.asarray(anos, dtype="float64")
    ok = ~np.isnan(v)
    out = np.full(v.shape, -1, dtype="int64")
    a = np.where(ok, v, 0)
    idx = np.where(a < 1, 0, np.where(a < 5, 1, np.minimum(2 + (a - 5) // 5, 17)))
    out[ok] = idx[ok].astype("int64")
    return out


def idade_anos(campo):
    """Campo IDADE do SIM: primeiro dígito é a unidade, os dois seguintes a quantidade."""
    s = pd.Series(campo).astype(str).str.strip()
    u = pd.to_numeric(s.str[0], errors="coerce")
    q = pd.to_numeric(s.str[1:3], errors="coerce")
    return np.where(u == 5, q + 100, np.where(u == 4, q, np.where(u < 4, 0, np.nan)))


def corrige_autoprovocada(D, W):
    """Correção 1, em todos os recortes. Devolve o número de células alteradas."""
    W5, SW5 = W[2:], W[2:].sum()
    n = 0
    for li in range(len(D["dimensions"]["locations"])):
        for si in range(len(D["dimensions"]["sexes"])):
            for yi in range(len(D["dimensions"]["years"])):
                cel = D["deaths_by_external_cause"][li][si][yi][I_AUTO]
                f = np.array(D["deaths_by_external_cause_age"][li][si][yi][I_AUTO], float)
                p = np.array(D["population_by_age"][li][si][yi], float)
                p5 = p[2:].sum()
                if not p5:
                    continue
                num = cel[0] - int(f[0] + f[1])
                b = round(num / p5 * 1e5, CASAS_EXT)
                pr = round(float((W5 * np.divide(f[2:], p[2:], out=np.zeros(16),
                                                 where=p[2:] > 0)).sum() / SW5 * 1e5), CASAS_EXT)
                if [cel[1], cel[2]] != [b, pr]:
                    n += 1
                cel[1], cel[2] = b, pr
    return n


def incompativeis(dir_parquet, anos):
    """C61 em mulheres e C53 em homens, por (ano, UF, sexo) e por faixa etária.
    Cada registro entra duas vezes: na sua UF e no agregado BR."""
    mov = {}
    for a in anos:
        p = pathlib.Path(dir_parquet) / f"ano={a}" / "parte.parquet"
        if not p.exists():
            continue
        d = pd.read_parquet(p, columns=["TIPOBITO", "IDADE", "SEXO", "CODMUNRES", "CAUSABAS"])
        d = d[d.TIPOBITO != "1"].copy()
        cb = d.CAUSABAS.astype(str).str.upper().str.strip()
        num = pd.to_numeric(cb.str[1:3], errors="coerce")
        sel = ((cb.str[0] == "C")
               & (((num == 61) & (d.SEXO == "2")) | ((num == 53) & (d.SEXO == "1"))))
        g = d[sel]
        if g.empty:
            continue
        g = g.assign(uf=pd.to_numeric(g.CODMUNRES.str[:2], errors="coerce").map(UFCOD),
                     sexo=np.where(g.SEXO == "1", "Homens", "Mulheres"),
                     fx=faixa_de(idade_anos(g.IDADE)),
                     cod=np.where(num[sel] == 61, "C61", "C53"))
        for (uf, sx), sub in g.groupby(["uf", "sexo"]):
            for chave in ((a, uf, sx), (a, "BR", sx)):
                v = mov.setdefault(chave, {"n": 0, "fx": np.zeros(18, int),
                                           "cods": collections.Counter()})
                v["n"] += len(sub)
                v["cods"].update(sub.cod)
                for k in sub.fx[sub.fx >= 0]:
                    v["fx"][int(k)] += 1
    return mov


def corrige_neoplasias(D, W, mov):
    """Correção 2, apenas nos recortes com registro incompatível."""
    L = {v: i for i, v in enumerate(D["dimensions"]["locations"])}
    S = {v: i for i, v in enumerate(D["dimensions"]["sexes"])}
    Y = {int(v): i for i, v in enumerate(D["dimensions"]["years"])}
    for (a, uf, sx), v in mov.items():
        li, si, yi = L[uf], S[sx], Y[a]
        ds = D["deaths_by_detailed_subgroup"][li][si][yi]
        da = D["deaths_by_detailed_subgroup_age"][li][si][yi]
        p = np.array(D["population_by_age"][li][si][yi], float)
        novo_age = np.array(da[I_DEMAIS], int) + v["fx"]
        da[I_DEMAIS] = [int(x) for x in novo_age]
        n = ds[I_DEMAIS][0] + v["n"]
        ds[I_DEMAIS] = [
            n,
            round(n / p.sum() * 1e5, CASAS_SUB),
            round(float((W * np.divide(novo_age.astype(float), p, out=np.zeros(18),
                                       where=p > 0)).sum() / W.sum() * 1e5), CASAS_SUB)]
    return len(mov)


def limpa(o):
    if isinstance(o, dict):
        return {k: limpa(v) for k, v in o.items()}
    if isinstance(o, list):
        return [limpa(x) for x in o]
    if isinstance(o, np.integer):
        return int(o)
    if isinstance(o, np.floating):
        return float(o)
    return o


def main(entrada, saida, dir_parquet=None):
    D = json.loads(pathlib.Path(entrada).read_text(encoding="utf-8"))
    W = np.array(D["dimensions"]["standard_population_weights"], float)
    anos = [int(a) for a in D["dimensions"]["years"]]

    n1 = corrige_autoprovocada(D, W)
    print(f"correção 1 · lesão autoprovocada: {n1} recortes com taxa alterada")

    if not dir_parquet:
        sys.exit("correção 2 exige --parquet DIR com os Parquet anuais do SIM; "
                 "sem eles a distribuição etária dos registros realocados é desconhecida")
    mov = incompativeis(dir_parquet, anos)
    n2 = corrige_neoplasias(D, W, mov)
    por_ano = collections.Counter()
    cods = collections.defaultdict(collections.Counter)
    for (a, uf, _), v in mov.items():
        if uf == "BR":
            continue
        por_ano[a] += v["n"]
        cods[a].update(v["cods"])
    print(f"correção 2 · neoplasias: {n2} recortes, "
          f"{sum(por_ano.values())} registros realocados "
          f"({ {a: dict(cods[a]) for a in sorted(cods)} })")

    D["meta"]["origin"] = "atlas_mortalidade rev 15"
    D["meta"]["notes_rev15"] = NOTAS.format(
        total=sum(por_ano.values()),
        c2021=dict(cods.get(2021, {})), c2025=dict(cods.get(2025, {})))
    pathlib.Path(saida).write_text(
        json.dumps(limpa(D), ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"gravado: {pathlib.Path(saida).stat().st_size:,} bytes".replace(",", "."))
    return 0


NOTAS = (
 "Duas correções de dado sobre a rev 14, e nada mais. "
 "(1) LESÃO AUTOPROVOCADA (external_cause_types índice 3) voltou ao denominador de 5 anos e mais, "
 "conforme a ficha MRT.4.02, que a rev 14 havia perdido. A taxa bruta usa o total do recorte menos "
 "os óbitos abaixo de 5 anos, sobre a população das faixas 2 a 17; a padronizada usa pesos e "
 "população restritos a essas 16 faixas. O numerador mantém os óbitos de idade ignorada, como em "
 "todas as demais tabelas do arquivo — excluí-los daria 8,57 em BR/Ambos/2023 contra os 8,58 que a "
 "ficha publica. Óbitos abaixo de 5 anos nessa causa: 48 em toda a série, em 34 recortes. Os outros "
 "quatro tipos de causa externa seguem com população total. "
 "(2) NEOPLASIAS: {total} registros do SIM têm sexo incompatível com o código da causa "
 "({c2021} em 2021 e {c2025} em 2025). A célula específica continua null (Próstata em Mulheres, "
 "Colo de útero em Homens), mas os registros passaram a ser somados a 'Demais localizações' no "
 "mesmo estrato de sexo, em deaths_by_detailed_subgroup e _age, o que fecha a partição do capítulo "
 "II nos 2.184 recortes. Antes eles desapareciam da partição em 20 recortes. "
 "SALTOS REAIS DA SÉRIE BR, que não são artefato: 'Outras do aparelho respiratório' vai de 12.173 "
 "para 26.490 em 2020, por insuficiência respiratória J96 associada à pandemia, com a COVID "
 "codificada à parte em U07.1 e B34.2; e 'Necróticas e supurativas' oscila em 2006 e 2022 por ser "
 "grupo pequeno, abaixo de 1.100 óbitos, sensível a variação de codificação.")


if __name__ == "__main__":
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    dirp = None
    if "--parquet" in sys.argv:
        dirp = sys.argv[sys.argv.index("--parquet") + 1]
    if len(args) < 2:
        sys.exit(__doc__)
    sys.exit(main(args[0], args[1], dirp))
