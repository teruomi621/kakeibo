import { firebaseConfig } from "./config.js";

/* =====================================================================
   みんなの家計簿 — each person keeps their own book; friends can only
   read what the owner made public. All permission checks also live in
   firestore.rules, so the UI is never the only guard.
   ===================================================================== */

/* ================= constants ================= */
const APP_VERSION = "3.0";
const FB = "https://www.gstatic.com/firebasejs/10.12.2/";
const MAX_GROUPS = 10;
const CODE_ALPHA = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const WD = ["日", "月", "火", "水", "木", "金", "土"];
const CATS = [
  { id: "食費", g: "食", c: 0, subs: ["スーパー・食料品", "外食", "朝ごはん", "昼ごはん", "夜ごはん", "カフェ", "コンビニ", "お菓子・飲み物", "その他"] },
  { id: "日用品", g: "日", c: 2, subs: ["日用雑貨", "ドラッグストア", "100円ショップ", "家具・家電", "その他"] },
  { id: "交通費", g: "交", c: 3, subs: ["電車", "バス", "タクシー", "ガソリン", "駐車場", "新幹線・飛行機", "その他"] },
  { id: "住まい", g: "住", c: 4, subs: ["家賃", "電気", "ガス", "水道", "スマホ・通信", "ネット", "その他"] },
  { id: "交際費", g: "際", c: 5, subs: ["飲み会", "プレゼント", "お祝い", "デート", "その他"] },
  { id: "娯楽", g: "遊", c: 6, subs: ["映画・ライブ", "本・マンガ", "ゲーム", "サブスク", "旅行", "趣味", "その他"] },
  { id: "服・美容", g: "衣", c: 7, subs: ["服", "靴・バッグ", "美容院", "コスメ", "その他"] },
  { id: "健康・医療", g: "医", c: 1, subs: ["病院", "薬", "ジム・運動", "その他"] },
  { id: "学び・仕事", g: "学", c: 9, subs: ["本・教材", "資格・講座", "文房具", "仕事用品", "その他"] },
  { id: "その他", g: "他", c: 8, subs: ["税金・保険", "手数料", "寄付", "その他"] },
];
const INCOME_CATS = [
  { id: "給与", g: "給", c: 0, subs: ["給料", "賞与", "その他"] },
  { id: "副業", g: "副", c: 2, subs: ["フリマ", "業務委託", "その他"] },
  { id: "お小遣い", g: "小", c: 4, subs: ["その他"] },
  { id: "臨時収入", g: "臨", c: 6, subs: ["お祝い", "返金", "ポイント", "その他"] },
  { id: "その他収入", g: "他", c: 8, subs: ["その他"] },
];
const ALL_CATS = CATS.concat(INCOME_CATS);
const CAT = Object.fromEntries(ALL_CATS.map(c => [c.id, c]));
const catOf = (id) => CAT[id] || CAT["その他"];
const PAYS = ["現金", "クレジットカード", "PayPay", "交通系IC", "電子マネー", "デビット", "口座振替", "その他"];
const TIME_PRESETS = [["朝", "08:00"], ["昼", "12:30"], ["おやつ", "15:00"], ["夜", "19:00"], ["深夜", "23:00"]];
// Card colours for people (self is always the first one).
const PEOPLE = ["#11634F", "#2E4A7A", "#7A3E5B", "#8A5A1E", "#3E6B6B", "#5B4A86", "#7A4E2E", "#35603F", "#6B3A3A", "#3D5A80"];
// Shop names offered by autocomplete before you have your own history.
const KNOWN_SHOPS = ["スターバックス", "ドトール", "タリーズ", "コメダ珈琲", "マクドナルド", "モスバーガー", "すき家", "吉野家", "松屋", "丸亀製麺", "サイゼリヤ", "ガスト", "スシロー", "くら寿司",
  "セブン-イレブン", "ローソン", "ファミリーマート", "ミニストップ", "イオン", "ライフ", "西友", "イトーヨーカドー", "業務スーパー", "成城石井", "まいばすけっと", "コープ",
  "マツモトキヨシ", "ウエルシア", "ツルハドラッグ", "スギ薬局", "ダイソー", "セリア", "ニトリ", "無印良品", "ユニクロ", "GU", "Amazon", "楽天市場", "ヨドバシカメラ", "ビックカメラ",
  "JR", "タクシー", "ENEOS", "TOHOシネマズ", "Netflix", "Spotify", "TSUTAYA", "紀伊國屋書店"];
const RULES = [
  [/セブン|ローソン|ファミリーマート|ファミマ|ミニストップ|デイリーヤマザキ|ポプラ|セイコーマート|NEWDAYS/i, "食費", "コンビニ"],
  [/スターバックス|スタバ|ドトール|タリーズ|コメダ|エクセルシオール|サンマルク|カフェ|珈琲|コーヒー/i, "食費", "カフェ"],
  [/マクドナルド|すき家|吉野家|松屋|ガスト|サイゼリヤ|ケンタッキー|モスバーガー|丸亀|くら寿司|スシロー|はま寿司|ミスタードーナツ|餃子の王将|CoCo壱|ココイチ|バーミヤン|ジョナサン|デニーズ|ロイヤルホスト|てんや|なか卯|ラーメン|食堂|居酒屋|焼肉|Uber ?Eats|出前館|menu/i, "食費", "外食"],
  [/イオン|ライフ|西友|イトーヨーカ|マルエツ|業務スーパー|コープ|生協|サミット|ヤオコー|オーケー|まいばすけっと|成城石井|阪急オアシス|万代|コノミヤ|ダイエー|スーパー|マックスバリュ|フレスコ/i, "食費", "スーパー・食料品"],
  [/病院|クリニック|医院|歯科|調剤/i, "健康・医療", "病院"],
  [/ジム|フィットネス|チョコザップ|chocoZAP/i, "健康・医療", "ジム・運動"],
  [/マツモトキヨシ|マツキヨ|ウエルシア|ツルハ|スギ薬局|ココカラ|サンドラッグ|コスモス|ドラッグ|薬局/i, "日用品", "ドラッグストア"],
  [/ダイソー|セリア|キャンドゥ|ワッツ/i, "日用品", "100円ショップ"],
  [/ニトリ|IKEA|ヨドバシ|ビックカメラ|ケーズ|エディオン|ヤマダ電機|ジョーシン/i, "日用品", "家具・家電"],
  [/無印|ロフト|ハンズ|カインズ|コーナン|Amazon|アマゾン|楽天/i, "日用品", "日用雑貨"],
  [/新幹線|ANA|JAL|Peach|ジェットスター|スカイマーク/i, "交通費", "新幹線・飛行機"],
  [/JR|鉄道|メトロ|電鉄|阪急電|阪神電|近鉄|南海|京阪|地下鉄|Suica|ICOCA|PASMO/i, "交通費", "電車"],
  [/バス/i, "交通費", "バス"],
  [/タクシー|^GO$|DiDi|S\.RIDE/i, "交通費", "タクシー"],
  [/ENEOS|出光|コスモ石油|シェル|ガソリン/i, "交通費", "ガソリン"],
  [/駐車|パーキング|タイムズ|リパーク/i, "交通費", "駐車場"],
  [/電力|でんき|電気/i, "住まい", "電気"],
  [/ガス/i, "住まい", "ガス"],
  [/水道/i, "住まい", "水道"],
  [/ソフトバンク|ドコモ|ワイモバイル|楽天モバイル|UQ|povo|ahamo|LINEMO/i, "住まい", "スマホ・通信"],
  [/ユニクロ|UNIQLO|^GU$|ZARA|H&M|しまむら/i, "服・美容", "服"],
  [/ABCマート|靴/i, "服・美容", "靴・バッグ"],
  [/美容|ヘア|サロン|ネイル|理容/i, "服・美容", "美容院"],
  [/コスメ|化粧/i, "服・美容", "コスメ"],
  [/Netflix|Spotify|YouTube|Disney|Prime|Apple Music|U-NEXT|DAZN/i, "娯楽", "サブスク"],
  [/映画|シネマ|TOHO|ライブ|チケット|ぴあ/i, "娯楽", "映画・ライブ"],
  [/書店|ブック|TSUTAYA|紀伊國屋|ジュンク堂|丸善/i, "娯楽", "本・マンガ"],
  [/ゲーム|Steam|Nintendo|任天堂|PlayStation/i, "娯楽", "ゲーム"],
  [/カラオケ/i, "娯楽", "趣味"],
];
function guessCat(shop, kind) {
  if (/送る|送金|送った|わりかん|割り勘/.test(kind || "")) return ["交際費", ""];
  for (const [re, c, sub] of RULES) if (re.test(shop || "")) return [c, sub];
  return ["その他", ""];
}

/* ================= small helpers ================= */
const $ = (id) => document.getElementById(id);
const pad = (n) => String(n).padStart(2, "0");
const yen = (n) => (n < 0 ? "-" : "") + "¥" + Math.abs(Math.round(n)).toLocaleString("ja-JP");
const yenShort = (n) => n >= 10000 ? (n / 10000).toFixed(n >= 100000 ? 0 : 1) + "万" : Math.round(n).toLocaleString("ja-JP");
const ymd = (d) => d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
const today = () => ymd(new Date());
const ymKey = (ym) => ym.y + "-" + pad(ym.m);
const addMonths = (ym, n) => { const d = new Date(ym.y, ym.m - 1 + n, 1); return { y: d.getFullYear(), m: d.getMonth() + 1 }; };
const daysIn = (ym) => new Date(ym.y, ym.m, 0).getDate();
const thisMonth = () => { const d = new Date(); return { y: d.getFullYear(), m: d.getMonth() + 1 }; };
const nowHM = () => { const d = new Date(); return pad(d.getHours()) + ":" + pad(d.getMinutes()); };
const cvar = (i) => `var(--c${i})`;
const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
const isStandalone = () => matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
const buzz = (ms = 8) => { try { navigator.vibrate?.(ms); } catch {} };
function h(tag, attrs, ...kids) {
  const e = document.createElement(tag);
  if (attrs) for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === "class") e.className = v;
    else if (k === "style") e.style.cssText = v;
    else if (k.startsWith("on")) e.addEventListener(k.slice(2), v);
    else if (k === "text") e.textContent = v;
    else e.setAttribute(k, v === true ? "" : v);
  }
  for (const k of kids.flat(Infinity)) if (k != null && k !== false) e.append(k.nodeType ? k : String(k));
  return e;
}
// replaceChildren that skips null/false and flattens nested arrays
function fill(el, ...kids) { el.replaceChildren(...kids.flat(Infinity).filter(k => k != null && k !== false).map(k => k.nodeType ? k : document.createTextNode(String(k)))); }
function svg(tag, attrs, ...kids) {
  const e = document.createElementNS("http://www.w3.org/2000/svg", tag);
  for (const [k, v] of Object.entries(attrs || {})) { if (v == null) continue; if (k === "style") e.style.cssText = v; else if (k === "text") e.textContent = v; else if (k.startsWith("on")) e.addEventListener(k.slice(2), v); else e.setAttribute(k, v); }
  kids.flat(Infinity).forEach(k => k && e.append(k));
  return e;
}
const ICONS = {
  check: "M5 12.5l4.5 4.5L19 7.5", x: "M6 6l12 12M18 6L6 18", warn: "M12 8v5M12 16.5v.01M10.3 3.8L2.5 18a2 2 0 0 0 1.7 3h15.6a2 2 0 0 0 1.7-3L13.7 3.8a2 2 0 0 0-3.4 0z", info: "M12 11v6M12 7.5v.01",
  lock: "M7 11V8a5 5 0 0 1 10 0v3M5 11h14v10H5z", eye: "M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z", edit: "M4 20h4L19 9l-4-4L4 16zM14 6l4 4",
  trash: "M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13", clock: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v5l3 2", card: "M3 6h18v12H3zM3 10h18M7 15h3", shop: "M4 9l1.5-5h13L20 9M4 9v11h16V9M4 9h16M9 20v-6h6v6",
  memo: "M5 4h14v16H5zM8 9h8M8 13h8M8 17h5", camera: "M4 8h3l2-3h6l2 3h3v11H4zM12 16.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z", search: "M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM20 20l-4-4",
  people: "M9 11a3.2 3.2 0 1 0 0-6.4A3.2 3.2 0 0 0 9 11zM3 20c.8-3.3 3.2-5 6-5s5.2 1.7 6 5M17 11.6a2.6 2.6 0 1 0 0-5.2M15 15.6c2.6-.3 4.8 1.2 5.5 4.4", plus: "M12 5v14M5 12h14",
  share: "M12 3v12M7 8l5-5 5 5M5 14v6h14v-6", up: "M7 14l5-5 5 5", down: "M7 10l5 5 5-5", spark: "M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5L18 18M18 6l-2.5 2.5M8.5 15.5L6 18",
  wallet: "M4 7h14a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H4zM4 7l11-3v3M16 13.5h.01", target: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM12 12h.01",
  star: "M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.9L12 16.9l-5.2 2.8 1-5.9-4.3-4.1 5.9-.8z", key: "M14.5 9.5a4 4 0 1 0-1.4 1.4L20 17.8V20h-2.2v-1.8H16v-1.8M9.5 6.5h.01",
  invite: "M15 19c0-2.8-2.7-5-6-5s-6 2.2-6 5M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7M19 8v6M16 11h6", leave: "M10 17l-5-5 5-5M5 12h11M14 4h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4",
  paypay: "M4 7h16v12H4zM4 11h16M8 15h3", budget: "M12 3v18M17 7.5c0-1.9-2.2-3-5-3s-5 1.1-5 3 2.2 2.6 5 3.2 5 1.4 5 3.3-2.2 3.5-5 3.5-5-1.2-5-3", csv: "M12 4v11M7 10l5 5 5-5M5 20h14",
  theme: "M12 3a9 9 0 1 0 9 9 7 7 0 0 1-9-9", user: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8M4 21c.8-3.8 4-6 8-6s7.2 2.2 8 6", home: "M4 11l8-7 8 7v9h-5v-6H9v6H4z",
  help: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18M9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6V14M12 17.5v.01", out: "M15 17l5-5-5-5M20 12H9M11 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h5",
  shield: "M12 3l8 3v6c0 4.5-3.4 8.2-8 9-4.6-.8-8-4.5-8-9V6z", receipt: "M6 3h12v18l-3-2-3 2-3-2-3 2zM9 8h6M9 12h6",
};
const ic = (k, extra) => svg("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", "stroke-width": 2, "stroke-linecap": "round", "stroke-linejoin": "round", "aria-hidden": "true", ...(extra || {}) }, svg("path", { d: ICONS[k] }));
const ls = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch {} },
};
function newCode() { const a = new Uint32Array(10); crypto.getRandomValues(a); return Array.from(a, n => CODE_ALPHA[n % CODE_ALPHA.length]).join(""); }
const fmtCode = (c) => c ? c.slice(0, 5) + "-" + c.slice(5) : "";
const normCode = (s) => (s || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
function hashIdx(id, n) { let x = 0; for (const ch of id || "") x = (x * 31 + ch.charCodeAt(0)) >>> 0; return x % n; }
// Hiragana → katakana and width folding so 「すた」 finds 「スターバックス」.
const fold = (s) => (s || "").normalize("NFKC").toLowerCase().replace(/[ぁ-ゖ]/g, c => String.fromCharCode(c.charCodeAt(0) + 0x60));
const isExp = (x) => x.type !== "income";
const sumOf = (list) => list.reduce((s, x) => s + x.amount, 0);
const expTotal = (list) => sumOf(list.filter(isExp));
const incTotal = (list) => sumOf(list.filter(x => x.type === "income"));
function sumBy(list, key = "category") { const o = {}; list.forEach(x => { const k = x[key] || "指定なし"; o[k] = (o[k] || 0) + x.amount; }); return Object.entries(o).sort((a, b) => b[1] - a[1]); }
const sortEntries = (list) => list.slice().sort((a, b) => b.date.localeCompare(a.date) || (b.time || "").localeCompare(a.time || "") || (b.t || 0) - (a.t || 0));
const inMonth = (list, ym) => list.filter(x => x.date && x.date.startsWith(ymKey(ym)));
const titleOf = (x) => x.shop || x.memo || x.sub || x.category;
const catLabel = (x) => x.sub ? `${x.category} › ${x.sub}` : x.category;
function normEntry(x) {
  const e = { ...x, sub: x.sub || "", shop: x.shop || "", memo: x.memo || "", pay: x.pay || "", type: x.type === "income" ? "income" : "expense", time: x.time || "" };
  if (e.category === "外食") { e.category = "食費"; e.sub = e.sub || "外食"; } // older books had 外食 as its own category
  return e;
}
const dayLabel = (d) => {
  if (d === today()) return "今日";
  if (d === ymd(new Date(Date.now() - 864e5))) return "昨日";
  const dt = new Date(d + "T00:00:00");
  return `${dt.getMonth() + 1}月${dt.getDate()}日（${WD[dt.getDay()]}）`;
};

/* ================= PayPay CSV ================= */
function parseCSV(text) {
  const rows = []; let row = [], f = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"') { if (text[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += c; }
    else if (c === '"') q = true;
    else if (c === ",") { row.push(f); f = ""; }
    else if (c === "\n" || c === "\r") { if (c === "\r" && text[i + 1] === "\n") i++; row.push(f); rows.push(row); row = []; f = ""; }
    else f += c;
  }
  if (f !== "" || row.length) { row.push(f); rows.push(row); }
  return rows.filter(r => r.some(x => x.trim() !== ""));
}
async function readText(file) {
  const buf = await file.arrayBuffer();
  let t;
  try { t = new TextDecoder("utf-8", { fatal: true }).decode(buf); } catch { t = new TextDecoder("shift_jis").decode(buf); }
  return t.replace(/^﻿/, "");
}
function parsePayPay(text) {
  const rows = parseCSV(text);
  const hi = rows.findIndex(r => r.some(c => c.trim() === "取引日"));
  if (hi < 0) throw new Error("format");
  const head = rows[hi].map(c => c.trim());
  const col = (re) => head.findIndex(c => re.test(c));
  const iDate = col(/^取引日/), iOut = col(/^出金金額/), iKind = col(/^取引内容/), iWho = col(/^取引先/), iNo = col(/^取引番号/);
  if (iDate < 0 || iOut < 0) throw new Error("format");
  const out = [];
  rows.slice(hi + 1).forEach((r, n) => {
    const amount = Number(String(r[iOut] || "").replace(/[^0-9]/g, ""));
    const m = String(r[iDate] || "").match(/(\d{4})[\/\-年.](\d{1,2})[\/\-月.](\d{1,2})/);
    const tm = String(r[iDate] || "").match(/(\d{1,2}):(\d{2})/);
    if (!amount || !m) return;
    const date = `${m[1]}-${pad(m[2])}-${pad(m[3])}`;
    const who = (iWho >= 0 ? r[iWho] : "").trim(), kind = (iKind >= 0 ? r[iKind] : "").trim();
    const no = (iNo >= 0 ? r[iNo] : "").replace(/[^A-Za-z0-9_-]/g, "");
    let hsh = 0; for (const ch of date + amount + who + n) hsh = (hsh * 33 + ch.charCodeAt(0)) >>> 0;
    const [category, sub] = guessCat(who, kind);
    out.push({ id: "pp_" + (no || "x" + hsh.toString(36)), date, time: tm ? pad(tm[1]) + ":" + tm[2] : "", amount, kind, who: who.slice(0, 40), category, sub, on: /支払/.test(kind) || !kind });
  });
  return out;
}

