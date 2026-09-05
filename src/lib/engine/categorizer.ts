import { db } from "../db";
import type { Category, MerchantMapping } from "../types";

// --- Built-in merchant → category knowledge ---

const MERCHANT_CATEGORY_MAP: Record<string, { category: string; subcategory?: string }> = {
  // Food delivery
  swiggy: { category: "Food", subcategory: "Delivery" },
  zomato: { category: "Food", subcategory: "Delivery" },
  "uber eats": { category: "Food", subcategory: "Delivery" },
  dunzo: { category: "Food", subcategory: "Delivery" },
  blinkit: { category: "Groceries", subcategory: "Quick Commerce" },
  zepto: { category: "Groceries", subcategory: "Quick Commerce" },
  bigbasket: { category: "Groceries" },
  "jio mart": { category: "Groceries" },
  instamart: { category: "Groceries", subcategory: "Quick Commerce" },
  // Transport
  uber: { category: "Transport", subcategory: "Ride" },
  ola: { category: "Transport", subcategory: "Ride" },
  rapido: { category: "Transport", subcategory: "Ride" },
  metro: { category: "Transport", subcategory: "Metro" },
  irctc: { category: "Travel", subcategory: "Train" },
  redbus: { category: "Travel", subcategory: "Bus" },
  // Shopping
  amazon: { category: "Shopping" },
  flipkart: { category: "Shopping" },
  myntra: { category: "Shopping", subcategory: "Fashion" },
  ajio: { category: "Shopping", subcategory: "Fashion" },
  meesho: { category: "Shopping" },
  nykaa: { category: "Shopping", subcategory: "Beauty" },
  // Subscriptions
  netflix: { category: "Subscriptions", subcategory: "Streaming" },
  hotstar: { category: "Subscriptions", subcategory: "Streaming" },
  "disney+": { category: "Subscriptions", subcategory: "Streaming" },
  spotify: { category: "Subscriptions", subcategory: "Music" },
  "youtube premium": { category: "Subscriptions", subcategory: "Streaming" },
  "amazon prime": { category: "Subscriptions", subcategory: "Streaming" },
  "apple music": { category: "Subscriptions", subcategory: "Music" },
  jio: { category: "Bills", subcategory: "Phone" },
  airtel: { category: "Bills", subcategory: "Phone" },
  vi: { category: "Bills", subcategory: "Phone" },
  // Fuel
  hp: { category: "Fuel" },
  "indian oil": { category: "Fuel" },
  "bharat petroleum": { category: "Fuel" },
  bpcl: { category: "Fuel" },
  // Coffee & Quick bites
  starbucks: { category: "Food", subcategory: "Coffee" },
  "cafe coffee day": { category: "Food", subcategory: "Coffee" },
  ccd: { category: "Food", subcategory: "Coffee" },
  "mcdonald's": { category: "Food", subcategory: "Fast Food" },
  mcdonalds: { category: "Food", subcategory: "Fast Food" },
  kfc: { category: "Food", subcategory: "Fast Food" },
  dominos: { category: "Food", subcategory: "Fast Food" },
  "pizza hut": { category: "Food", subcategory: "Fast Food" },
  subway: { category: "Food", subcategory: "Fast Food" },
  // Utilities
  electricity: { category: "Utilities" },
  water: { category: "Utilities" },
  gas: { category: "Utilities" },
  wifi: { category: "Bills", subcategory: "Internet" },
  broadband: { category: "Bills", subcategory: "Internet" },
  // Healthcare
  pharmacy: { category: "Healthcare" },
  "1mg": { category: "Healthcare", subcategory: "Pharmacy" },
  pharmeasy: { category: "Healthcare", subcategory: "Pharmacy" },
  apollo: { category: "Healthcare" },
  practo: { category: "Healthcare" },
};

