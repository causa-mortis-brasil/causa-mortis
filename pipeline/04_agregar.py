# -*- coding: utf-8 -*-
"""Agrega os microdados classificados nas tabelas do painel.

CHAVES DO RECORTE
Localidade: as 27 UFs por residência (CODMUNRES) mais BR = soma de todas.
Sexo: Homens, Mulheres e Ambos = TODOS os registros, inclusive sexo ignorado.
      Ambos != Homens + Mulheres, e isso é a regra, não defeito (§3b).
Contagem: inclui idade ignorada. Tabelas por faixa: só idade conhecida.
"""
import gc, json, pathlib, sys, time
import numpy as np, pandas as pd
import importlib.util
sp = importlib.util.spec_from_file_location("rc", "reconstruir.py")
rc = importlib.util.module_from_spec(sp); sp.loader.exec_module(rc)

LOCS = ["BR"] + sorted(rc.UFCOD.values())
SEXOS = ["Ambos", "Homens", "Mulheres"]
ANOS = list(range(2000, 2026))
iL = {u: i for i, u in enumerate(LOCS)}; iS = {s: i for i, s in enumerate(SEXOS)}
iA = {a: i for i, a in enumerate(ANOS)}

def contagens(d, chave, cats):
    """(loc, sexo, categoria) -> total, e (loc, sexo, categoria, faixa) -> vetor 18.
    BR e Ambos são somas, calculadas uma vez em vez de refiltrar o quadro."""
    idx = {c: i for i, c in enumerate(cats)}
    k = d[chave].map(idx)
    ok = k.notna()
    sub = pd.DataFrame({"uf": d.uf[ok], "sx": d.sx[ok], "k": k[ok].astype(int), "fx": d.fx[ok]})
    tot = sub.groupby(["uf","sx","k"], observed=True).size()
    fai = sub[sub.fx >= 0].groupby(["uf","sx","k","fx"], observed=True).size()
    T = np.zeros((len(LOCS), len(SEXOS), len(cats)), dtype=np.int64)
    F = np.zeros((len(LOCS), len(SEXOS), len(cats), 18), dtype=np.int64)
    for (uf, sx, kk), n in tot.items():
        if uf not in iL: continue
        for si in ({"Homens":[0,1], "Mulheres":[0,2]}.get(sx, [0])):
            T[iL[uf], si, kk] += n; T[0, si, kk] += n
    for (uf, sx, kk, fx), n in fai.items():
        if uf not in iL: continue
        for si in ({"Homens":[0,1], "Mulheres":[0,2]}.get(sx, [0])):
            F[iL[uf], si, kk, fx] += n; F[0, si, kk, fx] += n
    return T, F

def totais(d):
    T = np.zeros((len(LOCS), len(SEXOS)), dtype=np.int64)
    F = np.zeros((len(LOCS), len(SEXOS), 18), dtype=np.int64)
    for (uf, sx), n in d.groupby(["uf","sx"], observed=True).size().items():
        if uf not in iL: continue
        for si in ({"Homens":[0,1], "Mulheres":[0,2]}.get(sx, [0])):
            T[iL[uf], si] += n; T[0, si] += n
    for (uf, sx, fx), n in d[d.fx >= 0].groupby(["uf","sx","fx"], observed=True).size().items():
        if uf not in iL: continue
        for si in ({"Homens":[0,1], "Mulheres":[0,2]}.get(sx, [0])):
            F[iL[uf], si, fx] += n; F[0, si, fx] += n
    return T, F

def main():
    t0 = time.time()
    out = {}
    for ano in ANOS:
        d = pd.read_parquet(f"data/interim/SIM/ano={ano}/parte.parquet",
                            columns=["TIPOBITO","IDADE","SEXO","CODMUNRES","CAUSABAS"])
        d = d[d.TIPOBITO != "1"].copy()
        d["uf"] = pd.to_numeric(d.CODMUNRES.str[:2], errors="coerce").map(rc.UFCOD)
        d["sx"] = np.where(d.SEXO == "1", "Homens", np.where(d.SEXO == "2", "Mulheres", "Ignorado"))
        d["fx"] = rc.faixa_de(rc.idade_anos(d.IDADE))
        g, ex, mi, sb = rc.classifica(d, ano)
        d["g"] = g; d["ex"] = ex; d["mi"] = mi; d["sb"] = sb
        d = d[d.uf.notna()]
        r = {}
        r["tot"], r["tot_f"] = totais(d)
        r["g"], r["g_f"] = contagens(d, "g", rc.GRUPOS)
        r["ex"], r["ex_f"] = contagens(d, "ex", rc.EXTERNAS)
        r["mi"], r["mi_f"] = contagens(d, "mi", rc.MEIOS)
        r["sb"], r["sb_f"] = contagens(d, "sb", list(range(18)))
        out[ano] = {k: v.tolist() for k, v in r.items()}
        print(f"  {ano}  {len(d):>9,} óbitos  ign idade {int((d.fx<0).sum()):>5,}"
              f"  ign sexo {int((d.sx=='Ignorado').sum()):>5,}".replace(",","."), flush=True)
        del d; gc.collect()
    json.dump(out, open("handoff/agregados_rev15.json", "w"))
    print(f"\nagregação concluída em {(time.time()-t0)/60:.1f} min")
    return 0

if __name__ == "__main__":
    sys.exit(main())
