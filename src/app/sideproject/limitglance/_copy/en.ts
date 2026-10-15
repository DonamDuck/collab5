// English copy. Written after the Korean page, in the same plain first-person voice.
// ⚠️The "Why I made it" paragraphs mirror the Korean draft and change when that one does.
import type { Copy } from "./types";

export const en: Copy = {
  title: "LimitGlance — see your Claude usage in the menu bar (free for Mac and Windows)",
  description:
    "A free app that keeps your Claude 5-hour and 7-day usage limits in the Mac menu bar or the Windows taskbar. One number for your whole account: chat, Cowork and Claude Code together.",
  ogTitle: "LimitGlance — your Claude usage, always in the menu bar",
  keywords: [
    "Claude usage",
    "Claude usage limit",
    "check Claude usage",
    "Claude 5-hour limit",
    "Claude weekly limit",
    "Claude limit reset time",
    "Claude Code usage",
    "Claude Max usage",
    "Claude Pro limit",
    "Claude usage menu bar",
  ],
  back: "Side projects",
  lead: "How full your Claude limit is and when it resets, always sitting in the menu bar. Chat, Cowork or Claude Code, it's one number for your account.",
  downloads: {
    mac: ["Download for macOS", "macOS 13+ · Intel / Apple silicon"],
    windows: ["Download for Windows", "Windows 10 · 11"],
    soon: "Coming soon",
  },
  extension: {
    title: "Add the browser extension too",
    text: "The extension picks up the numbers from claude.ai and hands them to the app. Install it in the one browser where you're logged in.",
    chrome: "Install in Chrome",
    edge: "Install in Edge",
    whale: "Install in Whale",
    soon: "Coming soon",
    note: "All three open the same Chrome Web Store page. In Edge, click \"Allow extensions from other stores\" at the top once and the install button turns on.",
  },
  free: "Free, no sign-up.",
  autoUpdate: "When a new version is out, the app tells you and updates itself with one click.",
  whyTitle: "Why I made it",
  why: [
    "I work with several Claude windows open, so I kept checking how much of my 5-hour limit was left.",
    "I put the percentage in my MacBook's menu bar and used it on my own for a while. Then it hit me that people who only use chat or Cowork want the same thing, so I rebuilt it for anyone.",
  ],
  howTitle: "How to use it",
  howToName: "How to show your Claude usage in the menu bar with LimitGlance",
  steps: [
    "Download the app for Mac or Windows and open it. A small gauge icon appears in the menu bar (on Windows, at the right end of the taskbar).",
    "Add the **LimitGlance extension** to the browser you use: Chrome, Edge or Whale.",
    "If you're logged in to claude.ai in that browser, you're done. The percentage shows up next to the icon within seconds.",
  ],
  menuNote:
    "Click the icon to see your 5-hour and 7-day limits and how long until each one resets. The number turns orange past 70% and red past 90%.",
  firstTitle: "Opening it the first time",
  firstIntro: "The app isn't signed by Apple or Microsoft yet, so you'll see a warning the first time.",
  firstMac: ["Mac", "If macOS says it can't be opened, go to **System Settings › Privacy & Security** and click **Open Anyway**."],
  firstWin: ["Windows", "If **Windows protected your PC** appears, click **More info**, then **Run anyway**."],
  faqTitle: "FAQ",
  faq: [
    {
      q: "Where can I check my Claude usage?",
      a: "On claude.ai under Settings › Usage. LimitGlance keeps the same numbers in your menu bar, so you don't have to go and open that page.",
    },
    {
      q: "Does it combine chat, Cowork and Claude Code?",
      a: "Yes. Claude's limits are shared across your account, and LimitGlance shows that combined number.",
    },
    {
      q: "When does the 5-hour limit reset?",
      a: "It depends on when you've been using Claude. Open the menu and you'll see how long until the reset and the exact time.",
    },
    {
      q: "Does it take my login details?",
      a: "No. The extension reads only the usage numbers inside your logged-in browser and passes just those numbers to the app on your own computer. The app never connects to claude.ai and never reads passwords or login data.",
    },
    {
      q: "What if my browser is closed?",
      a: "The app keeps the last numbers it got, dimmed, and tells you how old they are. Open the browser again and it picks up where it left off.",
    },
    { q: "Does it work on the free plan?", a: "For now the numbers only show up on paid plans such as Pro and Max." },
    { q: "What about Safari?", a: "For now it works in Chrome, Edge and Whale only." },
    {
      q: "Is this made by Anthropic?",
      a: "No, it's my own personal project. It shows the same numbers claude.ai shows you.",
    },
    {
      q: "Do you collect any personal data?",
      a: "No. There's no account and no analytics. The app only fetches one small file from collab5.co.kr to check for new versions.",
    },
    {
      q: "Will it run on my computer?",
      a: "On Mac, macOS 13 or later on Intel or Apple silicon. On Windows, Windows 10 or 11.",
    },
  ],
  footer:
    "A tool one of the makers behind collab5 built for their own needs. It's separate from the collab5 service and not affiliated with Anthropic. Claude is a trademark of Anthropic.",
  fig: {
    rows: [
      { label: "5-hour limit", value: "42%" },
      { label: "resets in 2h 10m · 3:20 PM", sub: true },
      { label: "7-day limit", value: "18%" },
      { label: "resets in 4d 6h · Oct 18, 9:00 AM", sub: true },
    ],
    meta: "Max 5x · updated 1 min ago",
    items: ["Install the browser extension…", "Open at login", "Check for updates…", "LimitGlance website", "Quit"],
    menuLabel: "The menu bar shows a gauge icon with 42%; clicking it lists the 5-hour limit at 42% and the 7-day limit at 18%, each with its reset time",
    browser: "Browser",
    browserSub: "logged in to claude.ai",
    app: "LimitGlance app",
    appSub: "menu bar · taskbar",
    only: "only the numbers",
    flowLabel: "The extension in your logged-in browser passes only the usage numbers to the app on your computer",
    trayTip: "5-hour 42% · resets in 2h 10m",
    trayLabel: "A tray icon showing 42 at the right end of the Windows taskbar, with a tooltip reading 5-hour 42%",
  },
};
