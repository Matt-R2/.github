// ---------- API Config ----------
const API_KEY = "5209567dcbe49befeb739dbbd73b4467"; // Your key
const METALPRICE_URL = `https://api.metalpriceapi.com/v1/latest?api_key=${API_KEY}&base=USD&symbols=USDXAU`;

// ---------- State ----------
const LS_ITEMS = "mw_items_v1";
const LS_HISTORY = "mw_history_v1";
const LS_PRICES = "mw_prices_v1";

let items = load(LS_ITEMS, []);
let history = load(LS_HISTORY, []);
let prices = load(LS_PRICES, {
  Gold: 60, Silver: 0.75, Platinum: 30, Palladium: 35
});

// ---------- DOM ----------
const el = (id) => document.getElementById(id);
const metalEl = el("metal");
const karatEl = el("karat");
const gramsEl = el("grams");
const tbody = el("tbody");
const totalValueEl = el("totalValue");

// price inputs
const priceInputs = {
  Gold: el("priceGold"),
  Silver: el("priceSilver"),
  Platinum: el("pricePlatinum"),
  Palladium: el("pricePalladium"),
};

// hydrate price fields from saved prices
for (const m of Object.keys(priceInputs)) {
  priceInputs[m].value = prices[m];
  priceInputs[m].addEventListener("input", () => {
    prices[m] = toNum(priceInputs[m].value, 0);
    save(LS_PRICES, prices);
    render();
  });
}

// ---------- Utils ----------
function save(key, value){ localStorage.setItem(key, JSON.stringify(value)); }
function load(key, fallback){ try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } }
function toNum(v, d=0){ const n = Number(v); return Number.isFinite(n) ? n : d; }
function purityFromKarat(k){ const n = toNum(k, 0); return Math.min(Math.max(n,1),24)/24; } // clamp 1..24

function pricePerGram(metal){
  return toNum(priceInputs[metal].value, 0);
}

function valueOfItem(item){
  const price = pricePerGram(item.metal);
  const purity = purityFromKarat(item.karat);
  return toNum(item.grams,0) * price * purity;
}

// ---------- Live Price Fetch ----------
async function updateGoldSpot() {
  try {
    const res = await fetch(METALPRICE_URL);
    const data = await res.json();
    if (!data.success) throw new Error("API error");

    const ounceRate = data.rates["USDXAU"]; // USD per ounce
    const gramsPerOunce = 31.1035;
    const perGram = ounceRate / gramsPerOunce;

    prices["Gold"] = perGram;
    priceInputs.Gold.value = perGram.toFixed(2);
    save(LS_PRICES, prices);

    console.log("Gold price updated to", perGram.toFixed(2), "USD/g");
  } catch (err) {
    console.error("Failed to fetch gold price:", err);
    alert("Unable to fetch live gold price.");
  }
}

// ---------- Table ----------
function renderTable(){
  tbody.innerHTML = "";
  let total = 0;

  items.forEach((item, idx) => {
    const val = valueOfItem(item);
    total += val;

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${item.metal}</td>
      <td>${item.karat}</td>
      <td class="right">${Number(item.grams).toFixed(3)}</td>
      <td class="right">$${val.toFixed(2)}</td>
      <td class="right">
        <button class="btn-outline" data-edit="${idx}">Edit</button>
        <button class="btn-danger" data-del="${idx}">Delete</button>
      </td>
    `;
    tbody.appendChild(tr);
  });

  totalValueEl.textContent = total.toFixed(2);
}

// ---------- Items Actions ----------
function addItem(){
  const metal = metalEl.value;
  const karat = toNum(karatEl.value, NaN);
  const grams = toNum(gramsEl.value, NaN);

  if (!Number.isFinite(karat) || karat < 1 || karat > 24) {
    alert("Please enter a karat between 1 and 24.");
    return;
  }
  if (!Number.isFinite(grams) || grams <= 0) {
    alert("Please enter grams > 0.");
    return;
  }

  items.push({ metal, karat, grams });
  save(LS_ITEMS, items);
  karatEl.value = "";
  gramsEl.value = "";
  render();
}

function onTableClick(e){
  const delIdx = e.target.getAttribute("data-del");
  const editIdx = e.target.getAttribute("data-edit");

  if (delIdx !== null){
    const i = Number(delIdx);
    if (confirm("Delete this item?")){
      items.splice(i,1);
      save(LS_ITEMS, items);
      render();
    }
  }

  if (editIdx !== null){
    const i = Number(editIdx);
    const it = items[i];
    const newMetal = prompt("Metal (Gold/Silver/Platinum/Palladium):", it.metal) ?? it.metal;
    const newKarat = toNum(prompt("Karat (1–24):", it.karat), it.karat);
    const newGrams = toNum(prompt("Grams:", it.grams), it.grams);
    if (newKarat >= 1 && newKarat <= 24 && newGrams > 0 && ["Gold","Silver","Platinum","Palladium"].includes(newMetal)){
      items[i] = { metal:newMetal, karat:newKarat, grams:newGrams };
      save(LS_ITEMS, items);
      render();
    } else {
      alert("Invalid edit. No changes saved.");
    }
  }
}

// ---------- Chart ----------
const ctx = document.getElementById("chart").getContext("2d");
const chart = new Chart(ctx, {
  type: "line",
  data: {
    labels: history.map(h => h.t),
    datasets: [{
      label: "Collection Worth ($)",
      data: history.map(h => h.v),
      fill: true,
      tension: 0.25
    }]
  },
  options: {
    plugins: { legend: { display: true } },
    scales: {
      x: { ticks: { color: "#a3a3a3" }, grid: { color: "#1f2937" } },
      y: { ticks: { color: "#a3a3a3" }, grid: { color: "#1f2937" } }
    }
  }
});

function snapshot(){
  const total = toNum(totalValueEl.textContent, 0);
  const t = new Date().toLocaleString();
  history.push({ t, v: total });
  save(LS_HISTORY, history);
  chart.data.labels = history.map(h => h.t);
  chart.data.datasets[0].data = history.map(h => h.v);
  chart.update();
}

function resetHistory(){
  if (!history.length) return;
  if (confirm("Clear chart history snapshots? Your items will remain.")){
    history = [];
    save(LS_HISTORY, history);
    chart.data.labels = [];
    chart.data.datasets[0].data = [];
    chart.update();
  }
}

// ---------- Render ----------
function render(){
  renderTable();
}

// ---------- Events ----------
document.getElementById("addBtn").addEventListener("click", addItem);
document.getElementById("updateBtn").addEventListener("click", async () => {
  await updateGoldSpot(); // fetch live gold price
  render();
  snapshot();
});
document.getElementById("resetHistoryBtn").addEventListener("click", resetHistory);
tbody.addEventListener("click", onTableClick);

// initial render
render();
