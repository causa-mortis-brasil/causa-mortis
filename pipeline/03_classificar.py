# -*- coding: utf-8 -*-
"""Reconstrói as tabelas de contagem do painel a partir dos microdados do SIM.

O QUE MUDA EM RELAÇÃO À ROTA HÍBRIDA
Tudo sai do mesmo arquivo. Antes, capítulos vinham dos microdados e os subgrupos
respiratórios do TabNet, o que obrigava a ancorar a partição de 2025 (dois
instantâneos distintos) e a ratear a idade ignorada por pesos externos. Nada disso
é necessário aqui: idade ignorada é contada no registro, e a COVID sai de B34.2
exato em vez da categoria de três caracteres.

A REGRA DA IDADE IGNORADA (§3b), APLICADA NOS TRÊS NÍVEIS
O primeiro elemento de toda célula de contagem é o total do recorte, incluindo
idade ignorada. As tabelas _age e as taxas padronizadas usam só idade conhecida.
Isso vale para capítulos, tipos de causa externa, meios de agressão e subgrupos —
foi a assimetria entre esses níveis que produziu os quatro furos da rev 13.

SEXO IGNORADO
O estrato "Ambos" inclui os 15.674 óbitos sem sexo informado. Somar Homens e
Mulheres NÃO reproduz Ambos, e isso é correto, não defeito.
"""
import gc, json, pathlib, sys, time
import numpy as np, pandas as pd

UFCOD = {11:"RO",12:"AC",13:"AM",14:"RR",15:"PA",16:"AP",17:"TO",21:"MA",22:"PI",23:"CE",
 24:"RN",25:"PB",26:"PE",27:"AL",28:"SE",29:"BA",31:"MG",32:"ES",33:"RJ",35:"SP",41:"PR",
 42:"SC",43:"RS",50:"MS",51:"MT",52:"GO",53:"DF"}
FAIXAS = ['<1','1-4','5-9','10-14','15-19','20-24','25-29','30-34','35-39','40-44',
          '45-49','50-54','55-59','60-64','65-69','70-74','75-79','80+']
GRUPOS = ['Aparelho circulatório','Neoplasias','Aparelho respiratório','Causas externas',
 'COVID-19','Endócrinas e metabólicas','Aparelho digestivo','Infecciosas e parasitárias',
 'Perinatais e malformações','Sinais e achados mal definidos','Demais causas definidas']
EXTERNAS = ['Lesão de trânsito','Agressão','Causas acidentais','Lesão autoprovocada',
            'Demais causas externas']
MEIOS = ['Arma de fogo','Arma branca ou objeto contundente','Estrangulamento',
         'Força corporal','Demais meios especificados','Meios não especificados']
SUBS = ['Órgãos digestivos','Pulmão, traqueia e brônquios','Mama','Próstata','Colo de útero',
 'Demais localizações','Isquêmicas do coração','Cerebrovasculares','Demais cardiovasculares',
 'Vias aéreas superiores','Crônicas das vias aéreas inferiores','Pulmonares por agentes externos',
 'Interstício pulmonar','Necróticas e supurativas','Pleura','Outras do aparelho respiratório',
 'Influenza e pneumonia','Neoplasias não malignas (D00–D48)']