/* ================= demo store ================= */
function demoStore() {
  let rnd = 11; const R = () => (rnd = (rnd * 16807) % 2147483647) / 2147483647;
  const pick = (a) => a[Math.floor(R() * a.length)];
  const users = {
    me: { name: "あなた", groups: ["ITSUMEN123", "KAZOKU4567"], current: "ITSUMEN123" },
    sakura: { name: "さくら", groups: ["ITSUMEN123"] }, ken: { name: "けん", groups: ["ITSUMEN123"] }, mama: { name: "お母さん", groups: ["KAZOKU4567"] },
  };
  const groups = { ITSUMEN123: { name: "いつメン", members: ["me", "sakura", "ken"] }, KAZOKU4567: { name: "家族", members: ["me", "mama"] } };
  const pub = {}, priv = {}, prefs = { me: { budget: 90000, catBudgets: { 食費: 35000, 交通費: 8000, 娯楽: 12000, 日用品: 6000 }, noSpend: [],
    favs: [{ c: "食費", s: "昼ごはん", m: "", sh: "社食", a: 450, p: "現金" }, { c: "交通費", s: "電車", m: "", sh: "JR", a: 0, p: "交通系IC" }, { c: "食費", s: "カフェ", m: "", sh: "スターバックス", a: 0, p: "PayPay" }] } };
  const share = { me: { defaultPublic: false, hiddenCats: ["健康・医療"], blocked: [] } };
  const T = [
    ["食費", "スーパー・食料品", ["ライフ", "イオン", "業務スーパー"], [800, 4200], ["クレジットカード", "PayPay"]],
    ["食費", "コンビニ", ["セブン-イレブン", "ローソン", "ファミリーマート"], [150, 900], ["PayPay", "交通系IC"]],
    ["食費", "昼ごはん", ["社食", "丸亀製麺", "すき家", "松屋"], [450, 1100], ["現金", "PayPay"]],
    ["食費", "カフェ", ["スターバックス", "ドトール", "コメダ珈琲"], [350, 900], ["PayPay", "電子マネー"]],
    ["食費", "夜ごはん", ["サイゼリヤ", "ガスト", "居酒屋"], [900, 3800], ["クレジットカード"]],
    ["日用品", "ドラッグストア", ["マツモトキヨシ", "ウエルシア"], [300, 2500], ["PayPay"]],
    ["日用品", "100円ショップ", ["ダイソー", "セリア"], [110, 880], ["現金"]],
    ["交通費", "電車", ["JR", "阪急電鉄"], [180, 1200], ["交通系IC"]],
    ["交際費", "飲み会", ["居酒屋", "焼肉"], [3000, 6000], ["現金", "クレジットカード"]],
    ["娯楽", "映画・ライブ", ["TOHOシネマズ"], [1900, 2200], ["クレジットカード"]],
    ["娯楽", "本・マンガ", ["紀伊國屋書店", "TSUTAYA"], [600, 1800], ["PayPay"]],
    ["服・美容", "服", ["ユニクロ", "GU"], [1500, 5000], ["クレジットカード"]],
  ];
  const base = thisMonth(), tday = new Date().getDate();
  let n = 0;
  const gen = (uid, scale) => {
    pub[uid] = []; priv[uid] = [];
    for (let k = 6; k >= 0; k--) {
      const ym = addMonths(base, -k), days = k === 0 ? tday : daysIn(ym);
      const cnt = Math.round((14 + R() * 10) * scale * (k === 0 ? tday / daysIn(ym) : 1));
      for (let i = 0; i < cnt; i++) {
        const [c, s, shops, [lo, hi], pays] = T[Math.floor(R() * R() * T.length)];
        const amt = Math.round((lo + (hi - lo) * R()) / 10) * 10;
        const e = { id: "s" + n++, date: `${ymKey(ym)}-${pad(1 + Math.floor(R() * days))}`, time: pad(8 + Math.floor(R() * 14)) + ":" + pad(Math.floor(R() * 6) * 10), amount: amt, category: c, sub: s, shop: pick(shops), memo: "", pay: pick(pays), type: "expense", t: n };
        (R() < 0.12 ? priv[uid] : pub[uid]).push(e);
      }
      pub[uid].push({ id: "s" + n++, date: `${ymKey(ym)}-${pad(Math.min(days, 2))}`, time: "09:00", amount: 7800, category: "住まい", sub: "スマホ・通信", shop: "ドコモ", memo: "", pay: "口座振替", type: "expense", t: n });
      if (k === 0 ? tday >= 25 : true) priv[uid].push({ id: "s" + n++, date: `${ymKey(ym)}-${pad(Math.min(days, 25))}`, time: "10:00", amount: 210000 + Math.round(R() * 30) * 1000, category: "給与", sub: "給料", shop: "", memo: "", pay: "", type: "income", t: n });
    }
  };
  gen("me", 1); gen("sakura", 1.1); gen("ken", .8); gen("mama", .9);
  priv.me.push({ id: "p1", date: today(), time: "21:30", amount: 3000, category: "娯楽", sub: "ゲーム", shop: "", memo: "ゲーム課金", pay: "クレジットカード", type: "expense", t: 1 });
  const L = new Set(); const bump = () => L.forEach(f => f());
  const watch = (fn) => { const f = () => fn(); L.add(f); setTimeout(f, 350); return () => L.delete(f); }; // small delay so loading states can be seen
  let authCb = null, user = null;
  const clone = (x) => JSON.parse(JSON.stringify(x));
  const box = (uid, p) => p ? (priv[uid] = priv[uid] || []) : (pub[uid] = pub[uid] || []);
  return {
    demo: true,
    onAuth(cb) { authCb = cb; setTimeout(() => cb(user), 0); },
    async signIn() { user = { uid: "me", email: "demo@example.com" }; authCb(user); },
    async signUp(email, pw, name) { users.me.name = name || "あなた"; return this.signIn(); },
    async resetPassword() {},
    async signOut() { user = null; authCb(null); },
    watchMe(uid, cb) { return watch(() => cb(clone(users[uid]))); },
    async ensureMe() {},
    async updateMe(uid, patch) { Object.assign(users[uid], patch); bump(); },
    watchUser(uid, cb) { return watch(() => cb(users[uid] ? { name: users[uid].name } : null)); },
    async getGroup(code) { return groups[code] ? { name: groups[code].name } : null; },
    async createGroup(uid, name) { const c = newCode(); groups[c] = { name, members: [uid] }; users[uid].groups.push(c); users[uid].current = c; bump(); return c; },
    async joinGroup(uid, code) { if (!groups[code]) { const e = new Error(); e.code = "not_found"; throw e; } if (!groups[code].members.includes(uid)) groups[code].members.push(uid); if (!users[uid].groups.includes(code)) users[uid].groups.push(code); users[uid].current = code; bump(); },
    async leaveGroup(uid, code) { groups[code].members = groups[code].members.filter(x => x !== uid); users[uid].groups = users[uid].groups.filter(x => x !== code); users[uid].current = users[uid].groups[0] || null; bump(); },
    watchMembers(code, cb) { return watch(() => cb(groups[code] ? groups[code].members.slice() : [])); },
    watchRange(uid, from, to, p, cb) { return watch(() => cb(clone(box(uid, p).filter(x => x.date >= from && x.date <= to)))); },
    async addEntry(uid, data, p) { const id = "d" + Date.now() + Math.random().toString(36).slice(2, 6); box(uid, p).push({ id, ...data, t: Date.now() }); bump(); return id; },
    async setEntry(uid, id, data, p) { const b = box(uid, p); const i = b.findIndex(e => e.id === id); if (i >= 0) b[i] = { id, ...data, t: b[i].t }; else b.push({ id, ...data, t: Date.now() }); bump(); },
    async updateEntry(uid, id, data, p) { const x = box(uid, p).find(e => e.id === id); if (x) Object.assign(x, data); bump(); },
    async deleteEntry(uid, id, p) { const b = box(uid, p); const i = b.findIndex(e => e.id === id); if (i >= 0) b.splice(i, 1); bump(); },
    async moveEntry(uid, id, data, fromP, toP) { await this.deleteEntry(uid, id, fromP); box(uid, toP).push({ id, ...data, t: Date.now() }); bump(); },
    async privatize(uid, filter) { const moved = box(uid, false).filter(filter); pub[uid] = box(uid, false).filter(x => !filter(x)); box(uid, true).push(...moved); bump(); return moved.length; },
    async existingIds(uid) { return new Set(box(uid, false).concat(box(uid, true)).map(e => e.id)); },
    async importEntries(uid, rows, p) { rows.forEach(r => box(uid, p).push({ ...r, t: Date.now() })); bump(); return rows.length; },
    watchPrefs(uid, cb) { return watch(() => cb(clone(prefs[uid] || {}))); },
    async setPrefs(uid, patch) { prefs[uid] = { ...(prefs[uid] || {}), ...patch }; bump(); },
    watchShare(uid, cb) { return watch(() => cb(clone(share[uid] || {}))); },
    async setShare(uid, patch) { share[uid] = { ...(share[uid] || {}), ...patch }; bump(); },
  };
}

/* ================= firebase store ================= */
async function firebaseStore() {
  const [{ initializeApp }, A, F] = await Promise.all([import(FB + "firebase-app.js"), import(FB + "firebase-auth.js"), import(FB + "firebase-firestore.js")]);
  const app = initializeApp(firebaseConfig);
  // Stay signed in across app restarts by default (IndexedDB); "ログインしたままにする" off → this tab only.
  const auth = A.initializeAuth(app, { persistence: [A.indexedDBLocalPersistence, A.browserLocalPersistence, A.browserSessionPersistence] });
  auth.languageCode = "ja";
  const setKeep = (keep) => A.setPersistence(auth, keep ? A.indexedDBLocalPersistence : A.browserSessionPersistence).catch(() => A.setPersistence(auth, keep ? A.browserLocalPersistence : A.browserSessionPersistence));
  let db;
  try { db = F.initializeFirestore(app, { localCache: F.persistentLocalCache() }); } catch { db = F.getFirestore(app); }
  const { doc, collection, getDoc, getDocs, setDoc, updateDoc, deleteDoc, addDoc, onSnapshot, query, where, serverTimestamp, arrayUnion, arrayRemove, writeBatch } = F;
  const uRef = (uid) => doc(db, "users", uid);
  const gRef = (code) => doc(db, "groups", code);
  const mRef = (code, uid) => doc(db, "groups", code, "members", uid);
  const eCol = (uid, p) => collection(db, "users", uid, p ? "private" : "entries");
  const pRef = (uid) => doc(db, "users", uid, "prefs", "main");
  const sRef = (uid) => doc(db, "users", uid, "share", "main");
  const list = (s) => s.docs.map(d => { const x = d.data(); return { id: d.id, ...x, t: x.createdAt?.toMillis?.() || 0 }; });
  const strip = (data) => { const { id, t, priv, ...rest } = data; return rest; };
  return {
    demo: false,
    onAuth(cb) { A.onAuthStateChanged(auth, u => cb(u ? { uid: u.uid, email: u.email } : null)); },
    async signIn(email, pw, keep = true) { await setKeep(keep); await A.signInWithEmailAndPassword(auth, email, pw); },
    async signUp(email, pw, name, keep = true) {
      await setKeep(keep);
      const c = await A.createUserWithEmailAndPassword(auth, email, pw);
      await setDoc(uRef(c.user.uid), { name, groups: [], current: null, createdAt: serverTimestamp() });
    },
    async resetPassword(email) { await A.sendPasswordResetEmail(auth, email); },
    async signOut() { await A.signOut(auth); },
    watchMe(uid, cb) { return onSnapshot(uRef(uid), s => cb(s.exists() ? s.data() : null), () => cb(undefined)); },
    async ensureMe(uid, name) { const s = await getDoc(uRef(uid)); if (!s.exists()) await setDoc(uRef(uid), { name, groups: [], current: null, createdAt: serverTimestamp() }); },
    async updateMe(uid, patch) { await updateDoc(uRef(uid), patch); },
    watchUser(uid, cb) { return onSnapshot(uRef(uid), s => cb(s.exists() ? { name: s.data().name } : null), () => cb(null)); },
    async getGroup(code) { const g = await getDoc(gRef(code)); return g.exists() ? g.data() : null; },
    async createGroup(uid, name) {
      for (let i = 0; i < 3; i++) {
        const code = newCode();
        try {
          await setDoc(gRef(code), { name, createdBy: uid, createdAt: serverTimestamp() });
          await setDoc(mRef(code, uid), { joinedAt: serverTimestamp() });
          await updateDoc(uRef(uid), { groups: arrayUnion(code), current: code });
          return code;
        } catch (e) { if (i === 2) throw e; }
      }
    },
    async joinGroup(uid, code) {
      const g = await getDoc(gRef(code));
      if (!g.exists()) { const e = new Error("not_found"); e.code = "not_found"; throw e; }
      await setDoc(mRef(code, uid), { joinedAt: serverTimestamp() });
      await updateDoc(uRef(uid), { groups: arrayUnion(code), current: code });
    },
    async leaveGroup(uid, code, next) {
      await updateDoc(uRef(uid), { groups: arrayRemove(code), current: next || null });
      try { await deleteDoc(mRef(code, uid)); } catch {}
    },
    watchMembers(code, cb) { return onSnapshot(collection(db, "groups", code, "members"), s => cb(s.docs.map(d => d.id)), () => cb(null)); },
    watchRange(uid, from, to, p, cb, err) {
      return onSnapshot(query(eCol(uid, p), where("date", ">=", from), where("date", "<=", to)), s => cb(list(s)), (e) => (err ? err(e) : cb([])));
    },
    async addEntry(uid, data, p) { const r = await addDoc(eCol(uid, p), { ...strip(data), createdAt: serverTimestamp() }); return r.id; },
    async setEntry(uid, id, data, p) { await setDoc(doc(eCol(uid, p), id), { ...strip(data), createdAt: serverTimestamp() }); },
    async updateEntry(uid, id, data, p) { await updateDoc(doc(eCol(uid, p), id), strip(data)); },
    async deleteEntry(uid, id, p) { await deleteDoc(doc(eCol(uid, p), id)); },
    async moveEntry(uid, id, data, fromP, toP) {
      const b = writeBatch(db);
      b.set(doc(eCol(uid, toP), id), { ...strip(data), createdAt: serverTimestamp() });
      b.delete(doc(eCol(uid, fromP), id));
      await b.commit();
    },
    // Move every public entry matching `filter` into the private collection (used when a category stops being shared).
    async privatize(uid, filter) {
      const s = await getDocs(eCol(uid, false));
      const docs = s.docs.filter(d => filter(normEntry(d.data())));
      for (let i = 0; i < docs.length; i += 200) {
        const b = writeBatch(db);
        docs.slice(i, i + 200).forEach(d => { b.set(doc(eCol(uid, true), d.id), d.data()); b.delete(d.ref); });
        await b.commit();
      }
      return docs.length;
    },
    async existingIds(uid) {
      const ids = new Set();
      for (const p of [false, true]) (await getDocs(query(eCol(uid, p), where("source", "==", "paypay")))).forEach(d => ids.add(d.id));
      return ids;
    },
    async importEntries(uid, rows, p) {
      for (let i = 0; i < rows.length; i += 400) {
        const b = writeBatch(db);
        rows.slice(i, i + 400).forEach(r => { const { id, ...data } = r; b.set(doc(eCol(uid, p), id), { ...data, createdAt: serverTimestamp() }); });
        await b.commit();
      }
      return rows.length;
    },
    watchPrefs(uid, cb) { return onSnapshot(pRef(uid), s => cb(s.exists() ? s.data() : {}), () => cb({})); },
    async setPrefs(uid, patch) { await setDoc(pRef(uid), patch, { merge: true }); },
    watchShare(uid, cb) { return onSnapshot(sRef(uid), s => cb(s.exists() ? s.data() : {}), () => cb({})); },
    async setShare(uid, patch) { await setDoc(sRef(uid), patch, { merge: true }); },
  };
}

/* ================= state ================= */
const S = {
  store: null, user: null, me: null, prefs: {}, share: {},
  code: null, group: null, groupNames: {}, memberIds: [], people: {},
  data: {}, priv: [], loaded: {}, privLoaded: false, denied: {},
  viewing: null, ym: thisMonth(), tab: "home",
  list: { q: "", type: "all", cat: "" }, an: { period: "month", sel: "" },
  subs: { me: null, prefs: null, share: null, group: [], data: [] }, personSubs: {},
  startDismissed: false, refreshing: false, donutPrev: {}, nums: {},
  joinParam: normCode(new URLSearchParams(location.search).get("join")),
};
const me = () => S.user?.uid;
const isMe = (uid) => uid === me();
const unsubAll = (arr) => { arr.forEach(f => { try { f(); } catch {} }); arr.length = 0; };
const nameOf = (uid) => (isMe(uid) ? S.me?.name || "自分" : S.people[uid]?.name) || "メンバー";
const colorOf = (uid) => isMe(uid) ? PEOPLE[0] : PEOPLE[1 + hashIdx(uid, PEOPLE.length - 1)];
const people = () => [me(), ...S.memberIds.filter(x => !isMe(x))];
// What the viewer may see of a person: everything for yourself, only public records for anyone else.
const recordsOf = (uid) => isMe(uid) ? (S.data[uid] || []).map(x => ({ ...x, priv: false })).concat(S.priv.map(x => ({ ...x, priv: true }))) : (S.data[uid] || []);
const isLoaded = (uid) => !!S.loaded[uid] && (!isMe(uid) || S.privLoaded);
const hiddenCats = () => S.share.hiddenCats || [];
let rq = false;
const queueRender = () => { if (rq) return; rq = true; requestAnimationFrame(() => { rq = false; render(); }); };

/* ================= theme ================= */
function applyTheme(t) {
  const r = document.documentElement;
  if (t === "light" || t === "dark") r.setAttribute("data-theme", t); else r.removeAttribute("data-theme");
}

/* ================= toast ================= */
const TOAST_ICON = { success: "check", error: "x", warning: "warn", info: "info" };
function toast(msg, opts = {}) {
  const type = opts.type || "info", root = $("toastRoot");
  root.classList.toggle("over-sheet", sheets.length > 0);
  // drop an identical toast that is already showing
  [...root.children].forEach(t => { if (t.dataset.msg === msg) t.remove(); });
  while (root.children.length >= 2) root.firstChild.remove();
  const close = () => { if (!el.isConnected) return; el.classList.add("out"); setTimeout(() => el.remove(), 210); };
  const icon = ic(TOAST_ICON[type], type === "success" ? { class: "check", "stroke-width": 3 } : { "stroke-width": 2.6 });
  const el = h("div", { class: "toast " + type, "data-msg": msg },
    h("span", { class: "ti" }, icon), h("span", { class: "msg" }, msg),
    opts.action ? h("button", { type: "button", class: "act", onclick: () => { close(); opts.action.fn(); } }, opts.action.label) : null,
    h("button", { type: "button", class: "x", "aria-label": "通知を閉じる", onclick: close }, "×"));
  root.append(el);
  if (type === "error" || type === "warning") $("alertRoot").textContent = msg;
  setTimeout(close, opts.action ? 6000 : type === "error" ? 5000 : 2800);
  if (type === "success") buzz(10);
}
const ok = (m, o) => toast(m, { ...o, type: "success" });
const fail = (m, o) => toast(m, { ...o, type: "error" });
const warn = (m, o) => toast(m, { ...o, type: "warning" });

