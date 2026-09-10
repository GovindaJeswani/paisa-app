import Dexie, { type Table } from "dexie";

export interface Expense {
  id: string;
  amount: number;
  description: string;
  category: string;
  type: "expense" | "income"; // NEW: track income too
  date: string;
  time: string;
  createdAt: string;
}

export interface Settings {
  id: string;
  monthlyBudget: number;     // monthly spending limit
  dailyBudget: number;       // daily spending limit
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
      // Migrate v1 expenses to have type field
      return tx.table("expenses").toCollection().modify((exp) => {
        if (!exp.type) exp.type = "expense";
      });
    });
  }
}

export const db = new PaisaDB();

// Init default settings
export async function initSettings() {
  const s = await db.settings.get("default");
  if (!s) await db.settings.put({ id: "default", monthlyBudget: 0, dailyBudget: 0 });
}

// ── Smart category detection ──

const CATEGORY_MAP: Record<string, string> = {
  breakfast: "🍳 Food", lunch: "🍱 Food", dinner: "🍽️ Food", snack: "🍿 Food",
  snacks: "🍿 Food", food: "🍔 Food", eat: "🍔 Food", biryani: "🍱 Food",
  pizza: "🍕 Food", burger: "🍔 Food", momos: "🍱 Food", dosa: "🍱 Food",
  thali: "🍱 Food", paratha: "🍱 Food", chai: "☕ Food", tea: "☕ Food",
  coffee: "☕ Food", juice: "🥤 Food", milk: "🥛 Food",
  swiggy: "🍔 Food", zomato: "🍔 Food", maggi: "🍜 Food",
  auto: "🛺 Transport", rickshaw: "🛺 Transport", uber: "🚗 Transport",
  ola: "🚗 Transport", cab: "🚗 Transport", bus: "🚌 Transport",
  metro: "🚇 Transport", train: "🚆 Transport", petrol: "⛽ Transport",
  fuel: "⛽ Transport", diesel: "⛽ Transport", rapido: "🏍️ Transport",
  amazon: "🛒 Shopping", flipkart: "🛒 Shopping", myntra: "👕 Shopping",
  clothes: "👕 Shopping", shoes: "👟 Shopping", shopping: "🛒 Shopping",
  recharge: "📱 Bills", phone: "📱 Bills", wifi: "📶 Bills",
  internet: "📶 Bills", electricity: "💡 Bills", water: "💧 Bills",
  rent: "🏠 Rent", airtel: "📱 Bills", jio: "📱 Bills",
  movie: "🎬 Fun", movies: "🎬 Fun", netflix: "📺 Fun", spotify: "🎵 Fun",
  game: "🎮 Fun", games: "🎮 Fun",
  grocery: "🛒 Groceries", groceries: "🛒 Groceries", vegetables: "🥬 Groceries",
  fruits: "🍎 Groceries", blinkit: "🛒 Groceries", zepto: "🛒 Groceries",
  bigbasket: "🛒 Groceries",
  book: "📚 Education", books: "📚 Education", course: "📚 Education",
  college: "🎓 Education", stationery: "✏️ Education",
  medicine: "💊 Health", doctor: "🏥 Health", gym: "💪 Health",
  haircut: "💇 Personal", salon: "💇 Personal",
  subscription: "📱 Subscription",
  // Income keywords
  salary: "💰 Salary", freelance: "💻 Freelance", cashback: "💸 Cashback",
  refund: "↩️ Refund", allowance: "🤝 Allowance", interest: "🏦 Interest",
};

export function guessCategory(text: string): string {
  const lower = text.toLowerCase();
  for (const [keyword, category] of Object.entries(CATEGORY_MAP)) {
    if (lower.includes(keyword)) return category;
  }
  return "📦 Other";
}

export function isIncomeKeyword(text: string): boolean {
  return /salary|income|freelance|cashback|refund|allowance|received|credited|interest|pocket\s*money/i.test(text);
}

export function getCategoryEmoji(category: string): string {
  return category.split(" ")[0] || "📦";
}
export function getCategoryName(category: string): string {
  return category.replace(/^[^\s]+\s/, "");
}

// Quick-add categories (emoji grid)
export const QUICK_CATEGORIES = [
  { emoji: "🍔", label: "Food", cat: "🍔 Food" },
  { emoji: "☕", label: "Chai/Coffee", cat: "☕ Food" },
  { emoji: "🛺", label: "Auto/Cab", cat: "🛺 Transport" },
  { emoji: "🚌", label: "Bus/Metro", cat: "🚌 Transport" },
  { emoji: "🛒", label: "Shopping", cat: "🛒 Shopping" },
  { emoji: "📱", label: "Bills", cat: "📱 Bills" },
  { emoji: "🏠", label: "Rent", cat: "🏠 Rent" },
  { emoji: "🎬", label: "Fun", cat: "🎬 Fun" },
  { emoji: "🥬", label: "Groceries", cat: "🛒 Groceries" },
  { emoji: "📚", label: "Education", cat: "📚 Education" },
  { emoji: "💊", label: "Health", cat: "💊 Health" },
  { emoji: "💇", label: "Personal", cat: "💇 Personal" },
];

export const CATEGORIES = [
  "🍔 Food", "☕ Food", "🛺 Transport", "🛒 Shopping", "📱 Bills",
  "🏠 Rent", "🎬 Fun", "🛒 Groceries", "📚 Education", "💊 Health",
  "💇 Personal", "📱 Subscription", "📦 Other",
];
