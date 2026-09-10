import Dexie, { type Table } from "dexie";

export interface Expense {
  id: string;
  amount: number;
  description: string;
  category: string;
  type: "expense" | "income";
  date: string;
  time: string;
  location?: string;
  paymentMode?: "upi" | "cash" | "card" | "netbanking" | "wallet" | "other";
  photoUrl?: string;
  isRecurring?: boolean;
  recurringDay?: number;
  tags?: string[];
  createdAt: string;
}

export interface FriendSplit {
  id: string;
  friendName: string;
  amount: number;          // positive = they owe you, negative = you owe them
  description: string;
  date: string;
  settled: boolean;
  createdAt: string;
}

export interface Settings {
  id: string;
  monthlyBudget: number;
  dailyBudget: number;
  reminderEnabled: boolean;
  defaultPaymentMode: string;
}

class PaisaDB extends Dexie {
  expenses!: Table<Expense, string>;
  settings!: Table<Settings, string>;
  splits!: Table<FriendSplit, string>;

  constructor() {
    super("PaisaSimple");
    this.version(4).stores({
      expenses: "id, date, category, type, createdAt, isRecurring",
      settings: "id",
      splits: "id, friendName, settled, date",
    }).upgrade((tx) => {
      return tx.table("expenses").toCollection().modify((exp) => {
        if (!exp.type) exp.type = "expense";
        if (!exp.paymentMode) exp.paymentMode = "upi";
      });
    });
  }
}

export const db = new PaisaDB();

export async function initSettings() {
  const s = await db.settings.get("default");
  if (!s) await db.settings.put({ id: "default", monthlyBudget: 0, dailyBudget: 0, reminderEnabled: true, defaultPaymentMode: "upi" });
}

export async function getSettings(): Promise<Settings> {
  const s = await db.settings.get("default");
  return s || { id: "default", monthlyBudget: 0, dailyBudget: 0, reminderEnabled: true, defaultPaymentMode: "upi" };
}

// ═══════════════════════════════════════════════════════
// SMART CATEGORY ENGINE — 200+ Indian keywords
// ═══════════════════════════════════════════════════════

const CATEGORY_MAP: Record<string, string> = {
  // FOOD
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
  chaat: "🍔 Food", golgappa: "🍔 Food", bhel: "🍔 Food",
  cake: "🍔 Food", pastry: "🍔 Food", icecream: "🍔 Food",
  chocolate: "🍔 Food", sweet: "🍔 Food", mithai: "🍔 Food",
  jalebi: "🍔 Food", halwa: "🍔 Food",
  chai: "🍔 Food", tea: "🍔 Food", coffee: "🍔 Food", juice: "🍔 Food",
  milk: "🍔 Food", lassi: "🍔 Food", smoothie: "🍔 Food", shake: "🍔 Food",
  soda: "🍔 Food", coke: "🍔 Food", pepsi: "🍔 Food",
  swiggy: "🍔 Food", zomato: "🍔 Food",
  dominos: "🍔 Food", mcdonalds: "🍔 Food", kfc: "🍔 Food", subway: "🍔 Food",
  starbucks: "🍔 Food", ccd: "🍔 Food", haldirams: "🍔 Food",
  restaurant: "🍔 Food", dhaba: "🍔 Food", canteen: "🍔 Food", mess: "🍔 Food",
  tiffin: "🍔 Food", dabba: "🍔 Food",
  // TRANSPORT
  auto: "🛺 Transport", rickshaw: "🛺 Transport", uber: "🛺 Transport",
  ola: "🛺 Transport", cab: "🛺 Transport", taxi: "🛺 Transport",
  bus: "🛺 Transport", metro: "🛺 Transport", train: "🛺 Transport",
  rapido: "🛺 Transport", petrol: "🛺 Transport", fuel: "🛺 Transport",
  diesel: "🛺 Transport", toll: "🛺 Transport", parking: "🛺 Transport",
  flight: "🛺 Transport", fare: "🛺 Transport", ride: "🛺 Transport",
  // SHOPPING
  amazon: "🛒 Shopping", flipkart: "🛒 Shopping", myntra: "🛒 Shopping",
  ajio: "🛒 Shopping", meesho: "🛒 Shopping", nykaa: "🛒 Shopping",
  clothes: "🛒 Shopping", shoes: "🛒 Shopping", shirt: "🛒 Shopping",
  jeans: "🛒 Shopping", dress: "🛒 Shopping", watch: "🛒 Shopping",
  bag: "🛒 Shopping", backpack: "🛒 Shopping", perfume: "🛒 Shopping",
  makeup: "🛒 Shopping", shopping: "🛒 Shopping", mall: "🛒 Shopping",
  earphones: "🛒 Shopping", headphones: "🛒 Shopping", charger: "🛒 Shopping",
  // GROCERIES
  grocery: "🥬 Groceries", groceries: "🥬 Groceries", vegetables: "🥬 Groceries",
  fruits: "🥬 Groceries", sabzi: "🥬 Groceries", atta: "🥬 Groceries",
  oil: "🥬 Groceries", sugar: "🥬 Groceries", masala: "🥬 Groceries",
  blinkit: "🥬 Groceries", zepto: "🥬 Groceries", bigbasket: "🥬 Groceries",
  instamart: "🥬 Groceries", dmart: "🥬 Groceries", kirana: "🥬 Groceries",
  bread: "🥬 Groceries", butter: "🥬 Groceries", curd: "🥬 Groceries",
  // BILLS
  recharge: "📱 Bills", wifi: "📱 Bills", internet: "📱 Bills",
  electricity: "📱 Bills", airtel: "📱 Bills", jio: "📱 Bills",
  vi: "📱 Bills", broadband: "📱 Bills", maintenance: "📱 Bills",
  // RENT
  rent: "🏠 Rent", pg: "🏠 Rent", hostel: "🏠 Rent", room: "🏠 Rent",
  // FUN
  movie: "🎬 Fun", movies: "🎬 Fun", cinema: "🎬 Fun", pvr: "🎬 Fun",
  netflix: "🎬 Fun", spotify: "🎬 Fun", hotstar: "🎬 Fun",
  game: "🎬 Fun", games: "🎬 Fun", gaming: "🎬 Fun", bowling: "🎬 Fun",
  pool: "🎬 Fun", arcade: "🎬 Fun", concert: "🎬 Fun", ticket: "🎬 Fun",
  party: "🎬 Fun", pub: "🎬 Fun", bar: "🎬 Fun", beer: "🎬 Fun",
  drinks: "🎬 Fun", hookah: "🎬 Fun", outing: "🎬 Fun", trip: "🎬 Fun",
  subscription: "🎬 Fun",
  // EDUCATION
  book: "📚 Education", books: "📚 Education", course: "📚 Education",
  college: "📚 Education", tuition: "📚 Education", coaching: "📚 Education",
  udemy: "📚 Education", stationery: "📚 Education", pen: "📚 Education",
  xerox: "📚 Education", photocopy: "📚 Education", print: "📚 Education",
  exam: "📚 Education", fee: "📚 Education", fees: "📚 Education",
  // HEALTH
  medicine: "💊 Health", doctor: "💊 Health", hospital: "💊 Health",
  pharmacy: "💊 Health", gym: "💊 Health", fitness: "💊 Health",
  dental: "💊 Health", "1mg": "💊 Health", pharmeasy: "💊 Health",
  // PERSONAL
  haircut: "💇 Personal", salon: "💇 Personal", spa: "💇 Personal",
  grooming: "💇 Personal", laundry: "💇 Personal", ironing: "💇 Personal",
  // GIFTS
  gift: "🎁 Gifts", birthday: "🎁 Gifts", present: "🎁 Gifts",
  wedding: "🎁 Gifts", shagun: "🎁 Gifts", donation: "🎁 Gifts",
  festival: "🎁 Gifts", diwali: "🎁 Gifts", rakhi: "🎁 Gifts",
  // EMI
  emi: "🏦 EMI", loan: "🏦 EMI", installment: "🏦 EMI",
  // INCOME
  salary: "💰 Salary", income: "💰 Salary", freelance: "💻 Freelance",
  cashback: "💸 Cashback", refund: "↩️ Refund", allowance: "🤝 Allowance",
  interest: "🏦 Interest", stipend: "💰 Salary", bonus: "💰 Salary",
};