/* ================= sheets (stackable) & modal ================= */
const sheets = [];
// opts.page: a full-screen page that slides in from the right (used for the entry screen);
// otherwise a bottom sheet. Pages also take one step of browser history so "back" closes them.
function openSheet(content, opts = {}) {
  const scrim = h("div", { class: "scrim" + (opts.page ? " page-scrim" : ""), onclick: () => { if (!opts.page) closeSheet(handle); } });
  const body = h("div", { class: "body" }, content);
  const grab = opts.page ? null : h("div", { class: "grab", "aria-hidden": "true" });
  const el = h("div", { class: "sheet" + (opts.page ? " page" : "") + (opts.tall ? " tall" : "") + (opts.footer ? " has-keypad" : ""), role: "dialog", "aria-modal": "true", "aria-label": opts.label || "" },
    opts.header || grab, body, opts.footer || null);
  const handle = { el, scrim, body, onClose: opts.onClose, page: !!opts.page };
  sheets.push(handle);
  $("sheetRoot").append(scrim, el);
  $("tabbar").setAttribute("aria-hidden", "true");
  if (grab) dragToClose(handle, grab);
  if (opts.page) {
    try { history.pushState({ kakeiboPage: true }, ""); handle.pushed = true; } catch {}
    handle.onPop = () => { handle.popped = true; closeSheet(handle); };
    window.addEventListener("popstate", handle.onPop);
  }
  setTimeout(() => { const f = el.querySelector("[autofocus]"); if (f) f.focus(); }, 380);
  return handle;
}
function closeSheet(handle) {
  handle = handle || sheets[sheets.length - 1];
  if (!handle) return;
  const i = sheets.indexOf(handle); if (i < 0) return;
  sheets.splice(i, 1);
  handle.el.classList.add("out"); handle.scrim.classList.add("out");
  setTimeout(() => { handle.el.remove(); handle.scrim.remove(); }, 260);
  if (handle.page) {
    window.removeEventListener("popstate", handle.onPop);
    if (handle.pushed && !handle.popped && history.state?.kakeiboPage) { try { history.back(); } catch {} }
  }
  if (!sheets.length) $("tabbar").removeAttribute("aria-hidden");
  handle.onClose?.();
}
const closeAllSheets = () => { while (sheets.length) closeSheet(); };
function dragToClose(handle, grab) {
  let y0 = null, dy = 0;
  const move = (e) => { if (y0 == null) return; dy = Math.max(0, e.clientY - y0); handle.el.style.setProperty("--drag", dy + "px"); };
  const up = () => {
    if (y0 == null) return; y0 = null; handle.el.classList.remove("dragging");
    if (dy > 110) { closeSheet(handle); return; }
    handle.el.classList.add("snap"); handle.el.style.setProperty("--drag", "0px");
    setTimeout(() => handle.el.classList.remove("snap"), 300);
  };
  grab.addEventListener("pointerdown", (e) => { y0 = e.clientY; dy = 0; handle.el.classList.add("dragging"); grab.setPointerCapture(e.pointerId); });
  grab.addEventListener("pointermove", move);
  grab.addEventListener("pointerup", up); grab.addEventListener("pointercancel", up);
}
function confirmModal({ title, body, okLabel = "OK", danger = false, cancelLabel = "キャンセル" }) {
  return new Promise((resolve) => {
    const scrim = h("div", { class: "scrim" });
    const done = (v) => { modal.classList.add("out"); scrim.classList.add("out"); setTimeout(() => wrap.remove(), 200); resolve(v); };
    const okBtn = h("button", { type: "button", class: "btn press " + (danger ? "danger solid" : "primary"), onclick: () => done(true) }, okLabel);
    const modal = h("div", { class: "modal", role: "alertdialog", "aria-modal": "true", "aria-label": title },
      h("h3", null, title), body ? h("div", { class: "help" }, body) : null,
      h("div", { class: "row" }, h("button", { type: "button", class: "btn press", onclick: () => done(false) }, cancelLabel), okBtn));
    const wrap = h("div", { class: "modal-wrap" }, scrim, modal);
    scrim.addEventListener("click", () => done(false));
    $("modalRoot").append(wrap);
    setTimeout(() => okBtn.focus(), 50);
  });
}

