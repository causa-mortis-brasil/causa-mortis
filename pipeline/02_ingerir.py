# -*- coding: utf-8 -*-
"""Ingere a série do SIM 2000-2025 para Parquet, de CSV e de JSON.

DOIS FORMATOS NA MESMA SÉRIE, E POR QUÊ
2022 e 2023 não têm mais variante CSV no bucket. A variante JSON de cada um
contém os fragmentos DO22OPEN_*.json e DO23OPEN_*.json — isto é, exatamente os
arquivos que a rev 13 usou, republicados em outro formato. A contagem confirma:
1.544.266 e 1.465.610 registros, iguais ao TabNet ao registro. O CSV de 2023 que
ainda existe é a publicação incompleta, 65.020 óbitos abaixo — a mesma que
rejeitamos em agosto.

DELIMITADOR NÃO É UNIFORME
O SIM usa ';' em todos os anos, mas isso é verificado, não pressuposto: o
cabeçalho é lido e o separador escolhido pelo que produz mais colunas. Fixar o
delimitador foi o que corrompeu o Sinasc em 2006-2009 na primeira rodada.
"""
import io, json, pathlib, sys, time, zipfile
import pandas as pd

RAW = pathlib.Path("data/raw/SIM")
OUT = pathlib.Path("data/interim/SIM"); OUT.mkdir(parents=True, exist_ok=True)
COLS = ["TIPOBITO","DTOBITO","IDADE","SEXO","RACACOR","CODMUNRES","CODMUNOCOR",
        "CAUSABAS","CAUSABAS_O","LOCOCOR","ESC","ESTCIV","OBITOGRAV","OBITOPUERP"]

def _sep(linha):
    return max([";", ",", "|"], key=lambda s: linha.count(s))

def le_csv(z, nome):
    with zipfile.ZipFile(z) as f:
        interno = [x for x in f.namelist() if x.lower().endswith(".csv")][0]
        with f.open(interno) as h:
            bruto = h.read()
    txt = bruto.decode("latin-1")
    sep = _sep(txt.split("\n", 1)[0])
    df = pd.read_csv(io.StringIO(txt), sep=sep, dtype=str, low_memory=False)
    df.columns = [c.strip().upper() for c in df.columns]
    return df

def le_json(z):
    partes = []
    with zipfile.ZipFile(z) as f:
        for nm in sorted(x for x in f.namelist() if x.endswith(".json")):
            with f.open(nm) as h:
                partes.append(pd.DataFrame(json.load(h)))
    df = pd.concat(partes, ignore_index=True)
    df.columns = [c.strip().upper() for c in df.columns]
    return df

def main():
    cat = json.load(open("handoff/catalogo_final_rev15.json", encoding="utf-8"))
    t0, log = time.time(), []
    for ano in sorted(cat, key=int):
        c = cat[ano]; alvo = OUT / f"ano={ano}" / "parte.parquet"
        if alvo.exists():
            log.append({"ano": int(ano), "n": None, "cache": True}); continue
        z = RAW / c["arquivo"]
        df = le_json(z) if c["formato"] == "json" else le_csv(z, c["arquivo"])
        faltam = [x for x in COLS if x not in df.columns]
        pres = [x for x in COLS if x in df.columns]
        # GUARDA: se as colunas essenciais não vierem, o arquivo não foi lido direito
        if not {"CAUSABAS", "IDADE", "SEXO", "CODMUNRES"} <= set(pres):
            raise RuntimeError(f"{ano}: colunas essenciais ausentes ({len(df.columns)} lidas)")
        esp = c.get("registros_esperados")
        if esp and len(df) != esp:
            raise RuntimeError(f"{ano}: {len(df)} registros, esperados {esp}")
        alvo.parent.mkdir(parents=True, exist_ok=True)
        df[pres].to_parquet(alvo, index=False)
        log.append({"ano": int(ano), "n": len(df), "colunas": len(pres), "ausentes": faltam,
                    "formato": c["formato"]})
        print(f"  {ano}  {len(df):>9,} registros  {len(pres)}/{len(COLS)} colunas"
              .replace(",", ".") + (f"  faltam: {faltam}" if faltam else ""), flush=True)
    json.dump(log, open("handoff/ingestao_rev15.json", "w"), ensure_ascii=False, indent=1)
    print(f"\nconcluido em {(time.time()-t0)/60:.1f} min | anos: {len(log)}")
    return 0

if __name__ == "__main__":
    sys.exit(main())
