# -*- coding: utf-8 -*-
"""Monta o mortality-indexed.json a partir dos agregados e da população do IBGE.

    python3 05_montar_indexed.py <agregados.json> <populacao.parquet> <modelo.json> <saida.json>

O MODELO
O quarto argumento é um mortality-indexed.json já existente, usado como molde: dele
saem `dimensions` inteiro, a tabela `coverage` (que vem da RIPSA, não do SIM) e o
esqueleto das listas. Só as tabelas de contagem e taxa são recalculadas. Isso evita
que este script precise reconstruir vocabulários que não são dele — nomes de
subgrupo, pesos da população-padrão, cobertura — e mantém o diff entre revisões
restrito ao que de fato mudou.

REGRAS QUE NÃO SÃO ÓBVIAS

Idade ignorada. O primeiro elemento de toda célula é o TOTAL do recorte, com idade
ignorada incluída. As tabelas _age e a taxa padronizada usam só idade conhecida.
Por isso sum(_age) <= célula[0], e a diferença é justamente a idade ignorada.

O estrato "Ambos" inclui os óbitos sem sexo informado, então Ambos != Homens +
Mulheres. É regra, não defeito, e vale para todas as tabelas.

Arredondamento não é uniforme: 2 casas nas taxas gerais, de causa externa e de
meio; 3 nos subgrupos detalhados; 1 na taxa específica por idade. Está assim no
arquivo em produção e o site depende disso.

Células null são semânticas: COVID-19 antes de 2020, "Próstata" em Mulheres e
"Colo de útero" em Homens. Nunca são zero disfarçado.
"""
import json
import pathlib
import sys

import numpy as np
import pandas as pd

NAO_APLICAVEL = {("Próstata", "Mulheres"), ("Colo de útero", "Homens")}


def populacao(caminho, locs, sexos, anos):
    """População por faixa etária do painel, a partir da idade simples do IBGE."""
    pop = pd.read_parquet(caminho)
    fx = np.where(pop.IDADE < 1, 0,
                  np.where(pop.IDADE < 5, 1, np.minimum(2 + (pop.IDADE - 5) // 5, 17)))
    g = pop.assign(fx=fx).groupby(["SIGLA", "SEXO", "ANO", "fx"], observed=True).POP.sum()
    P = np.zeros((len(locs), len(sexos), len(anos), 18))
    iL = {v: i for i, v in enumerate(locs)}
    iS = {v: i for i, v in enumerate(sexos)}
    iA = {int(v): i for i, v in enumerate(anos)}
    for (sg, sx, an, k), v in g.items():
        if sg in iL and sx in iS and int(an) in iA:
            P[iL[sg], iS[sx], iA[int(an)], int(k)] = v
    return P


def taxas(total, por_faixa, p, W, casas=2):
    """Bruta sobre o total do recorte; padronizada direta sobre a idade conhecida."""
    pt = p.sum()
    bruta = round(total / pt * 1e5, casas) if pt else 0.0
    padr = round(float((W * np.divide(np.asarray(por_faixa, float), p,
                                      out=np.zeros(len(p)), where=p > 0)).sum()
                       / W.sum() * 1e5), casas)
    return bruta, padr


def main(f_agg, f_pop, f_modelo, f_saida):
    AG = json.loads(pathlib.Path(f_agg).read_text(encoding="utf-8"))
    D = json.loads(pathlib.Path(f_modelo).read_text(encoding="utf-8"))
    dm = D["dimensions"]
    locs, sexos, anos = dm["locations"], dm["sexes"], dm["years"]
    W = np.array(dm["standard_population_weights"], float)
    grupos, externas = dm["cause_groups"], dm["external_cause_types"]
    meios, subs = dm["assault_means"], dm["detailed_subgroups"]
    POP = populacao(f_pop, locs, sexos, anos)

    for yi, ano in enumerate(anos):
        A = AG[str(ano)]
        T, TF = np.array(A["tot"]), np.array(A["tot_f"])
        G, GF = np.array(A["g"]), np.array(A["g_f"])
        E, EF = np.array(A["ex"]), np.array(A["ex_f"])
        M, MF = np.array(A["mi"]), np.array(A["mi_f"])
        S, SF = np.array(A["sb"]), np.array(A["sb_f"])
        for li in range(len(locs)):
            for si, sx in enumerate(sexos):
                p = POP[li, si, yi]
                b, pr = taxas(T[li, si], TF[li, si], p, W)
                D["overall"][li][si][yi] = [int(T[li, si]), b, pr, int(round(p.sum()))]
                D["deaths_by_age"][li][si][yi] = [int(x) for x in TF[li, si]]
                D["population_by_age"][li][si][yi] = [int(round(x)) for x in p]
                D["age_specific_rate"][li][si][yi] = [
                    round(float(TF[li, si, k] / p[k] * 1e5), 1) if p[k] else 0.0
                    for k in range(18)]

                cg, cga = [], []
                for k, nome in enumerate(grupos):
                    if nome == "COVID-19" and int(ano) < 2020:
                        cg.append(None); cga.append([0] * 18); continue
                    _, pr2 = taxas(G[li, si, k], GF[li, si, k], p, W)
                    cg.append([int(G[li, si, k]), pr2])
                    cga.append([int(x) for x in GF[li, si, k]])
                D["deaths_by_cause_group"][li][si][yi] = cg
                D["deaths_by_cause_group_age"][li][si][yi] = cga

                for tab, arr, arrf, cats in [
                        ("deaths_by_external_cause", E, EF, externas),
                        ("deaths_by_assault_means", M, MF, meios)]:
                    cel, cea = [], []
                    for k in range(len(cats)):
                        b2, p2 = taxas(arr[li, si, k], arrf[li, si, k], p, W)
                        cel.append([int(arr[li, si, k]), b2, p2])
                        cea.append([int(x) for x in arrf[li, si, k]])
                    D[tab][li][si][yi] = cel
                    D[tab + "_age"][li][si][yi] = cea

                ds, da = [], []
                for k, nome in enumerate(subs):
                    if (nome, sx) in NAO_APLICAVEL:
                        ds.append(None); da.append([0] * 18); continue
                    b3, p3 = taxas(S[li, si, k], SF[li, si, k], p, W, casas=3)
                    ds.append([int(S[li, si, k]), b3, p3])
                    da.append([int(x) for x in SF[li, si, k]])
                D["deaths_by_detailed_subgroup"][li][si][yi] = ds
                D["deaths_by_detailed_subgroup_age"][li][si][yi] = da

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

    pathlib.Path(f_saida).write_text(
        json.dumps(limpa(D), ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"gravado: {pathlib.Path(f_saida).stat().st_size:,} bytes".replace(",", "."))
    return 0


if __name__ == "__main__":
    if len(sys.argv) < 5:
        sys.exit(__doc__)
    sys.exit(main(*sys.argv[1:5]))