// Keyword → category mapping for when merchant isn't recognized
const KEYWORD_CATEGORY_MAP: Record<string, string> = {
  food: "Food",
  eat: "Food",
  dinner: "Food",
  lunch: "Food",
  breakfast: "Food",
  coffee: "Food",
  tea: "Food",
  snack: "Food",
  restaurant: "Food",
  biryani: "Food",
  pizza: "Food",
  burger: "Food",
  chai: "Food",
  grocery: "Groceries",
  groceries: "Groceries",
  vegetables: "Groceries",
  fruits: "Groceries",
  milk: "Groceries",
  cab: "Transport",
  auto: "Transport",
  rickshaw: "Transport",
  bus: "Transport",
  train: "Transport",
  petrol: "Fuel",
  diesel: "Fuel",
  fuel: "Fuel",
  rent: "Rent",
  electricity: "Utilities",
  water: "Utilities",
  gas: "Utilities",
  wifi: "Bills",
  internet: "Bills",
  phone: "Bills",
  recharge: "Bills",
  movie: "Entertainment",
  cinema: "Entertainment",
  game: "Entertainment",
  doctor: "Healthcare",
  hospital: "Healthcare",
  medicine: "Healthcare",
  medical: "Healthcare",
  book: "Education",
  course: "Education",
  tuition: "Education",
  college: "Education",
  school: "Education",
  clothes: "Shopping",
  shoes: "Shopping",
  shirt: "Shopping",
  shopping: "Shopping",
  subscription: "Subscriptions",
  insurance: "Insurance",
  emi: "EMI",
  loan: "EMI",
  gift: "Gifts",
  present: "Gifts",
  trip: "Travel",
  flight: "Travel",
  hotel: "Travel",
  travel: "Travel",
  salon: "Personal",
  haircut: "Personal",
  gym: "Personal",
  salary: "Salary",
  freelance: "Freelance",
  cashback: "Cashback",
  refund: "Refund",
  interest: "Interest",
  invested: "Investments",
  sip: "Investments",
  "mutual fund": "Investments",
  save: "Savings",
  saved: "Savings",
  saving: "Savings",
};

export async function categorizeMerchant(
  merchant: string
): Promise<{ categoryId: string; subcategory?: string; confidence: number } | null> {
  const normalized = merchant.toLowerCase().trim();

  // 1. Check user-learned mappings first (highest priority)
  const userMapping = await db.merchantMappings
    .where("merchant")
    .equalsIgnoreCase(normalized)
    .first();

  if (userMapping && userMapping.confidence > 50) {
    return {
      categoryId: userMapping.categoryId,
      subcategory: userMapping.subcategory,
      confidence: Math.min(95, userMapping.confidence),
    };
  }

  // 2. Check built-in merchant map
  for (const [key, value] of Object.entries(MERCHANT_CATEGORY_MAP)) {
    if (normalized.includes(key) || key.includes(normalized)) {
      const category = await db.categories
        .filter((c) => c.name.toLowerCase() === value.category.toLowerCase())
        .first();
      if (category) {
        return {
          categoryId: category.id,
          subcategory: value.subcategory,
          confidence: 85,
        };
      }
    }
  }

  return null;
}

export async function categorizeByKeywords(
  text: string
): Promise<{ categoryId: string; confidence: number } | null> {
  const normalized = text.toLowerCase();
  const words = normalized.split(/\s+/);

  // Check multi-word keywords first
  for (const [keyword, categoryName] of Object.entries(KEYWORD_CATEGORY_MAP)) {
    if (keyword.includes(" ") && normalized.includes(keyword)) {
      const category = await db.categories
        .filter((c) => c.name.toLowerCase() === categoryName.toLowerCase())
        .first();
      if (category) {
        return { categoryId: category.id, confidence: 70 };
      }
    }
  }

  // Then single-word keywords
  for (const word of words) {
    const categoryName = KEYWORD_CATEGORY_MAP[word];
    if (categoryName) {
      const category = await db.categories
        .filter((c) => c.name.toLowerCase() === categoryName.toLowerCase())
        .first();
      if (category) {
        return { categoryId: category.id, confidence: 60 };
      }
    }
  }

  return null;
}

export async function learnFromCorrection(
  merchant: string,
  categoryId: string,
  subcategory?: string
): Promise<void> {
  const normalized = merchant.toLowerCase().trim();
  if (!normalized) return;

  const existing = await db.merchantMappings
    .where("merchant")
    .equalsIgnoreCase(normalized)
    .first();

  if (existing) {
    await db.merchantMappings.update(existing.id, {
      categoryId,
      subcategory,
      confidence: Math.min(99, existing.confidence + 10),
      timesUsed: existing.timesUsed + 1,
      lastUsed: new Date().toISOString(),
    });
  } else {
    await db.merchantMappings.put({
      id: `mm_${Date.now()}`,
      merchant: normalized,
      categoryId,
      subcategory,
      confidence: 70,
      timesUsed: 1,
      lastUsed: new Date().toISOString(),
    });
  }
}