/* ================= reusable bits ================= */
function countUp(el, value, fmt = yen, key) {
  const k = key || el.dataset.key;
  const from = k in S.nums ? S.nums[k] : 0;
  S.nums[k] = value;
  if (reduced() || from === value) { el.textContent = fmt(value); return; }
  const t0 = performance.now(), d = 520;
  const step = (t) => {
    const p = Math.min(1, (t - t0) / d), e = 1 - Math.pow(1 - p, 3);
    el.textContent = fmt(from + (value - from) * e);
    if (p < 1 && el.isConnected) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}
function numEl(key, value, fmt = yen, cls = "num") { const e = h("span", { class: cls }); countUp(e, value, fmt, key); return e; }
function segmented(options, current, onPick, label) {
  const i = Math.max(0, options.findIndex(o => o[0] === current));
  const thumb = h("span", { class: "thumb", style: `width:calc((100% - 6px) / ${options.length});transform:translateX(${i * 100}%)` });
  const el = h("div", { class: "seg", role: "group", "aria-label": label || "" }, thumb, options.map(([v, l], j) =>
    h("button", { type: "button", "aria-pressed": String(v === current), onclick: () => {
      thumb.style.transform = `translateX(${j * 100}%)`;
      el.querySelectorAll("button").forEach((b, k) => b.setAttribute("aria-pressed", String(k === j)));
      onPick(v);
    } }, l)));
  return el;
}
function switchEl(id, checked, onChange, label, disabled) {
  const input = h("input", { type: "checkbox", role: "switch", id, checked: checked ? true : null, disabled: disabled ? true : null, "aria-label": label, onchange: (e) => onChange(e.target.checked, e.target) });
  return h("span", { class: "switch" }, input, h("span"));
}
const avatar = (uid, size) => h("span", { class: "av", style: `background:${colorOf(uid)}${size ? `;width:${size}px;height:${size}px` : ""}` }, nameOf(uid).slice(0, 1));
const catIcon = (id, sm) => h("span", { class: "icon" + (sm ? " sm" : ""), style: `background:${cvar(catOf(id).c)}` }, catOf(id).g);
function emptyState(title, text, action, iconKey = "receipt") {
  return h("div", { class: "empty fade-in" }, h("div", { class: "art" }, ic(iconKey)), h("strong", null, title), text ? h("span", null, text) : null,
    action ? h("button", { type: "button", class: "btn primary press", onclick: action.fn }, action.label) : null);
}
const skRows = (n = 4) => h("div", { class: "rows loading-delay", "aria-busy": "true", "aria-label": "読み込み中" },
  Array.from({ length: n }, () => h("div", { class: "erow sk-row" }, h("div", { class: "face" }, h("span", { class: "sk", style: "width:34px;height:34px;border-radius:11px" }),
    h("div", { class: "t" }, h("div", { class: "sk line", style: "width:60%" }), h("div", { class: "sk line", style: "width:40%;margin-top:8px;height:9px" })), h("span", { class: "sk line", style: "width:60px" })))));
const skCard = (hgt = 160) => h("div", { class: "card loading-delay", "aria-busy": "true" }, h("div", { class: "sk line", style: "width:30%" }), h("div", { class: "sk", style: `height:${hgt}px;margin-top:12px;border-radius:14px` }));

/* ================= pull to refresh ================= */
function wirePullToRefresh() {
  const ptr = $("ptr"), area = $("screens");
  let y0 = null, x0 = 0, dist = 0, active = false, ready = false;
  const scr = () => area.querySelector(".screen:not([hidden])");
  const setPos = (d, settle) => {
    ptr.classList.toggle("settle", !!settle);
    ptr.style.transform = `translateY(${d - 48}px) rotate(${d * 3}deg)`;
    ptr.style.opacity = String(Math.min(1, d / 50));
  };
  area.addEventListener("touchstart", (e) => {
    if (S.refreshing || e.touches.length > 1 || sheets.length) return;
    const s = scr(); if (!s || s.scrollTop > 0) return;
    if (e.target.closest(".wallet, .insights, .chips, .erow .face.open")) { y0 = null; return; }
    y0 = e.touches[0].clientY; x0 = e.touches[0].clientX; dist = 0; active = false; ready = false;
  }, { passive: true });
  area.addEventListener("touchmove", (e) => {
    if (y0 == null) return;
    const dy = e.touches[0].clientY - y0, dx = Math.abs(e.touches[0].clientX - x0);
    if (!active) { if (dy > 6 && dy > dx && scr().scrollTop <= 0) active = true; else if (dy < 0 || dx > dy) { y0 = null; return; } else return; }
    e.preventDefault(); // we own this gesture now; stops the browser's rubber-band
    dist = 110 * (1 - Math.exp(-dy / 160)); // more resistance the further you pull
    setPos(dist);
    const r = dist > 64; if (r !== ready) { ready = r; ptr.classList.toggle("ready", r); if (r) buzz(6); }
  }, { passive: false });
  const end = async () => {
    if (y0 == null) return; y0 = null;
    if (!active) return; active = false;
    if (!ready) { setPos(0, true); return; }
    ptr.classList.remove("ready"); ptr.classList.add("spin"); setPos(56, true);
    await doRefresh();
    ptr.classList.remove("spin"); setPos(0, true);
  };
  area.addEventListener("touchend", end); area.addEventListener("touchcancel", end);
}
async function doRefresh() {
  if (S.refreshing || !S.user) return;
  S.refreshing = true;
  try { await watchData(true); ok("最新の情報に更新しました"); }
  catch { fail("更新できませんでした。通信状態を確認してください"); }
  finally { S.refreshing = false; }
}

/* ================= data subscriptions ================= */
function onSignedIn(user) {
  S.user = user; S.me = null; S.viewing = user.uid; S.startDismissed = false;
  S.subs.me = S.store.watchMe(user.uid, async (doc) => {
    if (doc === undefined) { fail("読み込めませんでした。通信状態を確認してください"); return; }
    if (doc === null) { try { await S.store.ensureMe(user.uid, (user.email || "わたし").split("@")[0].slice(0, 20)); } catch {} return; }
    const first = !S.me; S.me = doc;
    const groups = doc.groups || [];
    const want = groups.includes(doc.current) ? doc.current : groups[0] || null;
    if (first || want !== S.code) switchGroup(want);
    groups.forEach(c => { if (!(c in S.groupNames)) { S.groupNames[c] = ""; S.store.getGroup(c).then(g => { S.groupNames[c] = g?.name || "グループ"; queueRender(); refreshDrawer(); }).catch(() => {}); } });
    if (first) {
      hideFull();
      if (S.joinParam && !groups.includes(S.joinParam)) joinSheet(S.joinParam);
      else if (!groups.length && !S.startDismissed) showStart();
      history.replaceState(null, "", location.pathname);
    }
    queueRender(); refreshDrawer();
  });
  S.subs.prefs = S.store.watchPrefs(user.uid, (p) => { S.prefs = p || {}; queueRender(); });
  S.subs.share = S.store.watchShare(user.uid, (p) => { S.share = p || {}; queueRender(); });
}
function onSignedOut() {
  S.subs.me?.(); S.subs.prefs?.(); S.subs.share?.(); unsubAll(S.subs.group); unsubAll(S.subs.data);
  Object.values(S.personSubs).forEach(f => f()); S.personSubs = {};
  Object.assign(S, { user: null, me: null, prefs: {}, share: {}, code: null, group: null, groupNames: {}, memberIds: [], people: {}, data: {}, priv: [], loaded: {}, privLoaded: false, denied: {}, viewing: null, nums: {} });
  closeDrawer(); closeAllSheets(); showAuth("login");
}
function switchGroup(code) {
  unsubAll(S.subs.group);
  S.code = code; S.group = null;
  if (!code) { setMembers([me()]); return; }
  S.store.getGroup(code).then(g => { if (S.code === code) { S.group = g; S.groupNames[code] = g?.name || "グループ"; queueRender(); } }).catch(() => {});
  setMembers([me()]);
  S.subs.group.push(S.store.watchMembers(code, (ids) => {
    if (!ids || S.code !== code) return;
    setMembers(Array.from(new Set([me(), ...ids])));
  }));
}
function setMembers(ids) {
  const same = ids.length === S.memberIds.length && ids.every(x => S.memberIds.includes(x));
  if (same && S.subs.data.length) return;
  S.memberIds = ids;
  if (!ids.includes(S.viewing)) S.viewing = me();
  Object.keys(S.personSubs).forEach(id => { if (!ids.includes(id)) { S.personSubs[id](); delete S.personSubs[id]; } });
  ids.forEach(id => { if (!isMe(id) && !S.personSubs[id]) S.personSubs[id] = S.store.watchUser(id, (u) => { S.people[id] = u; queueRender(); }); });
  watchData();
}
// Seven months of records up to the shown month: enough for 6-month trends and month-on-month comparisons.
function watchData(keepOld) {
  unsubAll(S.subs.data);
  if (!keepOld) { S.data = {}; S.priv = []; S.loaded = {}; S.privLoaded = false; }
  S.denied = {};
  const from = ymKey(addMonths(S.ym, -6)) + "-01", to = ymKey(S.ym) + "-31";
  const waits = [];
  const once = () => { let res, rej; const p = new Promise((a, b) => { res = a; rej = b; }); waits.push(p); let done = false; return { ok: () => { if (!done) { done = true; res(); } }, ng: (e) => { if (!done) { done = true; rej(e); } } }; };
  S.memberIds.forEach(uid => {
    const w = once();
    S.subs.data.push(S.store.watchRange(uid, from, to, false,
      (l) => { S.data[uid] = l.map(normEntry); S.loaded[uid] = true; S.denied[uid] = false; w.ok(); queueRender(); },
      () => { S.data[uid] = []; S.loaded[uid] = true; S.denied[uid] = true; isMe(uid) ? w.ng() : w.ok(); queueRender(); }));
  });
  const w = once();
  S.subs.data.push(S.store.watchRange(me(), from, to, true, (l) => { S.priv = l.map(normEntry); S.privLoaded = true; w.ok(); queueRender(); }, () => { S.privLoaded = true; w.ng(); queueRender(); }));
  queueRender();
  const p = Promise.race([Promise.all(waits), new Promise((_, rej) => setTimeout(() => rej(new Error("timeout")), 8000))]);
  p.catch(() => {}); // only pull-to-refresh reports failures; background reloads stay quiet
  return p;
}
function setViewing(uid, fromCarousel) {
  if (!S.memberIds.includes(uid)) uid = me();
  if (S.viewing === uid) return;
  S.viewing = uid; S.an.sel = ""; S.list.cat = ""; S.list.type = "all";
  buzz(5);
  if (!fromCarousel) S.homeKey = null; // re-centre the wallet on the chosen card
  render();
}
function shiftMonth(d) { S.ym = addMonths(S.ym, d); S.an.sel = ""; S.homeKey = null; watchData(true); render(); }

/* ================= header & tabs ================= */
function renderHeader() {
  const uid = S.viewing;
  $("whoBtn").replaceChildren(avatar(uid), h("div", null, h("strong", null, isMe(uid) ? `${nameOf(uid)}の家計簿` : `${nameOf(uid)}さんの家計簿`),
    h("small", null, isMe(uid) ? (S.code ? (S.group?.name || S.groupNames[S.code] || "グループ") : "ひとりで使っています") : h("span", { class: "badge view" }, ic("eye"), "閲覧のみ"))));
  $("monthLabel").textContent = `${S.ym.y}年${S.ym.m}月`;
  $("monthnav").hidden = S.tab === "friends";
}
function go(tab) {
  if (S.tab !== tab) { S.tab = tab; buzz(4); }
  document.querySelectorAll(".tab").forEach(b => { if (b.dataset.go === tab) b.setAttribute("aria-current", "page"); else b.removeAttribute("aria-current"); });
  document.querySelectorAll(".screen").forEach(s => {
    const on = s.dataset.tab === tab;
    if (on && s.hidden) { s.hidden = false; s.classList.remove("enter"); void s.offsetWidth; s.classList.add("enter"); } else if (!on) s.hidden = true;
  });
  moveTabIndicator();
  render();
}
function moveTabIndicator() {
  const b = document.querySelector(`.tab[data-go="${S.tab}"]`), bar = $("tabbar"), ind = $("tabInd");
  if (!b) return;
  const r = b.getBoundingClientRect(), br = bar.getBoundingClientRect();
  ind.style.width = Math.min(64, r.width - 8) + "px";
  ind.style.transform = `translateX(${r.left - br.left + (r.width - Math.min(64, r.width - 8)) / 2}px)`;
}
function render() {
  if (!S.user) return;
  renderHeader();
  if (S.tab === "home") renderHome();
  else if (S.tab === "list") renderList();
  else if (S.tab === "analysis") renderAnalysis();
  else renderFriends();
  S.shareRedraw?.();
}

/* ================= HOME ================= */
function monthStats(uid, ym) {
  const all = recordsOf(uid), cur = inMonth(all, ym), prev = inMonth(all, addMonths(ym, -1));
  return { cur, prev, spent: expTotal(cur), prevSpent: expTotal(prev), income: incTotal(cur) };
}
function pctChange(a, b) { return b > 0 ? Math.round((a - b) / b * 100) : null; }
function personCard(uid, i) {
  const st = monthStats(uid, S.ym), ch = pctChange(st.spent, st.prevSpent), mine = isMe(uid);
  const budget = mine ? Number(S.prefs.budget || 0) : 0;
  const big = h("span", { class: "num" }); countUp(big, st.spent, (v) => Math.round(v).toLocaleString("ja-JP"), "card-" + uid + ymKey(S.ym));
  return h("button", { type: "button", class: "pcard" + (S.viewing === uid ? "" : " dim"), style: `--pc:${colorOf(uid)}`, "data-uid": uid, "data-i": i,
    "aria-label": `${nameOf(uid)}の家計簿 ${S.ym.m}月の支出 ${yen(st.spent)}`, onclick: () => { if (S.viewing !== uid) scrollWalletTo(uid); } },
    h("div", { class: "top" }, h("span", { class: "av" }, nameOf(uid).slice(0, 1)), h("span", { class: "nm" }, nameOf(uid)),
      mine ? h("span", { class: "pill" }, "自分") : h("span", { class: "pill" }, ic("eye"), "閲覧のみ")),
    h("div", { class: "lbl" }, `${S.ym.m}月の支出${mine ? "" : "（公開分）"}`),
    !isLoaded(uid) ? h("div", { class: "big" }, h("span", { class: "sk", style: "display:inline-block;width:150px;height:36px;background:rgba(255,255,255,.2)" }))
      : S.denied[uid] ? h("div", { class: "big", style: "font-size:1rem" }, "この人の家計簿は表示できません")
      : h("div", { class: "big" }, h("small", null, "¥"), big),
    h("div", { class: "meta" },
      ch != null ? h("span", null, ch > 0 ? ic("up") : ic("down"), `先月比 ${ch > 0 ? "+" : ""}${ch}%`) : null,
      mine && budget ? h("span", null, ic("target"), st.spent > budget ? `予算を${yen(st.spent - budget)}超過` : `予算残り ${yen(budget - st.spent)}`) : null,
      mine && st.income ? h("span", null, `収入 ${yen(st.income)}`) : null,
      !mine ? h("span", null, `${st.cur.filter(isExp).length}件`) : null));
}
function scrollWalletTo(uid, instant) {
  const w = document.querySelector(".wallet"); if (!w) return;
  const card = w.querySelector(`[data-uid="${CSS.escape(uid)}"]`); if (!card) return;
  w.scrollTo({ left: card.offsetLeft - w.firstElementChild.offsetLeft, behavior: instant || reduced() ? "auto" : "smooth" });
}
function renderHome() {
  const scr = $("s-home"), ps = people();
  const key = ps.join(",") + "|" + ymKey(S.ym) + "|" + ps.map(u => (isLoaded(u) ? 1 : 0) + (S.denied[u] ? "d" : "")).join("") + "|" + JSON.stringify(ps.map(u => [nameOf(u), monthStats(u, S.ym).spent])) + S.prefs.budget;
  let wallet = scr.querySelector(".wallet");
  if (!wallet || S.homeKey !== key) {
    const prevLeft = wallet ? wallet.scrollLeft : null, rebuildFully = !wallet || S.homeKey == null;
    S.homeKey = key;
    wallet = h("div", { class: "wallet", role: "group", "aria-label": "家計簿を切り替える（左右にスワイプ）" }, ps.map((u, i) => personCard(u, i)));
    const dots = h("div", { class: "dots", "aria-hidden": "true" }, ps.map(u => h("i", { class: u === S.viewing ? "on" : "" })));
    let t;
    wallet.addEventListener("scroll", () => {
      clearTimeout(t);
      t = setTimeout(() => {
        const cards = [...wallet.children], x = wallet.scrollLeft;
        let best = 0, bd = Infinity; cards.forEach((c, i) => { const d = Math.abs(c.offsetLeft - wallet.firstElementChild.offsetLeft - x); if (d < bd) { bd = d; best = i; } });
        const uid = cards[best]?.dataset.uid;
        cards.forEach((c, i) => c.classList.toggle("dim", i !== best));
        dots.querySelectorAll("i").forEach((d, i) => d.classList.toggle("on", i === best));
        if (uid && uid !== S.viewing) { S.viewing = uid; S.an.sel = ""; S.list.cat = ""; buzz(5); renderHeader(); renderHomeBelow(); }
      }, 90);
    }, { passive: true });
    const top = scr.querySelector(".home-top");
    const block = h("div", { class: "home-top stack", style: "gap:10px" }, wallet, ps.length > 1 ? dots : null);
    if (top) top.replaceWith(block); else fill(scr, block, h("div", { class: "home-below stack", style: "margin-top:14px" }));
    requestAnimationFrame(() => { if (rebuildFully || prevLeft == null) scrollWalletTo(S.viewing, true); else wallet.scrollLeft = prevLeft; });
  }
  renderHomeBelow();
}
function renderHomeBelow() {
  const box = $("s-home").querySelector(".home-below"); if (!box) return;
  const uid = S.viewing, mine = isMe(uid);
  if (!isLoaded(uid)) { fill(box, skCard(60), h("div", { class: "section-title" }, h("h2", null, "最近の記録")), skRows(4)); return; }
  if (S.denied[uid]) { fill(box, emptyState("表示できません", "この人が閲覧を許可していないため、記録は見られません。", null, "lock")); return; }
  const st = monthStats(uid, S.ym), recent = sortEntries(recordsOf(uid)).filter(x => x.date <= ymKey(S.ym) + "-31").slice(0, 6);
  const kids = [];
  if (mine) {
    const budget = Number(S.prefs.budget || 0);
    if (budget) {
      const pct = st.spent / budget, isNow = ymKey(S.ym) === ymKey(thisMonth()), left = daysIn(S.ym) - new Date().getDate() + 1;
      const bar = h("div", { class: "bar" + (pct > 1 ? " over" : pct > .85 ? " near" : "") }, h("i"));
      requestAnimationFrame(() => requestAnimationFrame(() => { bar.firstChild.style.width = Math.min(100, pct * 100) + "%"; }));
      kids.push(h("button", { type: "button", class: "card press", style: "text-align:left;width:100%", onclick: () => go("analysis") },
        h("div", { style: "display:flex;justify-content:space-between;align-items:baseline;gap:8px" }, h("span", { class: "label", style: "margin:0" }, "今月の予算"),
          h("span", { class: "num", style: "font-weight:700" }, pct > 1 ? h("span", { class: "delta-up" }, `${yen(st.spent - budget)} 超過`) : `残り ${yen(budget - st.spent)}`)),
        h("div", { style: "margin-top:10px" }, bar),
        h("p", { class: "help", style: "margin-top:8px" }, `${yen(st.spent)} / ${yen(budget)}` + (isNow && pct <= 1 && left > 0 ? `・1日あたり ${yen((budget - st.spent) / left)}` : ""))));
    } else kids.push(h("button", { type: "button", class: "card press", style: "text-align:left;width:100%;display:flex;gap:12px;align-items:center", onclick: budgetSheet },
      h("span", { class: "icon", style: "background:var(--brand-soft);color:var(--brand)" }, ic("target")), h("span", null, h("strong", null, "月の予算を決める"), h("small", { class: "help", style: "display:block" }, "使いすぎを早めに気づけます"))));
  } else {
    kids.push(h("div", { class: "card", style: "display:flex;gap:12px;align-items:center;padding:12px 14px" }, h("span", { class: "badge view" }, ic("eye"), "閲覧のみ"),
      h("p", { class: "help" }, `${nameOf(uid)}さんが公開した記録だけを表示しています。編集はできません。`)));
  }
  kids.push(h("div", { class: "section-title" }, h("h2", null, "最近の記録"), recent.length ? h("button", { type: "button", class: "press", onclick: () => go("list") }, "すべて見る") : null));
  kids.push(recent.length ? entryRows(recent, uid) : emptyState(mine ? "まだ支出がありません" : "公開された記録はまだありません",
    mine ? "最初の支出を追加しましょう。下の＋から記録できます。" : "記録が公開されると、ここに表示されます。", mine ? { label: "支出を記録する", fn: () => openEntry() } : null));
  fill(box, ...kids);
}

/* ================= entry rows (with swipe on your own) ================= */
function entryRows(list, uid) {
  const mine = isMe(uid);
  return h("div", { class: "rows" }, list.map(x => {
    const face = h("button", { type: "button", class: "face", "aria-label": `${titleOf(x)} ${x.type === "income" ? "収入" : "支出"} ${yen(x.amount)}${x.priv ? " 非公開" : ""}` },
      catIcon(x.category),
      h("span", { class: "t" }, h("strong", null, titleOf(x)),
        h("small", null, [x.time, catLabel(x), x.pay].filter(Boolean).join("・"))),
      h("span", { class: "amt num" + (x.type === "income" ? " inc" : "") }, (x.type === "income" ? "+" : "") + yen(x.amount),
        x.priv ? h("span", { class: "badge lock" }, ic("lock"), "非公開") : x.source === "paypay" ? h("span", { class: "badge src" }, "PayPay") : null));
    const row = h("div", { class: "erow" }, mine ? h("div", { class: "acts" },
      h("button", { type: "button", class: "ed", tabindex: "-1", onclick: () => openEntry(x) }, ic("edit"), "編集"),
      h("button", { type: "button", class: "del", tabindex: "-1", onclick: () => deleteWithUndo(x, row) }, ic("trash"), "削除")) : null, face);
    if (mine) swipeable(face, () => detailSheet(x, uid)); else face.addEventListener("click", () => detailSheet(x, uid));
    return row;
  }));
}
function swipeable(face, onTap) {
  const W = 152; let x0 = null, y0 = 0, dx = 0, mode = null, open = false;
  const set = (v) => { face.style.transform = v ? `translateX(${v}px)` : ""; };
  face.addEventListener("pointerdown", (e) => { if (e.pointerType === "mouse" && e.button !== 0) return; x0 = e.clientX; y0 = e.clientY; dx = 0; mode = null; });
  face.addEventListener("pointermove", (e) => {
    if (x0 == null) return;
    const mx = e.clientX - x0, my = e.clientY - y0;
    if (!mode) { if (Math.abs(mx) > 8 && Math.abs(mx) > Math.abs(my)) { mode = "h"; face.classList.add("dragging"); face.setPointerCapture(e.pointerId); } else if (Math.abs(my) > 8) { mode = "v"; } }
    if (mode !== "h") return;
    dx = Math.max(-W - 30, Math.min(0, (open ? -W : 0) + mx));
    set(dx);
  });
  const up = () => {
    if (x0 == null) return; x0 = null; face.classList.remove("dragging");
    if (mode === "h") { open = dx < -W / 2; set(open ? -W : 0); face.classList.toggle("open", open); if (open) buzz(6); }
    mode === "h" ? (face.dataset.justDragged = "1", setTimeout(() => delete face.dataset.justDragged, 50)) : null;
  };
  face.addEventListener("pointerup", up); face.addEventListener("pointercancel", up);
  face.addEventListener("click", () => {
    if (face.dataset.justDragged) return;
    if (open) { open = false; set(0); face.classList.remove("open"); return; }
    onTap();
  });
}
async function deleteWithUndo(x, row) {
  const data = { ...x };
  if (row) row.classList.add("removing");
  try {
    await S.store.deleteEntry(me(), x.id, x.priv);
    ok("削除しました", { action: { label: "取り消す", fn: async () => { try { await S.store.setEntry(me(), x.id, data, x.priv); ok("元に戻しました"); } catch { fail("元に戻せませんでした"); } } } });
  } catch { row?.classList.remove("removing"); fail("削除できませんでした。通信状態を確認してください"); }
}
function detailSheet(x, uid) {
  const mine = isMe(uid);
  const rowsOf = [["日時", `${dayLabel(x.date)} ${x.time || ""}`], ["費目", catLabel(x)], ["店舗", x.shop], ["メモ", x.memo], ["支払方法", x.pay], ["公開", mine ? (x.priv ? "非公開（自分だけ）" : "友達に公開") : null], ["取込元", x.source === "paypay" ? "PayPay" : null]].filter(r => r[1]);
  const handle = openSheet(h("div", { class: "stack" },
    h("div", { class: "head" }, catIcon(x.category), h("h2", null, titleOf(x)), mine ? null : h("span", { class: "badge view" }, ic("eye"), "閲覧のみ")),
    h("div", { style: "font-size:2rem;font-weight:700;text-align:right", class: "num" + (x.type === "income" ? " delta-down" : "") }, (x.type === "income" ? "+" : "") + yen(x.amount)),
    h("div", { class: "group" }, rowsOf.map(([k, v]) => h("div", { class: "cell" }, h("span", { class: "help", style: "width:5.5em;flex:none" }, k), h("span", { class: "grow", style: "font-weight:600" }, v)))),
    mine ? h("div", { class: "row" },
      h("button", { type: "button", class: "btn danger press", onclick: async () => {
        if (await confirmModal({ title: "この記録を削除しますか？", body: `${titleOf(x)}・${yen(x.amount)}`, okLabel: "削除", danger: true })) { closeSheet(handle); deleteWithUndo(x); }
      } }, "削除"),
      h("button", { type: "button", class: "btn primary press", onclick: () => { closeSheet(handle); openEntry(x); } }, "編集"))
      : h("p", { class: "help" }, "友達の記録は見るだけで、編集や削除はできません。")), { label: "記録の詳細" });
}

/* ================= LIST ================= */
function renderList() {
  const scr = $("s-list"), uid = S.viewing, mine = isMe(uid);
  const L = S.list;
  const keepFocus = document.activeElement?.id === "listSearch";
  const caret = keepFocus ? document.activeElement.selectionStart : null;
  const search = h("input", { class: "text", id: "listSearch", type: "search", enterkeyhint: "search", placeholder: "店舗・メモ・費目・金額で探す", value: L.q, "aria-label": "明細を検索",
    oninput: (e) => { L.q = e.target.value; renderList(); } });
  const types = [["all", "すべて"], ["expense", "支出"], ["income", "収入"]].concat(mine ? [["private", "非公開"]] : []);
  const cats = [...new Set(inMonth(recordsOf(uid), S.ym).map(x => x.category))];
  const head = h("div", { class: "listhead" },
    h("div", { class: "search" }, ic("search"), search, L.q ? h("button", { type: "button", class: "clear", "aria-label": "検索をクリア", onclick: () => { L.q = ""; renderList(); } }, "×") : null),
    h("div", { class: "chips", role: "group", "aria-label": "絞り込み" },
      types.map(([v, l]) => h("button", { type: "button", class: "chip", "aria-pressed": String(L.type === v && !L.cat), onclick: () => { L.type = v; L.cat = ""; buzz(4); renderList(); } }, l)),
      cats.map(c => h("button", { type: "button", class: "chip", "aria-pressed": String(L.cat === c), onclick: () => { L.cat = L.cat === c ? "" : c; L.type = "all"; buzz(4); renderList(); } }, catIcon(c, true), c))));
  if (!isLoaded(uid)) { fill(scr, head, h("div", { class: "day-h" }, h("span", { class: "sk line", style: "width:80px" })), skRows(5)); return; }
  if (S.denied[uid]) { fill(scr, head, emptyState("表示できません", "この人が閲覧を許可していないため、記録は見られません。", null, "lock")); return; }
  const q = fold(L.q.trim()), qNum = L.q.replace(/[^0-9]/g, "");
  let rows = inMonth(recordsOf(uid), S.ym);
  if (L.type === "expense") rows = rows.filter(isExp);
  if (L.type === "income") rows = rows.filter(x => x.type === "income");
  if (L.type === "private") rows = rows.filter(x => x.priv);
  if (L.cat) rows = rows.filter(x => x.category === L.cat);
  if (q) rows = rows.filter(x => fold([x.shop, x.memo, x.category, x.sub, x.pay].join(" ")).includes(q) || (qNum && String(x.amount).includes(qNum)));
  rows = sortEntries(rows);
  const days = {}; rows.forEach(x => (days[x.date] = days[x.date] || []).push(x));
  const body = rows.length ? [
    h("div", { class: "resultline" }, `${rows.length}件・支出 ${yen(expTotal(rows))}` + (incTotal(rows) ? `・収入 ${yen(incTotal(rows))}` : "") + (mine ? "" : "（公開分）")),
    Object.keys(days).sort().reverse().map(d => h("section", { class: "day" },
      h("div", { class: "day-h" }, h("span", null, dayLabel(d)), h("span", { class: "num" }, yen(expTotal(days[d])))), entryRows(days[d], uid)))]
    : (L.q || L.cat || L.type !== "all") ? emptyState("見つかりませんでした", "条件を変えて探してみてください。", { label: "条件をクリア", fn: () => { Object.assign(L, { q: "", cat: "", type: "all" }); renderList(); } }, "search")
    : emptyState(mine ? "まだ支出がありません" : "公開された記録はありません", mine ? "最初の支出を追加しましょう。" : null, mine ? { label: "支出を記録する", fn: () => openEntry() } : null);
  fill(scr, head, ...[body].flat());
  if (keepFocus) { search.focus(); try { search.setSelectionRange(caret, caret); } catch {} }
}

/* ================= ANALYSIS ================= */
function renderAnalysis() {
  const scr = $("s-analysis"), uid = S.viewing, mine = isMe(uid), A = S.an;
  const seg = segmented([["month", `${S.ym.m}月`], ["prev", `${addMonths(S.ym, -1).m}月`], ["6m", "6か月"]], A.period, (v) => { A.period = v; A.sel = ""; setTimeout(renderAnalysis, 160); }, "期間");
  if (!isLoaded(uid)) { fill(scr, h("div", { class: "stack" }, seg, h("div", { class: "insights" }, h("div", { class: "insight sk loading-delay", style: "height:84px" })), skCard(150), skCard(120), skCard(140))); return; }
  if (S.denied[uid]) { fill(scr, emptyState("表示できません", "この人が閲覧を許可していないため、分析は見られません。", null, "lock")); return; }
  const all = recordsOf(uid);
  const ym = A.period === "prev" ? addMonths(S.ym, -1) : S.ym;
  const range = A.period === "6m" ? all.filter(x => x.date >= ymKey(addMonths(S.ym, -5)) + "-01" && x.date <= ymKey(S.ym) + "-31") : inMonth(all, ym);
  const exp = range.filter(isExp);
  const kids = [seg, insightsRow(uid, ym)];
  kids.push(donutCard(exp, A.period === "6m" ? "6か月の支出" : `${ym.m}月の支出`, uid));
  const duo = h("div", { class: "duo" });
  if (A.period !== "6m") duo.append(budgetCard(uid, ym));
  duo.append(trendCard(uid));
  kids.push(duo);
  kids.push(calendarCard(uid, A.period === "6m" ? S.ym : ym));
  if (A.period !== "6m") kids.push(compareCard(uid, ym));
  if (!mine) kids.push(h("p", { class: "help", style: "text-align:center" }, "友達が公開した記録だけで集計しています。非公開の記録は含まれません。"));
  fill(scr, h("div", { class: "stack" }, kids));
}
function insightsRow(uid, ym) {
  const all = recordsOf(uid), cur = inMonth(all, ym).filter(isExp), prev = inMonth(all, addMonths(ym, -1)).filter(isExp), mine = isMe(uid);
  const cards = [];
  const card = (iconKey, tone, text) => h("div", { class: "insight" }, h("span", { class: "ic", style: `background:var(--${tone}-soft);color:var(--${tone})` }, ic(iconKey)), h("p", null, text));
  if (cur.length && prev.length) {
    const cats = [...new Set(cur.concat(prev).map(x => x.category))].map(c => ({ c, a: sumOf(cur.filter(x => x.category === c)), b: sumOf(prev.filter(x => x.category === c)) }));
    const up = cats.filter(x => x.b >= 1000 && x.a > x.b).sort((p, q) => (q.a - q.b) / q.b - (p.a - p.b) / p.b)[0];
    if (up) cards.push(card("up", "danger", h("span", null, `先月より${up.c}が `, h("b", null, `${Math.round((up.a - up.b) / up.b * 100)}%`), " 増えています")));
    const down = cats.filter(x => x.b >= 1000 && x.a < x.b).sort((p, q) => (q.b - q.a) - (p.b - p.a))[0];
    if (down) cards.push(card("down", "brand", h("span", null, `${ym.m}月の${down.c}は先月より `, h("b", null, yen(down.b - down.a)), " 少なくなっています")));
  }
  if (mine && Number(S.prefs.budget) && ymKey(ym) === ymKey(S.ym)) {
    const b = Number(S.prefs.budget), s = sumOf(cur);
    cards.push(s <= b ? card("target", "brand", h("span", null, `${ym.m}月の予算は残り `, h("b", null, yen(b - s)), " です")) : card("warn", "danger", h("span", null, "予算を ", h("b", null, yen(s - b)), " 超えています")));
  }
  if (cur.length && ymKey(ym) === ymKey(thisMonth())) {
    const d = new Date().getDate();
    if (d >= 5) cards.push(card("spark", "info", h("span", null, "このペースだと月末は約 ", h("b", null, yen(sumOf(cur) / d * daysIn(ym))), " になりそうです")));
  }
  if (cur.length >= 3) { const top = sumBy(cur)[0]; cards.push(card("target", "warn", h("span", null, `${top[0]}が支出の `, h("b", null, `${Math.round(top[1] / sumOf(cur) * 100)}%`), " を占めています"))); }
  if (mine) { const z = (S.prefs.noSpend || []).filter(d => d.startsWith(ymKey(ym))).length; if (z) cards.push(card("check", "brand", h("span", null, "支出ゼロの日が ", h("b", null, `${z}日`), " ありました"))); }
  if (!cards.length) cards.push(card("info", "info", "記録が増えると、先月との比較などの気づきがここに表示されます。"));
  return h("div", { class: "insights", role: "list", "aria-label": "気づき" }, cards.map(c => (c.setAttribute("role", "listitem"), c)));
}
function donutCard(exp, title, uid) {
  const A = S.an, total = sumOf(exp), parts = sumBy(exp);
  if (!total) return h("div", { class: "card" }, h("p", { class: "label" }, title), emptyState("まだ支出がありません", isMe(uid) ? "記録するとグラフが表示されます。" : null, null, "target"));
  const R = 15.9155, C = 21;
  const sel = parts.some(p => p[0] === A.sel) ? A.sel : "";
  const center = svg("g", null,
    svg("text", { x: C, y: C - 4, "text-anchor": "middle", "font-size": 2.6, style: "fill:var(--muted)", text: sel || "合計" }),
    svg("text", { x: C, y: C + 1.6, "text-anchor": "middle", "font-size": 4.4, "font-weight": 700, style: "fill:var(--ink)", class: "num", text: yen(sel ? parts.find(p => p[0] === sel)[1] : total) }),
    sel ? svg("text", { x: C, y: C + 6, "text-anchor": "middle", "font-size": 2.4, style: "fill:var(--muted)", text: `${Math.round(parts.find(p => p[0] === sel)[1] / total * 100)}%` }) : null);
  const g = svg("svg", { viewBox: "0 0 42 42", role: "img", "aria-label": `${title} ${yen(total)}` },
    svg("circle", { cx: C, cy: C, r: R, fill: "none", "stroke-width": 6, style: "stroke:var(--faint)" }));
  let off = 25; const arcs = [];
  parts.forEach(([c, v]) => {
    const p = v / total * 100, gap = parts.length > 1 ? .6 : 0;
    const prev = S.donutPrev[c] || { p: 0, off };
    const arc = svg("circle", { class: "arc" + (sel && sel !== c ? " faded" : "") + (sel === c ? " sel" : ""), cx: C, cy: C, r: R, fill: "none", "stroke-width": 6,
      "stroke-dasharray": `${prev.p} ${100 - prev.p}`, "stroke-dashoffset": prev.off, style: `stroke:${cvar(catOf(c).c)}`, onclick: () => { A.sel = sel === c ? "" : c; buzz(4); renderAnalysis(); } });
    arcs.push([arc, Math.max(0, p - gap), off]);
    S.donutPrev[c] = { p: Math.max(0, p - gap), off };
    off -= p;
  });
  arcs.forEach(([a]) => g.append(a)); g.append(center);
  requestAnimationFrame(() => requestAnimationFrame(() => arcs.forEach(([a, p, o]) => { a.setAttribute("stroke-dasharray", `${p} ${100 - p}`); a.setAttribute("stroke-dashoffset", o); })));
  const legend = h("div", { class: "legend" }, parts.map(([c, v]) => h("button", { type: "button", "aria-pressed": String(sel === c), class: sel && sel !== c ? "faded" : "",
    onclick: () => { A.sel = sel === c ? "" : c; buzz(4); renderAnalysis(); } },
    h("i", { style: `background:${cvar(catOf(c).c)}` }), h("span", null, c), h("span", { class: "num" }, yen(v)), h("span", { class: "pct num" }, Math.round(v / total * 100) + "%"))));
  return h("div", { class: "card" }, h("div", { style: "display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:10px" }, h("p", { class: "label", style: "margin:0" }, title),
    sel ? h("button", { type: "button", class: "btn small press", onclick: () => { S.list = { q: "", type: "all", cat: sel }; go("list"); } }, `${sel}の明細へ`) : null),
    h("div", { class: "donut" }, g, legend),
    sel ? subBreakdown(exp.filter(x => x.category === sel)) : null);
}
function subBreakdown(list) {
  const parts = sumBy(list, "sub"), t = sumOf(list);
  return h("div", { class: "fade-in", style: "margin-top:12px;border-top:1px solid var(--line);padding-top:10px" }, parts.map(([s, v]) => h("div", { class: "cmp", style: "grid-template-columns:1fr" },
    h("div", { class: "h" }, h("span", null, s), h("span", { class: "num" }, yen(v))), h("div", { class: "bar", style: "height:6px" }, h("i", { style: `width:${v / t * 100}%` })))));
}
function budgetCard(uid, ym) {
  const mine = isMe(uid), all = recordsOf(uid), cur = inMonth(all, ym).filter(isExp), prev = inMonth(all, addMonths(ym, -1)).filter(isExp);
  const cb = mine ? (S.prefs.catBudgets || {}) : {};
  const cats = [...new Set([...Object.keys(cb).filter(k => cb[k] > 0), ...sumBy(cur).map(p => p[0])])].filter(c => CAT[c]);
  const head = h("div", { style: "display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:4px" },
    h("p", { class: "label", style: "margin:0" }, mine ? `${ym.m}月のカテゴリ予算` : `${ym.m}月のカテゴリ別`), mine ? h("button", { type: "button", class: "btn small press", onclick: budgetSheet }, "予算を設定") : null);
  if (!cats.length) return h("div", { class: "card" }, head, emptyState(mine ? "予算はまだありません" : "記録がありません", mine ? "カテゴリごとに予算を決めると、使った割合がバーで表示されます。" : null, null, "target"));
  const max = Math.max(...cats.map(c => sumOf(cur.filter(x => x.category === c))), 1);
  const rows = cats.map(c => {
    const used = sumOf(cur.filter(x => x.category === c)), b = cb[c] || 0, pv = sumOf(prev.filter(x => x.category === c));
    const pct = b ? used / b : used / max;
    const bar = h("div", { class: "bar" + (b && pct > 1 ? " over" : b && pct > .85 ? " near" : "") }, h("i", { style: `background:${b ? "" : cvar(catOf(c).c)}` }));
    requestAnimationFrame(() => requestAnimationFrame(() => { bar.firstChild.style.width = Math.min(100, pct * 100) + "%"; }));
    const d = used - pv;
    return h("button", { type: "button", class: "cbud press", onclick: () => { S.list = { q: "", type: "all", cat: c }; go("list"); }, "aria-label": `${c} ${yen(used)}${b ? " 予算 " + yen(b) : ""}` },
      catIcon(c), h("div", { class: "h" }, h("strong", null, c), h("span", { class: "num" }, yen(used), b ? h("span", { class: "help", style: "display:inline" }, ` / ${yen(b)}`) : null)), bar,
      h("div", { class: "s" }, b ? (used > b ? h("span", { class: "over" }, `${yen(used - b)} オーバー`) : h("span", null, `残り ${yen(b - used)}`)) : h("span", null, mine ? "予算なし" : ""),
        pv ? h("span", { class: d > 0 ? "delta-up" : "delta-down" }, `先月比 ${d > 0 ? "+" : ""}${yen(d)}`) : h("span", null, "")));
  });
  return h("div", { class: "card" }, head, rows);
}
function trendCard(uid) {
  const all = recordsOf(uid), months = Array.from({ length: 6 }, (_, i) => addMonths(S.ym, i - 5));
  const totals = months.map(m => expTotal(inMonth(all, m)));
  const max = Math.max(1, ...totals), avg = totals.reduce((a, b) => a + b, 0) / 6;
  const W = 320, H = 170, top = 22, bottom = 26, bw = 30, gap = (W - 6 * bw) / 6, sy = (v) => H - bottom - (v / max) * (H - top - bottom);
  const bars = [];
  const chart = svg("svg", { viewBox: `0 0 ${W} ${H}`, class: "trend", role: "img", "aria-label": "6か月の支出の推移" },
    [0.5, 1].map(f => svg("line", { x1: 0, x2: W, y1: sy(max * f), y2: sy(max * f), style: "stroke:var(--line);stroke-width:1" })),
    months.map((m, i) => {
      const x = gap / 2 + i * (bw + gap), cur = i === 5, r = svg("rect", { x, y: H - bottom, width: bw, height: 0, rx: 6, style: `fill:${cur ? "var(--brand)" : "var(--brand-soft)"};transition:y var(--d-chart) var(--ease),height var(--d-chart) var(--ease)` });
      bars.push([r, sy(totals[i])]);
      return [r, svg("text", { x: x + bw / 2, y: sy(totals[i]) - 5, "text-anchor": "middle", "font-size": 10, style: "fill:var(--ink);font-weight:700", text: totals[i] ? yenShort(totals[i]) : "" }),
        svg("text", { x: x + bw / 2, y: H - 8, "text-anchor": "middle", "font-size": 11, style: "fill:var(--muted)", text: m.m + "月" })];
    }),
    avg ? [svg("line", { x1: 0, x2: W, y1: sy(avg), y2: sy(avg), "stroke-dasharray": "4 4", style: "stroke:var(--muted);stroke-width:1" }),
      svg("text", { x: W - 2, y: sy(avg) - 4, "text-anchor": "end", "font-size": 9, style: "fill:var(--muted)", text: "平均 " + yenShort(avg) })] : null);
  requestAnimationFrame(() => requestAnimationFrame(() => bars.forEach(([r, y]) => { r.setAttribute("y", y); r.setAttribute("height", Math.max(0, H - bottom - y)); })));
  return h("div", { class: "card" }, h("p", { class: "label" }, "6か月の推移"), chart);
}
// Month calendar: each day shows how much was spent. Days with no record and days marked
// "支出ゼロ" are kept visually distinct.
function calendarCard(uid, ym) {
  const mine = isMe(uid), all = inMonth(recordsOf(uid), ym), exp = all.filter(isExp);
  const noSpend = new Set(mine ? (S.prefs.noSpend || []) : []);
  const byDay = {}; exp.forEach(x => byDay[x.date] = (byDay[x.date] || 0) + x.amount);
  const incDays = new Set(all.filter(x => x.type === "income").map(x => x.date));
  const max = Math.max(1, ...Object.values(byDay));
  const lead = new Date(ym.y, ym.m - 1, 1).getDay(), n = daysIn(ym), tdy = today();
  const total = sumOf(exp), daysWith = Object.keys(byDay).length;
  const daysSoFar = ymKey(ym) === ymKey(thisMonth()) ? new Date().getDate() : ymKey(ym) < ymKey(thisMonth()) ? n : 0;
  const grid = h("div", { class: "mcal", role: "grid", "aria-label": `${ym.m}月のカレンダー` },
    WD.map((w, i) => h("span", { class: "wd" + (i === 0 ? " sun" : i === 6 ? " sat" : "") }, w)),
    Array.from({ length: lead }, () => h("span", { class: "out" })),
    Array.from({ length: n }, (_, i) => {
      const d = `${ymKey(ym)}-${pad(i + 1)}`, v = byDay[d], dow = (lead + i) % 7;
      const future = d > tdy, zero = !v && noSpend.has(d);
      const level = v ? Math.min(4, 1 + Math.floor(v / max * 4 - 0.0001)) : 0;
      const label = future ? "これからの日" : v ? yen(v) : zero ? "支出ゼロ" : "記録なし";
      return h("button", { type: "button", class: ["day", future ? "future" : "", v ? "has l" + level : "", zero ? "zero" : "", d === tdy ? "today" : ""].filter(Boolean).join(" "),
        "aria-label": `${ym.m}月${i + 1}日 ${label}`, onclick: () => daySheet(uid, d) },
        h("span", { class: "dn" + (dow === 0 ? " sun" : dow === 6 ? " sat" : "") }, i + 1),
        v ? h("span", { class: "dv num" }, yenShort(v)) : zero ? h("span", { class: "dv zero" }, "0円") : null,
        incDays.has(d) ? h("i", { class: "inc", "aria-hidden": "true" }) : null);
    }));
  return h("div", { class: "card" },
    h("div", { style: "display:flex;justify-content:space-between;align-items:baseline;gap:8px;margin-bottom:10px" },
      h("p", { class: "label", style: "margin:0" }, `${ym.y}年${ym.m}月のカレンダー`), h("span", { class: "num", style: "font-weight:700" }, yen(total))),
    grid,
    h("div", { class: "calsum" },
      h("span", null, "使った日 ", h("b", { class: "num" }, `${daysWith}日`)),
      daysSoFar ? h("span", null, "1日平均 ", h("b", { class: "num" }, yen(total / daysSoFar))) : null,
      daysWith ? h("span", null, "いちばん多い日 ", h("b", { class: "num" }, yen(Math.max(...Object.values(byDay))))) : null),
    h("p", { class: "help", style: "margin-top:6px;font-size:.72rem" }, mine
      ? "日付をタップすると、その日の明細が開きます。使わなかった日は「支出ゼロ」にできます。緑の点は収入がある日です。"
      : "公開された記録がある日だけ金額が出ます。"));
}
function daySheet(uid, d) {
  const mine = isMe(uid), list = sortEntries(recordsOf(uid).filter(x => x.date === d));
  const zero = (S.prefs.noSpend || []).includes(d);
  const handle = openSheet(h("div", { class: "stack" },
    h("div", { class: "head" }, h("h2", null, dayLabel(d)), h("span", { class: "num", style: "font-weight:700" }, yen(expTotal(list)))),
    list.length ? entryRows(list, uid) : emptyState(zero ? "支出ゼロの日" : "この日の記録はありません", zero ? "この日はお金を使わなかった日として記録しています。" : null, null, zero ? "check" : "receipt"),
    mine && !list.length && d <= today() ? h("button", { type: "button", class: "btn press" + (zero ? "" : " primary"), onclick: async () => {
      const cur = new Set(S.prefs.noSpend || []); zero ? cur.delete(d) : cur.add(d);
      try { await S.store.setPrefs(me(), { noSpend: [...cur].sort().slice(-400) }); closeSheet(handle); ok(zero ? "支出ゼロの記録を取り消しました" : "支出ゼロの日として記録しました"); } catch { fail("保存できませんでした"); }
    } }, zero ? "支出ゼロの記録を取り消す" : "この日は支出ゼロだった") : null,
    mine ? h("button", { type: "button", class: "btn press", onclick: () => { closeSheet(handle); openEntry(null, { date: d }); } }, "この日の支出を追加") : null), { label: "日別の明細" });
}
function compareCard(uid, ym) {
  const all = recordsOf(uid), cur = inMonth(all, ym).filter(isExp), prev = inMonth(all, addMonths(ym, -1)).filter(isExp);
  const cats = [...new Set(cur.concat(prev).map(x => x.category))];
  const title = h("p", { class: "label" }, `${ym.m}月と${addMonths(ym, -1).m}月の比較`);
  if (!prev.length || !cur.length) return h("div", { class: "card" }, title, h("p", { class: "help" }, "比べられる記録がまだありません。2か月分の記録がそろうと表示されます。"));
  const max = Math.max(1, ...cats.flatMap(c => [sumOf(cur.filter(x => x.category === c)), sumOf(prev.filter(x => x.category === c))]));
  const rows = cats.map(c => ({ c, a: sumOf(cur.filter(x => x.category === c)), b: sumOf(prev.filter(x => x.category === c)) })).sort((x, y) => y.a - x.a).map(({ c, a, b }) => {
    const ba = h("div", { class: "bar" }, h("i", { style: `background:${cvar(catOf(c).c)}` })), bb = h("div", { class: "bar prev" }, h("i", { style: "background:var(--line)" }));
    requestAnimationFrame(() => requestAnimationFrame(() => { ba.firstChild.style.width = a / max * 100 + "%"; bb.firstChild.style.width = b / max * 100 + "%"; }));
    return h("div", { class: "cmp" }, catIcon(c, true), h("div", { class: "h" }, h("span", null, c), h("span", { class: "num" }, yen(a), " ", a === b ? h("span", { class: "help", style: "display:inline" }, "±0") : h("span", { class: a > b ? "delta-up" : "delta-down" }, (a > b ? "▲" : "▼") + yen(Math.abs(a - b))))), h("div", { class: "bars" }, ba, bb));
  });
  return h("div", { class: "card" }, title, h("p", { class: "help", style: "margin:-4px 0 6px;font-size:.72rem" }, "上の色付きバーが今月、下の灰色が前の月です。"), rows);
}

/* ================= FRIENDS ================= */
function renderFriends() {
  const scr = $("s-friends"), friends = S.memberIds.filter(x => !isMe(x));
  const groups = S.me?.groups || [];
  const kids = [];
  kids.push(h("div", { class: "chips", role: "group", "aria-label": "グループ" },
    groups.map(c => h("button", { type: "button", class: "chip", "aria-pressed": String(c === S.code), onclick: async () => { if (c !== S.code) { try { await S.store.updateMe(me(), { current: c }); } catch { fail("切り替えられませんでした"); } } } }, S.groupNames[c] || "…")),
    h("button", { type: "button", class: "chip dashed", onclick: createGroupSheet }, "＋ グループを作る"),
    h("button", { type: "button", class: "chip dashed", onclick: () => joinSheet() }, "コードで参加")));
  if (!S.code) kids.push(emptyState("まだ友達がいません", "グループを作って招待すると、お互いの公開した記録を見られます。", { label: "グループを作る", fn: createGroupSheet }, "people"));
  else if (!friends.length) kids.push(emptyState("まだ友達がいません", "招待コードを送って、友達を呼びましょう。", { label: "友達を招待する", fn: inviteSheet }, "people"));
  else {
    kids.push(h("div", { class: "row" }, h("button", { type: "button", class: "btn press", onclick: inviteSheet }, ic("invite", { width: 18, height: 18 }), " 友達を招待"), h("button", { type: "button", class: "btn press", onclick: shareSheet }, ic("shield", { width: 18, height: 18 }), " 共有設定")));
    kids.push(...friends.map(uid => friendCard(uid)));
    kids.push(peopleCompare());
  }
  fill(scr, h("div", { class: "stack" }, kids));
}
function friendCard(uid) {
  if (!isLoaded(uid)) return h("div", { class: "card loading-delay" }, h("div", { style: "display:flex;gap:12px;align-items:center" }, h("span", { class: "sk circle", style: "width:40px;height:40px" }), h("div", { style: "flex:1" }, h("div", { class: "sk line", style: "width:40%" }))), h("div", { class: "sk", style: "height:60px;margin-top:12px" }));
  const st = monthStats(uid, S.ym), ch = pctChange(st.spent, st.prevSpent), recent = sortEntries(st.cur).slice(0, 3);
  return h("button", { type: "button", class: "card press fcard", onclick: () => { setViewing(uid); go("home"); }, "aria-label": `${nameOf(uid)}さんの家計簿を見る` },
    h("div", { class: "top" }, avatar(uid), h("div", { class: "grow" }, h("strong", null, nameOf(uid)), h("span", { class: "badge view" }, ic("eye"), "閲覧のみ")),
      S.denied[uid] ? null : h("div", { style: "text-align:right" }, h("div", { class: "sum" }, numEl("f-" + uid + ymKey(S.ym), st.spent)), ch != null ? h("small", { class: ch > 0 ? "delta-up" : "delta-down" }, `先月比 ${ch > 0 ? "+" : ""}${ch}%`) : null)),
    S.denied[uid] ? h("p", { class: "help" }, "この人は、あなたへの公開をオフにしています。")
      : recent.length ? h("div", { class: "recent" }, recent.map(x => h("div", null, catIcon(x.category, true), h("span", null, `${dayLabel(x.date)}・${titleOf(x)}`), h("span", { class: "num", style: "font-weight:600" }, (x.type === "income" ? "+" : "") + yen(x.amount)))))
      : h("p", { class: "help" }, `${S.ym.m}月に公開された記録はまだありません。`));
}
function peopleCompare() {
  const ps = people().filter(u => isLoaded(u) && !S.denied[u]);
  const sums = ps.map(u => ({ u, s: expTotal(inMonth(S.data[u] || [], S.ym)) })); // public records only, for everyone (yourself included) so it is a fair comparison
  const max = Math.max(1, ...sums.map(x => x.s));
  const rows = sums.sort((a, b) => b.s - a.s).map(({ u, s }) => {
    const bar = h("div", { class: "bar" }, h("i", { style: `background:${colorOf(u)}` }));
    requestAnimationFrame(() => requestAnimationFrame(() => { bar.firstChild.style.width = s / max * 100 + "%"; }));
    return h("div", { class: "pcmp" }, avatar(u, 30), h("span", null, nameOf(u), isMe(u) ? h("span", { class: "badge me", style: "margin-left:6px" }, "自分") : null), h("span", { class: "num", style: "font-weight:700" }, yen(s)), bar);
  });
  return h("div", { class: "card" }, h("p", { class: "label" }, `${S.ym.m}月の比較（公開された記録のみ）`), rows,
    h("p", { class: "help", style: "margin-top:8px;font-size:.72rem" }, "一人ずつ別々に集計しています。非公開の記録は、自分の分も含めて入れていません。"));
}

/* ================= ENTRY SHEET (add / edit) ================= */
function myHistory() { return sortEntries(recordsOf(me())); }
function suggestShops(q) {
  const hist = myHistory(), score = {}, meta = {};
  hist.forEach((x, i) => { if (!x.shop) return; score[x.shop] = (score[x.shop] || 0) + 1 + Math.max(0, 30 - i) / 10; meta[x.shop] = meta[x.shop] || x; });
  const f = fold(q);
  const mine = Object.keys(score).filter(s => !f || fold(s).includes(f)).sort((a, b) => (fold(b).startsWith(f) - fold(a).startsWith(f)) || score[b] - score[a]).slice(0, 6)
    .map(s => ({ value: s, label: s, sub: catLabel(meta[s]) + (meta[s].pay ? "・" + meta[s].pay : ""), tag: "履歴", kind: "shop", hist: meta[s] }));
  const known = f ? KNOWN_SHOPS.filter(s => fold(s).includes(f) && !score[s]).slice(0, 4).map(s => { const [c, sb] = guessCat(s); return { value: s, label: s, sub: sb ? `${c} › ${sb}` : c, tag: "候補", kind: "shop" }; }) : [];
  const cats = f ? CATS.flatMap(c => c.subs.filter(s => s !== "その他").map(s => [c.id, s])).filter(([c, s]) => fold(s).includes(f) || fold(c).includes(f)).slice(0, 3)
    .map(([c, s]) => ({ value: "", label: `${c} › ${s}`, sub: "カテゴリを選ぶ", tag: "カテゴリ", kind: "cat", cat: c, subName: s })) : [];
  return mine.concat(known, cats);
}
function suggestMemos(q) {
  const f = fold(q), seen = new Map();
  myHistory().forEach(x => { if (x.memo && !seen.has(x.memo)) seen.set(x.memo, x); });
  return [...seen.keys()].filter(m => !f || fold(m).includes(f)).slice(0, 6).map(m => ({ value: m, label: m, sub: catLabel(seen.get(m)), tag: "履歴", kind: "memo" }));
}
function recentPays() {
  const order = []; myHistory().forEach(x => { if (x.pay && !order.includes(x.pay)) order.push(x.pay); });
  return order.concat(PAYS.filter(p => !order.includes(p)));
}
// Accessible combobox: arrow keys move, Enter picks, Esc closes; taps work too.
function autocomplete(input, getItems, onPick) {
  const wrap = h("div", { class: "ac" }); input.replaceWith?.(wrap); wrap.append(input);
  const id = "ac" + Math.random().toString(36).slice(2, 7);
  input.setAttribute("role", "combobox"); input.setAttribute("aria-autocomplete", "list"); input.setAttribute("aria-expanded", "false"); input.setAttribute("aria-controls", id); input.setAttribute("autocomplete", "off");
  let list = null, items = [], idx = -1;
  const close = () => { list?.remove(); list = null; idx = -1; input.setAttribute("aria-expanded", "false"); input.removeAttribute("aria-activedescendant"); };
  const mark = (text, q) => { const f = fold(q), i = fold(text).indexOf(f); if (!q || i < 0) return text; return [text.slice(0, i), h("mark", null, text.slice(i, i + q.length)), text.slice(i + q.length)]; };
  const draw = () => {
    const q = input.value.trim();
    items = getItems(q);
    if (!list) { list = h("div", { class: "ac-list", role: "listbox", id }); wrap.append(list); input.setAttribute("aria-expanded", "true"); }
    if (!items.length) { fill(list, h("div", { class: "ac-empty" }, q ? "候補はありません。そのまま入力できます。" : "入力すると、過去の記録から候補を出します。")); return; }
    fill(list, ...items.map((it, i) => h("div", { role: "option", id: `${id}-${i}`, "aria-selected": String(i === idx), tabindex: "-1",
      onpointerdown: (e) => { e.preventDefault(); pick(i); } },
      h("div", { class: "grow" }, h("strong", null, mark(it.label, q)), it.sub ? h("small", null, it.sub) : null), it.tag ? h("span", { class: "tag" }, it.tag) : null)));
    if (idx >= 0) input.setAttribute("aria-activedescendant", `${id}-${idx}`);
  };
  const pick = (i) => { const it = items[i]; if (!it) return; if (it.kind !== "cat") input.value = it.value; onPick(it); close(); buzz(5); };
  input.addEventListener("focus", draw);
  input.addEventListener("input", () => { idx = -1; draw(); });
  input.addEventListener("blur", () => setTimeout(close, 120));
  input.addEventListener("keydown", (e) => {
    if (!list) return;
    if (e.key === "ArrowDown") { e.preventDefault(); idx = Math.min(items.length - 1, idx + 1); draw(); list.children[idx]?.scrollIntoView({ block: "nearest" }); }
    else if (e.key === "ArrowUp") { e.preventDefault(); idx = Math.max(-1, idx - 1); draw(); }
    else if (e.key === "Enter") { if (idx >= 0) { e.preventDefault(); pick(idx); } else { close(); input.blur(); } }
    else if (e.key === "Escape") { close(); }
  });
  return wrap;
}
const favKey = (f) => [f.t || "expense", f.c, f.s || "", f.a || 0, f.m || "", f.sh || "", f.p || ""].join("|");
function autoFavs() {
  const freq = {}, mine = new Set((S.prefs.favs || []).map(favKey));
  myHistory().forEach(x => { if (x.source || !isExp(x)) return; const f = { t: "expense", c: x.category, s: x.sub, a: x.amount, m: x.memo, sh: x.shop, p: x.pay }; const k = favKey(f); freq[k] = freq[k] || { f, n: 0 }; freq[k].n++; });
  return Object.entries(freq).filter(([k, v]) => v.n >= 2 && !mine.has(k)).sort((a, b) => b[1].n - a[1].n).slice(0, 4).map(([, v]) => v.f);
}
function openEntry(edit, preset = {}) {
  const isEdit = !!edit;
  const hiddenNow = () => hiddenCats();
  const st = {
    type: edit?.type || "expense", amount: edit ? String(edit.amount) : "", cat: edit?.category || (ls.get("kakeibo.cat") && CAT[ls.get("kakeibo.cat")] && !INCOME_CATS.some(c => c.id === ls.get("kakeibo.cat")) ? ls.get("kakeibo.cat") : "食費"),
    sub: edit?.sub || "", date: edit?.date || preset.date || today(), time: edit?.time || "", shop: edit?.shop || "", memo: edit?.memo || "", pay: edit?.pay || "",
    pub: edit ? !edit.priv : !!S.share.defaultPublic, catTouched: isEdit, fromFav: false, busy: false,
  };
  const catsFor = () => st.type === "income" ? INCOME_CATS : CATS;
  const body = h("div", { class: "entry stack", style: "gap:8px" });
  const saveBtn = h("button", { type: "button", class: "save", id: "saveBtn" }, ic("check", { "stroke-width": 3 }), isEdit ? "更新" : "保存");
  const favRow = h("div", { class: "favrow", "aria-label": "よく使う項目" });
  const keypad = h("div", { class: "keypad", role: "group", "aria-label": "金額の入力" },
    ["7", "8", "9", ["del", "⌫", "1文字消す"], "4", "5", "6", ["clear", "C", "金額を消す"], "1", "2", "3"].map(k => Array.isArray(k)
      ? h("button", { type: "button", class: "fn", "data-k": k[0], "aria-label": k[2] }, k[1]) : h("button", { type: "button", "data-k": k }, k)),
    saveBtn, h("button", { type: "button", class: "zero", "data-k": "0" }, "0"), h("button", { type: "button", "data-k": "00" }, "00"));
  const footer = h("div", { class: "keypad-wrap" }, favRow, keypad);
  let handle;
  // inputs live outside draw() so typing never loses focus
  const shopIn = h("input", { class: "text", id: "enShop", maxlength: 40, placeholder: "店舗名", value: st.shop, enterkeyhint: "next", "aria-label": "店舗名" });
  const memoIn = h("input", { class: "text", id: "enMemo", maxlength: 80, placeholder: "メモ", value: st.memo, enterkeyhint: "done", "aria-label": "メモ" });
  shopIn.addEventListener("input", () => { st.shop = shopIn.value; });
  memoIn.addEventListener("input", () => { st.memo = memoIn.value; });
  const shopAC = autocomplete(shopIn, suggestShops, (it) => {
    if (it.kind === "cat") { st.type = "expense"; st.cat = it.cat; st.sub = it.subName; st.catTouched = true; draw(); return; }
    st.shop = it.value;
    if (it.hist) { if (!st.catTouched) { st.cat = it.hist.category; st.sub = it.hist.sub; } if (!st.pay && it.hist.pay) st.pay = it.hist.pay; }
    else if (!st.catTouched && st.type === "expense") { const [c, s] = guessCat(it.value); if (c !== "その他") { st.cat = c; st.sub = s; } }
    draw();
  });
  const memoAC = autocomplete(memoIn, suggestMemos, (it) => { st.memo = it.value; });
  const amountBtn = h("button", { type: "button", class: "amount", "aria-live": "polite", onclick: () => { st.amount = ""; drawAmount(); } });
  const drawAmount = () => {
    amountBtn.classList.toggle("inc", st.type === "income");
    fill(amountBtn, h("span", { class: "y" }, st.type === "income" ? "+¥" : "¥"), h("span", { class: "v num" + (st.amount ? "" : " ph") }, st.amount ? Number(st.amount).toLocaleString("ja-JP") : "0"));
    amountBtn.setAttribute("aria-label", `金額 ${st.amount ? yen(Number(st.amount)) : "未入力"}（タップで消す）`);
    saveBtn.disabled = !st.amount || st.busy;
  };
  const draw = () => {
    const cats = catsFor();
    if (!cats.some(c => c.id === st.cat)) { st.cat = cats[0].id; st.sub = ""; }
    const locked = hiddenNow().includes(st.cat);
    if (locked) st.pub = false;
    const c = catOf(st.cat);
    const dtLabel = `${dayLabel(st.date).replace(/（.）/, "")} ${st.time ? (TIME_PRESETS.find(p => p[1] === st.time)?.[0] || st.time) : "今"}`;
    const payLabel = st.pay ? st.pay.replace("クレジットカード", "クレカ").replace("交通系IC", "交通IC") : "支払方法";
    fill(body,
      // row 1: expense / income
      h("div", { class: "toprow" },
        h("div", { class: "typeseg" }, segmented([["expense", "支出"], ["income", "収入"]], st.type, (v) => { st.type = v; st.sub = ""; st.cat = (v === "income" ? INCOME_CATS : CATS)[0].id; if (v === "income") st.pub = false; setTimeout(draw, 120); }, "支出か収入か")),
        h("div", { style: "flex:1" }),
        isEdit ? h("button", { type: "button", class: "iconbtn sm press", "aria-label": "この記録を削除", style: "color:var(--danger)", onclick: async () => {
          if (await confirmModal({ title: "この記録を削除しますか？", body: `${titleOf(edit)}・${yen(edit.amount)}`, okLabel: "削除", danger: true })) { closeSheet(handle); deleteWithUndo(edit); }
        } }, ic("trash")) : null),
      amountBtn,
      h("div", { class: "cats", role: "radiogroup", "aria-label": "カテゴリ" }, cats.map(k => h("button", { type: "button", class: "cat", role: "radio", "aria-checked": String(k.id === st.cat),
        onclick: () => { if (st.cat !== k.id) { st.cat = k.id; st.sub = ""; } st.catTouched = true; if (st.type === "expense") ls.set("kakeibo.cat", k.id); buzz(5); draw(); } },
        h("span", { class: "icon", style: `background:${cvar(k.c)}` }, k.g), h("span", null, k.id)))),
      h("div", { class: "chips subs", role: "radiogroup", "aria-label": `${c.id}の内容` },
        [["", "指定なし"], ...c.subs.map(s => [s, s])].map(([v, l]) => h("button", { type: "button", class: "chip", role: "radio", "aria-checked": String(st.sub === v), onclick: () => { st.sub = v; buzz(4); draw(); } }, l))),
      // row: date/time, payment, visibility — compact chips so the whole sheet fits a phone screen
      h("div", { class: "metarow" },
        h("button", { type: "button", class: "mchip press", "aria-label": `日時：${dtLabel}`, onclick: () => dateTimeSheet(st, draw) }, ic("clock"), h("span", null, dtLabel)),
        h("button", { type: "button", class: "mchip press" + (st.pay ? "" : " unset"), "aria-label": `支払方法：${st.pay || "未選択"}`, onclick: () => paySheet(st, draw) }, ic("card"), h("span", null, payLabel)),
        h("button", { type: "button", class: "mchip vischip press" + (st.pub ? " on" : ""), "aria-pressed": String(st.pub), disabled: locked ? true : null,
          "aria-label": locked ? `「${st.cat}」は共有しない設定のため非公開` : st.pub ? "友達に公開（タップで非公開にする）" : "非公開（タップで友達に公開する）",
          onclick: () => { st.pub = !st.pub; buzz(5); draw(); toast(st.pub ? "この記録は同じグループの友達に公開されます" : "この記録は自分にだけ見えます"); } },
          ic(st.pub ? "eye" : "lock"), h("span", null, st.pub ? "公開" : "非公開"))),
      h("div", { class: "tworow" }, h("div", null, shopAC), h("div", null, memoAC)));
    drawAmount(); drawFavs();
  };
  const drawFavs = () => {
    const favs = (S.prefs.favs || []).filter(f => (f.t || "expense") === st.type), auto = st.type === "expense" ? autoFavs() : [];
    const chip = (f, isFav) => h("button", { type: "button", class: "chip" + (isFav ? " fav" : ""), onclick: () => applyFav(f) },
      catIcon(f.c, true), f.sh || f.m || f.s || f.c, f.a ? h("b", { class: "num" }, yen(f.a)) : null);
    fill(favRow, h("span", { class: "lbl" }, "よく使う"), ...favs.map(f => chip(f, true)), ...auto.map(f => chip(f, false)),
      h("button", { type: "button", class: "chip dashed", onclick: () => favSheet(st, draw) }, "＋ 登録"));
  };
  const applyFav = (f) => {
    st.type = f.t || "expense"; st.cat = CAT[f.c] ? f.c : "その他"; st.sub = f.s || ""; st.memo = f.m || ""; st.shop = f.sh || ""; st.pay = f.p || st.pay; st.catTouched = true;
    if (f.a) { st.amount = String(f.a); st.fromFav = true; }
    shopIn.value = st.shop; memoIn.value = st.memo; buzz(6); draw();
    toast(f.a ? "入力しました。保存を押すと記録されます" : "内容を入れました。金額を入れて保存してください");
  };
  keypad.addEventListener("click", (e) => {
    const b = e.target.closest("button"); if (!b) return;
    if (b === saveBtn) { save(); return; }
    const k = b.dataset.k; if (!k) return;
    buzz(4);
    if (k === "del") st.amount = st.amount.slice(0, -1);
    else if (k === "clear") st.amount = "";
    else { if (st.fromFav) st.amount = ""; if (st.amount.length < 8) st.amount = (st.amount + k).replace(/^0+/, ""); }
    st.fromFav = false; drawAmount();
  });
  const save = async () => {
    const amount = Number(st.amount);
    if (!amount) { amountBtn.classList.remove("bad"); void amountBtn.offsetWidth; amountBtn.classList.add("bad"); warn("金額を入力してください"); return; }
    if (amount > 99999999) { warn("金額が大きすぎます。入力内容を確認してください"); return; }
    st.shop = shopIn.value.trim(); st.memo = memoIn.value.trim();
    const pub = st.pub && !hiddenNow().includes(st.cat);
    const data = { type: st.type, date: st.date, time: st.time || (isEdit ? edit.time || nowHM() : nowHM()), amount, category: st.cat, sub: st.sub, shop: st.shop.slice(0, 40), memo: st.memo.slice(0, 80), pay: st.pay };
    if (edit?.source) data.source = edit.source;
    st.busy = true; drawAmount();
    try {
      if (!isEdit) {
        const id = await S.store.addEntry(me(), data, !pub);
        closeSheet(handle);
        ok(st.type === "income" ? "収入を保存しました" : "支出を保存しました", { action: { label: "取り消す", fn: () => S.store.deleteEntry(me(), id, !pub).then(() => toast("取り消しました")).catch(() => fail("取り消せませんでした")) } });
      } else {
        const before = { ...edit }, wasPriv = !!edit.priv;
        if (wasPriv === !pub) await S.store.updateEntry(me(), edit.id, data, wasPriv);
        else await S.store.moveEntry(me(), edit.id, { ...edit, ...data }, wasPriv, !pub);
        closeSheet(handle);
        ok(st.type === "income" ? "収入を更新しました" : "支出を更新しました", { action: { label: "元に戻す", fn: async () => {
          try { if (wasPriv === !pub) await S.store.updateEntry(me(), edit.id, before, wasPriv); else await S.store.moveEntry(me(), edit.id, before, !pub, wasPriv); toast("元に戻しました"); } catch { fail("元に戻せませんでした"); }
        } } });
      }
    } catch { fail("保存できませんでした。通信状態を確認してください"); st.busy = false; drawAmount(); }
  };
  // hide the keypad while a text field has the keyboard, and keep the sheet above the keyboard
  const onFocus = (e) => { if (e.target.matches("input[type=text], input:not([type]), input[type=search]")) handle.el.classList.add("typing"); };
  const onBlur = () => setTimeout(() => { if (!handle.el.contains(document.activeElement) || !document.activeElement.matches("input:not([type=checkbox])")) handle.el.classList.remove("typing"); }, 60);
  const vv = window.visualViewport;
  const onVV = () => { const kb = Math.max(0, window.innerHeight - vv.height - vv.offsetTop); handle.el.style.setProperty("--kb", kb > 80 ? kb + "px" : "0px"); };
  const header = h("header", { class: "pagehead" },
    h("button", { type: "button", class: "back press", onclick: () => closeSheet(handle) }, svg("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", "stroke-width": 2.4, "stroke-linecap": "round", "stroke-linejoin": "round", "aria-hidden": "true" }, svg("path", { d: "M15 5l-7 7 7 7" })), "戻る"),
    h("h1", null, isEdit ? "記録を編集" : "記録する"),
    !isEdit ? h("button", { type: "button", class: "iconbtn press", "aria-label": "レシートを読み取る", onclick: () => $("receiptFile").click() }, ic("camera")) : h("span", { style: "width:40px" }));
  handle = openSheet(body, { page: true, header, footer, label: isEdit ? "記録を編集" : "記録する", onClose: () => { vv?.removeEventListener("resize", onVV); S.entryState = null; } });
  handle.el.addEventListener("focusin", onFocus); handle.el.addEventListener("focusout", onBlur);
  vv?.addEventListener("resize", onVV);
  S.entryState = { st, draw: () => { shopIn.value = st.shop; memoIn.value = st.memo; draw(); } };
  draw();
}
function dateTimeSheet(st, done) {
  let date = st.date, time = st.time;
  const body = h("div", { class: "stack" });
  let handle;
  const draw = () => {
    const t = today(), y = ymd(new Date(Date.now() - 864e5)), y2 = ymd(new Date(Date.now() - 2 * 864e5));
    fill(body, 
      h("div", { class: "head" }, h("h2", null, "いつ使った？")),
      h("p", { class: "label", style: "margin:0" }, "日付"),
      h("div", { class: "chips wrap" }, [[t, "今日"], [y, "昨日"], [y2, "おととい"]].map(([d, l]) => h("button", { type: "button", class: "chip", role: "radio", "aria-checked": String(date === d), onclick: () => { date = d; draw(); } }, l))),
      h("input", { type: "date", class: "text", id: "dtDate", value: date, max: t, "aria-label": "日付", onchange: (e) => { if (e.target.value) { date = e.target.value; draw(); } } }),
      h("p", { class: "label", style: "margin:4px 0 0" }, "時間"),
      h("div", { class: "chips wrap" },
        h("button", { type: "button", class: "chip", role: "radio", "aria-checked": String(!time), onclick: () => { time = ""; draw(); } }, "今（保存した時刻）"),
        TIME_PRESETS.map(([l, v]) => h("button", { type: "button", class: "chip", role: "radio", "aria-checked": String(time === v), onclick: () => { time = v; draw(); } }, `${l} ${v}`))),
      h("input", { type: "time", class: "text", id: "dtTime", value: time || nowHM(), "aria-label": "時刻を細かく指定", onchange: (e) => { time = e.target.value; draw(); } }),
      h("button", { type: "button", class: "btn primary press", onclick: () => { st.date = date; st.time = time; closeSheet(handle); done(); } }, "決定"));
  };
  draw(); handle = openSheet(body, { label: "日時を選ぶ" });
}
function paySheet(st, done) {
  let handle;
  handle = openSheet(h("div", { class: "stack" }, h("div", { class: "head" }, h("h2", null, "支払方法")),
    h("div", { class: "chips wrap" }, recentPays().map(p => h("button", { type: "button", class: "chip", role: "radio", "aria-checked": String(st.pay === p), onclick: () => { st.pay = p; buzz(4); closeSheet(handle); done(); } }, p))),
    st.pay ? h("button", { type: "button", class: "btn press", onclick: () => { st.pay = ""; closeSheet(handle); done(); } }, "指定しない") : null,
    h("p", { class: "help" }, "よく使う支払方法ほど前に並びます。")), { label: "支払方法" });
}
function favSheet(st, done) {
  let handle, withAmount = !!st.amount, armed = -1;
  const body = h("div", { class: "stack" });
  const draw = () => {
    const favs = S.prefs.favs || [];
    const cur = { t: st.type, c: st.cat, s: st.sub, m: (st.memo || "").slice(0, 40), sh: (st.shop || "").slice(0, 40), p: st.pay, a: withAmount ? Number(st.amount) || 0 : 0 };
    const exists = favs.some(f => favKey(f) === favKey(cur));
    const line = (f) => h("span", { class: "grow" }, h("strong", null, f.sh || f.m || f.s || f.c), h("small", null, [catLabel({ category: f.c, sub: f.s }), f.p, f.a ? yen(f.a) : ""].filter(Boolean).join("・")));
    fill(body, 
      h("div", { class: "head" }, h("h2", null, "よく使う項目")),
      h("p", { class: "help" }, "登録すると、入力画面の「よく使う」からタップするだけで、カテゴリ・店舗・支払方法（と金額）がまとめて入ります。"),
      h("div", { class: "group" }, h("div", { class: "cell" }, catIcon(cur.c), line(cur)),
        st.amount ? h("label", { class: "cell" }, h("input", { type: "checkbox", class: "cbx", checked: withAmount ? true : null, onchange: (e) => { withAmount = e.target.checked; draw(); } }), h("span", { class: "grow" }, "金額も一緒に登録する")) : null,
        h("div", { class: "cell" }, h("button", { type: "button", class: "btn primary press", disabled: exists || favs.length >= 20 ? true : null, onclick: async () => {
          try { await S.store.setPrefs(me(), { favs: [...favs, cur].slice(0, 20) }); S.prefs.favs = [...favs, cur]; ok("よく使う項目に登録しました"); draw(); done?.(); } catch { fail("保存できませんでした"); }
        } }, exists ? "登録済みです" : favs.length >= 20 ? "20個まで登録できます" : "今の入力を登録"))),
      favs.length ? h("div", null, h("p", { class: "label" }, `登録済み（${favs.length}）`), h("div", { class: "group" }, favs.map((f, i) => h("div", { class: "cell" }, catIcon(f.c, true), line(f),
        i > 0 ? h("button", { type: "button", class: "btn small press", "aria-label": "前に移動", onclick: async () => { const l = favs.slice(); [l[i - 1], l[i]] = [l[i], l[i - 1]]; try { await S.store.setPrefs(me(), { favs: l }); S.prefs.favs = l; draw(); done?.(); } catch { fail("保存できませんでした"); } } }, "↑") : null,
        h("button", { type: "button", class: "linklike danger", onclick: async () => {
          if (armed !== i) { armed = i; draw(); return; }
          armed = -1; const l = favs.filter((_, j) => j !== i);
          try { await S.store.setPrefs(me(), { favs: l }); S.prefs.favs = l; toast("削除しました"); draw(); done?.(); } catch { fail("削除できませんでした"); }
        } }, armed === i ? "本当に削除" : "削除"))))) : null);
  };
  draw(); handle = openSheet(body, { label: "よく使う項目" });
}

