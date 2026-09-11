# ==============================================================================
# 09_assercoes.R — as verificações do §5, como RELATÓRIO e como PORTÃO
#
# Duas formas de uso, de propósito:
#   verificar(dados)            -> conta violações por asserção e devolve a tabela
#   verificar(dados, gate=TRUE) -> falha na primeira violação, para usar antes de gravar
#
# O relatório existe porque `stopifnot` no meio de 2.184 recortes diz apenas
# "falhou" — não diz em quantos, nem onde, nem se é um caso de borda ou um erro
# estrutural. Quando rodei isto contra a rev 13, foi a contagem por asserção que
# separou os furos um do outro.
# ==============================================================================

#' @param d lista já parseada (dimensions + tabelas), folhas como vetor atômico
#' @param gate se TRUE, para na primeira violação
verificar <- function(d, gate = FALSE, tol = 0.01) {
  dm <- d$dimensions
  L <- length(dm$locations); S <- length(dm$sexes); Y <- length(dm$years)
  w  <- as.numeric(dm$standard_population_weights)
  iAno2022 <- which(as.integer(dm$years) == 2022)
  ni <- length(dm$detailed_subgroups)
  res <- list()
  # DUAS NATUREZAS, QUE NÃO PODEM SER SOMADAS NO MESMO PLACAR.
  # tipo = "identidade": tem de fechar exatamente. Σ das partes igual ao todo, taxa
  #   reproduzível a partir dos insumos, soma dos pesos. Violação aqui é defeito, e
  #   com gate = TRUE interrompe antes de gravar.
  # tipo = "alerta": limiar heurístico que aponta ONDE OLHAR, não o que está errado.
  #   O único é o salto de 40% entre anos consecutivos nos subgrupos respiratórios,
  #   e os dois casos que ele acusa já foram investigados e são sinal real, não
  #   artefato — estão descritos em meta.notes_rev15. Somá-los às identidades daria
  #   a impressão falsa de que o arquivo tem defeito.
  reg <- function(nome, viol, total, exemplo = NULL, tipo = "identidade") {
    res[[length(res) + 1L]] <<- data.frame(assercao = nome, tipo = tipo, violacoes = viol,
      de = total, exemplo = if (is.null(exemplo)) "" else exemplo,
      stringsAsFactors = FALSE)
    if (gate && viol > 0 && tipo == "identidade")
      stop(sprintf("§5 reprovou em '%s': %d de %d (%s)", nome, viol, total,
                   if (is.null(exemplo)) "" else exemplo))
  }
  nm <- function(l, s, y) sprintf("%s/%s/%d", dm$locations[l], dm$sexes[s], dm$years[y])

  reg("soma dos pesos == 210862983", as.integer(sum(w) != 210862983), 1L)

  p2022 <- as.numeric(unlist(d$population_by_age[[1]][[1]][[iAno2022]]))
  reg("population_by_age[BR][Ambos][2022] == pesos",
      as.integer(!isTRUE(all.equal(p2022, w, tolerance = 0))), 1L,
      if (!isTRUE(all.equal(p2022, w, tolerance = 0)))
        sprintf("difere em %d faixas", sum(p2022 != w)) else "")

  cont <- c(bruta = 0, padr = 0, pop = 0, cap = 0, ext = 0, meios = 0, cardio = 0, malig = 0)
  ex   <- as.list(setNames(rep("", 8), names(cont)))
  pega <- function(e, i = 1) if (is.null(e)) 0 else as.numeric(e)[i]
  for (l in seq_len(L)) for (s in seq_len(S)) for (y in seq_len(Y)) {
    o <- as.numeric(d$overall[[l]][[s]][[y]])
    if (is.null(o) || !length(o)) next
    dd <- as.numeric(unlist(d$deaths_by_age[[l]][[s]][[y]]))
    pp <- as.numeric(unlist(d$population_by_age[[l]][[s]][[y]]))
    if (abs(o[1]/o[4]*1e5 - o[2]) >= tol) { cont["bruta"] <- cont["bruta"] + 1
      if (!nzchar(ex$bruta)) ex$bruta <- nm(l,s,y) }
    esp <- sum(w * dd / pp) / sum(w) * 1e5
    if (abs(esp - o[3]) >= tol) { cont["padr"] <- cont["padr"] + 1
      if (!nzchar(ex$padr)) ex$padr <- sprintf("%s: %.2f vs %.2f", nm(l,s,y), esp, o[3]) }
    if (sum(pp) != o[4]) { cont["pop"] <- cont["pop"] + 1
      if (!nzchar(ex$pop)) ex$pop <- nm(l,s,y) }

    cg <- d$deaths_by_cause_group[[l]][[s]][[y]]
    scg <- sum(vapply(cg, pega, numeric(1)))
    if (scg != o[1]) { cont["cap"] <- cont["cap"] + 1
      if (!nzchar(ex$cap)) ex$cap <- sprintf("%s: %.0f vs %.0f", nm(l,s,y), scg, o[1]) }

    ec <- d$deaths_by_external_cause[[l]][[s]][[y]]
    sec <- sum(vapply(ec, pega, numeric(1)))
    if (sec != pega(cg[[4]])) { cont["ext"] <- cont["ext"] + 1
      if (!nzchar(ex$ext)) ex$ext <- sprintf("%s: %.0f vs %.0f", nm(l,s,y), sec, pega(cg[[4]])) }

    am <- d$deaths_by_assault_means[[l]][[s]][[y]]
    sam <- sum(vapply(am, pega, numeric(1)))
    if (sam != pega(ec[[2]])) { cont["meios"] <- cont["meios"] + 1
      if (!nzchar(ex$meios)) ex$meios <- sprintf("%s: %.0f vs %.0f", nm(l,s,y), sam, pega(ec[[2]])) }

    ds <- d$deaths_by_detailed_subgroup[[l]][[s]][[y]]
    sub <- function(idx0) sum(vapply(ds[idx0 + 1L], pega, numeric(1)))
    if (sub(6:8) != pega(cg[[1]])) { cont["cardio"] <- cont["cardio"] + 1
      if (!nzchar(ex$cardio)) ex$cardio <- sprintf("%s: %.0f vs %.0f", nm(l,s,y), sub(6:8), pega(cg[[1]])) }
    malig <- if (ni >= 18) sub(c(0:5, 17)) else sub(0:5)
    if (malig > pega(cg[[2]])) { cont["malig"] <- cont["malig"] + 1
      if (!nzchar(ex$malig)) ex$malig <- sprintf("%s: %.0f > %.0f", nm(l,s,y), malig, pega(cg[[2]])) }
  }
  N <- L * S * Y
  reg("taxa bruta reproduzível",            cont[["bruta"]],  N, ex$bruta)
  reg("taxa padronizada reproduzível",      cont[["padr"]],   N, ex$padr)
  reg("sum(population_by_age) == overall[4]", cont[["pop"]],  N, ex$pop)
  reg("sum(capitulos) == overall[1]",       cont[["cap"]],    N, ex$cap)
  reg("sum(tipos externos) == cap. externas", cont[["ext"]],  N, ex$ext)
  reg("sum(meios) == agressao",             cont[["meios"]],  N, ex$meios)
  reg("sum(subgrupos cardio) == cap. IX",   cont[["cardio"]], N, ex$cardio)
  reg("sum(malignas) <= cap. II",           cont[["malig"]],  N, ex$malig)

  v <- 0; e1 <- ""
  for (s in seq_len(S)) for (y in seq_len(Y)) {
    somaUF <- sum(vapply(2:L, function(l) as.numeric(d$overall[[l]][[s]][[y]])[1], numeric(1)))
    br <- as.numeric(d$overall[[1]][[s]][[y]])[1]
    if (somaUF != br) { v <- v + 1; if (!nzchar(e1)) e1 <- sprintf("%s/%d: %.0f vs %.0f", dm$sexes[s], dm$years[y], somaUF, br) }
  }
  reg("soma das UFs == Brasil", v, S * Y, e1)

  # subgrupos respiratórios (0-based 9..15, mais 16 se existir): série BR sem salto > 40%
  resp <- 9:min(15 + (ni >= 17), ni - 1)
  v <- 0; e2 <- ""
  for (k in resp) {
    serie <- vapply(seq_len(Y), function(y) pega(d$deaths_by_detailed_subgroup[[1]][[1]][[y]][[k + 1L]]), numeric(1))
    base <- head(serie, -1); salto <- abs(diff(serie) / ifelse(base == 0, NA, base))
    mx <- suppressWarnings(max(salto, na.rm = TRUE))
    if (is.finite(mx) && mx >= 0.4) { v <- v + 1
      if (!nzchar(e2)) e2 <- sprintf("%s: salto de %.0f%% em %d", dm$detailed_subgroups[k + 1L],
                                     100 * mx, dm$years[which.max(salto) + 1L]) }
  }
  reg("subgrupos respiratórios sem salto > 40%", v, length(resp), e2, tipo = "alerta")

  # NEOPLASIAS MALIGNAS EM 2023: a ficha MRT.5.02 publica 249.942 e o microdado tem
  # 249.941 registros com código C. A diferença é UM registro, e a causa está medida:
  # o TabNet agrupa por arquivo de conversão curado, não pela faixa literal da CID, e
  # aloca no capítulo II um óbito masculino codificado O24.1 (diabetes na gravidez) —
  # o mesmo registro que aparece na checagem cruzada de capítulos, em 2023/MG/Homens.
  # A asserção compara com o valor DO MICRODADO, para continuar detectando qualquer
  # deriva do pipeline, e a diferença para a ficha fica declarada aqui e no meta.
  iBR <- 1; iAmbos <- 1; i2023 <- which(as.integer(dm$years) == 2023)
  ds <- d$deaths_by_detailed_subgroup[[iBR]][[iAmbos]][[i2023]]
  mal <- sum(vapply(ds[1:6], pega, numeric(1)))
  reg("malignas BR/Ambos/2023 == 249.941 (ficha: 249.942)",
      as.integer(mal != 249941), 1L, sprintf("%.0f", mal))

  do.call(rbind, res)
}
