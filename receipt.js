// Reads a receipt photo on the phone itself (no upload) and pulls out the total, date and store name.
const TESSERACT = "https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js";

function loadScript(src) {
  return new Promise((resolve, reject) => {
    if (window.Tesseract) return resolve();
    const s = document.createElement("script");
    s.src = src; s.onload = resolve; s.onerror = () => reject(new Error("load"));
    document.head.append(s);
  });
}

// Shrink, grayscale and stretch contrast so thermal-paper print reads better.
export async function prepareImage(file) {
  const bmp = await createImageBitmap(file).catch(async () => {
    const img = new Image(); img.src = URL.createObjectURL(file); await img.decode(); return img;
  });
  const w0 = bmp.width, h0 = bmp.height, scale = Math.min(1, 1800 / Math.max(w0, h0));
  const w = Math.round(w0 * scale), h = Math.round(h0 * scale);
  const c = document.createElement("canvas"); c.width = w; c.height = h;
  const ctx = c.getContext("2d", { willReadFrequently: true });
  ctx.drawImage(bmp, 0, 0, w, h);
  const im = ctx.getImageData(0, 0, w, h), d = im.data;
  let lo = 255, hi = 0; const g = new Uint8ClampedArray(w * h);
  for (let i = 0, j = 0; i < d.length; i += 4, j++) { const v = (d[i] * 299 + d[i + 1] * 587 + d[i + 2] * 114) / 1000; g[j] = v; }
  const hist = new Array(256).fill(0); g.forEach(v => hist[v | 0]++);
  let acc = 0; for (let v = 0; v < 256; v++) { acc += hist[v]; if (acc > g.length * 0.02) { lo = v; break; } }
  acc = 0; for (let v = 255; v >= 0; v--) { acc += hist[v]; if (acc > g.length * 0.02) { hi = v; break; } }
  const span = Math.max(1, hi - lo);
  for (let i = 0, j = 0; i < d.length; i += 4, j++) { const v = Math.max(0, Math.min(255, (g[j] - lo) * 255 / span)); d[i] = d[i + 1] = d[i + 2] = v; }
  ctx.putImageData(im, 0, 0);
  return c;
}

export async function recognize(canvas, onProgress) {
  const paths = window.__ocrPaths || {}; // test hook: serve the OCR files locally
  await loadScript(paths.script || TESSERACT);
  const worker = await window.Tesseract.createWorker("jpn", 1, {
    ...(paths.workerPath ? { workerPath: paths.workerPath, corePath: paths.corePath, langPath: paths.langPath } : {}),
    logger: (m) => { if (m.status === "recognizing text") onProgress?.(m.progress); else if (/load/.test(m.status)) onProgress?.(-1); },
  });
  try { const { data } = await worker.recognize(canvas); return data.text || ""; }
  finally { worker.terminate(); }
}

/* ---------- text → fields ---------- */
const z2h = (s) => s.replace(/[０-９Ａ-Ｚａ-ｚ]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xFEE0))
  .replace(/[，、]/g, ",").replace(/[．。]/g, ".").replace(/[￥]/g, "¥").replace(/[：]/g, ":").replace(/[／]/g, "/").replace(/[－ー—–]/g, m => m === "ー" ? "ー" : "-");
// OCR often reads ¥ as y / Y / \ and 1 as i / l / |, and the thousands comma as a period
const fixMoney = (l) => l.replace(/[yYＹ\\](?=[\dIil|])/g, "¥").replace(/¥[Iil|]/g, "¥1").replace(/(\d)\s+(?=[\d,.])/g, "$1").replace(/(\d)[,.]+(?=\d{3}(?!\d))/g, "$1");
const nums = (line) => (fixMoney(line).match(/\d{1,3}(?:,\d{3})+|\d+/g) || []).map(n => Number(n.replace(/,/g, ""))).filter(n => n > 0 && n < 10000000);

export function parseReceipt(raw) {
  const cjk = "ぁ-んァ-ヶー一-龠々";
  const lines = z2h(raw).split(/\r?\n/)
    .map(l => l.replace(new RegExp(`([${cjk}\\-])\\s+(?=[${cjk}\\-])`, "g"), "$1").trim()).filter(Boolean);
  const squash = (l) => l.replace(/\s+/g, "");
  // total
  let amount = 0, conf = "none";
  const skip = /預|釣|おつり|お釣|ポイント|pt|対象|内税|消費税|税率|税額|点数|個数|小計|値引|割引|クーポン/i;
  const keys = [/合計|お会計|ご請求|総額|総計|お買上|お買い上げ|御買上|お支払/, /計/];
  for (const key of keys) {
    for (let i = 0; i < lines.length && !amount; i++) {
      const l = squash(lines[i]);
      if (!key.test(l) || (skip.test(l) && !/合計/.test(l)) || /小計/.test(l)) continue;
      let n = nums(l).filter(v => v >= 10);
      if (!n.length && lines[i + 1]) n = nums(squash(lines[i + 1])).filter(v => v >= 10);
      if (n.length) { amount = n[n.length - 1]; conf = "total"; }
    }
    if (amount) break;
  }
  if (!amount) {
    const yenNums = lines.map(fixMoney).filter(l => /¥|円/.test(l) && !skip.test(squash(l))).flatMap(l => nums(squash(l)));
    if (yenNums.length) { amount = Math.max(...yenNums); conf = "guess"; }
  }
  // date
  let date = null;
  for (const l0 of lines) {
    const l = squash(l0);
    let m = l.match(/(20\d{2})[年\/.\-](\d{1,2})[月\/.\-](\d{1,2})/);
    if (m) { date = [m[1], m[2], m[3]]; break; }
    m = l.match(/(?:令和|R)(\d{1,2})[年\/.\-](\d{1,2})[月\/.\-](\d{1,2})/);
    if (m) { date = [String(2018 + Number(m[1])), m[2], m[3]]; break; }
    m = l.match(/(?:^|[^\d])(\d{2})[\/.\-](\d{1,2})[\/.\-](\d{1,2})(?:[^\d]|$)/);
    if (m && Number(m[1]) >= 20) { date = ["20" + m[1], m[2], m[3]]; break; }
  }
  let ymdStr = null;
  if (date) {
    const [y, mo, d] = date.map(Number);
    if (mo >= 1 && mo <= 12 && d >= 1 && d <= 31) ymdStr = `${y}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  }
  // store: first line that reads like a name
  const notName = /領収|レシート|receipt|電話|TEL|tel|〒|登録番号|インボイス|No\.|^\d|毎度|ありがとう|いらっしゃい|ご来店|様$/;
  let store = "";
  for (const l0 of lines.slice(0, 8)) {
    const l = l0.replace(/\s{2,}/g, " ").trim();
    const jp = (l.match(/[ぁ-んァ-ヶ一-龠A-Za-z]/g) || []).length;
    if (jp >= 2 && !notName.test(l) && !/[¥]\s*\d/.test(fixMoney(l))) { store = l.slice(0, 40); break; }
  }
  // time (e.g. 18:42) — prefer the line that also holds the date
  let time = "";
  const tl = lines.map(l => l.replace(/\s+/g, "")).sort((a, b) => /20\d{2}|令和|R\d/.test(b) - /20\d{2}|令和|R\d/.test(a));
  for (const l of tl) { const m = l.match(/(?:^|[^\d])([01]?\d|2[0-3])[:時]([0-5]\d)/); if (m) { time = m[1].padStart(2, "0") + ":" + m[2]; break; } }
  return { amount, amountConfidence: conf, date: ymdStr, time, store, text: lines.join("\n") };
}