/* ================= receipt reading ================= */
function receiptFlow(file) {
  const es = S.entryState;
  const url = URL.createObjectURL(file);
  const bar = h("div", { class: "progress indet" }, h("i"));
  const msg = h("p", { class: "help" }, "文字を読み取っています。はじめての時は準備に少し時間がかかります。");
  const body = h("div", { class: "stack" }, h("div", { class: "head" }, h("h2", null, "レシートを読み取り中")), h("div", { class: "rcpt" }, h("img", { src: url, alt: "撮影したレシート" }), h("div", { style: "flex:1;min-width:0" }, msg, bar)));
  const handle = openSheet(body, { label: "レシートの読み取り" });
  const finish = (r) => {
    URL.revokeObjectURL(url);
    if (!sheets.includes(handle)) return;
    if (!r.amount) {
      fill(body, h("div", { class: "head" }, h("h2", null, "合計金額を読み取れませんでした")),
        h("p", { class: "help" }, "レシート全体が入るように、明るい場所でまっすぐ撮ると読み取りやすくなります。"),
        r.text ? h("details", { class: "ocrtext" }, h("summary", null, "読み取れた文字を見る"), h("pre", null, r.text)) : null,
        h("div", { class: "row" }, h("button", { type: "button", class: "btn press", onclick: () => { closeSheet(handle); $("receiptFile").click(); } }, "撮り直す"),
          h("button", { type: "button", class: "btn primary press", onclick: () => { if (es && r.store) { es.st.shop = r.store; es.draw(); } closeSheet(handle); } }, "手で入力する")));
      return;
    }
    closeSheet(handle);
    if (!es) { openEntry(); }
    const s2 = S.entryState; if (!s2) return;
    s2.st.type = "expense"; s2.st.amount = String(r.amount);
    if (r.date && Math.abs(new Date(r.date) - new Date()) < 366 * 864e5 && r.date <= today()) s2.st.date = r.date;
    if (r.time) s2.st.time = r.time;
    if (r.store) { s2.st.shop = r.store; if (!s2.st.catTouched) { const [c, sb] = guessCat(r.store); s2.st.cat = c; s2.st.sub = sb; } }
    s2.draw();
    toast(r.amountConfidence === "total" ? "読み取りました。内容を確かめて保存してください" : "金額は推測です。確かめてから保存してください", { type: r.amountConfidence === "total" ? "info" : "warning" });
  };
  if (S.store.demo) { setTimeout(() => finish({ amount: 1484, amountConfidence: "total", date: today(), time: "18:42", store: "ライフ 三宮店" }), 1300); return; }
  (async () => {
    try {
      const { prepareImage, recognize, parseReceipt } = await import("./receipt.js");
      const canvas = await prepareImage(file);
      const text = await recognize(canvas, (p) => { if (p < 0) return; bar.classList.remove("indet"); bar.firstChild.style.width = Math.round(p * 100) + "%"; msg.textContent = `文字を読み取っています（${Math.round(p * 100)}%）`; });
      finish(parseReceipt(text));
    } catch {
      URL.revokeObjectURL(url);
      if (sheets.includes(handle)) fill(body, h("div", { class: "head" }, h("h2", null, "読み取れませんでした")), h("p", { class: "help" }, "読み取りの準備にはインターネット接続が必要です（初回のみ）。通信状態を確認して、もう一度試してください。"), h("button", { type: "button", class: "btn primary press", onclick: () => closeSheet(handle) }, "閉じる"));
    }
  })();
}

