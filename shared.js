// ของที่ใช้ร่วมกันระหว่างหน้าแคตตาล็อก (index.html) และหน้าสั่งรายการ (order.html)
// ต้องโหลดหลัง data/products.js
window.ShopKit = (() => {
  const D = window.BPO_DATA;
  if (!D) return null;

  const store = {
    get(k, d) { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
  };
  // ทุกร้านอยู่โดเมนเดียวกัน (kong41111.github.io) จึงต้องแยกคีย์ตามชื่อร้าน ไม่งั้นตะกร้าปนกัน
  const key = (k) => `${k}:${D.shop}`;
  const legacy = (k) => (D.shop === "BPO" ? store.get(k, null) : null);  // คีย์เก่าก่อนแยกร้าน

  const num = (v) => { const n = parseFloat(String(v).replace(/,/g, "")); return isFinite(n) ? n : NaN; };
  const money = (n) => n.toLocaleString("en-US", { maximumFractionDigits: 2 });
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  const thumbUrl = (p) => D.localImages ? `data/images/${p.id}.jpg` : `https://lh3.googleusercontent.com/d/${p.id}=w400`;
  const bigUrl = (p, w = 1600) => `https://lh3.googleusercontent.com/d/${p.id}=w${w}`;
  const driveUrl = (p) => `https://drive.google.com/file/d/${p.id}/view`;
  const label = (p) => p.noname ? `${p.type} (ไม่มีชื่อ)` : p.name;
  const orderName = (p) => [p.code, p.noname ? `${p.type} (${p.name.slice(0, 20)})` : p.name].filter(Boolean).join(" ");

  // ราคาที่แสดง: ราคาเดียว "280 ฿" หรือหลายรุ่น "118 – 144 ฿"
  function priceRange(p) {
    const list = p.options ? p.options.map((o) => o.price) : p.price != null ? [p.price] : [];
    if (!list.length) return "";
    const lo = Math.min(...list), hi = Math.max(...list);
    return lo === hi ? `${money(lo)} ฿` : `${money(lo)} – ${money(hi)} ฿`;
  }

  // ---------- ตะกร้า: [{ id, name, variant, qty, price }] (price = ราคาต่อชิ้น, "" = ยังไม่ใส่) ----------
  const byId = new Map(D.products.map((p) => [p.id, p]));
  const lastPrice = store.get(key("prices"), null) ?? legacy("bpo-prices") ?? {};  // จำราคาที่เคยพิมพ์เอง
  const loadCart = () => (store.get(key("cart"), null) ?? legacy("bpo-cart") ?? [])
    .filter((l) => l && byId.has(l.id))        // ตัดของร้านอื่น / สินค้าที่ถูกลบจาก Drive
    .map((l) => ({ ...l, variant: l.variant || "" }));
  const saveCart = (cart) => store.set(key("cart"), cart);
  function rememberPrice(id, price) {
    if (isNaN(num(price))) return;
    lastPrice[id] = price;
    store.set(key("prices"), lastPrice);
  }
  // ราคาเริ่มต้นของบรรทัด: ราคารุ่นที่เลือก > ราคาสินค้า > ราคาที่เคยพิมพ์เอง
  function defaultPrice(p, variant = "") {
    const opt = p.options?.find((o) => o.name === variant.trim());
    return opt ? opt.price : p.price ?? lastPrice[p.id] ?? "";
  }

  // ข้อความสรุป: "ชื่อสินค้า (รุ่น) จำนวน x ราคา : ยอดเงิน"
  function summaryText(cart, { links = false, note = "" } = {}) {
    let total = 0, pieces = 0, missing = 0;
    const lines = [];
    for (const l of cart) {
      const q = num(l.qty) || 0, pr = num(l.price);
      pieces += q;
      const name = l.name + (l.variant.trim() ? ` (${l.variant.trim()})` : "");
      if (isNaN(pr)) { missing++; lines.push(`${name} ${money(q)} x ? : ?`); }
      else { total += q * pr; lines.push(`${name} ${money(q)} x ${money(pr)} : ${money(q * pr)}`); }
      const p = byId.get(l.id);
      if (links && p) lines.push(`   รูป: ${driveUrl(p)}`);
    }
    const text = [
      `รายการสั่งซื้อ ร้าน ${D.shop}`,
      ...lines,
      `รวม ${cart.length} รายการ ${money(pieces)} ชิ้น`,
      `ยอดเงินรวม : ${money(total)} บาท` + (missing ? ` (ยังไม่ใส่ราคา ${missing} รายการ)` : ""),
      ...(note.trim() ? [`หมายเหตุ: ${note.trim()}`] : []),
    ].join("\n");
    return { text, total, missing, pieces };
  }
  const lineShareUrl = (text) => "https://line.me/R/share?text=" + encodeURIComponent(text);

  async function copyText(text) {
    try { await navigator.clipboard.writeText(text); return true; }
    catch {
      const ta = Object.assign(document.createElement("textarea"), { value: text });
      document.body.appendChild(ta); ta.select();
      const ok = document.execCommand("copy"); ta.remove(); return ok;
    }
  }

  // ชื่อร้าน: ชื่อแท็บ และไอคอนแท็บ (ตัวอักษรแรกของชื่อร้าน)
  function brandPage(suffix) {
    document.title = `${D.shop} — ${suffix}`;
    const mark = D.shop.split(/[.\s]/)[0].slice(0, 3);
    const icon = document.getElementById("favicon");
    if (icon) icon.href = "data:image/svg+xml," + encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'><rect width='64' height='64' rx='14' fill='#0c2340'/><text x='32' y='41' font-family='Arial' font-weight='900' font-size='${mark.length > 2 ? 22 : 28}' fill='white' text-anchor='middle'>${esc(mark)}</text><rect x='14' y='47' width='36' height='4' rx='2' fill='#ff7a1a'/></svg>`);
  }

  return {
    D, store, key, num, money, esc, thumbUrl, bigUrl, driveUrl, label, orderName, priceRange,
    byId, loadCart, saveCart, rememberPrice, defaultPrice, summaryText, lineShareUrl, copyText, brandPage,
  };
})();
