// Deutsch (Du-Form). Auf Basis der englischen Fassung (en.ts) neu formuliert, nicht Wort für Wort übersetzt.
// Die App gibt es nur auf Koreanisch und Englisch, daher bleiben Menünamen englisch, mit deutscher Bedeutung daneben.
// macOS-Bezeichnungen mit der deutschen Apple-Support-Seite abgeglichen (10-08):
//   Systemeinstellungen › Datenschutz & Sicherheit › Dennoch öffnen / Systemeinstellungen › Displays › Anordnen
// Windows: Die Seite „Anzeige“ heißt in Windows 10 und 11 unterschiedlich, deshalb nur „Einstellungen › System“.
import type { Copy } from "./types";

export const de: Copy = {
  title: "MonitorAlign — Monitore mit zwei Klicks anordnen (kostenlos, Mac & Windows)",
  description:
    "Neuer Platz, und der Mauszeiger verschwindet an der falschen Kante? MonitorAlign ordnet deine Monitore mit zwei Klicks neu an. Kostenlos für Mac und Windows.",
  ogTitle: "MonitorAlign — Monitore mit zwei Klicks anordnen",
  keywords: ["Monitore anordnen", "Bildschirmanordnung Mac", "zweiter Monitor Maus"],
  back: "Nebenprojekte",
  lead: "Bei jedem Platzwechsel stehen deine Monitore woanders. MonitorAlign bringt sie mit zwei Klicks wieder in die richtige Anordnung.",
  downloads: {
    mac: ["Download für macOS", "macOS 13+ · Intel & Apple Silicon"],
    windows: ["Download für Windows", "Windows 10 & 11"],
    soon: "Bald verfügbar",
  },
  free: "Kostenlos, ohne Konto.",
  autoUpdate: "Gibt es eine neue Version, sagt dir die App Bescheid, und du kannst sofort aktualisieren.",
  whyTitle: "Warum es das gibt",
  why: [
    "Ich arbeite oft an verschiedenen Orten, und der Monitor steht jedes Mal woanders. Aber der Computer merkt sich die alte Anordnung, und der Mauszeiger rutscht an der falschen Kante hinaus.",
    "Statt in den Anzeigeeinstellungen Rechtecke herumzuschieben, klickst du einfach dort, wo du hinüberwechseln willst.",
  ],
  howTitle: "So funktioniert’s",
  howToName: "Zwei Monitore mit MonitorAlign anordnen",
  steps: [
    {
      text: "Klicke auf das Symbol in der Menüleiste und wähle **Align Monitors** (Monitore ausrichten). Unter Windows sitzt das Symbol im Infobereich der Taskleiste.",
      shortcutLead: "Oder drücke",
      note: "Schwer zu greifen? Du kannst das Tastenkürzel selbst festlegen oder ändern. Öffne im Menü **Shortcut Settings** (Tastenkürzel) und drücke die gewünschten Tasten.",
    },
    { text: "Klicke auf diesem Bildschirm nahe der Kante, über die der Zeiger wechseln soll." },
    { text: "Wechsle zum anderen Bildschirm und klicke dort, wo der Zeiger ankommen soll." },
    { text: "Bestätige, und die beiden Punkte rasten aneinander ein." },
  ],
  undo: { text: "Danebengegangen? Das Tastenkürzel zum Widerrufen stellt die vorherige Anordnung wieder her.", custom: "" },
  presetsTitle: "Anordnungen speichern",
  presets: [
    "Speichere die Monitoranordnung für Orte, an denen du oft sitzt, etwa zu Hause oder im Büro, und wechsle mit einem Klick dorthin zurück.",
    "Öffne im Menü **Saved Layouts** (gespeicherte Anordnungen), wähle **Save Current Layout…** (aktuelle Anordnung speichern) und gib einen Namen ein. Ohne Namen wird sie als Layout 1, Layout 2 gespeichert.",
    "Eine gespeicherte Anordnung wählst du im selben Menü aus. Unter **Manage Layouts…** (Anordnungen verwalten) kannst du jeder Anordnung auch ein eigenes Tastenkürzel geben.",
    "Wenn du dieselben Monitore wieder anschließt, fragt die App zuerst, ob sie zu dieser Anordnung wechseln soll. Wenn du das nicht möchtest, schalte im Menü **Suggest a saved layout when monitors change** (gespeicherte Anordnung vorschlagen, wenn sich die Monitore ändern) aus.",
  ],
  featuresTitle: "Was du bekommst",
  features: [
    "Kostenlos herunterladen und nutzen.",
    "Winzig: rund 430 KB gezippt auf dem Mac, rund 60 KB unter Windows.",
    "Keine besonderen Berechtigungen auf dem Mac. Die App fragt nie nach Zugriff auf die Bedienungshilfen.",
    "Ein einziges Tastenkürzel macht eine misslungene Anordnung rückgängig.",
    "Tastenkürzel lassen sich ändern, Updates installierst du direkt in der App.",
  ],
  firstTitle: "Beim ersten Öffnen",
  firstIntro: "Die Mac-App ist von Apple beglaubigt. Deshalb öffnet sie sich schon beim ersten Mal ohne Warnung. Die Windows-App ist noch nicht von Microsoft signiert, darum erscheint einmal eine Warnung.",
  firstMac: [
    "Mac",
    "Meldet macOS, dass die App nicht geöffnet werden kann, hast du einen älteren Download. Lade sie noch einmal herunter, dann öffnet sie sich sofort.",
  ],
  firstWin: [
    "Windows",
    "Erscheint **Der Computer wurde durch Windows geschützt**, klicke auf **Weitere Informationen** und dann auf **Trotzdem ausführen**.",
  ],
  faqTitle: "Häufige Fragen",
  faq: [
    {
      q: "Wie ändere ich die Bildschirmanordnung am Mac?",
      a: "Normalerweise öffnest du Systemeinstellungen › Displays, klickst auf „Anordnen“ und ziehst die Bildschirm-Rechtecke dorthin, wo die Monitore auf deinem Schreibtisch wirklich stehen. Mit MonitorAlign brauchst du dieses Fenster nicht: Du klickst einmal dort, wo der Zeiger hinaus soll, und einmal dort, wo er hereinkommen soll.",
    },
    {
      q: "Wie ordne ich Monitore unter Windows an?",
      a: "Öffne in den Einstellungen unter System die Anzeigeeinstellungen, zieh die nummerierten Rechtecke an die Stellen, an denen deine Monitore tatsächlich stehen, und übernimm die Änderung. MonitorAlign für Windows erledigt das mit zwei Klicks.",
    },
    {
      q: "Warum wechselt die Maus nicht auf den zweiten Monitor?",
      a: "Weil die Anordnung, die sich dein Computer gemerkt hat, nicht zur echten Position der Monitore passt. Steht der Monitor links, der Computer hält ihn aber für rechts, kommt der Zeiger nach links nicht hinüber. Passe die Anordnung an die echte Position an, dann klappt es sofort wieder.",
    },
    {
      q: "Ist das sicher? Was genau wird geändert?",
      a: "Nur die Bildschirmanordnung. Es ist dieselbe Änderung, die du beim Verschieben der Bildschirme in den Systemeinstellungen oder den Windows-Anzeigeeinstellungen machst, und das Tastenkürzel zum Widerrufen stellt die vorherige Anordnung wieder her.",
    },
    { q: "Funktioniert es mit drei Monitoren?", a: "Noch nicht. Im Moment nur mit zwei Bildschirmen." },
    { q: "Was ist, wenn ich zwei identische Monitore habe?", a: "Jeder Monitor wird an seiner eingebauten Seriennummer erkannt. Bei Monitoren ohne Seriennummer wählt die App die Zuordnung, bei der sich gegenüber der jetzigen Position am wenigsten ändert. Liegt sie daneben, stellt das Tastenkürzel zum Widerrufen mit einem Druck alles wieder her." },
    {
      q: "Werden Daten gesammelt?",
      a: "Nein. Es gibt kein Konto und keine Analysetools in der App. Die einzige Verbindung lädt eine kleine Update-Datei von collab5.co.kr.",
    },
    {
      q: "Was brauche ich dafür?",
      a: "macOS 13 oder neuer auf Intel oder Apple Silicon, oder Windows 10 bzw. 11.",
    },
  ],
  supportTitle: "Unterstützen",
  supportText: "Wenn dir das ein bisschen Ärger erspart, kannst du etwas beisteuern. Das hilft mir, weiter kleine Tools wie dieses zu bauen.",
  footer: "Ein privates Projekt der Person hinter collab5. Es gehört nicht zum Dienst von collab5.",
  macLabel: "Mac",
  winLabel: "Windows",
  fig: {
    desk: "Auf deinem Schreibtisch",
    mem: "Was dein Computer gespeichert hat",
    whyLabel: "Der Monitor steht links oben, aber der Computer hält ihn für rechts, deshalb stößt der Zeiger nach oben an eine Wand",
    menu: ["Align Monitors…", "Undo", "Shortcut Settings…", "How to Use"],
    menuLabel: "Auf das Zwei-Bildschirm-Symbol in der Menüleiste klicken und Align Monitors wählen",
    firstLabel: "Beide Bildschirme werden abgedunkelt; ein Klick links an der Oberkante des Laptops markiert diese Kante mit einem blauen Balken und einem Punkt",
    secondLabel: "Zum Monitor wechseln und rechts an seiner Unterkante klicken",
    pill: "Aligned",
    pillWidth: 92,
    doneLabel: "Die beiden Punkte sind verbunden, der Zeiger wandert vom Laptop nach oben direkt in die rechte untere Ecke des Monitors",
  },
};