def faixa_de(anos):
    """Índice da faixa etária do painel, -1 para idade ignorada.
    <1 = 0, 1-4 = 1, depois quinquenais a partir de 5 anos, teto em 80+ (17)."""
    v = np.asarray(anos, dtype="float64")
    ok = ~np.isnan(v)
    a = np.where(ok, v, 0.0)
    f = np.where(a < 1, 0, np.where(a < 5, 1, np.minimum(2 + ((a - 5) // 5), 17)))
    return np.where(ok, f, -1).astype(np.int8)

def idade_anos(s):
    """IDADE do SIM: 1º caractere é a unidade (0-3 = menos de um ano, 4 = anos,
    5 = 100+). '999' e códigos inválidos viram NaN — idade ignorada."""
    u = s.str[0]; n = pd.to_numeric(s.str[1:], errors="coerce")
    return np.where(u.isin(["0","1","2","3"]), 0.0,
           np.where(u == "4", n, np.where(u == "5", 100 + n, np.nan)))

def classifica(d, ano):
    cb = d.CAUSABAS.str.upper().str.strip()
    L = cb.str[0]; c3 = cb.str[:3]; c4 = cb.str[:4]
    num = pd.to_numeric(cb.str[1:3], errors="coerce")
    covid = (c4 == "B342") | (L == "U")
    # Antes de 2020 os óbitos de B34.2 são infecção por coronavírus não especificada,
    # não COVID-19: a categoria só existe a partir da pandemia (§2).
    if ano < 2020: covid = covid & False
    g = np.select(
        [covid, L == "I", (L == "C") | ((L == "D") & (num <= 48)), L == "J",
         L.isin(["V","W","X","Y"]), L == "E", L == "K", L.isin(["A","B"]),
         L.isin(["P","Q"]), L == "R"],
        ["COVID-19","Aparelho circulatório","Neoplasias","Aparelho respiratório",
         "Causas externas","Endócrinas e metabólicas","Aparelho digestivo",
         "Infecciosas e parasitárias","Perinatais e malformações",
         "Sinais e achados mal definidos"], default="Demais causas definidas")
    ex = np.select(
        [(L == "V") & num.between(1, 89), (L == "W") | ((L == "X") & (num <= 59)),
         (L == "X") & num.between(60, 84), ((L == "X") & (num >= 85)) | ((L == "Y") & (num <= 9))],
        ["Lesão de trânsito","Causas acidentais","Lesão autoprovocada","Agressão"],
        default=None)
    ex = np.where(L.isin(["V","W","X","Y"]), np.where(pd.isna(ex), "Demais causas externas", ex), None)
    agr = ((L == "X") & (num >= 85)) | ((L == "Y") & (num <= 9))
    mi = np.select([c3.isin(["X93","X94","X95"]), c3.isin(["X99","Y00"]), c3 == "X91",
                    c3 == "Y04", c3 == "Y09"],
                   ["Arma de fogo","Arma branca ou objeto contundente","Estrangulamento",
                    "Força corporal","Meios não especificados"], default="Demais meios especificados")
    mi = np.where(agr, mi, None)
    sb = np.select(
        [(L == "C") & num.between(15, 26), (L == "C") & num.isin([33, 34]),
         (L == "C") & (num == 50), (L == "C") & (num == 61), (L == "C") & (num == 53),
         (L == "C"),
         (L == "I") & num.between(20, 25), (L == "I") & num.between(60, 69), (L == "I"),
         (L == "J") & num.between(30, 39), (L == "J") & num.between(40, 47),
         (L == "J") & num.between(60, 70), (L == "J") & num.between(80, 84),
         (L == "J") & num.between(85, 86), (L == "J") & num.between(90, 94),
         (L == "J") & (num.between(95, 99) | num.between(0, 6) | num.between(20, 22)),
         (L == "J") & num.between(9, 18),
         (L == "D") & (num <= 48)],
        list(range(18)), default=-1)
    return g, ex, mi, sb.astype(np.int16)

def main():
    t0 = time.time()
    pop = pd.read_parquet("data/interim/ibge_projecoes2024_idade_simples_2000_2025.parquet")
    pop["faixa"] = np.where(pop.IDADE < 1, 0, np.where(pop.IDADE < 5, 1,
                            np.minimum(2 + (pop.IDADE - 5) // 5, 17)))
    PF = (pop.groupby(["SIGLA","SEXO","ANO","faixa"], observed=True).POP.sum()
             .astype("int64").reset_index())
    saida = {}
    for ano in range(2000, 2026):
        d = pd.read_parquet(f"data/interim/SIM/ano={ano}/parte.parquet",
                            columns=["TIPOBITO","IDADE","SEXO","CODMUNRES","CAUSABAS"])
        d = d[d.TIPOBITO != "1"].copy()
        d["uf"] = pd.to_numeric(d.CODMUNRES.str[:2], errors="coerce").map(UFCOD)
        d["sx"] = np.where(d.SEXO == "1", "Homens", np.where(d.SEXO == "2", "Mulheres", "Ignorado"))
        d["fx"] = faixa_de(pd.Series(idade_anos(d.IDADE)))
        g, ex, mi, sb = classifica(d, ano)
        d["g"] = g; d["ex"] = ex; d["mi"] = mi; d["sb"] = sb
        saida[ano] = d
        print(f"  {ano}  {len(d):>9,} óbitos  idade ign {int((d.fx<0).sum()):>5,}"
              f"  sexo ign {int((d.sx=='Ignorado').sum()):>5,}".replace(",","."), flush=True)
        d.to_parquet(f"data/interim/CLASS/ano={ano}.parquet", index=False)
        del d; gc.collect()
    print(f"\nclassificação concluída em {(time.time()-t0)/60:.1f} min")
    return 0

if __name__ == "__main__":
    pathlib.Path("data/interim/CLASS").mkdir(parents=True, exist_ok=True)
    sys.exit(main())
