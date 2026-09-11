# ==============================================================================
# 10_atomizar.R — converte o que jsonlite devolve com simplifyVector = FALSE
# na forma que exportar_indexed() e verificar() esperam.
#
# POR QUE ISTO EXISTE
# Lido com simplifyVector = FALSE, um vetor JSON [1,2,3] vira list(1,2,3), e as
# funções do pipeline esperam c(1,2,3). Simplificar na leitura não serve: com
# simplifyVector = TRUE o jsonlite achata matrizes inteiras e destrói o aninhamento
# por localidade/sexo/ano, além de transformar null em NA no meio de vetores.
#
# A REGRA
# Uma lista cujos elementos são TODOS numéricos de comprimento 1 é uma folha —
# vira vetor atômico. Qualquer outra lista continua lista e é percorrida. NULL é
# preservado, porque no arquivo ele é semântico: marca "não aplicável".
#
# ATENÇÃO: uma folha que contenha NULL (por exemplo uma célula parcialmente nula)
# NÃO é atomizada, de propósito — unlist() apagaria o NULL e encurtaria o vetor
# em silêncio, desalinhando as posições. O contrato do arquivo é que a célula é
# inteiramente nula ou inteiramente preenchida.
#
# Esta função é validada por ida-e-volta: atomizar() seguido de exportar_indexed()
# tem de reproduzir byte a byte o arquivo de entrada.
# ==============================================================================

atomizar <- function(x) {
  if (is.null(x)) return(NULL)
  if (!is.list(x)) return(x)
  if (length(x) &&
      all(vapply(x, function(e) is.numeric(e) && length(e) == 1L, logical(1))))
    return(unlist(x, use.names = FALSE))
  lapply(x, atomizar)
}

#' Lê um mortality-indexed.json na forma que o pipeline espera.
#' As dimensões são desempacotadas à parte: são vetores de texto, que a regra
#' acima (só numéricos) deixaria como lista.
ler_indexed <- function(caminho) {
  z <- jsonlite::fromJSON(caminho, simplifyVector = FALSE)
  out <- atomizar(z)
  for (k in c("locations", "sexes", "age_groups", "years", "cause_groups",
              "external_cause_types", "assault_means", "detailed_subgroups",
              "standard_population_weights"))
    out$dimensions[[k]] <- unlist(z$dimensions[[k]], use.names = FALSE)
  out$dimensions$detailed_subgroups_by_cause_group <-
    lapply(z$dimensions$detailed_subgroups_by_cause_group, unlist, use.names = FALSE)
  out$dimensions$location_names <- z$dimensions$location_names
  out
}