/* ================= SHARING SETTINGS ================= */
function shareSheet() {
  const body = h("div", { class: "stack" });
  let handle;
  const draw = () => {
    const sh = S.share, hidden = new Set(sh.hiddenCats || []), blocked = new Set(sh.blocked || []);
    const mine = recordsOf(me()), cur = inMonth(mine, S.ym), pubCur = cur.filter(x => !x.priv), privCur = cur.filter(x => x.priv);
    const friends = [...new Set(S.memberIds.filter(x => !isMe(x)))];
    const accRow = (title, sub, content, open) => {
      const acc = h("div", { class: "acc" + (open ? " open" : "") });
      const btn = h("button", { type: "button", class: "cell", "aria-expanded": String(!!open), onclick: () => { acc.classList.toggle("open"); btn.setAttribute("aria-expanded", String(acc.classList.contains("open"))); } },
        h("span", { class: "grow" }, h("strong", null, title), h("small", null, sub)), h("span", { class: "acc-chev chev" }, "›"));
      acc.append(btn, h("div", { class: "acc-body" }, h("div", null, content)));
      return acc;
    };
    fill(body, 
      h("div", { class: "head" }, h("span", { class: "icon", style: "background:var(--brand-soft);color:var(--brand)" }, ic("shield")), h("h2", null, "共有設定")),
      h("div", { class: "card" }, h("p", { class: "label" }, "友達から見えるもの（プレビュー）"),
        h("div", { style: "display:grid;grid-template-columns:1fr 1fr;gap:10px" },
          h("div", null, h("small", { class: "help" }, `${S.ym.m}月の公開`), h("div", { style: "font-weight:700;font-size:1.2rem" }, yen(expTotal(pubCur))), h("small", { class: "help" }, `${pubCur.length}件`)),
          h("div", null, h("small", { class: "help" }, "非公開（見えない）"), h("div", { style: "font-weight:700;font-size:1.2rem" }, yen(expTotal(privCur))), h("small", { class: "help" }, `${privCur.length}件`))),
        h("p", { class: "help", style: "margin-top:10px" }, hidden.size ? `共有しない費目：${[...hidden].join("・")}` : "すべての費目を、公開を選んだ記録で共有しています。"),
        blocked.size ? h("p", { class: "help" }, `見せない人：${[...blocked].map(nameOf).join("・")}`) : null,
        h("p", { class: "help", style: "margin-top:6px" }, "予算、よく使う項目、支出ゼロの日、非公開の記録は、誰にも見えません。")),
      h("div", { class: "group" },
        h("div", { class: "cell" }, h("span", { class: "grow" }, h("strong", null, "新しい記録を最初から公開する"), h("small", null, "オフのときは、記録するたびに公開を選びます（おすすめ）")),
          switchEl("shDefault", !!sh.defaultPublic, async (v, el) => {
            const okd = await confirmModal({ title: v ? "新しい記録を最初から公開にしますか？" : "新しい記録を最初から非公開にしますか？", body: v ? "記録するたびに、初めから「友達に公開」がオンになります。" : "記録するたびに、自分で公開を選ぶようになります。", okLabel: "変更する" });
            if (!okd) { el.checked = !v; return; }
            try { await S.store.setShare(me(), { defaultPublic: v }); ok("共有設定を更新しました"); } catch { el.checked = !v; fail("保存できませんでした"); }
          }, "新しい記録を最初から公開する"))),
      h("div", { class: "group" },
        accRow("費目ごとの共有", hidden.size ? `${hidden.size}個の費目を共有していません` : "すべての費目を共有できます",
          h("div", null, ALL_CATS.map(c => h("div", { class: "cell" }, catIcon(c.id, true), h("span", { class: "grow" }, h("strong", null, c.id), h("small", null, INCOME_CATS.includes(c) ? "収入" : "支出")),
            switchEl("shc-" + c.id, !hidden.has(c.id), async (v, el) => {
              const affected = mine.filter(x => !x.priv && x.category === c.id).length;
              const okd = await confirmModal(v
                ? { title: `「${c.id}」を共有できるようにしますか？`, body: "これから記録する分は、公開を選べるようになります。今まで非公開だった記録は、非公開のままです。", okLabel: "共有できるようにする" }
                : { title: `「${c.id}」を共有しないようにしますか？`, body: `この費目の公開中の記録${affected ? `（表示中の期間で${affected}件）` : ""}をすべて非公開に移します。友達からはすぐに見えなくなります。`, okLabel: "共有をやめる", danger: true });
              if (!okd) { el.checked = !v; return; }
              try {
                const next = v ? [...hidden].filter(x => x !== c.id) : [...hidden, c.id];
                await S.store.setShare(me(), { hiddenCats: next });
                if (!v) { const n = await S.store.privatize(me(), (x) => x.category === c.id); ok(n ? `共有設定を更新しました（${n}件を非公開にしました）` : "共有設定を更新しました"); }
                else ok("共有設定を更新しました");
              } catch { el.checked = !v; fail("保存できませんでした。通信状態を確認してください"); }
            }, `${c.id}を共有する`))))),
        accRow("友達ごとの閲覧許可", friends.length ? (blocked.size ? `${blocked.size}人には見せていません` : "グループの全員が見られます") : "グループに友達がいません",
          friends.length ? h("div", null, friends.map(uid => h("div", { class: "cell" }, avatar(uid, 30), h("span", { class: "grow" }, h("strong", null, nameOf(uid)), h("small", null, blocked.has(uid) ? "あなたの記録は見えません" : "公開した記録を見られます")),
            switchEl("shb-" + uid, !blocked.has(uid), async (v, el) => {
              const okd = await confirmModal(v ? { title: `${nameOf(uid)}さんに見せますか？`, body: "公開した記録を見られるようになります。", okLabel: "見せる" }
                : { title: `${nameOf(uid)}さんに見せないようにしますか？`, body: "すぐに、あなたの記録は一切見えなくなります。相手に通知は届きません。", okLabel: "見せない", danger: true });
              if (!okd) { el.checked = !v; return; }
              try { await S.store.setShare(me(), { blocked: v ? [...blocked].filter(x => x !== uid) : [...blocked, uid] }); ok("共有設定を更新しました"); } catch { el.checked = !v; fail("保存できませんでした"); }
            }, `${nameOf(uid)}さんに見せる`)))) : h("p", { class: "help", style: "padding:0 14px 12px" }, "友達を招待すると、ここで一人ずつ設定できます。"))),
      h("div", { class: "group" },
        h("button", { type: "button", class: "cell", onclick: async () => {
          const n = mine.filter(x => !x.priv).length;
          if (!(await confirmModal({ title: "すべての記録を非公開にしますか？", body: `公開中の記録をすべて非公開に移します${n ? `（表示中の期間で${n}件）` : ""}。友達からはすぐに見えなくなります。`, okLabel: "すべて非公開にする", danger: true }))) return;
          try { const k = await S.store.privatize(me(), () => true); await S.store.setShare(me(), { defaultPublic: false }); ok(`共有を解除しました（${k}件を非公開にしました）`); } catch { fail("できませんでした。通信状態を確認してください"); }
        } }, h("span", { class: "grow" }, h("strong", { style: "color:var(--danger)" }, "共有をすべて解除する"), h("small", null, "公開中の記録をすべて非公開にします"))),
        S.code ? h("button", { type: "button", class: "cell", onclick: () => { closeSheet(handle); leaveSheet(); } }, h("span", { class: "grow" }, h("strong", { style: "color:var(--danger)" }, "このグループを抜ける"), h("small", null, "グループの人から見えなくなります"))) : null));
  };
  draw();
  handle = openSheet(body, { tall: true, label: "共有設定" });
  const stop = setInterval(() => { if (!sheets.includes(handle)) clearInterval(stop); }, 1000);
  S.shareRedraw = () => { if (sheets.includes(handle)) { const sc = handle.body.scrollTop; const open = [...body.querySelectorAll(".acc")].map(a => a.classList.contains("open")); draw(); body.querySelectorAll(".acc").forEach((a, i) => a.classList.toggle("open", !!open[i])); handle.body.scrollTop = sc; } };
}

