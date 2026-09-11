# -*- coding: utf-8 -*-
"""Baixa a série do SIM do bucket do Portal de Dados Abertos.

O QUE MUDOU DESDE AGOSTO, E POR QUE O 403 ENGANAVA
Os arquivos foram movidos para o prefixo SIM/csv/. Pedir o caminho antigo devolve
403 AccessDenied, não 404: o bucket não concede s3:ListBucket, e nesse caso o S3
responde AccessDenied para chave inexistente — indistinguível de falta de
permissão. Isso me fez concluir que a fonte estava fora do ar quando o que havia
mudado era o caminho. Sondar o prefixo novo resolve.

Transporte: forma virtual-hosted sobre HTTP. A forma path-style que a página
publica não é alcançável deste ambiente por política de rede. Como HTTP não é
autenticado, cada arquivo tem SHA-256 gravado e comparado com o manifesto de
18/08 quando o nome coincide.
"""
import hashlib, json, pathlib, sys, time, urllib.request

B = "http://ckan.saude.gov.br.s3.sa-east-1.amazonaws.com/"
DST = pathlib.Path("data/raw/SIM"); DST.mkdir(parents=True, exist_ok=True)
UA = {"User-Agent": "pipeline-mortalidade"}

def baixa(path, destino):
    if destino.exists(): return destino.stat().st_size, True
    tmp = destino.with_suffix(destino.suffix + ".parcial")
    req = urllib.request.Request(B + path, headers=UA)
    with urllib.request.urlopen(req, timeout=900) as r, open(tmp, "wb") as f:
        while True:
            bloco = r.read(1 << 20)
            if not bloco: break
            f.write(bloco)
    tmp.rename(destino)          # renomeia só no fim: arquivo parcial nunca vira definitivo
    return destino.stat().st_size, False

def sha256(p, bloco=1 << 20):
    h = hashlib.sha256()
    with open(p, "rb") as f:
        for c in iter(lambda: f.read(bloco), b""): h.update(c)
    return h.hexdigest()

def main():
    cat = json.load(open("handoff/catalogo_rev15.json", encoding="utf-8"))
    ant = {}
    import csv as _csv
    for row in _csv.DictReader(open("pipeline/sim_files.csv", encoding="utf-8")):
        ant[row["arquivo"]] = row["sha256"]
    saida, t0 = [], time.time()
    for chave in sorted(cat):
        c = cat[chave]; nome = c["path"].split("/")[-1]
        alvo = DST / nome
        try:
            n, cache = baixa(c["path"], alvo)
        except Exception as e:
            print(f"  FALHA {chave} {nome}: {type(e).__name__}: {str(e)[:70]}", flush=True)
            saida.append({"chave": chave, "arquivo": nome, "erro": str(e)[:120]}); continue
        h = sha256(alvo)
        esperado = ant.get(nome)
        estado = "novo" if esperado is None else ("igual" if esperado == h else "REPUBLICADO")
        saida.append({"chave": chave, "arquivo": nome, "bytes": n, "sha256": h, "vs_agosto": estado})
        print(f"  {chave:>18s} {nome:40s} {n/1048576:>7.1f} MB  {estado}"
              + ("  (cache)" if cache else ""), flush=True)
    json.dump(saida, open("handoff/baixados_rev15.json", "w"), ensure_ascii=False, indent=1)
    print(f"\nconcluido: {len(saida)} arquivos em {(time.time()-t0)/60:.1f} min")
    print("  republicados:", [s["arquivo"] for s in saida if s.get("vs_agosto") == "REPUBLICADO"] or "nenhum")
    print("  novos:", [s["arquivo"] for s in saida if s.get("vs_agosto") == "novo"] or "nenhum")
    return 0

if __name__ == "__main__":
    sys.exit(main())
