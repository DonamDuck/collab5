// Español neutro, pensado para que se lea bien en Latinoamérica (tú, computadora, mouse).
// Escrito a partir de la versión en inglés (en.ts), no traducido palabra por palabra.
// La app solo tiene interfaz en coreano e inglés, así que los nombres de menú van en inglés con su sentido al lado.
// Nombres de macOS comprobados en el soporte de Apple (10-08). Cambian según la variante del sistema:
//   España: Ajustes del Sistema › Privacidad y seguridad › Abrir igualmente
//   Latinoamérica: Configuración del Sistema › Privacidad y seguridad › Abrir de todos modos
//   Pantallas › Organizar (igual en ambas)
import type { Copy } from "./types";

export const es: Copy = {
  title: "MonitorAlign — Alinea tus dos monitores en dos clics (gratis, Mac y Windows)",
  description:
    "¿Cambiaste de escritorio y el puntero sale por el borde equivocado? MonitorAlign vuelve a alinear tus dos monitores en dos clics. Gratis para Mac y Windows.",
  ogTitle: "MonitorAlign — Alinea tus dos monitores en dos clics",
  keywords: ["alinear monitores", "organizar pantallas Mac", "monitor externo posición", "doble monitor"],
  back: "Proyectos personales",
  lead: "Cada vez que cambias de escritorio, tus monitores quedan en otro lugar. MonitorAlign los vuelve a alinear en dos clics.",
  downloads: {
    mac: ["Descargar para macOS", "macOS 13 o posterior · Intel y Apple silicon"],
    windows: ["Descargar para Windows", "Windows 10 y 11"],
    soon: "Próximamente",
  },
  free: "Gratis y sin crear cuenta.",
  autoUpdate: "Cuando hay una versión nueva, la app te avisa y puedes actualizar en el momento.",
  whyTitle: "Por qué existe",
  why: [
    "El lunes en casa, el martes en un café, el miércoles en la oficina. El monitor externo queda de un lado distinto cada vez, pero tu computadora sigue recordando la disposición anterior, así que el puntero se escapa por el borde equivocado.",
    "En lugar de arrastrar rectángulos en la configuración de pantalla, solo haces clic donde quieres pasar.",
  ],
  howTitle: "Cómo funciona",
  howToName: "Cómo alinear dos monitores con MonitorAlign",
  steps: [
    {
      text: "Haz clic en el ícono de la barra de menús y elige **Align Monitors** (alinear monitores). En Windows, el ícono está en la bandeja del sistema.",
      shortcutLead: "O presiona",
      note: "¿Te queda incómodo? Puedes elegir o cambiar el atajo tú mismo. Abre **Shortcut Settings** (configuración de atajos) en el menú y presiona las teclas que quieras.",
    },
    { text: "En esta pantalla, haz clic cerca del borde por donde debería pasar el puntero." },
    { text: "Pasa a la otra pantalla y haz clic donde debería entrar." },
    { text: "Confirma y los dos puntos quedan unidos." },
  ],
  undo: { text: "¿Te equivocaste? El atajo de deshacer devuelve la disposición anterior.", custom: "" },
  featuresTitle: "Lo que incluye",
  features: [
    "Gratis para descargar y usar.",
    "Muy liviana: unos 430 KB comprimida en Mac y unos 60 KB en Windows.",
    "Sin permisos especiales en Mac. Nunca pide acceso de Accesibilidad.",
    "Un solo atajo deshace una disposición que quedó mal.",
    "Atajos que puedes cambiar y actualizaciones que se instalan desde la propia app.",
  ],
  firstTitle: "La primera vez que la abres",
  firstIntro: "La app todavía no está firmada por Apple ni por Microsoft, así que verás una advertencia la primera vez que la abras.",
  firstMac: [
    "Mac",
    "Si macOS dice que no puede verificar al desarrollador, ve a **Ajustes del Sistema › Privacidad y seguridad** y haz clic en **Abrir igualmente**. En el macOS de Latinoamérica se llama **Configuración del Sistema** y el botón dice **Abrir de todos modos**.",
  ],
  firstWin: [
    "Windows",
    "Si aparece **Windows protegió su PC**, haz clic en **Más información** y luego en **Ejecutar de todas formas**.",
  ],
  faqTitle: "Preguntas frecuentes",
  faq: [
    {
      q: "¿Cómo cambio la posición de los monitores en Mac?",
      a: "La forma de siempre es abrir Ajustes del Sistema › Pantallas (Configuración del Sistema en Latinoamérica), hacer clic en Organizar y arrastrar los rectángulos de las pantallas hasta donde están en tu escritorio. Con MonitorAlign no hace falta abrir esa ventana: haces un clic donde debe salir el puntero y otro donde debe entrar.",
    },
    {
      q: "¿Cómo organizo los monitores en Windows?",
      a: "En Configuración › Sistema › Pantalla, arrastra los rectángulos numerados hasta que coincidan con la posición real de tus monitores y selecciona Aplicar. MonitorAlign para Windows (próximamente) hace lo mismo en dos clics.",
    },
    {
      q: "¿Por qué el mouse no pasa al segundo monitor?",
      a: "Porque la disposición que recuerda tu computadora no coincide con el lugar real de los monitores. Si el monitor está a tu izquierda pero la computadora cree que está a la derecha, el puntero no va a pasar aunque lo muevas hacia la izquierda. Ajusta la disposición a la posición real y vuelve a funcionar.",
    },
    {
      q: "¿Es seguro? ¿Qué cambia exactamente?",
      a: "Solo la configuración de disposición de pantallas. Es el mismo cambio que harías arrastrando las pantallas en los ajustes de macOS o en la configuración de pantalla de Windows, y el atajo de deshacer devuelve la disposición anterior.",
    },
    { q: "¿Funciona con tres monitores?", a: "Todavía no. Por ahora solo con dos pantallas." },
    {
      q: "¿Recopila datos?",
      a: "No. No hay cuenta ni herramientas de análisis en la app. Lo único que descarga es un pequeño archivo de actualización desde collab5.co.kr.",
    },
    {
      q: "¿Qué necesito para usarla?",
      a: "macOS 13 o posterior con Intel o Apple silicon, o Windows 10 u 11.",
    },
  ],
  supportTitle: "Apoya el proyecto",
  supportText: "Si te ahorra un poco de lío, puedes aportar algo. Me ayuda a seguir haciendo herramientas pequeñas como esta.",
  footer: "Un proyecto personal de quien hace collab5. No forma parte del servicio de collab5.",
  macLabel: "Mac",
  winLabel: "Windows",
  fig: {
    desk: "En tu escritorio",
    mem: "Lo que recuerda tu computadora",
    whyLabel: "El monitor está arriba a la izquierda, pero la computadora cree que está a la derecha, así que al subir el puntero choca contra un borde",
    menu: ["Align Monitors…", "Undo", "Shortcut Settings…", "How to Use"],
    menuLabel: "Hacer clic en el ícono de dos pantallas de la barra de menús y elegir Align Monitors",
    firstLabel: "Las dos pantallas se oscurecen; al hacer clic en la parte izquierda del borde superior de la laptop, ese borde se marca con una barra azul y un punto",
    secondLabel: "Pasar al monitor y hacer clic en la parte derecha de su borde inferior",
    pill: "Aligned",
    pillWidth: 92,
    doneLabel: "Los dos puntos quedan unidos, así que el puntero que sube desde la laptop pasa directo a la parte inferior derecha del monitor",
  },
};
