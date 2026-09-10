import Dexie, { type Table } from "dexie";

export interface Expense {
  id: string;
  amount: number;
  description: string;
  category: string;
  type: "expense" | "income";
  date: string;
  time: string;
  createdAt: string;
}

export interface Settings {
  id: string;
  monthlyBudget: number;
  dailyBudget: number;
}

class PaisaDB extends Dexie {
  expenses!: Table<Expense, string>;
  settings!: Table<Settings, string>;

  constructor() {
    super("PaisaSimple");
    this.version(2).stores({
      expenses: "id, date, category, type, createdAt",
      settings: "id",
    }).upgrade((tx) => {
      return tx.table("expenses").toCollection().modify((exp) => {
        if (!exp.type) exp.type = "expense";
      });
    });
  }
}

export const db = new PaisaDB();

export async function initSettings() {
  const s = await db.settings.get("default");
  if (!s) await db.settings.put({ id: "default", monthlyBudget: 0, dailyBudget: 0 });
}

// ═══════════════════════════════════════════════════════
// SMART CATEGORY ENGINE — 200+ Indian keywords
// ═══════════════════════════════════════════════════════

const CATEGORY_MAP: Record<string, string> = {
  // ── FOOD & DRINKS (merged into one "🍔 Food") ──
  breakfast: "🍔 Food", lunch: "🍔 Food", dinner: "🍔 Food", snack: "🍔 Food",
  snacks: "🍔 Food", food: "🍔 Food", eat: "🍔 Food", eating: "🍔 Food",
  biryani: "🍔 Food", pizza: "🍔 Food", burger: "🍔 Food", momos: "🍔 Food",
  momo: "🍔 Food", dosa: "🍔 Food", thali: "🍔 Food", paratha: "🍔 Food",
  noodles: "🍔 Food", maggi: "🍔 Food", pasta: "🍔 Food", sandwich: "🍔 Food",
  roll: "🍔 Food", rolls: "🍔 Food", chowmein: "🍔 Food", pav: "🍔 Food",
  vada: "🍔 Food", idli: "🍔 Food", samosa: "🍔 Food", paneer: "🍔 Food",
  chicken: "🍔 Food", mutton: "🍔 Food", fish: "🍔 Food", egg: "🍔 Food",
  rice: "🍔 Food", roti: "🍔 Food", naan: "🍔 Food", dal: "🍔 Food",
  rajma: "🍔 Food", chole: "🍔 Food", puri: "🍔 Food", bhaji: "🍔 Food",
  chaat: "🍔 Food", golgappa: "🍔 Food", pani: "🍔 Food", bhel: "🍔 Food",
  cake: "🍔 Food", pastry: "🍔 Food", ice: "🍔 Food", icecream: "🍔 Food",
  chocolate: "🍔 Food", sweet: "🍔 Food", mithai: "🍔 Food", ladoo: "🍔 Food",
  gulab: "🍔 Food", jalebi: "🍔 Food", halwa: "🍔 Food",
  chai: "🍔 Food", tea: "🍔 Food", coffee: "🍔 Food", juice: "🍔 Food",
  milk: "🍔 Food", lassi: "🍔 Food", smoothie: "🍔 Food", shake: "🍔 Food",
  soda: "🍔 Food", coke: "🍔 Food", pepsi: "🍔 Food", sprite: "🍔 Food",
  water: "🍔 Food", buttermilk: "🍔 Food", nimbu: "🍔 Food", lemon: "🍔 Food",
  // Delivery apps
  swiggy: "🍔 Food", zomato: "🍔 Food", "uber eats": "🍔 Food",
  dominos: "🍔 Food", mcdonalds: "🍔 Food", kfc: "🍔 Food", subway: "🍔 Food",
  "pizza hut": "🍔 Food", starbucks: "🍔 Food", "cafe coffee": "🍔 Food",
  ccd: "🍔 Food", barista: "🍔 Food", haldirams: "🍔 Food", bikanervala: "🍔 Food",
  restaurant: "🍔 Food", dhaba: "🍔 Food", canteen: "🍔 Food", mess: "🍔 Food",
  tiffin: "🍔 Food", dabba: "🍔 Food", hotel: "🍔 Food",

  // ── TRANSPORT ──
  auto: "🛺 Transport", rickshaw: "🛺 Transport", uber: "🛺 Transport",
  ola: "🛺 Transport", cab: "🛺 Transport", taxi: "🛺 Transport",
  bus: "🛺 Transport", metro: "🛺 Transport", train: "🛺 Transport",
  rapido: "🛺 Transport", bike: "🛺 Transport", scooty: "🛺 Transport",
  petrol: "🛺 Transport", fuel: "🛺 Transport", diesel: "🛺 Transport",
  cng: "🛺 Transport", gas: "🛺 Transport", toll: "🛺 Transport",
  parking: "🛺 Transport", flight: "🛺 Transport", irctc: "🛺 Transport",
  redbus: "🛺 Transport", travel: "🛺 Transport", fare: "🛺 Transport",
  ride: "🛺 Transport", commute: "🛺 Transport",

  // ── SHOPPING ──
  amazon: "🛒 Shopping", flipkart: "🛒 Shopping", myntra: "🛒 Shopping",
  ajio: "🛒 Shopping", meesho: "🛒 Shopping", nykaa: "🛒 Shopping",
  clothes: "🛒 Shopping", shoes: "🛒 Shopping", shirt: "🛒 Shopping",
  tshirt: "🛒 Shopping", jeans: "🛒 Shopping", dress: "🛒 Shopping",
  kurta: "🛒 Shopping", saree: "🛒 Shopping", watch: "🛒 Shopping",
  bag: "🛒 Shopping", backpack: "🛒 Shopping", belt: "🛒 Shopping",
  sunglasses: "🛒 Shopping", perfume: "🛒 Shopping", cosmetics: "🛒 Shopping",
  makeup: "🛒 Shopping", cream: "🛒 Shopping", lotion: "🛒 Shopping",
  shopping: "🛒 Shopping", mall: "🛒 Shopping", market: "🛒 Shopping",
  online: "🛒 Shopping", order: "🛒 Shopping",
  phone: "🛒 Shopping", earphones: "🛒 Shopping", headphones: "🛒 Shopping",
  charger: "🛒 Shopping", cable: "🛒 Shopping", cover: "🛒 Shopping",
  electronics: "🛒 Shopping", laptop: "🛒 Shopping", mouse: "🛒 Shopping",

  // ── GROCERIES ──
  grocery: "🥬 Groceries", groceries: "🥬 Groceries", vegetables: "🥬 Groceries",
  fruits: "🥬 Groceries", sabzi: "🥬 Groceries", atta: "🥬 Groceries",
  flour: "🥬 Groceries", oil: "🥬 Groceries", sugar: "🥬 Groceries",
  salt: "🥬 Groceries", masala: "🥬 Groceries", spices: "🥬 Groceries",
  onion: "🥬 Groceries", potato: "🥬 Groceries", tomato: "🥬 Groceries",
  blinkit: "🥬 Groceries", zepto: "🥬 Groceries", bigbasket: "🥬 Groceries",
  instamart: "🥬 Groceries", dmart: "🥬 Groceries", reliance: "🥬 Groceries",
  kirana: "🥬 Groceries", supermarket: "🥬 Groceries", provision: "🥬 Groceries",
  bread: "🥬 Groceries", butter: "🥬 Groceries", cheese: "🥬 Groceries",
  curd: "🥬 Groceries", dahi: "🥬 Groceries",

  // ── BILLS & RECHARGE ──
  recharge: "📱 Bills", mobile: "📱 Bills", wifi: "📱 Bills",
  internet: "📱 Bills", broadband: "📱 Bills", electricity: "📱 Bills",
  "electric bill": "📱 Bills", "water bill": "📱 Bills", "gas bill": "📱 Bills",
  airtel: "📱 Bills", jio: "📱 Bills", vi: "📱 Bills", bsnl: "📱 Bills",
  postpaid: "📱 Bills", prepaid: "📱 Bills", dth: "📱 Bills",
  "phone bill": "📱 Bills", maintenance: "📱 Bills",

  // ── RENT ──
  rent: "🏠 Rent", pg: "🏠 Rent", hostel: "🏠 Rent", room: "🏠 Rent",
  "house rent": "🏠 Rent", landlord: "🏠 Rent", deposit: "🏠 Rent",
  society: "🏠 Rent", flat: "🏠 Rent",

  // ── ENTERTAINMENT / FUN ──
  movie: "🎬 Fun", movies: "🎬 Fun", cinema: "🎬 Fun", pvr: "🎬 Fun",
  inox: "🎬 Fun", netflix: "🎬 Fun", spotify: "🎬 Fun", hotstar: "🎬 Fun",
  prime: "🎬 Fun", disney: "🎬 Fun", youtube: "🎬 Fun",
  game: "🎬 Fun", games: "🎬 Fun", gaming: "🎬 Fun", bowling: "🎬 Fun",
  pool: "🎬 Fun", billiards: "🎬 Fun", arcade: "🎬 Fun", vr: "🎬 Fun",
  concert: "🎬 Fun", show: "🎬 Fun", event: "🎬 Fun", ticket: "🎬 Fun",
  party: "🎬 Fun", club: "🎬 Fun", pub: "🎬 Fun", bar: "🎬 Fun",
  beer: "🎬 Fun", drinks: "🎬 Fun", drink: "🎬 Fun", alcohol: "🎬 Fun",
  hookah: "🎬 Fun", lounge: "🎬 Fun", outing: "🎬 Fun", hangout: "🎬 Fun",
  picnic: "🎬 Fun", trip: "🎬 Fun", vacation: "🎬 Fun",
  amusement: "🎬 Fun", waterpark: "🎬 Fun", zoo: "🎬 Fun",
  subscription: "🎬 Fun",

  // ── EDUCATION ──
  book: "📚 Education", books: "📚 Education", course: "📚 Education",
  college: "📚 Education", university: "📚 Education", school: "📚 Education",
  tuition: "📚 Education", coaching: "📚 Education", class: "📚 Education",
  udemy: "📚 Education", coursera: "📚 Education", skillshare: "📚 Education",
  stationery: "📚 Education", pen: "📚 Education", pencil: "📚 Education",
  notebook: "📚 Education", xerox: "📚 Education", photocopy: "📚 Education",
  print: "📚 Education", printing: "📚 Education", exam: "📚 Education",
  fee: "📚 Education", fees: "📚 Education", library: "📚 Education",
  study: "📚 Education",

  // ── HEALTH ──
  medicine: "💊 Health", doctor: "💊 Health", hospital: "💊 Health",
  clinic: "💊 Health", pharmacy: "💊 Health", medical: "💊 Health",
  gym: "💊 Health", fitness: "💊 Health", yoga: "💊 Health",
  supplement: "💊 Health", protein: "💊 Health", vitamin: "💊 Health",
  tablet: "💊 Health", syrup: "💊 Health", injection: "💊 Health",
  test: "💊 Health", "blood test": "💊 Health", xray: "💊 Health",
  dental: "💊 Health", dentist: "💊 Health", eye: "💊 Health",
  spectacles: "💊 Health", glasses: "💊 Health", lens: "💊 Health",
  "1mg": "💊 Health", pharmeasy: "💊 Health", apollo: "💊 Health",
  practo: "💊 Health",

  // ── PERSONAL CARE ──
  haircut: "💇 Personal", salon: "💇 Personal", parlour: "💇 Personal",
  spa: "💇 Personal", massage: "💇 Personal", facial: "💇 Personal",
  waxing: "💇 Personal", threading: "💇 Personal", grooming: "💇 Personal",
  shampoo: "💇 Personal", soap: "💇 Personal", toothpaste: "💇 Personal",
  deodorant: "💇 Personal", razor: "💇 Personal", laundry: "💇 Personal",
  ironing: "💇 Personal", drycleaning: "💇 Personal", cleaning: "💇 Personal",

  // ── GIFTS & DONATIONS ──
  gift: "🎁 Gifts", birthday: "🎁 Gifts", present: "🎁 Gifts",
  wedding: "🎁 Gifts", shagun: "🎁 Gifts", donation: "🎁 Gifts",
  charity: "🎁 Gifts", temple: "🎁 Gifts", mandir: "🎁 Gifts",
  pooja: "🎁 Gifts", festival: "🎁 Gifts", diwali: "🎁 Gifts",
  holi: "🎁 Gifts", rakhi: "🎁 Gifts", eid: "🎁 Gifts",

  // ── EMI / LOANS ──
  emi: "🏦 EMI", loan: "🏦 EMI", installment: "🏦 EMI",
  "credit card": "🏦 EMI", "card bill": "🏦 EMI", "card payment": "🏦 EMI",
  bajaj: "🏦 EMI",

  // ── INCOME ──
  salary: "💰 Salary", income: "💰 Salary", freelance: "💻 Freelance",
  cashback: "💸 Cashback", refund: "↩️ Refund", allowance: "🤝 Allowance",
  interest: "🏦 Interest", "pocket money": "🤝 Allowance",
  stipend: "💰 Salary", bonus: "💰 Salary", credited: "💰 Salary",
};

