// English. Written for English-speaking readers rather than translated word for word from Korean.
// The other non-Korean pages (ja·zh·es·de·fr·pt) are translated from this file, so keep facts in sync.
// Menu names are the app's real English labels (the app UI is Korean or English only).
import type { Copy } from "./types";

export const en: Copy = {
  title: "MonitorAlign — Align dual monitors in two clicks (free for Mac & Windows)",
  description:
    "Moved your laptop and now the pointer leaves the wrong edge? MonitorAlign lines your dual monitors back up in two clicks. Free for macOS and Windows.",
  ogTitle: "MonitorAlign — Fix your dual-monitor layout in two clicks",
  keywords: [
    "align dual monitors",
    "rearrange displays mac",
    "display arrangement",
    "external monitor position",
    "mouse won't move to second monitor",
    "multi monitor setup",
    "monitor alignment tool",
    "macbook external monitor",
  ],
  back: "Side projects",
  lead: "Your monitors end up in a new spot every time you change desks. MonitorAlign lines them back up in two clicks.",
  downloads: {
    mac: ["Download for macOS", "macOS 13+ · Intel & Apple silicon"],
    windows: ["Download for Windows", "Windows 10 & 11"],
    soon: "Coming soon",
  },
  free: "Free, no account needed.",
  autoUpdate: "When there's a new version, the app lets you know and you can update right away.",
  whyTitle: "Why it exists",
  why: [
    "I work in different places, and my monitor ends up on a different side each time. But the computer still remembers the old arrangement, so the pointer slides off the wrong edge.",
    "Instead of dragging rectangles around in display settings, you just click where you want to cross.",
  ],
  howTitle: "How it works",
  howToName: "How to align dual monitors with MonitorAlign",
  steps: [
    {
      text: "Click the menu bar icon and choose **Align Monitors**. On Windows, the icon sits in the system tray.",
      shortcutLead: "Or press",
      note: "Hard to reach? You can set or change the shortcut yourself. Open **Shortcut Settings** from the menu and press the keys you want.",
    },
    { text: "On this screen, click near the edge where the pointer should cross over." },
    { text: "Move to the other screen and click where it should come in." },
    { text: "Confirm, and the two points snap together." },
  ],
  undo: { text: "Got it wrong? The undo shortcut puts the previous layout back.", custom: "" },
  featuresTitle: "What you get",
  features: [
    "Free to download and use.",
    "Tiny: about 430 KB zipped on Mac, about 60 KB on Windows.",
    "No special permissions on Mac. It never asks for Accessibility access.",
    "A single shortcut undoes a layout that came out wrong.",
    "Shortcuts you can remap, and updates that install from inside the app.",
  ],
  firstTitle: "Opening it the first time",
  firstIntro: "The app isn't signed by Apple or Microsoft yet, so you'll see a warning the first time you open it.",
  firstMac: [
    "Mac",
    "If macOS says the developer can't be verified, go to **System Settings › Privacy & Security** and click **Open Anyway**.",
  ],
  firstWin: ["Windows", "If you see **Windows protected your PC**, click **More info**, then **Run anyway**."],
  faqTitle: "FAQ",
  faq: [
    {
      q: "How do I rearrange displays on a Mac?",
      a: "The built-in way is to open System Settings › Displays, click Arrange, and drag the display rectangles to where the screens actually sit on your desk. With MonitorAlign you skip that window: click once where the pointer should leave, and once where it should come in.",
    },
    {
      q: "How do I rearrange monitors in Windows?",
      a: "Go to Settings › System › Display, drag the numbered boxes to match where your monitors really are, and select Apply. MonitorAlign for Windows (coming soon) does the same thing in two clicks.",
    },
    {
      q: "Why won't my mouse move to my second monitor?",
      a: "Because the arrangement your computer remembers doesn't match where the monitors really are. If the monitor is on your left but the computer thinks it's on the right, pushing the pointer left won't cross over. Match the arrangement to the real positions and it works again.",
    },
    {
      q: "Is it safe? What does it actually change?",
      a: "Only your display arrangement setting. It's the same change you'd make by dragging the screens around in System Settings or Windows display settings, and the undo shortcut restores the previous layout.",
    },
    { q: "Does it work with three monitors?", a: "Not yet. Two displays only for now." },
    {
      q: "Does it collect any data?",
      a: "No. There's no account and no analytics in the app. The only network request is a small update file it fetches from collab5.co.kr.",
    },
    {
      q: "What do I need to run it?",
      a: "macOS 13 or later on Intel or Apple silicon, or Windows 10 or 11.",
    },
  ],
  supportTitle: "Support",
  supportText: "If it saves you a bit of hassle, you can chip in. It helps me keep building small tools like this.",
  footer: "A personal project by the maker of collab5. It isn't part of the collab5 service.",
  macLabel: "Mac",
  winLabel: "Windows",
  fig: {
    desk: "On your desk",
    mem: "What your computer remembers",
    whyLabel: "The monitor sits up and to the left, but the computer thinks it is on the right, so moving the pointer up hits a wall",
    menu: ["Align Monitors…", "Undo", "Shortcut Settings…", "How to Use"],
    menuLabel: "Clicking the two-screen icon in the menu bar and choosing Align Monitors",
    firstLabel: "Both screens dim; clicking the left part of the laptop's top edge marks that edge with a blue bar and a dot",
    secondLabel: "Moving to the monitor and clicking the right part of its bottom edge",
    pill: "Aligned",
    pillWidth: 92,
    doneLabel: "The two points are joined, so moving the pointer up from the laptop crosses straight into the monitor's lower right",
  },
};
