// Português do Brasil (você). Reescrito a partir da versão em inglês (en.ts), não traduzido palavra por palavra.
// O app só tem interface em coreano e inglês, então os nomes de menu ficam em inglês, com o sentido ao lado.
// Nomes do macOS conferidos no suporte da Apple em português do Brasil (10-08):
//   Ajustes do Sistema › Privacidade e Segurança › Abrir Mesmo Assim / Ajustes do Sistema › Telas › Organizar
// ⚠️O título exato do aviso do SmartScreen em português não foi confirmado em fonte confiável, então ele vem descrito, sem aspas.
// Windows: a página de tela tem nomes diferentes no Windows 10 e 11, então só escrevemos «Configurações › Sistema».
import type { Copy } from "./types";

export const ptBR: Copy = {
  title: "MonitorAlign — Organize dois monitores em dois cliques (grátis, Mac e Windows)",
  description:
    "Mudou de mesa e agora o ponteiro sai pela borda errada? O MonitorAlign organiza seus dois monitores de novo em dois cliques. Grátis para Mac e Windows.",
  ogTitle: "MonitorAlign — Organize dois monitores em dois cliques",
  keywords: ["organizar monitores", "dois monitores Mac", "posição do monitor externo"],
  back: "Projetos paralelos",
  lead: "Toda vez que você muda de mesa, os monitores ficam em outro lugar. O MonitorAlign alinha tudo de novo em dois cliques.",
  downloads: {
    mac: ["Baixar para macOS", "macOS 13 ou posterior · Intel e Apple silicon"],
    windows: ["Baixar para Windows", "Windows 10 e 11"],
    soon: "Em breve",
  },
  free: "Grátis e sem cadastro.",
  autoUpdate: "Quando sai uma versão nova, o app avisa e você atualiza na hora.",
  whyTitle: "Por que existe",
  why: [
    "Segunda em casa, terça num café, quarta no escritório. O monitor externo fica de um lado diferente a cada vez, mas o computador continua lembrando a disposição antiga, e o ponteiro escapa pela borda errada.",
    "Em vez de arrastar retângulos nos ajustes de tela, você só clica onde quer passar.",
  ],
  howTitle: "Como funciona",
  howToName: "Como organizar dois monitores com o MonitorAlign",
  steps: [
    {
      text: "Clique no ícone da barra de menus e escolha **Align Monitors** (alinhar monitores). No Windows, o ícone fica na bandeja do sistema.",
      shortcutLead: "Ou pressione",
      note: "Difícil de alcançar? Você mesmo pode definir ou trocar o atalho. Abra **Shortcut Settings** (ajustes de atalho) no menu e pressione as teclas que quiser.",
    },
    { text: "Nesta tela, clique perto da borda por onde o ponteiro deve passar." },
    { text: "Vá para a outra tela e clique onde ele deve entrar." },
    { text: "Confirme, e os dois pontos se encaixam." },
  ],
  undo: { text: "Errou? O atalho de desfazer traz a disposição anterior de volta.", custom: "" },
  featuresTitle: "O que você ganha",
  features: [
    "Grátis para baixar e usar.",
    "Leve: cerca de 430 KB compactado no Mac e cerca de 60 KB no Windows.",
    "Sem permissões especiais no Mac. Nunca pede acesso de Acessibilidade.",
    "Um único atalho desfaz uma disposição que ficou errada.",
    "Atalhos que você pode trocar e atualizações que se instalam de dentro do app.",
  ],
  firstTitle: "Ao abrir pela primeira vez",
  firstIntro: "O app ainda não é assinado pela Apple nem pela Microsoft, então um aviso aparece na primeira vez que você o abrir.",
  firstMac: [
    "Mac",
    "Se o macOS disser que não é possível verificar o desenvolvedor, vá em **Ajustes do Sistema › Privacidade e Segurança** e clique em **Abrir Mesmo Assim**.",
  ],
  firstWin: [
    "Windows",
    "Se aparecer o aviso do SmartScreen dizendo que o Windows protegeu o computador, clique em **Mais informações** e depois em **Executar assim mesmo**.",
  ],
  faqTitle: "Perguntas frequentes",
  faq: [
    {
      q: "Como organizar os monitores no Mac?",
      a: "O jeito padrão é abrir Ajustes do Sistema › Telas, clicar em Organizar e arrastar os retângulos das telas até onde os monitores estão de verdade na sua mesa. Com o MonitorAlign você nem abre essa janela: clica uma vez onde o ponteiro deve sair e outra onde ele deve entrar.",
    },
    {
      q: "Como organizar os monitores no Windows?",
      a: "Em Configurações › Sistema, abra os ajustes de tela, arraste os retângulos numerados até a posição real dos monitores e clique em Aplicar. O MonitorAlign para Windows (em breve) faz o mesmo em dois cliques.",
    },
    {
      q: "Por que o mouse não passa para o segundo monitor?",
      a: "Porque a disposição que o computador lembra não bate com a posição real dos monitores. Se o monitor está à sua esquerda mas o computador acha que está à direita, o ponteiro não passa quando você vai para a esquerda. Ajuste a disposição à posição real e volta a funcionar na hora.",
    },
    {
      q: "É seguro? O que exatamente ele muda?",
      a: "Só a disposição das telas. É a mesma mudança que você faria arrastando as telas nos ajustes do macOS ou do Windows, e o atalho de desfazer traz a disposição anterior de volta.",
    },
    { q: "Funciona com três monitores?", a: "Ainda não. Por enquanto, só com duas telas." },
    {
      q: "Ele coleta dados?",
      a: "Não. Não tem conta nem ferramenta de análise no app. A única conexão é para baixar um pequeno arquivo de atualização de collab5.co.kr.",
    },
    {
      q: "Do que eu preciso?",
      a: "macOS 13 ou posterior em Intel ou Apple silicon, ou Windows 10 ou 11.",
    },
  ],
  supportTitle: "Apoie",
  supportText: "Se ele te poupou um pouco de trabalho, você pode contribuir. Isso me ajuda a continuar fazendo ferramentas pequenas como esta.",
  footer: "Um projeto pessoal de quem faz o collab5. Não faz parte do serviço collab5.",
  macLabel: "Mac",
  winLabel: "Windows",
  fig: {
    desk: "Na sua mesa",
    mem: "O que o computador lembra",
    whyLabel: "O monitor está em cima à esquerda, mas o computador acha que está à direita, então o ponteiro bate numa parede ao subir",
    menu: ["Align Monitors…", "Undo", "Shortcut Settings…", "How to Use"],
    menuLabel: "Clicar no ícone de duas telas na barra de menus e escolher Align Monitors",
    firstLabel: "As duas telas escurecem; um clique na parte esquerda da borda superior do notebook marca essa borda com uma barra azul e um ponto",
    secondLabel: "Passar para o monitor e clicar na parte direita da borda inferior dele",
    pill: "Aligned",
    pillWidth: 92,
    doneLabel: "Os dois pontos se encaixam, e o ponteiro que sobe do notebook entra direto no canto inferior direito do monitor",
  },
};
