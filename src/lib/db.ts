import Dexie, { type Table } from "dexie";

export interface Expense {
  id: string;
  amount: number;
  description: string;
  category: string;
  date: string;      // yyyy-MM-dd
  time: string;      // HH:mm
  createdAt: string;
}

export interface MonthlyBudget {
  id: string;
  month: string;     // yyyy-MM
  income: number;
}

class PaisaDB extends Dexie {
  expenses!: Table<Expense, string>;
  budgets!: Table<MonthlyBudget, string>;

  constructor() {
    super("PaisaSimple");
    this.version(1).stores({
      expenses: "id, date, category, createdAt",
      budgets: "id, month",
    });
  }
}

export const db = new PaisaDB();

// ── Smart category detection ──

const CATEGORY_MAP: Record<string, string> = {
  // Food
  breakfast: "🍳 Food", lunch: "🍱 Food", dinner: "🍽️ Food", snack: "🍿 Food",
  snacks: "🍿 Food", food: "🍔 Food", eat: "🍔 Food", biryani: "🍱 Food",
  pizza: "🍕 Food", burger: "🍔 Food", momos: "🍱 Food", dosa: "🍱 Food",
  thali: "🍱 Food", paratha: "🍱 Food", chai: "☕ Food", tea: "☕ Food",
  coffee: "☕ Food", juice: "🥤 Food", milk: "🥛 Food",
  swiggy: "🍔 Food", zomato: "🍔 Food", maggi: "🍜 Food",
  // Transport
  auto: "🛺 Transport", rickshaw: "🛺 Transport", uber: "🚗 Transport",
  ola: "🚗 Transport", cab: "🚗 Transport", bus: "🚌 Transport",
  metro: "🚇 Transport", train: "🚆 Transport", petrol: "⛽ Transport",
  fuel: "⛽ Transport", diesel: "⛽ Transport", rapido: "🏍️ Transport",
  // Shopping
  amazon: "🛒 Shopping", flipkart: "🛒 Shopping", myntra: "👕 Shopping",
  clothes: "👕 Shopping", shoes: "👟 Shopping", shopping: "🛒 Shopping",
  // Bills & Recharge
  recharge: "📱 Bills", phone: "📱 Bills", wifi: "📶 Bills",
  internet: "📶 Bills", electricity: "💡 Bills", water: "💧 Bills",
  rent: "🏠 Rent", airtel: "📱 Bills", jio: "📱 Bills",
  // Entertainment
  movie: "🎬 Fun", movies: "🎬 Fun", netflix: "📺 Fun", spotify: "🎵 Fun",
  game: "🎮 Fun", games: "🎮 Fun",
  // Groceries
  grocery: "🛒 Groceries", groceries: "🛒 Groceries", vegetables: "🥬 Groceries",
  fruits: "🍎 Groceries", blinkit: "🛒 Groceries", zepto: "🛒 Groceries",
  bigbasket: "🛒 Groceries",
  // Education
  book: "📚 Education", books: "📚 Education", course: "📚 Education",
  college: "🎓 Education", stationery: "✏️ Education", pen: "✏️ Education",
  // Health
  medicine: "💊 Health", doctor: "🏥 Health", gym: "💪 Health",
  // Personal
  haircut: "💇 Personal", salon: "💇 Personal",
  // Subscriptions
  subscription: "📱 Subscription",
};

export function guessCategory(text: string): string {
  const lower = text.toLowerCase();
  for (const [keyword, category] of Object.entries(CATEGORY_MAP)) {
    if (lower.includes(keyword)) return category;
  }
  return "📦 Other";
}

export function getCategoryEmoji(category: string): string {
  return category.split(" ")[0] || "📦";
}

export function getCategoryName(category: string): string {
  return category.replace(/^[^\s]+\s/, "");
}

// Predefined categories for the picker
export const CATEGORIES = [
  "🍔 Food", "☕ Food", "🛺 Transport", "🛒 Shopping", "📱 Bills",
  "🏠 Rent", "🎬 Fun", "🛒 Groceries", "📚 Education", "💊 Health",
  "💇 Personal", "📱 Subscription", "📦 Other",
];
