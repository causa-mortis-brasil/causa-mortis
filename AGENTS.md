# Regras de Desenvolvimento

Este arquivo define as regras e padrões que devem ser seguidos ao trabalhar neste projeto.

O objetivo é produzir código simples, legível, tipado, acessível, performático, consistente com a arquitetura existente e fácil de manter.

As regras deste documento têm prioridade sobre preferências pessoais de implementação.

---

## Sobre o projeto

Causa Mortis é um site de infográficos sobre mortalidade no Brasil, construído com Astro. Ele apresenta dados oficiais de óbitos (SIM/DATASUS e projeções do IBGE) através de visualizações interativas — evolução de taxas, causas de morte, distribuição geográfica, composição por idade e pirâmide de mortalidade por sexo.

---

Ao iniciar o servidor de desenvolvimento, utilize o modo em segundo plano:

```
astro dev --background
```

Gerencie o servidor em segundo plano com `astro dev stop`, `astro dev status` e `astro dev logs`.

Documentação completa: [https://docs.astro.build](https://docs.astro.build)

Consulte estes guias antes de trabalhar em tarefas relacionadas:

- [Adicionando páginas, rotas dinâmicas ou middleware](https://docs.astro.build/en/guides/routing/)
- [Trabalhando com componentes Astro](https://docs.astro.build/en/basics/astro-components/)
- [Utilizando componentes React, Vue, Svelte ou de outros frameworks](https://docs.astro.build/en/guides/framework-components/)
- [Adicionando ou gerenciando conteúdo](https://docs.astro.build/en/guides/content-collections/)
- [Adicionando estilos ou utilizando Tailwind](https://docs.astro.build/en/guides/styling/)
- [Oferecendo suporte a múltiplos idiomas](https://docs.astro.build/en/guides/internationalization/)

---

## Regras do desenvolvedor

- Não adicione comentários.
- Não adicione textos placeholder genéricos, use lorem ipsum quando necessário.
- Ícones devem vir da lib de ícones do projeto, Lucide (`@lucide/astro`, já instalada). Não crie SVGs de ícones manualmente nem adicione outra lib de ícones.

---

# Regras de Desenvolvimento

Este arquivo define as regras e padrões que devem ser seguidos ao trabalhar neste projeto.

O objetivo é produzir código simples, legível, tipado, acessível, performático, consistente com a arquitetura existente e fácil de manter.

As regras deste documento devem ser seguidas em todas as alterações realizadas no projeto.

---

# 1. Princípios fundamentais

## 1.1 Simplicidade

Prefira sempre a solução mais simples que resolva corretamente o problema.

Não introduza complexidade antecipadamente.

Não crie abstrações, camadas, padrões ou estruturas apenas porque podem ser úteis no futuro.

Uma solução deve existir porque há uma necessidade concreta.

## 1.2 Consistência

Antes de implementar qualquer funcionalidade:

1. Analise o código existente.
2. Identifique os padrões utilizados no projeto.
3. Reutilize os padrões existentes.
4. Mantenha a implementação consistente com o restante da aplicação.

Não introduza uma arquitetura diferente para resolver uma única funcionalidade.

## 1.3 Código mínimo

Escreva somente o código necessário.

Não crie:

- funções não utilizadas;
- componentes não utilizados;
- tipos não utilizados;
- variáveis desnecessárias;
- arquivos desnecessários;
- abstrações preventivas;
- dependências desnecessárias;
- configurações desnecessárias;
- código comentado;
- código morto.

## 1.4 Reutilização

Antes de criar algo novo, procure por uma implementação existente que possa ser reutilizada.

Evite duplicação.

Entretanto, não crie abstrações artificiais apenas para eliminar pequenas duplicações.

Código semelhante não necessariamente precisa compartilhar uma abstração.

A abstração deve representar uma responsabilidade real.

## 1.5 Manutenibilidade

O código deve ser compreensível por outro desenvolvedor sem depender do conhecimento das circunstâncias que levaram à sua implementação.

Prefira código explícito a soluções excessivamente inteligentes.

Evite:

- metaprogramação desnecessária;
- APIs excessivamente genéricas;
- funções com muitas responsabilidades;
- componentes gigantes;
- condicionais profundamente aninhados;
- lógica duplicada;
- efeitos colaterais escondidos.

---

# 2. Processo de desenvolvimento

## 2.1 Antes de alterar o código

Antes de implementar uma funcionalidade ou corrigir um problema:

1. Leia os arquivos relacionados à tarefa.
2. Leia os componentes que utilizam esses arquivos.
3. Procure implementações semelhantes.
4. Verifique os tipos existentes.
5. Verifique as configurações relevantes.
6. Identifique as convenções utilizadas pelo projeto.
7. Determine a menor alteração necessária.

Não comece criando arquivos imediatamente.

## 2.2 Não inventar requisitos

Implemente somente o que foi solicitado ou o que for necessário para que a funcionalidade funcione corretamente.

Não adicione funcionalidades extras por iniciativa própria.

Não altere partes não relacionadas da aplicação.

Se uma alteração adicional for necessária, mantenha-a restrita ao que for tecnicamente necessário.

## 2.3 Alterações existentes

Não reescreva arquivos inteiros quando uma alteração localizada for suficiente.

Preserve código existente que não esteja relacionado à tarefa.

Não faça refatorações oportunistas durante uma implementação sem necessidade.

## 2.4 Dependências

Não adicione uma dependência para resolver um problema que possa ser resolvido de maneira simples com recursos já existentes no projeto ou da própria plataforma.

Antes de adicionar uma dependência, verifique se:

- ela é realmente necessária;
- já existe uma dependência que resolve o problema;
- a funcionalidade pode ser implementada com APIs nativas;
- a dependência é compatível com a arquitetura existente.

Não adicione dependências sem necessidade concreta.

---

# 3. Arquitetura

## 3.1 Arquitetura existente

A arquitetura atual do projeto deve ser considerada a fonte principal de verdade.

Não introduza:

- novos padrões arquiteturais sem necessidade;
- novas camadas sem necessidade;
- novos sistemas de gerenciamento de estado sem necessidade;
- novos sistemas de componentes sem necessidade;
- novas abstrações globais sem necessidade.

## 3.2 Responsabilidade única

Cada módulo deve possuir uma responsabilidade clara.

Evite componentes ou funções responsáveis simultaneamente por:

- buscar dados;
- transformar dados;
- controlar estado;
- renderizar grandes estruturas;
- executar regras de negócio;
- manipular diretamente diversas APIs.

Separe responsabilidades quando a separação tornar o código mais simples e compreensível.

## 3.3 Abstrações

Não abstraia código apenas porque ele possui algumas linhas semelhantes.

Uma abstração deve:

- representar um conceito real;
- reduzir complexidade;
- melhorar reutilização;
- possuir uma responsabilidade clara.

Uma abstração que torna o código mais difícil de compreender deve ser evitada.

## 3.4 YAGNI

Não implemente funcionalidades futuras.

Não crie APIs genéricas "para quando forem necessárias".

Não crie parâmetros que ainda não possuem uso.

Não crie sistemas de configuração para comportamentos que possuem apenas uma implementação.

---

# 4. TypeScript

## 4.1 Tipagem estrita

O projeto deve utilizar TypeScript em modo estrito.

Não contorne o sistema de tipos para fazer o código compilar.

## 4.2 `any`

`any` é proibido.

Não utilize `any` para:

- corrigir erros de tipagem;
- simplificar código;
- trabalhar rapidamente;
- contornar bibliotecas mal tipadas.

Quando o tipo realmente não for conhecido, prefira `unknown`.

## 4.3 `unknown`

Utilize `unknown` quando um valor possuir tipo desconhecido.

O valor deve ser validado antes de ser utilizado.

## 4.4 Type assertions

Evite type assertions:

```ts
value as SomeType;
```

Utilize assertions somente quando o tipo puder ser garantido pela estrutura do programa e o TypeScript não conseguir inferi-lo corretamente.

Não utilize assertions para esconder erros de modelagem.

## 4.5 Inferência

Prefira a inferência de tipos quando ela produzir um tipo claro.

Evite anotações redundantes.

## 4.6 Tipos

Os tipos devem representar corretamente o domínio.

Não utilize tipos genéricos apenas para evitar definir o modelo real.

Evite:

```ts
Record<string, unknown>;
```

quando for possível representar a estrutura real dos dados.

## 4.7 `null` e `undefined`

Trate explicitamente valores que podem não existir.

Não esconda valores opcionais utilizando assertions.

## 4.8 Unions

Prefira unions quando representam corretamente estados distintos.

Exemplo:

```ts
type Status = "idle" | "loading" | "success" | "error";
```

Evite strings genéricas quando o conjunto de valores for conhecido.

## 4.9 Enums

Não utilize `enum` automaticamente.

Prefira unions de strings quando forem suficientes.

## 4.10 Funções

Funções devem possuir uma responsabilidade clara.

Evite funções que realizem diversas transformações não relacionadas.

Prefira funções puras quando possível.

---

# 5. Astro

## 5.1 Server-first

Astro deve ser utilizado seguindo sua arquitetura orientada a conteúdo e server-first.

Prefira executar lógica no servidor sempre que não houver necessidade de execução no navegador.

## 5.2 Componentes Astro

Use componentes `.astro` como padrão.

Não transforme um componente em componente de framework apenas para facilitar a implementação.

## 5.3 Islands

Framework components devem ser utilizados somente quando houver necessidade real de interatividade no cliente.

Não utilize React, Vue, Svelte ou outro framework dentro de Astro sem justificativa.

## 5.4 Hidratação

Não utilize diretivas de hidratação automaticamente.

Evite `client:load` quando o componente não precisar ser interativo imediatamente.

Escolha a diretiva de hidratação de acordo com a necessidade real.

## 5.5 JavaScript no cliente

Não envie JavaScript ao navegador quando HTML e CSS forem suficientes.

Antes de adicionar JavaScript, verifique se a funcionalidade pode ser implementada utilizando:

- HTML;
- CSS;
- formulários;
- links;
- recursos nativos do navegador.

## 5.6 Frontmatter

Mantenha o frontmatter dos componentes `.astro` organizado.

Separe claramente:

- imports;
- tipos;
- dados;
- lógica;
- propriedades.

Não coloque grandes quantidades de lógica de apresentação no frontmatter.

## 5.7 Props

Defina explicitamente os tipos das propriedades.

Utilize a tipagem de props fornecida pelo Astro.

Evite propriedades genéricas quando uma estrutura específica puder ser definida.

## 5.8 Layouts

Utilize layouts para estruturas realmente compartilhadas.

Não crie layouts para componentes que não possuem responsabilidade de layout.

## 5.9 Páginas

Páginas devem coordenar a composição da interface.

Evite transformar páginas em componentes gigantes.

## 5.10 Rotas

Siga a estrutura de rotas já existente.

Não introduza estruturas alternativas de roteamento.

## 5.11 Dados

Separe obtenção e transformação de dados da apresentação quando isso reduzir a complexidade.

Não mova lógica para arquivos separados apenas para aumentar a quantidade de arquivos.

---

# 6. Componentização

## 6.1 Componentes pequenos

Componentes devem possuir uma responsabilidade clara.

Não existe um limite rígido de linhas, mas componentes que crescem excessivamente devem ser avaliados para decomposição.

## 6.2 Não fragmentar excessivamente

Não transforme cada elemento HTML em um componente.

Evite componentes sem responsabilidade real, como:

```text
Text
Wrapper
Container
Row
Column
Box
Section
```

quando eles não possuírem comportamento ou significado próprio.

## 6.3 Componentes sem significado

Não crie componentes apenas para reduzir o número de linhas de outro componente.

A extração deve melhorar:

- reutilização;
- legibilidade;
- separação de responsabilidades;
- manutenção.

## 6.4 Props

Não passe dezenas de propriedades para um componente.

Se um componente exigir muitas propriedades, avalie se:

- ele possui responsabilidades demais;
- os dados podem ser agrupados;
- a composição pode ser melhorada.

## 6.5 Composição

Prefira composição a componentes excessivamente configuráveis.

Evite componentes com dezenas de flags booleanas.

---

# 7. Tailwind CSS 4

O projeto utiliza Tailwind CSS 4.

Utilize as APIs e convenções atuais do Tailwind CSS 4.

Não aplique automaticamente padrões encontrados em projetos Tailwind CSS 3.

Quando houver dúvida sobre uma funcionalidade, consulte a documentação oficial da versão utilizada no projeto antes de implementá-la.

O Tailwind CSS 4 utiliza uma abordagem CSS-first para configuração e design tokens, com `@theme`.

Em projetos Astro atuais, a integração recomendada do Tailwind CSS 4 utiliza `@tailwindcss/vite` e `@import "tailwindcss";`.

## 7.1 CSS-first

Prefira a configuração CSS-first do Tailwind CSS 4.

Não crie `tailwind.config.js`, `tailwind.config.ts` ou equivalente apenas por hábito de versões anteriores.

Não introduza uma configuração legada quando os recursos nativos do Tailwind CSS 4 forem suficientes.

## 7.2 `@theme`

Utilize `@theme` para definir tokens que devem originar utilitários Tailwind.

Exemplo:

```css
@theme {
  --color-primary: oklch(0.6 0.2 250);
}
```

Isso permite utilizar os tokens através dos utilitários correspondentes.

Não repita valores de design diretamente em dezenas de componentes quando o valor representar um token compartilhado.

## 7.3 Design tokens

Utilize os tokens existentes no projeto.

Cores, espaçamentos, tipografia, raios, sombras, fontes e breakpoints recorrentes devem utilizar os valores definidos pelo design system.

Não invente valores semelhantes aos existentes.

Quando um valor visual recorrente não existir, avalie a criação de um token apropriado em vez de repetir valores arbitrários.

## 7.4 Valores arbitrários

Evite valores arbitrários quando existir um utilitário ou token adequado.

Evite:

```text
w-[317px]
p-[17px]
mt-[23px]
text-[15px]
z-[9999]
```

Valores arbitrários são permitidos quando representam uma necessidade específica que não pode ser atendida adequadamente pelos tokens existentes.

Não utilize valores arbitrários para compensar um layout mal estruturado.

Antes de utilizar um valor arbitrário, verifique se o problema pode ser resolvido utilizando:

- flexbox;
- grid;
- gap;
- padding;
- margin;
- max-width;
- min-width;
- container;
- tokens existentes;
- unidades relativas.

## 7.5 Classes redundantes

Não adicione utilitários redundantes.

Evite classes que não alterem o resultado final.

Exemplo:

```text
flex flex-row
```

quando `flex-row` não for necessário.

Não mantenha classes conflitantes.

Revise as classes antes de finalizar uma implementação.

## 7.6 Classes conflitantes

Não utilize simultaneamente classes que representam valores conflitantes sem uma razão clara.

Evite:

```text
block flex
text-left text-center
w-full w-1/2
hidden block
```

quando não houver uma variante condicional ou responsiva justificando o comportamento.

## 7.7 Ordem e legibilidade

Mantenha as classes Tailwind organizadas de maneira consistente com o projeto.

Quando existir uma ferramenta de ordenação de classes configurada no projeto, utilize-a.

Não tente criar manualmente uma convenção diferente da ferramenta existente.

Não sacrifique legibilidade para reduzir caracteres.

## 7.8 Responsividade

Utilize breakpoints somente quando houver alteração real de layout ou comportamento.

Não adicione breakpoints por padrão.

Evite:

```text
text-sm md:text-base lg:text-lg xl:text-xl
```

quando não houver uma necessidade real de alterar a tipografia em cada breakpoint.

Prefira uma composição que funcione naturalmente em diferentes tamanhos de tela.

## 7.9 Mobile-first

Utilize a abordagem mobile-first do Tailwind.

Comece pelo comportamento base e adicione variantes para telas maiores quando necessário.

Não escreva estilos para desktop primeiro e tente corrigir o comportamento mobile posteriormente.

## 7.10 Espaçamento

Prefira `gap` para espaçamento entre elementos de uma mesma composição.

Evite utilizar margens individuais para reproduzir espaçamento entre elementos quando `gap` resolver corretamente.

Prefira:

```text
flex gap-4
```

a múltiplos elementos com margens artificiais quando a relação entre eles for de espaçamento de composição.

## 7.11 Layout

Prefira:

- flexbox;
- grid;
- fluxo normal do documento.

Evite `absolute` quando o problema puder ser resolvido pelo sistema normal de layout.

Não utilize posicionamento absoluto para corrigir uma estrutura HTML inadequada.

## 7.12 Estados

Prefira variantes nativas do Tailwind para estados visuais:

```text
hover:
focus:
focus-visible:
active:
disabled:
group:
peer:
aria-*:
data-*:
```

Não utilize JavaScript para controlar estados puramente visuais que possam ser representados pelo CSS.

## 7.13 `group`

Utilize `group` quando um estado visual de um elemento depender do estado de outro elemento ancestral.

Não introduza JavaScript para esse tipo de interação visual.

## 7.14 `peer`

Utilize `peer` quando um estado visual depender de um elemento irmão.

Não utilize JavaScript quando uma variante CSS resolver corretamente o problema.

## 7.15 Atributos `data-*` e `aria-*`

Utilize variantes baseadas em atributos quando a interface já possuir estados representados semanticamente por esses atributos.

Não duplique estado em JavaScript apenas para controlar estilos.

## 7.16 `!important`

Não utilize `!important` como solução para conflitos de estilos.

Evite:

```text
!important
```

sem uma justificativa técnica real.

Antes de utilizar `!important`, identifique a origem do conflito.

## 7.17 `z-index`

Não utilize valores arbitrariamente altos:

```text
z-[9999]
z-[99999]
z-[2147483647]
```

Estabeleça uma hierarquia de camadas coerente.

Se o projeto possuir tokens de `z-index`, utilize-os.

## 7.18 `@apply`

Não utilize `@apply` indiscriminadamente.

Não utilize `@apply` apenas para transformar uma longa lista de utilitários em uma classe CSS.

Não use `@apply` para esconder componentes mal estruturados.

Utilize `@apply` somente quando houver uma razão concreta e consistente com a arquitetura do projeto.

## 7.19 CSS tradicional

Não crie CSS tradicional apenas para evitar escrever classes Tailwind.

CSS tradicional é aceitável quando:

- Tailwind não representa adequadamente a necessidade;
- existe uma regra CSS complexa;
- existe uma necessidade específica do navegador;
- uma abstração CSS melhora claramente a manutenção;
- o comportamento pertence naturalmente a uma regra CSS.

Não misture múltiplos sistemas de estilização sem necessidade.

## 7.20 Componentes e classes

Não crie um componente apenas para esconder uma lista grande de classes Tailwind.

Uma lista extensa de classes pode indicar um componente com responsabilidades demais, mas isso deve ser avaliado antes da extração.

Não transforme cada combinação visual em um componente.

## 7.21 Classes condicionais

Quando classes forem condicionais, utilize a abordagem já existente no projeto.

Não introduza uma biblioteca como `clsx`, `classnames` ou equivalente se o projeto não precisar dela.

Se o projeto já utilizar uma função utilitária para composição de classes, reutilize-a.

## 7.22 Design system

Não invente:

- cores;
- espaçamentos;
- tamanhos;
- sombras;
- raios;
- breakpoints;
- famílias tipográficas.

quando o projeto já possuir tokens equivalentes.

O design system existente deve ser a fonte de verdade.

## 7.23 Tailwind e HTML

Não utilize Tailwind para compensar HTML semanticamente incorreto.

Primeiro corrija a estrutura.

Depois estilize a estrutura.

## 7.24 Tailwind e JavaScript

Não utilize JavaScript para resolver problemas que pertencem ao CSS.

Antes de adicionar estado ou lógica JavaScript para uma interação visual, verifique se:

- variantes Tailwind;
- `group`;
- `peer`;
- `data-*`;
- `aria-*`;
- pseudo-classes;

resolvem o problema.

---

# 8. HTML

## 8.1 HTML semântico

Utilize elementos HTML de acordo com seu significado.

Prefira:

```html
<button></button>
```

a:

```html
<div></div>
```

quando o elemento representar uma ação.

Utilize corretamente:

- `header`;
- `nav`;
- `main`;
- `section`;
- `article`;
- `aside`;
- `footer`;
- `button`;
- `a`;
- `form`;
- `label`.

## 8.2 Links

Utilize links para navegação.

Não utilize `button` para navegação.

## 8.3 Botões

Utilize `button` para ações.

Não utilize elementos não interativos com eventos de clique quando um `button` resolver o problema.

## 8.4 Formulários

Campos de formulário devem possuir labels apropriados.

Utilize os tipos HTML corretos.

Não recrie funcionalidades nativas do navegador sem necessidade.

---

# 9. Acessibilidade

Acessibilidade deve fazer parte da implementação inicial.

Não trate acessibilidade como uma etapa opcional.

## 9.1 Teclado

Toda funcionalidade interativa deve ser acessível por teclado.

## 9.2 Foco

Não remova indicadores de foco sem fornecer uma alternativa visual adequada.

## 9.3 Imagens

Imagens informativas devem possuir texto alternativo apropriado.

Imagens puramente decorativas devem ser tratadas como decorativas.

## 9.4 Contraste

Mantenha contraste adequado entre conteúdo e fundo.

## 9.5 ARIA

Não utilize ARIA quando HTML semântico resolver o problema.

ARIA deve complementar HTML semântico, não substituí-lo.

## 9.6 Formulários

Inputs devem possuir labels associados.

Mensagens de erro devem ser identificáveis e compreensíveis.

---

# 10. Performance

## 10.1 JavaScript

Minimize JavaScript enviado ao cliente.

Em Astro, prefira HTML estático sempre que possível.

## 10.2 Hidratação

Evite hidratar componentes que não precisam de interatividade.

## 10.3 Imagens

Utilize o sistema de imagens do Astro quando apropriado.

Evite imagens maiores que o necessário.

## 10.4 Carregamento

Não carregue recursos antecipadamente sem necessidade.

Evite:

- scripts desnecessários;
- fontes excessivas;
- imagens desnecessárias;
- bibliotecas grandes para pequenas funcionalidades.

## 10.5 Dependências

Considere o custo de cada dependência adicionada ao bundle.

Uma biblioteca inteira não deve ser adicionada para resolver uma necessidade trivial.

---

# 11. SEO

Páginas públicas devem possuir estrutura adequada para mecanismos de busca.

Quando aplicável:

- `title`;
- `meta description`;
- headings semânticos;
- URLs apropriadas;
- canonical;
- Open Graph;
- Twitter Cards;
- dados estruturados.

## 11.1 Headings

Mantenha uma hierarquia lógica de headings.

Não escolha headings apenas pela aparência visual.

Utilize CSS para controlar apresentação.

## 11.2 Metadata

Metadata deve ser específica para a página quando o conteúdo for específico.

Evite títulos e descrições genéricos quando houver conteúdo dinâmico.

---

# 12. CSS

## 12.1 Responsividade

Implemente interfaces responsivas.

Não desenvolva somente para uma resolução específica.

## 12.2 Layout

Prefira:

- flexbox;
- grid;
- fluxo normal do documento.

antes de posicionamento absoluto.

## 12.3 Z-index

Evite valores arbitrariamente altos de `z-index`.

Quando vários elementos utilizarem camadas, estabeleça uma hierarquia coerente.

---

# 13. Estado

## 13.1 Estado local

Mantenha estado próximo de onde ele é utilizado.

Não transforme estado local em estado global sem necessidade.

## 13.2 Estado global

Não introduza gerenciamento de estado global para resolver problemas locais.

Antes de criar estado global, verifique se:

- props;
- composição;
- URL;
- estado local;
- dados do servidor;

já resolvem o problema.

## 13.3 URL

Quando um estado representar uma condição navegável ou compartilhável, considere se ele deve estar representado na URL.

---

# 14. Manipulação de dados

## 14.1 Validação

Dados externos devem ser considerados não confiáveis.

Isso inclui:

- APIs;
- formulários;
- parâmetros de URL;
- conteúdo externo;
- respostas de serviços.

Valide dados quando necessário.

## 14.2 Transformação

Separe transformação de dados da apresentação quando isso tornar o código mais simples.

Evite realizar várias transformações encadeadas diretamente no template.

## 14.3 Dados duplicados

Não mantenha múltiplas representações da mesma informação sem necessidade.

Prefira uma única fonte de verdade.

---

# 15. Tratamento de erros

## 15.1 Erros explícitos

Não ignore erros silenciosamente.

Evite:

```ts
try {
  await operation();
} catch {}
```

## 15.2 Fallbacks

Interfaces que dependem de dados externos devem possuir estados apropriados quando necessário:

- carregamento;
- erro;
- vazio;
- sucesso.

## 15.3 Mensagens

Mensagens apresentadas ao usuário devem ser compreensíveis.

Não exponha detalhes internos da aplicação desnecessariamente.

---

# 16. Segurança

Nunca confie em dados fornecidos pelo cliente.

Não insira conteúdo externo diretamente no HTML sem a devida segurança.

Evite manipulação manual do DOM quando APIs declarativas forem suficientes.

Não desative mecanismos de segurança para simplificar uma implementação.

Segredos não devem ser armazenados no código-fonte.

Credenciais e chaves privadas não devem ser expostas ao cliente.

---

# 17. Manipulação do DOM

Evite manipulação direta do DOM.

Antes de utilizar:

```ts
document.querySelector();
```

ou APIs semelhantes, verifique se a funcionalidade pode ser implementada utilizando a arquitetura do framework.

Manipulação direta do DOM deve possuir uma justificativa concreta.

---

# 18. JavaScript

## 18.1 APIs nativas

Prefira APIs nativas do navegador quando forem suficientes.

Não utilize bibliotecas para funcionalidades triviais.

## 18.2 Código assíncrono

Utilize `async` e `await` quando melhorarem a legibilidade.

Evite cadeias de promises desnecessariamente complexas.

## 18.3 Efeitos colaterais

Mantenha efeitos colaterais explícitos.

Evite funções que parecem puras mas alteram estado externo.

## 18.4 Imutabilidade

Prefira não mutar dados compartilhados.

Utilize transformações que produzam novos valores quando isso melhorar previsibilidade e manutenção.

Não aplique imutabilidade de maneira artificial quando uma mutação local simples for mais clara.

---

# 19. Funções

Funções devem ser pequenas o suficiente para que sua responsabilidade seja facilmente compreendida.

Evite funções que:

- façam várias tarefas não relacionadas;
- possuam muitos parâmetros;
- tenham muitos níveis de aninhamento;
- dependam de estado global desnecessariamente.

Prefira composição de funções simples.

---

# 20. Condicionais

Evite condicionais profundamente aninhadas.

Prefira retornos antecipados quando isso tornar o fluxo mais claro.

Evite abstrações complexas para eliminar condicionais simples.

Não transforme lógica simples em padrões excessivamente sofisticados.

---

# 21. Nomenclatura

Utilize nomes descritivos.

Evite:

```text
data
item
thing
value
temp
foo
bar
result
obj
```

quando um nome específico for possível.

Nomes devem representar o significado do valor.

Funções devem utilizar verbos quando apropriado.

Componentes devem representar conceitos da interface ou domínio.

## 21.1 Idioma do código

Código e nomes de arquivo devem ser sempre em inglês: identificadores (variáveis,
funções, tipos, classes, propriedades, IDs e classes CSS/HTML, chaves de dados
internas) e comentários.

Isso não se aplica a conteúdo voltado ao usuário final — o site é em pt-BR, então
textos de interface (labels, headings, mensagens, tooltips, rótulos de dados como
nomes de UF/sexo/causa) permanecem em português, pois são conteúdo, não código.

Arquivos de documentação (README, etc.) também são conteúdo, não código: devem
ser escritos em português.

---

# 22. Comentários

Não adicione comentários explicativos ao código por padrão.

O código deve ser escrito de forma suficientemente clara para que sua intenção seja compreendida pela leitura da implementação.

Não adicione comentários que:

- descrevam o que uma linha de código faz;
- repitam o nome de uma função ou variável;
- expliquem sintaxe;
- expliquem operações óbvias;
- narrem passo a passo o código;
- justifiquem decisões triviais;
- sejam utilizados para tornar código complexo aparentemente compreensível.

Não utilize comentários como substituto para:

- nomes melhores;
- funções menores;
- componentes menores;
- melhor separação de responsabilidades;
- melhor estrutura de código.

Comentários são permitidos quando registrarem uma informação que não possa ser obtida facilmente lendo o código, especialmente:

- decisões arquiteturais;
- restrições impostas por uma API externa;
- limitações de uma biblioteca;
- comportamentos inesperados de uma plataforma;
- decisões tomadas por motivos de compatibilidade;
- regras de negócio não óbvias.

Não escreva comentários para explicar ao desenvolvedor o que o código está fazendo quando isso puder ser compreendido diretamente pelo código.

Não deixe código antigo comentado.

Comentários devem ser exceção, não padrão.

---

# 23. JSDoc

Não utilize JSDoc para narrar implementações óbvias.

Não adicione JSDoc automaticamente a todas as funções.

JSDoc pode ser utilizado quando necessário para representar contratos públicos, tipos complexos ou informações que não sejam expressas adequadamente pelo TypeScript.

Quando JSDoc for utilizado, mantenha-o objetivo.

Não escreva documentação explicativa extensa dentro do código.

---

# 24. Documentação

Documente APIs públicas e comportamentos que realmente necessitem de documentação.

Não escreva documentação redundante.

Tipos devem ser documentados pelo próprio sistema de tipos sempre que possível.

---

# 25. Formatação

Siga as ferramentas de formatação e linting existentes no projeto.

Não introduza um formatador adicional sem necessidade.

Não altere configurações de formatação apenas para acomodar uma implementação.

O código final deve estar formatado conforme os padrões existentes.

## 25.1 Prettier

O projeto utiliza Prettier (com `prettier-plugin-astro`) como formatador obrigatório.

Antes de finalizar qualquer tarefa, execute:

```bash
npm run format
```

Nenhuma tarefa deve ser considerada concluída com `npm run format:check` falhando.

`npm run build` já executa `format:check` automaticamente; não remova ou contorne essa verificação.

Não altere as configurações do Prettier (`.prettierrc.json`, `.prettierignore`) sem necessidade relacionada à tarefa.

---

# 26. ESLint

Todo código deve estar em conformidade com as regras do ESLint configuradas no projeto.

Não desabilite regras apenas para fazer uma implementação passar.

Não utilize:

```text
eslint-disable
```

sem uma justificativa técnica real.

---

# 27. Type checking

Antes de considerar uma tarefa concluída, execute a verificação de tipos disponível no projeto.

Em projetos Astro, utilize:

```bash
astro check
```

quando esse comando estiver disponível.

Todos os erros relevantes devem ser corrigidos.

Não finalize uma tarefa deixando erros introduzidos pela implementação.

---

# 28. Testes

Quando existirem testes no projeto:

1. Identifique os testes relevantes.
2. Execute-os após a implementação.
3. Corrija falhas causadas pela alteração.
4. Adicione testes quando a funcionalidade ou correção exigir cobertura.

Não altere testes apenas para fazer uma implementação incorreta passar.

---

# 29. Refatoração

Refatore quando a implementação resultar em:

- duplicação significativa;
- responsabilidades misturadas;
- nomes inadequados;
- complexidade desnecessária;
- código difícil de testar;
- código difícil de compreender.

Não refatore partes não relacionadas sem necessidade.

---

# 30. Código legado

Ao trabalhar em código legado:

1. Preserve o comportamento existente.
2. Evite reescrever tudo.
3. Faça a menor alteração segura.
4. Melhore a estrutura somente quando necessário para a tarefa.

Não introduza novos padrões incompatíveis com o restante do código sem uma razão concreta.

---

# 31. Migrações

Durante migrações de tecnologia:

- preserve comportamento;
- mantenha APIs existentes quando necessário;
- faça alterações incrementais;
- remova código antigo somente quando não houver dependências;
- não misture migração com mudanças funcionais não relacionadas.

---

# 32. Arquivos

Não crie arquivos sem necessidade.

Antes de criar um novo arquivo, verifique se a funcionalidade pode ser adicionada a uma estrutura existente sem prejudicar a organização.

Não crie:

```text
utils.ts
helpers.ts
common.ts
misc.ts
shared.ts
```

apenas para armazenar funções que não possuem uma responsabilidade claramente definida.

Prefira arquivos organizados por responsabilidade ou domínio.

---

# 33. Organização

A organização deve facilitar a localização do código.

Componentes relacionados devem permanecer próximos quando isso fizer sentido.

Não crie estruturas de diretórios excessivamente profundas.

Evite categorizar arquivos em excesso apenas para manter diretórios aparentemente organizados.

---

# 34. Regras contra código lixo

Nunca introduza deliberadamente:

- `any`;
- `@ts-ignore`;
- `@ts-nocheck`;
- código duplicado;
- código morto;
- funções não utilizadas;
- imports não utilizados;
- variáveis não utilizadas;
- componentes não utilizados;
- dependências desnecessárias;
- abstrações prematuras;
- arquivos sem responsabilidade clara;
- manipulação desnecessária do DOM;
- JavaScript desnecessário no cliente;
- hidratação desnecessária;
- valores mágicos quando houver constantes ou tokens apropriados;
- CSS duplicado;
- classes Tailwind redundantes;
- valores arbitrários desnecessários;
- `z-index` arbitrariamente altos;
- `!important` sem necessidade;
- condicionais excessivamente complexas;
- componentes excessivamente configuráveis;
- soluções mais complexas do que o problema exige.

---

# 35. Não otimizar prematuramente

Não introduza otimizações complexas sem evidência de que são necessárias.

Primeiro produza uma implementação correta, simples e mensurável.

Otimize quando houver:

- evidência;
- requisito;
- gargalo conhecido;
- necessidade de escala.

Não sacrifique legibilidade por micro-otimizações.

---

# 36. Não alterar a configuração sem necessidade

Não altere:

- `tsconfig`;
- `astro.config`;
- configuração do Tailwind;
- ESLint;
- Prettier;
- package manager;
- scripts;
- build;
- integrações;

sem necessidade relacionada à tarefa.

Toda alteração de configuração deve possuir uma razão concreta.

---

# 37. Dependências e pacotes

Antes de instalar qualquer pacote:

1. Verifique se a funcionalidade já existe.
2. Verifique se o projeto já possui uma dependência equivalente.
3. Considere a API nativa.
4. Considere o custo de manutenção.
5. Considere o impacto no bundle.

Não instale bibliotecas apenas por conveniência.

---

# 38. Compatibilidade

Respeite as versões definidas pelo projeto.

Não utilize APIs incompatíveis com as versões suportadas.

Antes de introduzir uma API recente, verifique a compatibilidade com o ambiente do projeto.

---

# 39. Mudanças de API

Não altere APIs públicas ou contratos existentes sem necessidade.

Quando uma mudança for necessária:

- identifique os consumidores;
- atualize os tipos;
- atualize os usos;
- atualize os testes;
- mantenha comportamento consistente quando possível.

---

# 40. Antes de finalizar uma tarefa

Toda tarefa deve passar pelo seguinte processo.

## Análise

- [ ] O código existente foi analisado?
- [ ] Foram encontrados padrões semelhantes?
- [ ] A implementação segue a arquitetura existente?
- [ ] Foi evitada uma abstração desnecessária?

## Implementação

- [ ] O código é mínimo?
- [ ] Não existem duplicações desnecessárias?
- [ ] Não foram criados arquivos desnecessários?
- [ ] Não foram adicionadas dependências desnecessárias?
- [ ] Os componentes possuem responsabilidades claras?
- [ ] O código utiliza TypeScript corretamente?
- [ ] Não existe `any`?
- [ ] Não existem assertions desnecessárias?
- [ ] Astro está sendo utilizado de maneira server-first?
- [ ] Não existe JavaScript desnecessário no cliente?
- [ ] Não existe hidratação desnecessária?
- [ ] Tailwind 4 está sendo utilizado corretamente?
- [ ] Os tokens existentes estão sendo reutilizados?
- [ ] Não existem valores arbitrários desnecessários?
- [ ] Não existem classes conflitantes?
- [ ] Não existem classes redundantes?
- [ ] Não existe `!important` desnecessário?
- [ ] Não existem valores arbitrários de `z-index`?
- [ ] HTML é semântico?
- [ ] Acessibilidade foi considerada?
- [ ] SEO foi considerado quando aplicável?

## Qualidade

- [ ] Não existem imports não utilizados?
- [ ] Não existem variáveis não utilizadas?
- [ ] Não existe código morto?
- [ ] Não existem comentários explicativos desnecessários?
- [ ] Não existe código antigo comentado?
- [ ] Os nomes são claros?
- [ ] A implementação é simples?
- [ ] A solução não possui complexidade desnecessária?
- [ ] Não foram introduzidas abstrações prematuras?

## Verificação

Execute as ferramentas disponíveis no projeto.

Quando aplicável:

```bash
astro check
```

```bash
npm run format:check
```

```bash
npm run lint
```

```bash
npm test
```

Corrija os problemas encontrados antes de finalizar.

---

# 41. Regra final

Quando houver dúvida entre duas soluções tecnicamente válidas, prefira, nesta ordem:

1. A solução que já segue o padrão do projeto.
2. A solução mais simples.
3. A solução com menor quantidade de código.
4. A solução com menor quantidade de dependências.
5. A solução com menor quantidade de JavaScript no cliente.
6. A solução com menor quantidade de abstrações.
7. A solução mais fácil de testar.
8. A solução mais fácil de compreender e manter.

Não escreva código apenas para demonstrar capacidade técnica.

Não complique uma solução simples.

Não crie abstrações para problemas que ainda não existem.

Não adicione comentários para explicar código que deveria ser autoexplicativo.

Não utilize Tailwind para mascarar problemas de arquitetura, HTML ou layout.

Não utilize TypeScript para mascarar problemas de modelagem.

Não utilize JavaScript para resolver problemas que HTML ou CSS resolvem.

O objetivo é produzir software correto, simples, consistente, acessível, performático e sustentável.
