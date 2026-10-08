// Français (vouvoiement). Réécrit à partir de la version anglaise (en.ts), pas traduit mot à mot.
// L’app n’existe qu’en coréen et en anglais : les noms de menu restent en anglais, avec leur sens à côté.
// Libellés macOS vérifiés sur le support Apple en français (10-08) :
//   Réglages Système › Confidentialité et sécurité › Ouvrir quand même / Réglages Système › Moniteurs › Organiser
// Windows : la page « Affichage » ne porte pas le même nom sous Windows 10 et 11, on écrit seulement « Paramètres › Système ».
// Espaces insécables ( ) avant ? ! : et à l’intérieur des guillemets, comme le veut la typographie française.
import type { Copy } from "./types";

export const fr: Copy = {
  title: "MonitorAlign — Alignez deux écrans en deux clics (gratuit, Mac et Windows)",
  description:
    "Vous changez de bureau et le pointeur sort par le mauvais bord ? MonitorAlign réaligne vos deux écrans en deux clics. Gratuit pour Mac et Windows.",
  ogTitle: "MonitorAlign — Alignez deux écrans en deux clics",
  keywords: ["disposition des écrans Mac", "aligner deux écrans", "écran externe position"],
  back: "Projets perso",
  lead: "À chaque changement de bureau, vos écrans se retrouvent ailleurs. MonitorAlign les réaligne en deux clics.",
  downloads: {
    mac: ["Télécharger pour macOS", "macOS 13 ou ultérieur · Intel et puce Apple"],
    windows: ["Télécharger pour Windows", "Windows 10 et 11"],
    soon: "Bientôt disponible",
  },
  free: "Gratuit, sans compte.",
  autoUpdate: "Quand une nouvelle version sort, l’app vous prévient et vous pouvez la mettre à jour tout de suite.",
  whyTitle: "Pourquoi cette app",
  why: [
    "Je travaille souvent dans des endroits différents, et l’écran se retrouve à une place différente à chaque fois. Mais l’ordinateur garde en mémoire l’ancienne disposition, et le pointeur s’échappe par le mauvais bord.",
    "Au lieu de faire glisser des rectangles dans les réglages d’affichage, vous cliquez simplement là où vous voulez passer.",
  ],
  howTitle: "Comment ça marche",
  howToName: "Aligner deux écrans avec MonitorAlign",
  steps: [
    {
      text: "Cliquez sur l’icône dans la barre des menus et choisissez **Align Monitors** (aligner les écrans). Sous Windows, l’icône se trouve dans la zone de notification.",
      shortcutLead: "Ou appuyez sur",
      note: "Raccourci peu pratique ? Vous pouvez le définir ou le modifier vous-même. Ouvrez **Shortcut Settings** (réglages des raccourcis) dans le menu et appuyez sur les touches de votre choix.",
    },
    { text: "Sur cet écran, cliquez près du bord par lequel le pointeur doit passer." },
    { text: "Passez sur l’autre écran et cliquez là où il doit arriver." },
    { text: "Confirmez, et les deux points se rejoignent." },
  ],
  undo: { text: "Une erreur ? Le raccourci d’annulation rétablit la disposition précédente.", custom: "" },
  featuresTitle: "Ce que vous obtenez",
  features: [
    "Gratuit à télécharger et à utiliser.",
    "Léger : environ 430 Ko compressé sur Mac, environ 60 Ko sur Windows.",
    "Aucune autorisation spéciale sur Mac. L’app ne demande jamais l’accès à l’accessibilité.",
    "Un seul raccourci annule une disposition ratée.",
    "Des raccourcis modifiables, et des mises à jour qui s’installent depuis l’app.",
  ],
  firstTitle: "À la première ouverture",
  firstIntro: "L’app n’est pas encore signée par Apple ni par Microsoft, vous verrez donc un avertissement la première fois que vous l’ouvrirez.",
  firstMac: [
    "Mac",
    "Si macOS indique que le développeur ne peut pas être vérifié, allez dans **Réglages Système › Confidentialité et sécurité** et cliquez sur **Ouvrir quand même**.",
  ],
  firstWin: [
    "Windows",
    "Si le message **Windows a protégé votre ordinateur** s’affiche, cliquez sur **Informations complémentaires**, puis sur **Exécuter quand même**.",
  ],
  faqTitle: "Questions fréquentes",
  faq: [
    {
      q: "Comment changer la disposition des écrans sur Mac ?",
      a: "La méthode habituelle : ouvrez Réglages Système › Moniteurs, cliquez sur « Organiser », puis faites glisser les rectangles des écrans là où ils se trouvent vraiment sur votre bureau. Avec MonitorAlign, pas besoin d’ouvrir cette fenêtre : un clic là où le pointeur doit sortir, un autre là où il doit entrer.",
    },
    {
      q: "Comment organiser les écrans sous Windows ?",
      a: "Dans les Paramètres, sous Système, ouvrez les réglages d’affichage, faites glisser les rectangles numérotés pour qu’ils correspondent à la place réelle de vos écrans, puis appliquez. MonitorAlign pour Windows (bientôt disponible) fait la même chose en deux clics.",
    },
    {
      q: "Pourquoi la souris ne passe-t-elle pas sur le deuxième écran ?",
      a: "Parce que la disposition que retient votre ordinateur ne correspond pas à la place réelle des écrans. Si l’écran est à votre gauche mais que l’ordinateur le croit à droite, le pointeur ne passera pas en allant vers la gauche. Calez la disposition sur la position réelle, et tout refonctionne.",
    },
    {
      q: "Est-ce sûr ? Qu’est-ce que ça modifie exactement ?",
      a: "Uniquement la disposition des écrans. C’est le même changement que si vous déplaciez les écrans dans les réglages de macOS ou de Windows, et le raccourci d’annulation rétablit la disposition précédente.",
    },
    { q: "Ça marche avec trois écrans ?", a: "Pas encore. Deux écrans seulement pour l’instant." },
    {
      q: "L’app collecte-t-elle des données ?",
      a: "Non. Pas de compte, pas d’outil d’analyse dans l’app. Sa seule connexion sert à récupérer un petit fichier de mise à jour sur collab5.co.kr.",
    },
    {
      q: "De quoi ai-je besoin ?",
      a: "macOS 13 ou ultérieur sur Intel ou puce Apple, ou Windows 10 ou 11.",
    },
  ],
  supportTitle: "Soutenir",
  supportText: "Si l’app vous évite quelques tracas, vous pouvez participer. Ça m’aide à continuer de créer de petits outils comme celui-ci.",
  footer: "Un projet personnel de la personne derrière collab5. Il ne fait pas partie du service collab5.",
  macLabel: "Mac",
  winLabel: "Windows",
  fig: {
    desk: "Sur votre bureau",
    mem: "Ce que retient l’ordinateur",
    whyLabel: "L’écran est en haut à gauche, mais l’ordinateur le croit à droite, donc en montant le pointeur bute contre un mur",
    menu: ["Align Monitors…", "Undo", "Shortcut Settings…", "How to Use"],
    menuLabel: "Cliquer sur l’icône à deux écrans dans la barre des menus et choisir Align Monitors",
    firstLabel: "Les deux écrans s’assombrissent ; un clic sur la partie gauche du bord supérieur du portable marque ce bord d’une barre bleue et d’un point",
    secondLabel: "Passer sur le moniteur et cliquer sur la partie droite de son bord inférieur",
    pill: "Aligned",
    pillWidth: 92,
    doneLabel: "Les deux points sont reliés, et le pointeur qui monte depuis le portable passe directement dans le coin inférieur droit du moniteur",
  },
};