export function guessCategory(text: string): string {
  const lower = text.toLowerCase().trim();

  // Try exact match first
  if (CATEGORY_MAP[lower]) return CATEGORY_MAP[lower];

  // Try each keyword as substring
  for (const [keyword, category] of Object.entries(CATEGORY_MAP)) {
    if (lower.includes(keyword)) return category;
  }

  // Try splitting into words and matching each
  const words = lower.split(/\s+/);
  for (const word of words) {
    if (CATEGORY_MAP[word]) return CATEGORY_MAP[word];
  }

  return "📦 Other";
}

export function isIncomeKeyword(text: string): boolean {
  return /salary|income|freelance|cashback|refund|allowance|received|credited|interest|pocket\s*money|stipend|bonus/i.test(text);
}

export function getCategoryEmoji(category: string): string {
  return category.split(" ")[0] || "📦";
}
export function getCategoryName(category: string): string {
  return category.replace(/^[^\s]+\s/, "");
}

// For pie chart — group by category NAME (ignoring emoji differences)
export function normalizeCategoryForChart(category: string): string {
  return getCategoryName(category);
}

export const QUICK_CATEGORIES = [
  { emoji: "🍔", label: "Food", cat: "🍔 Food" },
  { emoji: "🛺", label: "Auto/Cab", cat: "🛺 Transport" },
  { emoji: "🛒", label: "Shopping", cat: "🛒 Shopping" },
  { emoji: "📱", label: "Bills", cat: "📱 Bills" },
  { emoji: "🏠", label: "Rent", cat: "🏠 Rent" },
  { emoji: "🎬", label: "Fun", cat: "🎬 Fun" },
  { emoji: "🥬", label: "Groceries", cat: "🥬 Groceries" },
  { emoji: "📚", label: "Education", cat: "📚 Education" },
  { emoji: "💊", label: "Health", cat: "💊 Health" },
  { emoji: "💇", label: "Personal", cat: "💇 Personal" },
  { emoji: "🎁", label: "Gifts", cat: "🎁 Gifts" },
  { emoji: "🏦", label: "EMI", cat: "🏦 EMI" },
];

export const CATEGORIES = [
  "🍔 Food", "🛺 Transport", "🛒 Shopping", "📱 Bills",
  "🏠 Rent", "🎬 Fun", "🥬 Groceries", "📚 Education",
  "💊 Health", "💇 Personal", "🎁 Gifts", "🏦 EMI", "📦 Other",
];