export function guessCategory(text: string): string {
  const lower = text.toLowerCase().trim();
  if (CATEGORY_MAP[lower]) return CATEGORY_MAP[lower];
  for (const [keyword, category] of Object.entries(CATEGORY_MAP)) {
    if (lower.includes(keyword)) return category;
  }
  const words = lower.split(/\s+/);
  for (const word of words) { if (CATEGORY_MAP[word]) return CATEGORY_MAP[word]; }
  return "📦 Other";
}

export function isIncomeKeyword(text: string): boolean {
  return /salary|income|freelance|cashback|refund|allowance|received|credited|interest|pocket\s*money|stipend|bonus/i.test(text);
}

export function getCategoryEmoji(c: string): string { return c.split(" ")[0] || "📦"; }
export function getCategoryName(c: string): string { return c.replace(/^[^\s]+\s/, ""); }
export function normalizeCategoryForChart(c: string): string { return getCategoryName(c); }

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

export const PAYMENT_MODES = [
  { value: "upi", label: "UPI", emoji: "📱" },
  { value: "cash", label: "Cash", emoji: "💵" },
  { value: "card", label: "Card", emoji: "💳" },
  { value: "netbanking", label: "Net Banking", emoji: "🏦" },
  { value: "wallet", label: "Wallet", emoji: "👛" },
] as const;

// ── Notification/reminder tips ──
export const REMINDER_MESSAGES = [
  "💸 Don't forget to log today's expenses!",
  "📝 Quick check — did you track everything today?",
  "🧾 Any spending today? Log it before you forget!",
  "💰 Track now, thank yourself later!",
  "📊 Your future self wants you to log this expense",
  "🎯 Consistency is key — add today's expenses",
  "🔥 Keep your streak alive! Log an expense",
];

export const NIGHT_MESSAGES = [
  "🌙 Good night! Here's your daily spending wrap-up",
  "✨ End of day — did you capture all expenses?",
  "🌟 One last thing — log anything you missed today",
  "💤 Before sleep, check if today's expenses are complete",
  "🌙 Quick review: did all your spending get logged?",
];

export const FUN_FACTS = [
  "💡 Indians spend ₹3.5 lakh crore annually on food delivery apps",
  "📱 UPI processed 14 billion transactions in a single month (2024)",
  "☕ The average Indian spends ₹35,000/year on tea and coffee",
  "🛺 Auto fares have increased 40% in the last 5 years",
  "📊 People who track expenses save 15-20% more money",
  "🎬 Netflix costs you ₹7,788/year — that's a flight to Goa",
  "🍔 Ordering food 3x/week = ₹45,000/year extra vs cooking",
  "💳 Credit card users spend 12-18% more than cash users",
  "🏠 Rent is the biggest expense for 65% of young Indians",
  "📈 ₹500/month SIP for 10 years at 12% = ₹1.16 lakh",
  "🛒 Impulse purchases account for 40% of online shopping",
  "⛽ Carpooling saves ₹2,000-4,000/month on commute",
];
