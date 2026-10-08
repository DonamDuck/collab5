// 繁體中文(台灣用語)。依英文版(en.ts)內容用自然的中文重寫，不是逐字翻譯。
// App 介面只有韓文和英文(中文系統顯示英文)，所以選單名稱保留英文，旁邊加上中文意思。
// macOS 名稱已對照 Apple 支援繁體中文(台灣)頁面(10-08)：
//   系統設定 › 隱私權與安全性 › 強制打開 / 系統設定 › 顯示器 › 排列
// ⚠️Windows SmartScreen 視窗標題的台灣中文原文沒有找到可靠出處，所以標題不加引號、用說明的方式寫。
import type { Copy } from "./types";

export const zhTW: Copy = {
  title: "MonitorAlign — 點兩下排好雙螢幕（Mac、Windows 免費）",
  description: "每次換個地方工作，雙螢幕的排列就亂掉。這個免費 App 點兩下就能重新對齊，支援 Mac 和 Windows。",
  ogTitle: "MonitorAlign — 點兩下排好雙螢幕",
  keywords: ["雙螢幕 排列", "螢幕 排列", "Mac 外接螢幕 位置", "多螢幕"],
  back: "個人專案",
  lead: "每次換位子，螢幕的位置也跟著變。用 MonitorAlign，點兩下就能重新對齊。",
  downloads: {
    mac: ["下載 macOS 版", "macOS 13 以上 · Intel/Apple 晶片"],
    windows: ["下載 Windows 版", "Windows 10、11"],
    soon: "即將推出",
  },
  free: "免費，不用註冊帳號。",
  autoUpdate: "有新版本時 App 會通知你，點一下就能更新。",
  whyTitle: "為什麼做這個",
  why: [
    "週一在家、週二在咖啡店、週三在辦公室。外接螢幕每次擺的位置都不一樣，電腦卻還記得上次的排列，滑鼠就從不對的邊緣跑出去。",
    "不必再到顯示器設定裡拖拉方塊，只要在想跨過去的地方點一下就好。",
  ],
  howTitle: "使用方式",
  howToName: "用 MonitorAlign 排列雙螢幕的方法",
  steps: [
    {
      text: "按一下選單列的圖示，選擇 **Align Monitors**（對齊螢幕）。在 Windows 上，圖示在工作列右側的系統匣裡。",
      shortcutLead: "也可以用快速鍵：",
      note: "不好按的話，可以自己設定或更改快速鍵。在選單打開 **Shortcut Settings**（快速鍵設定），按下想用的按鍵就好。",
    },
    { text: "在目前的螢幕上，按一下想讓滑鼠跨過去的那一側邊緣附近。" },
    { text: "把指標移到另一個螢幕，按一下希望它進來的位置。" },
    { text: "確認後，兩個點就會接在一起。" },
  ],
  undo: { text: "接錯了也沒關係，按復原快速鍵就能回到之前的排列。", custom: "" },
  featuresTitle: "功能特色",
  features: [
    "免費下載、免費使用。",
    "檔案很小：Mac 版壓縮檔約 430 KB，Windows 版約 60 KB。",
    "在 Mac 上不需要特殊權限，也不會要求輔助使用權限。",
    "排錯了，一個快速鍵就能復原。",
    "快速鍵可以自訂，更新也能在 App 裡直接完成。",
  ],
  firstTitle: "第一次打開時",
  firstIntro: "App 還沒有經過 Apple 和 Microsoft 簽署，所以第一次打開時會看到警告。",
  firstMac: ["Mac", "如果 macOS 顯示無法驗證開發者，請到 **系統設定 › 隱私權與安全性**，按一下 **強制打開**。"],
  firstWin: ["Windows", "如果出現 Windows SmartScreen 保護電腦的提示，請按 **其他資訊**，再按 **仍要執行**。"],
  faqTitle: "常見問題",
  faq: [
    {
      q: "Mac 怎麼調整雙螢幕的排列？",
      a: "內建的方法是到系統設定 › 顯示器，按一下「排列」，把螢幕方塊拖到和桌上實際位置相同的地方。用 MonitorAlign 就不用打開那個視窗，只要在滑鼠出去和進來的地方各點一下。",
    },
    {
      q: "Windows 怎麼調整螢幕的排列？",
      a: "到設定 › 系統 › 顯示器，把有編號的螢幕方塊拖到和實際位置相同的地方，再按「套用」。MonitorAlign 的 Windows 版（即將推出）點兩下就能做到一樣的事。",
    },
    {
      q: "滑鼠為什麼移不到第二個螢幕？",
      a: "因為電腦記住的螢幕排列和實際位置不一樣。螢幕明明在左邊，電腦卻以為在右邊，滑鼠往左推也過不去。把排列調成和實際位置一樣，馬上就好了。",
    },
    {
      q: "安全嗎？它到底改了什麼？",
      a: "只改顯示器排列這一項設定。跟你在系統設定或 Windows 顯示器設定裡拖拉螢幕是同樣的改動，按復原快速鍵也能回到之前的排列。",
    },
    { q: "可以用三個螢幕嗎？", a: "還不行，目前只支援兩個。" },
    {
      q: "會蒐集資料嗎？",
      a: "不會。沒有帳號，App 裡也沒有任何分析工具。唯一的連線是從 collab5.co.kr 取得一個小小的更新檔。",
    },
    {
      q: "需要什麼系統？",
      a: "macOS 13 以上（Intel 或 Apple 晶片），或 Windows 10、11。",
    },
  ],
  supportTitle: "支持一下",
  supportText: "如果它幫你省了點麻煩，歡迎支持一下。這能讓我繼續做這種小工具。",
  footer: "這是 collab5 開發者的個人專案，和 collab5 服務無關。",
  macLabel: "Mac",
  winLabel: "Windows",
  fig: {
    desk: "桌上的實際擺法",
    mem: "電腦記住的排列",
    whyLabel: "螢幕在左上方，電腦卻記成在右邊，滑鼠往上移就被擋住的示意圖",
    menu: ["Align Monitors…", "Undo", "Shortcut Settings…", "How to Use"],
    menuLabel: "按一下選單列的雙螢幕圖示並選擇 Align Monitors 的示意圖",
    firstLabel: "兩個螢幕變暗，按一下筆電螢幕上緣偏左的位置後，那條邊緣出現藍色橫條和圓點的示意圖",
    secondLabel: "把指標移到螢幕上，按一下螢幕下緣偏右位置的示意圖",
    pill: "Aligned",
    pillWidth: 92,
    doneLabel: "兩個點接在一起後，從筆電往上移的滑鼠直接進入螢幕右下方的示意圖",
  },
};