/* ================= other sheets ================= */
function budgetSheet() {
  const cb = { ...(S.prefs.catBudgets || {}) };
  const total = h("input", { class: "text num", id: "bdTotal", inputmode: "numeric", placeholder: "例：90000", value: S.prefs.budget || "", "aria-label": "月全体の予算" });
  const inputs = CATS.map(c => [c.id, h("input", { class: "text num", inputmode: "numeric", placeholder: "なし", value: cb[c.id] || "", "aria-label": `${c.id}の予算`, style: "max-width:130px;min-height:40px" })]);
  let handle;
  handle = openSheet(h("div", { class: "stack" }, h("div", { class: "head" }, h("h2", null, "予算")),
    h("p", { class: "help" }, "予算は自分にしか見えません。空欄や0にすると、その予算はなくなります。"),
    h("p", { class: "label", style: "margin:0" }, "月全体"), total,
    h("p", { class: "label", style: "margin:0" }, "カテゴリごと"),
    h("div", { class: "group" }, inputs.map(([id, inp]) => h("label", { class: "cell" }, catIcon(id, true), h("span", { class: "grow" }, id), inp))),
    h("button", { type: "button", class: "btn primary press", onclick: async () => {
      const num = (v) => Number(String(v).replace(/[^0-9]/g, "")) || 0;
      const next = {}; inputs.forEach(([id, inp]) => { const v = num(inp.value); if (v) next[id] = v; });
      try { await S.store.setPrefs(me(), { budget: num(total.value), catBudgets: next }); closeSheet(handle); ok("予算を保存しました"); } catch { fail("保存できませんでした"); }
    } }, "保存")), { tall: true, label: "予算" });
}
function inviteSheet() {
  if (!S.code) { createGroupSheet(); return; }
  const link = location.origin + location.pathname + "?join=" + S.code;
  openSheet(h("div", { class: "stack" }, h("div", { class: "head" }, h("h2", null, `「${S.group?.name || "グループ"}」に招待`)),
    h("div", { class: "card num", style: "text-align:center;font-size:1.6rem;font-weight:700;letter-spacing:.08em" }, fmtCode(S.code)),
    h("p", { class: "help" }, "コードかリンクをLINEなどで送ってください。友達はアカウントを作ってから「招待コードで参加」に入力します。"),
    h("div", { class: "row" },
      h("button", { type: "button", class: "btn press", onclick: () => copy(fmtCode(S.code)) }, "コードをコピー"),
      h("button", { type: "button", class: "btn primary press", onclick: async () => {
        const text = `家計簿アプリ「${S.group?.name || "みんなの家計簿"}」に招待します。\n${link}\n招待コード：${fmtCode(S.code)}`;
        if (navigator.share) { try { await navigator.share({ text }); } catch {} } else copy(text);
      } }, "招待を送る"))), { label: "友達を招待" });
}
function createGroupSheet() {
  if ((S.me?.groups || []).length >= MAX_GROUPS) { warn(`入れるグループは${MAX_GROUPS}個までです`); return; }
  const name = h("input", { class: "text", id: "cgName", maxlength: 24, placeholder: "いつメン", autofocus: true });
  const err = h("div", { class: "err" });
  let handle;
  const btn = h("button", { type: "button", class: "btn primary press", onclick: async () => {
    btn.disabled = true;
    try { await S.store.createGroup(me(), name.value.trim() || "みんなの家計簿"); closeSheet(handle); ok("グループを作りました"); inviteSheet(); }
    catch { err.textContent = "作れませんでした。通信状態を確認してください。"; btn.disabled = false; }
  } }, "作る");
  handle = openSheet(h("div", { class: "stack" }, h("div", { class: "head" }, h("h2", null, "グループを作る")), h("label", { class: "label", for: "cgName", style: "margin:0" }, "グループ名"), name, err, btn), { label: "グループを作る" });
}
function joinSheet(prefill) {
  const code = h("input", { class: "text num", id: "jgCode", maxlength: 11, placeholder: "ABCDE-23456", autocapitalize: "characters", value: prefill ? fmtCode(prefill) : "", autofocus: !prefill });
  const err = h("div", { class: "err", role: "alert" });
  let handle;
  const btn = h("button", { type: "button", class: "btn primary press", onclick: async () => {
    const c = normCode(code.value);
    if (c.length !== 10) { err.textContent = "招待コードは10文字です（例：ABCDE-23456）。"; code.classList.remove("bad"); void code.offsetWidth; code.classList.add("bad"); return; }
    if ((S.me?.groups || []).includes(c)) { closeSheet(handle); await S.store.updateMe(me(), { current: c }); return; }
    btn.disabled = true;
    try { await S.store.joinGroup(me(), c); closeSheet(handle); ok("友達を追加しました（グループに参加しました）"); S.joinParam = ""; }
    catch (e) { err.textContent = e.code === "not_found" ? "そのコードのグループが見つかりません。" : "参加できませんでした。通信状態を確認してください。"; btn.disabled = false; }
  } }, "参加する");
  handle = openSheet(h("div", { class: "stack" }, h("div", { class: "head" }, h("h2", null, "招待コードで参加")), h("label", { class: "label", for: "jgCode", style: "margin:0" }, "招待コード"), code, err, btn), { label: "招待コードで参加" });
}
async function leaveSheet() {
  if (!S.code) return;
  if (!(await confirmModal({ title: `「${S.group?.name || "グループ"}」を抜けますか？`, body: "自分の記録は消えません。このグループの人からは見えなくなります。もう一度入るには招待コードが必要です。", okLabel: "抜ける", danger: true }))) return;
  const next = (S.me.groups || []).find(c => c !== S.code) || null;
  try { await S.store.leaveGroup(me(), S.code, next); ok("グループを抜けました"); } catch { fail("抜けられませんでした"); }
}
function themeSheet() {
  const cur = ls.get("kakeibo.theme") || "auto";
  openSheet(h("div", { class: "stack" }, h("div", { class: "head" }, h("h2", null, "表示テーマ")),
    segmented([["auto", "自動"], ["light", "ライト"], ["dark", "ダーク"]], cur, (t) => { ls.set("kakeibo.theme", t === "auto" ? null : t); applyTheme(t); }, "表示テーマ"),
    h("p", { class: "help" }, "「自動」はスマホの設定に合わせます。")), { label: "表示テーマ" });
}
function accountSheet() {
  const name = h("input", { class: "text", id: "acName", maxlength: 20, value: S.me?.name || "" });
  let handle;
  handle = openSheet(h("div", { class: "stack" }, h("div", { class: "head" }, h("h2", null, "アカウント")),
    h("p", { class: "help" }, `ログイン中：${S.user?.email || ""}`),
    h("label", { class: "label", for: "acName", style: "margin:0" }, "表示名"), name,
    h("button", { type: "button", class: "btn primary press", onclick: async () => {
      const n = name.value.trim(); if (!n) { name.classList.add("bad"); warn("入力内容を確認してください"); return; }
      try { await S.store.updateMe(me(), { name: n }); ok("名前を変えました"); closeSheet(handle); } catch { fail("保存できませんでした"); }
    } }, "名前を保存"),
    h("button", { type: "button", class: "btn press", onclick: async () => { try { await S.store.resetPassword(S.user.email); ok("パスワード再設定のメールを送りました"); } catch { fail("送れませんでした"); } } }, "パスワードを変更する（メールが届きます）"),
    h("p", { class: "help" }, ls.get("kakeibo.keep") === "0" ? "このログインは、アプリを閉じると終わる設定です。" : "このスマホではログインしたままになります。")), { label: "アカウント" });
}
function homeSheet() {
  openSheet(h("div", { class: "stack" }, h("div", { class: "head" }, h("h2", null, "ホーム画面に追加する")),
    h("div", { class: "help" }, h("ol", null,
      h("li", null, "iPhone：Safariで開き、共有ボタン（□に↑）→「ホーム画面に追加」"),
      h("li", null, "Android：Chromeで開き、右上のメニュー（︙）→「ホーム画面に追加」"),
      h("li", null, "追加したアイコンから開いて、同じメールアドレスでログインします")))), { label: "ホーム画面に追加" });
}
function helpSheet() {
  openSheet(h("div", { class: "stack" }, h("div", { class: "head" }, h("h2", null, "使い方と安全について")),
    h("div", { class: "help" }, h("ul", null,
      h("li", null, "記録：下の＋から。金額を入れ、カテゴリを選んで「保存」。店舗名は、入力の途中で過去の記録や有名店の候補が出ます。"),
      h("li", null, "ホーム：カードを左右にスワイプすると、自分と友達の家計簿を切り替えられます。友達の家計簿は「閲覧のみ」です。"),
      h("li", null, "明細：左にスワイプすると編集・削除。タップで詳細が開きます。"),
      h("li", null, "更新：画面の上から下に引っ張ると、最新の情報に更新します。"),
      h("li", null, "公開：記録は最初は非公開です。公開した記録だけが友達に見えます。費目ごと・友達ごとの設定は「共有設定」から。"),
      h("li", null, "安全：見られる範囲はサーバー側のルールでも守っています。非公開の記録・予算・よく使う項目は、ほかの人のスマホには一切送られません。"),
      h("li", null, "レシートの読み取りはスマホの中で行い、写真はどこにも送られません。PayPayの取り込みも、PayPayのパスワードは使いません。")))), { label: "使い方" });
}
async function copy(t) { try { await navigator.clipboard.writeText(t); ok("コピーしました"); } catch { warn("コピーできませんでした。長押しで選んでください"); } }
function exportCSV() {
  const all = recordsOf(me());
  const esc = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const lines = [["日付", "時刻", "種類", "金額", "カテゴリ", "内容", "店舗", "メモ", "支払方法", "公開", "取込元"].map(esc).join(",")]
    .concat(sortEntries(all).reverse().map(x => [x.date, x.time, x.type === "income" ? "収入" : "支出", x.amount, x.category, x.sub, x.shop, x.memo, x.pay, x.priv ? "非公開" : "公開", x.source || ""].map(esc).join(",")));
  const blob = new Blob(["﻿" + lines.join("\r\n")], { type: "text/csv" });
  const a = h("a", { href: URL.createObjectURL(blob), download: `kakeibo_${ymKey(S.ym).replace("-", "")}.csv` });
  document.body.append(a); a.click(); a.remove(); ok("CSVを保存しました");
}

