# ==============================================================================
# 08_exportar.R — exportar_indexed()
#
# Substitui export/generate-flat.mjs. Grava mortality-indexed.json no formato que
# scripts/generate-mortality-data.ts lê, com aninhamento POSICIONAL:
#   tabela[i_localidade][i_sexo][i_ano]  e  coverage[i_localidade][i_ano]
#
# AS QUATRO ARMADILHAS DO jsonlite, E COMO CADA UMA É TRATADA
#
# 1. auto_unbox colapsa vetor de comprimento 1 em escalar. Nas tabelas
#    vetoriais isso seria um erro — as aridades são 2, 3, 4 e 18 —, então a
#    função confere e FALHA se surgir uma folha unitária, em vez de gravar um
#    escalar onde o site espera vetor.
#    A exceção é `coverage`, cuja folha é escalar POR CONTRATO
#    (coverage[localidade][ano] = número ou null): ali auto_unbox é o
#    comportamento desejado, e a tabela está em FOLHA_ESCALAR para que a
#    verificação não a reprove. Ou seja, o invariante é "nenhuma folha unitária
#    fora de FOLHA_ESCALAR", não "nenhuma folha unitária".
#
# 2. NULL dentro de list() some na concatenação. Célula ausente que desaparece
#    desloca TODO o eixo seguinte, e o site passa a ler o valor do vizinho —
#    erro silencioso e catastrófico. Por isso o comprimento de cada nível é
#    conferido contra os eixos depois da montagem.
#
# 3. digits arredonda na serialização e é GLOBAL. Cada tabela aqui tem
#    arredondamento próprio (2 casas nas taxas gerais, 3 nos subgrupos, 1 na
#    cobertura), medido no arquivo em produção. O arredondamento é feito antes,
#    posição a posição, e a serialização usa digits = NA para não remexer.
#
# 4. data.frame vira array de OBJETOS, não array de arrays. Todo eixo é list()
#    ou vetor atômico; nenhum data.frame chega ao toJSON.
# ==============================================================================

suppressPackageStartupMessages({library(jsonlite)})

# Casas decimais por posição da célula, medidas no arquivo em produção.
# Escalar = vale para a célula toda; vetor = uma casa por posição.
ARREDONDAMENTO <- list(
  overall                          = c(0, 2, 2, 0),
  deaths_by_cause_group            = c(0, 2),
  deaths_by_external_cause         = c(0, 2, 2),
  deaths_by_assault_means          = c(0, 2, 2),
  deaths_by_detailed_subgroup      = c(0, 3, 3),
  age_specific_rate                = 1,
  coverage                         = 1,
  population_by_age                = 0,
  deaths_by_age                    = 0,
  deaths_by_cause_group_age        = 0,
  deaths_by_external_cause_age     = 0,
  deaths_by_assault_means_age      = 0,
  deaths_by_detailed_subgroup_age  = 0
)

#' Arredonda uma célula-folha respeitando a posição.
#' NULL passa intacto: ausência não é zero.
arredondar_celula <- function(v, casas) {
  if (is.null(v)) return(NULL)
  v <- as.numeric(v)
  if (length(casas) == 1L) return(round(v, casas))
  if (length(casas) != length(v))
    stop(sprintf("aridade %d incompatível com %d casas declaradas", length(v), length(casas)))
  round(v, casas)   # round é vetorizado em digits
}

#' Percorre a estrutura aninhada aplicando fn nas folhas (vetor atômico ou NULL).
mapear_folhas <- function(x, fn) {
  if (is.null(x)) return(NULL)
  if (!is.list(x)) return(fn(x))
  lapply(x, function(e) mapear_folhas(e, fn))
}

#' Invariante que torna auto_unbox seguro (armadilha 1).
checar_sem_folha_unitaria <- function(x, caminho = "") {
  if (is.null(x)) return(invisible(NULL))
  if (!is.list(x)) {
    if (length(x) == 1L && is.numeric(x))
      stop(sprintf("folha de comprimento 1 em %s — auto_unbox gravaria escalar", caminho))
    return(invisible(NULL))
  }
  for (i in seq_along(x)) checar_sem_folha_unitaria(x[[i]], paste0(caminho, "[", i, "]"))
  invisible(NULL)
}

#' Confere o comprimento de cada nível contra os eixos (armadilha 2).
checar_forma <- function(x, esperado, nome) {
  if (length(esperado) == 0L) return(invisible(NULL))
  if (length(x) != esperado[1])
    stop(sprintf("%s: nível com %d, esperado %d", nome, length(x), esperado[1]))
  if (length(esperado) > 1L)
    for (i in seq_along(x))
      if (!is.null(x[[i]])) checar_forma(x[[i]], esperado[-1], sprintf("%s[%d]", nome, i))
  invisible(NULL)
}

#' Grava o pacote indexado.
#'
#' @param dados lista nomeada com dimensions, meta e as tabelas.
#' @param caminho arquivo de saída.
#' @param formas lista tabela -> comprimentos esperados por nível. Sem isso não
#'   há como distinguir célula legitimamente ausente de célula que sumiu.
exportar_indexed <- function(dados, caminho, formas = NULL) {
  falta <- setdiff(c("dimensions", "meta"), names(dados))
  if (length(falta)) stop("faltam chaves: ", paste(falta, collapse = ", "))

  for (tb in names(ARREDONDAMENTO)) {
    if (is.null(dados[[tb]])) next
    casas <- ARREDONDAMENTO[[tb]]
    dados[[tb]] <- mapear_folhas(dados[[tb]], function(v) arredondar_celula(v, casas))
  }
  # coverage é a ÚNICA tabela cuja folha é escalar por contrato
  # (coverage[localidade][ano] = número ou null), então auto_unbox ali é o
  # comportamento desejado e o invariante da armadilha 1 não se aplica.
  FOLHA_ESCALAR <- c("coverage")
  for (tb in setdiff(names(dados), c("dimensions", "meta"))) {
    if (!(tb %in% FOLHA_ESCALAR)) checar_sem_folha_unitaria(dados[[tb]], tb)
    if (!is.null(formas) && !is.null(formas[[tb]])) checar_forma(dados[[tb]], formas[[tb]], tb)
  }
  d <- dados$dimensions
  if (is.data.frame(d$location_names)) stop("location_names chegou como data.frame")
  dados$dimensions$location_names <- as.list(d$location_names)

  # pretty = 2 casa a indentação do arquivo em produção (2 espaços). Não é
  # capricho: o site versiona o pacote por sha256 do arquivo bruto
  # (shortHash(indexedRaw) em generate-mortality-data.ts), então mudar a
  # formatação muda a versão publicada mesmo sem mudar um único número.
  js <- jsonlite::toJSON(dados, auto_unbox = TRUE, null = "null",
                         na = "null", digits = NA, pretty = 2)
  dir.create(dirname(caminho), recursive = TRUE, showWarnings = FALSE)
  con <- file(caminho, open = "wb")
  writeBin(charToRaw(paste0(js, "\n")), con)
  close(con)
  invisible(file.size(caminho))
}