/* ================= PayPay import ================= */
function importSheet() {
  const file = h("input", { type: "file", accept: ".csv,text/csv", id: "ppFile", "aria-label": "PayPayの取引履歴ファイルを選ぶ" });
  const status = h("div", { class: "err", role: "alert" });
  let handle;
  file.addEventListener("change", async () => {
    const f = file.files[0]; if (!f) return;
    status.textContent = "読み込み中…";
    try {
      const rows = parsePayPay(await readText(f));
      if (!rows.length) { status.textContent = "支払いの記録が見つかりませんでした。"; return; }
      const done = await S.store.existingIds(me()).catch(() => new Set());
      closeSheet(handle);
      importReview(rows.map(r => done.has(r.id) ? { ...r, on: false, done: true } : r));
    } catch { status.textContent = "PayPayの取引履歴ファイルとして読み取れませんでした。PayPayアプリから保存したCSVファイルを選んでください。"; }
  });
  handle = openSheet(h("div", { class: "stack" }, h("div", { class: "head" }, h("h2", null, "PayPayの履歴を取り込む")),
    h("div", { class: "help" }, "PayPayアプリで履歴ファイルを保存してから、ここで選びます。", h("ol", null,
      h("li", null, "PayPayアプリのホーム →「取引履歴」"), h("li", null, "右上の「取引履歴のダウンロード」→ 期間を選んで申請"), h("li", null, "通知が来たら、ダウンロードしてファイルに保存（24時間以内）"))),
    h("label", { class: "btn primary filebtn press" }, "ファイルを選ぶ", file), status,
    h("p", { class: "help" }, "ファイルはスマホの中で読み取ります。同じ取引を二度取り込むことはありません。")), { label: "PayPayの取り込み" });
}
function importReview(rows) {
  let pub = false, handle;
  const summary = h("div", { style: "display:flex;justify-content:space-between;align-items:baseline" });
  const go2 = h("button", { type: "button", class: "btn primary press" });
  const upd = () => {
    const sel = rows.filter(r => r.on && !r.done);
    fill(summary, h("strong", null, `${sel.length}件を取り込む`), h("span", { class: "num", style: "font-weight:700;font-size:1.2rem" }, yen(sumOf(sel))));
    go2.disabled = !sel.length; go2.textContent = sel.length ? `${sel.length}件を取り込む` : "取り込む記録を選んでください";
  };
  const list = h("div", { class: "card", style: "padding:4px 14px" }, sortEntries(rows).map(r => {
    const cb = h("input", { type: "checkbox", class: "cbx", "aria-label": `${r.who} ${r.amount}円を取り込む`, checked: r.on && !r.done ? true : null, disabled: r.done ? true : null });
    const sel = h("select", { "aria-label": "カテゴリ", disabled: r.done ? true : null }, CATS.map(c => h("optgroup", { label: c.id },
      h("option", { value: c.id + "|", selected: c.id === r.category && !r.sub ? true : null }, c.id),
      c.subs.map(sb => h("option", { value: c.id + "|" + sb, selected: c.id === r.category && sb === r.sub ? true : null }, `${c.id} › ${sb}`)))));
    const row = h("div", { class: "imp" + (r.on && !r.done ? "" : " off") }, cb, h("span", { class: "who2" }, r.who || r.kind || "PayPay"), h("span", { class: "num" }, yen(r.amount)),
      h("span", { class: "meta" }, `${r.date.slice(5).replace("-", "/")}・${r.done ? "取り込み済み" : r.kind || "支払い"}`), sel);
    cb.addEventListener("change", () => { r.on = cb.checked; row.classList.toggle("off", !r.on); upd(); });
    sel.addEventListener("change", () => { [r.category, r.sub] = sel.value.split("|"); });
    return row;
  }));
  go2.addEventListener("click", async () => {
    const sel = rows.filter(r => r.on && !r.done).map(r => ({ id: r.id, type: "expense", date: r.date, time: r.time || "", amount: r.amount, category: r.category, sub: r.sub || "", shop: r.who || "", memo: "", pay: "PayPay", source: "paypay" }));
    const p2 = pub && !sel.some(x => hiddenCats().includes(x.category));
    go2.disabled = true; go2.textContent = "取り込み中…";
    try { const n = await S.store.importEntries(me(), sel, !p2); closeSheet(handle); ok(`${n}件を取り込みました`); }
    catch { fail("取り込めませんでした。通信状態を確認してください"); upd(); }
  });
  upd();
  handle = openSheet(h("div", { class: "stack" }, h("div", { class: "head" }, h("h2", null, "取り込む記録を確認")),
    h("p", { class: "help" }, "支払いだけに最初からチェックが入っています。カテゴリはお店の名前から自動で選んでいます。"),
    summary, h("div", { class: "vis" }, h("div", { class: "t" }, h("strong", null, "友達に公開する"), h("small", null, "オフなら非公開で取り込みます")), switchEl("impPub", false, (v) => { pub = v; }, "友達に公開する")),
    list, go2), { tall: true, label: "取り込む記録を確認" });
}

/* ================= drawer ================= */
const mi = (k, label, fn, extra) => h("button", { type: "button", class: "mi", onclick: () => { closeDrawer(); fn(); } }, ic(k), h("span", null, label), extra || null);
function openDrawer() { refreshDrawer(true); }
function closeDrawer() {
  const root = $("drawerRoot"); const d = root.querySelector(".drawer"), s = root.querySelector(".scrim");
  if (!d) return;
  d.classList.add("out"); s?.classList.add("out"); setTimeout(() => fill(root, ), 200);
  $("menuBtn").setAttribute("aria-expanded", "false");
}
function refreshDrawer(force) {
  const root = $("drawerRoot");
  if (!force && !root.querySelector(".drawer:not(.out)")) return;
  if (!S.user) return;
  const groups = S.me?.groups || [];
  const scroll = root.querySelector(".drawer")?.scrollTop || 0;
  const d = h("nav", { class: "drawer", "aria-label": "メニュー" },
    h("div", { class: "me" }, avatar(me()), h("div", null, h("strong", null, S.me?.name || ""), h("small", null, S.user.email || ""))),
    h("h3", null, "グループ"),
    groups.map(c => h("button", { type: "button", class: "mi" + (c === S.code ? " current" : ""), "aria-current": c === S.code ? "true" : null, onclick: async () => {
      closeDrawer(); if (c !== S.code) { try { await S.store.updateMe(me(), { current: c }); } catch { fail("切り替えられませんでした"); } }
    } }, h("span", { class: "gdot", style: `background:${PEOPLE[1 + hashIdx(c, 9)]}` }, (S.groupNames[c] || "・").slice(0, 1)), h("span", null, S.groupNames[c] || "読み込み中…"), c === S.code ? h("span", { class: "check" }, "✓") : null)),
    mi("plus", "グループを作る", createGroupSheet), mi("key", "招待コードで参加", () => joinSheet()),
    S.code ? [mi("invite", "このグループに友達を招待", inviteSheet), mi("leave", "このグループを抜ける", leaveSheet)] : null,
    h("h3", null, "記録"),
    mi("shield", "共有設定", shareSheet), mi("star", "よく使う項目", () => favSheet({ type: "expense", cat: "食費", sub: "", memo: "", shop: "", pay: "", amount: "" })), mi("budget", "予算", budgetSheet),
    mi("paypay", "PayPayの履歴を取り込む", importSheet), mi("csv", "CSVで保存", exportCSV),
    h("h3", null, "設定"),
    mi("theme", "表示テーマ", themeSheet), mi("user", "アカウント", accountSheet),
    isStandalone() ? null : mi("home", "ホーム画面に追加する", homeSheet), mi("help", "使い方と安全について", helpSheet),
    mi("out", "ログアウト", async () => { if (await confirmModal({ title: "ログアウトしますか？", okLabel: "ログアウト" })) { try { await S.store.signOut(); } catch {} } }),
    h("div", { class: "foot" }, `みんなの家計簿 ${APP_VERSION}`));
  fill(root, h("div", { class: "scrim", style: "z-index:35", onclick: closeDrawer }), d);
  d.scrollTop = scroll;
  if (!force) d.style.animation = "none";
  $("menuBtn").setAttribute("aria-expanded", "true");
}

/* ================= login & first run ================= */
function authErrorText(e) {
  const c = e && e.code || "";
  if (c.includes("email-already-in-use")) return "このメールアドレスはすでに登録されています。ログインしてください。";
  if (c.includes("invalid-email")) return "メールアドレスの形が正しくありません。";
  if (c.includes("weak-password")) return "パスワードは8文字以上にしてください。";
  if (c.includes("invalid-credential") || c.includes("wrong-password") || c.includes("user-not-found")) return "メールアドレスかパスワードが違います。";
  if (c.includes("too-many-requests")) return "試行回数が多すぎます。少し時間をおいてから試してください。";
  if (c.includes("network")) return "接続できませんでした。通信状態を確認してください。";
  return "うまくいきませんでした。もう一度試してください。";
}
function showAuth(mode = "login", msg = "") {
  const box = $("full"); box.hidden = false;
  const email = h("input", { class: "text", id: "auEmail", type: "email", autocomplete: "email", inputmode: "email", placeholder: "you@example.com", value: S.store.demo ? "demo@example.com" : (ls.get("kakeibo.email") || "") });
  const pw = h("input", { class: "text", id: "auPw", type: "password", autocomplete: mode === "signup" ? "new-password" : "current-password", placeholder: mode === "signup" ? "8文字以上" : "パスワード", value: S.store.demo ? "demopass" : "" });
  const name = h("input", { class: "text", id: "auName", maxlength: 20, autocomplete: "nickname", placeholder: "たろう" });
  const keep = h("input", { type: "checkbox", class: "cbx", id: "auKeep", checked: ls.get("kakeibo.keep") === "0" ? null : true });
  const err = h("div", { class: "err", role: "alert" }, msg);
  const btn = h("button", { type: "submit", class: "btn primary press" }, mode === "login" ? "ログイン" : mode === "signup" ? "アカウントを作る" : "再設定メールを送る");
  const submit = async () => {
    err.textContent = ""; const em = email.value.trim();
    if (!em) { err.textContent = "メールアドレスを入れてください。"; email.classList.add("bad"); return; }
    if (mode === "signup" && !name.value.trim()) { err.textContent = "表示名を入れてください。"; return; }
    if (mode === "signup" && pw.value.length < 8) { err.textContent = "パスワードは8文字以上にしてください。"; return; }
    btn.disabled = true; ls.set("kakeibo.email", em); ls.set("kakeibo.keep", keep.checked ? "1" : "0");
    try {
      if (mode === "login") await S.store.signIn(em, pw.value, keep.checked);
      else if (mode === "signup") await S.store.signUp(em, pw.value, name.value.trim(), keep.checked);
      else { await S.store.resetPassword(em); showAuth("login"); ok("パスワード再設定のメールを送りました"); return; }
    } catch (e) { err.textContent = authErrorText(e); btn.disabled = false; }
  };
  const form = h("form", { class: "inner gutter", onsubmit: (e) => { e.preventDefault(); submit(); } },
    h("div", { class: "mark" }, ic("wallet")),
    h("h1", null, mode === "signup" ? "はじめまして" : mode === "reset" ? "パスワードの再設定" : "みんなの家計簿"),
    h("p", { class: "lead" }, mode === "reset" ? "登録したメールアドレスに、パスワードを決め直すためのメールを送ります。" : "自分の家計簿をつけながら、友達が公開した支出も見られます。記録はアカウントに保存されるので、機種変更しても引き継げます。"),
    S.store.demo ? h("div", { class: "card help" }, "デモ表示です。このまま「ログイン」を押すと中を見られます。") : null,
    mode === "signup" ? [h("label", { class: "f", for: "auName" }, "表示名（友達に見える名前）"), name] : null,
    h("label", { class: "f", for: "auEmail" }, "メールアドレス"), email,
    mode !== "reset" ? [h("label", { class: "f", for: "auPw" }, "パスワード"), pw,
      h("label", { class: "keep", for: "auKeep" }, keep, h("span", null, "ログインしたままにする"), h("small", { class: "help", style: "margin-left:auto" }, "次回から入力不要"))] : null,
    err, btn,
    mode === "login" ? [h("button", { type: "button", class: "linklike", onclick: () => showAuth("signup") }, "はじめての方：アカウントを作る"), h("button", { type: "button", class: "linklike", onclick: () => showAuth("reset") }, "パスワードを忘れた")]
      : h("button", { type: "button", class: "linklike", onclick: () => showAuth("login") }, "ログイン画面に戻る"));
  fill(box, form);
}
function showStart() {
  const box = $("full"); box.hidden = false;
  fill(box, h("div", { class: "inner gutter" }, h("div", { class: "mark" }, ic("people")),
    h("h1", null, `ようこそ、${S.me?.name || ""}さん`),
    h("p", { class: "lead" }, "友達と見せ合うには、グループを作るか、友達から届いた招待コードで参加します。記録は最初は非公開で、公開したものだけが友達に見えます。"),
    h("button", { type: "button", class: "btn primary press", onclick: () => { hideFull(); createGroupSheet(); } }, "グループを作る"),
    h("button", { type: "button", class: "btn press", onclick: () => { hideFull(); joinSheet(S.joinParam); } }, "招待コードで参加"),
    h("button", { type: "button", class: "linklike", onclick: () => { S.startDismissed = true; hideFull(); } }, "まずはひとりで使う")));
}
function hideFull() { const f = $("full"); f.hidden = true; fill(f, ); }

/* ================= boot ================= */
async function boot() {
  applyTheme(ls.get("kakeibo.theme"));
  document.querySelectorAll(".tab").forEach(b => b.addEventListener("click", () => go(b.dataset.go)));
  $("addBtn").addEventListener("click", () => { buzz(8); openEntry(); });
  $("prevM").onclick = () => shiftMonth(-1); $("nextM").onclick = () => shiftMonth(1);
  $("menuBtn").onclick = openDrawer;
  $("whoBtn").onclick = () => {
    const ps = people(); if (ps.length < 2) { toast("友達を招待すると、ここで家計簿を切り替えられます"); return; }
    let handle;
    handle = openSheet(h("div", { class: "stack" }, h("div", { class: "head" }, h("h2", null, "家計簿を切り替える")),
      h("div", { class: "group" }, ps.map(u => h("button", { type: "button", class: "cell", onclick: () => { closeSheet(handle); setViewing(u); } }, avatar(u),
        h("span", { class: "grow" }, h("strong", null, nameOf(u)), h("small", null, isMe(u) ? "自分の家計簿" : "閲覧のみ")), u === S.viewing ? h("span", { style: "color:var(--brand);font-weight:700" }, "✓") : null)))), { label: "家計簿を切り替える" });
  };
  $("receiptFile").addEventListener("change", (e) => { const f = e.target.files[0]; e.target.value = ""; if (f) receiptFlow(f); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") { if ($("modalRoot").firstChild) return; if (sheets.length) closeSheet(); else closeDrawer(); } });
  window.addEventListener("resize", moveTabIndicator);
  window.addEventListener("online", () => toast("オンラインに戻りました"));
  window.addEventListener("offline", () => warn("オフラインです。記録は通信が戻ると保存されます"));
  wirePullToRefresh();
  moveTabIndicator();
  const configured = !!(firebaseConfig && firebaseConfig.apiKey);
  try { S.store = configured ? await firebaseStore() : demoStore(); }
  catch { S.store = demoStore(); warn("サーバーに接続できないため、デモ表示にしています"); }
  $("demoBanner").hidden = !S.store.demo;
  S.store.onAuth((u) => { if (u) { if (S.user?.uid !== u.uid) { hideFull(); onSignedIn(u); go(S.tab); } } else onSignedOut(); });
}
if ("serviceWorker" in navigator && location.protocol === "https:" && /github\.io$|web\.app$|firebaseapp\.com$/.test(location.hostname)) {
  navigator.serviceWorker.register("sw.js").catch(() => {});
}
boot();
