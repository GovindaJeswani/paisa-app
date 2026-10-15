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
  // V5 fields (optional for backward compat)
  categoryId?: string;         // new category system ID
  subcategoryId?: string;
  parentCategory?: string;     // parent category ID for grouping
  classification?: string;     // expense | income | transfer | investment | savings | credit_card_bill | loan_emi | lending | borrowing
  linkedCommitmentId?: string; // links to a recurring commitment
  linkedLoanId?: string;       // links to a loan record
}

export interface FriendSplit {
  id: string;
  friendName: string;
  amount: number;          // positive = they owe you, negative = you owe them
  description: string;
  date: string;
  settled: boolean;
  createdAt: string;
  linkedLoanId?: string;   // V5: link to a loan for conversion
}

export interface Settings {
  id: string;
  monthlyBudget: number;
  dailyBudget: number;
  reminderEnabled: boolean;
  defaultPaymentMode: string;
  hiddenHomeSections?: string[];  // V5: sections user has hidden
}

// ── V5: Recurring Commitments ──
export type CommitmentFrequency = "weekly" | "monthly" | "bimonthly" | "quarterly" | "halfyearly" | "yearly" | "custom";
export type CommitmentType = "bill" | "subscription" | "emi" | "sip" | "insurance" | "rent" | "other";
export type OccurrenceStatus = "upcoming" | "due_soon" | "paid" | "overdue" | "skipped" | "paused";

export interface Commitment {
  id: string;
  name: string;
  amount: number;
  categoryId: string;
  type: CommitmentType;
  frequency: CommitmentFrequency;
  customIntervalDays?: number;
  startDate: string;
  dueDay?: number;         // day of month (1-31)
  dueWindowStart?: number; // e.g. 1 (1st of month)
  dueWindowEnd?: number;   // e.g. 5 (5th of month)
  accountLabel?: string;
  notes?: string;
  isActive: boolean;
  createdAt: string;
}

export interface CommitmentOccurrence {
  id: string;
  commitmentId: string;
  dueDate: string;
  status: OccurrenceStatus;
  paidDate?: string;
  paidAmount?: number;
  linkedTransactionId?: string; // link to expense record
  notes?: string;
  createdAt: string;
}

// ── V5: Lending & Borrowing ──
export type LoanType = "lent" | "borrowed";
export type LoanStatus = "outstanding" | "partially_repaid" | "settled";

export interface Loan {
  id: string;
  personName: string;
  type: LoanType;          // lent = they owe me, borrowed = I owe them
  originalAmount: number;
  outstandingAmount: number;
  description: string;
  date: string;
  expectedRepayDate?: string;
  status: LoanStatus;
  notes?: string;
  createdAt: string;
}

export interface LoanRepayment {
  id: string;
  loanId: string;
  amount: number;
  date: string;
  notes?: string;
  createdAt: string;
}

// ── V5: Investment Tracking ──
export type InvestmentType = "sip" | "ipo" | "stock" | "mutual_fund" | "fd" | "rd" | "gold" | "other";
export type IPOStatus = "planned" | "applied" | "amount_blocked" | "allotted" | "partially_allotted" | "not_allotted" | "refund_pending" | "refunded" | "listed" | "cancelled";

export interface Investment {
  id: string;
  type: InvestmentType;
  name: string;
  amount: number;          // amount invested / applied
  date: string;
  // SIP fields
  frequency?: CommitmentFrequency;
  scheduledDay?: number;
  // IPO fields
  ipoStatus?: IPOStatus;
  amountBlocked?: number;
  amountAllotted?: number;
  refundAmount?: number;
  listingDate?: string;
  // Stock fields
  symbol?: string;
  quantity?: number;
  buyPrice?: number;
  sellPrice?: number;
  sellDate?: string;
  charges?: number;
  // Common
  accountLabel?: string;
  notes?: string;
  status: string;
  createdAt: string;
}

// ── V5: Custom Categories ──
export interface CustomCategory {
  id: string;
  name: string;
  parentId?: string;       // parent category ID
  icon: string;            // Lucide icon name
  color: string;
  isFavorite: boolean;
  sortOrder: number;
  createdAt: string;
}

class PaisaDB extends Dexie {
  expenses!: Table<Expense, string>;
  settings!: Table<Settings, string>;
  splits!: Table<FriendSplit, string>;
  commitments!: Table<Commitment, string>;
  occurrences!: Table<CommitmentOccurrence, string>;
  loans!: Table<Loan, string>;
  loanRepayments!: Table<LoanRepayment, string>;
  investments!: Table<Investment, string>;
  customCategories!: Table<CustomCategory, string>;

  constructor() {
    super("PaisaSimple");

    // V4: original schema (keep for users who haven't upgraded yet)
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

    // V5: add new tables + new indexes, preserve all existing data
    this.version(5).stores({
      expenses: "id, date, category, type, createdAt, isRecurring, categoryId, parentCategory, classification",
      settings: "id",
      splits: "id, friendName, settled, date, linkedLoanId",
      commitments: "id, type, categoryId, isActive",
      occurrences: "id, commitmentId, dueDate, status",
      loans: "id, personName, type, status, date",
      loanRepayments: "id, loanId, date",
      investments: "id, type, status, date",
      customCategories: "id, parentId, isFavorite, sortOrder",
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
// SMART CATEGORY ENGINE — 300+ keywords, Hindi/Hinglish, specific emojis
// ═══════════════════════════════════════════════════════

const CATEGORY_MAP: Record<string, string> = {
  // ── CHAI / COFFEE / DRINKS (specific emoji) ──
  chai: "☕ Chai/Coffee", tea: "☕ Chai/Coffee", coffee: "☕ Chai/Coffee",
  latte: "☕ Chai/Coffee", cappuccino: "☕ Chai/Coffee", espresso: "☕ Chai/Coffee",
  starbucks: "☕ Chai/Coffee", ccd: "☕ Chai/Coffee", "cafe coffee": "☕ Chai/Coffee",
  barista: "☕ Chai/Coffee",
  // Hindi
  chaai: "☕ Chai/Coffee", chay: "☕ Chai/Coffee",

  // ── FOOD — specific emojis ──
  breakfast: "🍳 Food", lunch: "🍱 Food", dinner: "🍽️ Food",
  snack: "🍿 Snacks", snacks: "🍿 Snacks", munchies: "🍿 Snacks",
  nashta: "🍳 Food", khana: "🍽️ Food", khaana: "🍽️ Food",
  bhojan: "🍽️ Food", tiffin: "🍱 Food", dabba: "🍱 Food",
  thali: "🍱 Food", mess: "🍱 Food", canteen: "🍱 Food",
  biryani: "🍛 Food", pulao: "🍛 Food",
  pizza: "🍕 Food", dominos: "🍕 Food", "pizza hut": "🍕 Food",
  burger: "🍔 Food", mcdonalds: "🍔 Food",
  momos: "🥟 Food", momo: "🥟 Food", dumpling: "🥟 Food",
  dosa: "🫓 Food", idli: "🫓 Food", uttapam: "🫓 Food", vada: "🫓 Food",
  paratha: "🫓 Food", roti: "🫓 Food", naan: "🫓 Food", puri: "🫓 Food",
  noodles: "🍜 Food", maggi: "🍜 Food", chowmein: "🍜 Food",
  pasta: "🍝 Food",
  samosa: "🥐 Food", kachori: "🥐 Food", pakora: "🥐 Food", pakoda: "🥐 Food",
  chaat: "🥘 Food", golgappa: "🥘 Food", pani: "🥘 Food", bhel: "🥘 Food",
  paneer: "🧀 Food", chicken: "🍗 Food", mutton: "🍖 Food", fish: "🐟 Food",
  egg: "🥚 Food", anda: "🥚 Food", omelette: "🥚 Food",
  rice: "🍚 Food", chawal: "🍚 Food", dal: "🫘 Food", rajma: "🫘 Food",
  chole: "🫘 Food", bhaji: "🥘 Food", sabji: "🥘 Food",
  sandwich: "🥪 Food", roll: "🌯 Food", rolls: "🌯 Food", wrap: "🌯 Food",
  cake: "🎂 Food", pastry: "🧁 Food", icecream: "🍦 Food", ice: "🍦 Food",
  chocolate: "🍫 Food", mithai: "🍬 Food", sweet: "🍬 Food",
  jalebi: "🍬 Food", gulab: "🍬 Food", ladoo: "🍬 Food", halwa: "🍬 Food",
  barfi: "🍬 Food", rasgulla: "🍬 Food",
  juice: "🧃 Food", lassi: "🥛 Food", smoothie: "🥤 Food", shake: "🥤 Food",
  milk: "🥛 Food", doodh: "🥛 Food", curd: "🥛 Food", dahi: "🥛 Food",
  soda: "🥤 Food", coke: "🥤 Food", pepsi: "🥤 Food", sprite: "🥤 Food",
  paani: "💧 Food", nimbu: "🍋 Food", shikanji: "🍋 Food",
  swiggy: "📦 Food", zomato: "📦 Food",
  kfc: "🍗 Food", subway: "🥪 Food", haldirams: "🍬 Food",
  restaurant: "🍽️ Food", dhaba: "🍽️ Food", hotel: "🍽️ Food",
  eat: "🍽️ Food", eating: "🍽️ Food", food: "🍽️ Food",

  // ── TRANSPORT — specific emojis ──
  auto: "🛺 Transport", rickshaw: "🛺 Transport", tuk: "🛺 Transport",
  uber: "🚖 Transport", ola: "🚖 Transport", cab: "🚖 Transport", taxi: "🚖 Transport",
  rapido: "🏍️ Transport", bike: "🏍️ Transport",
  bus: "🚌 Transport", metro: "🚇 Transport", local: "🚇 Transport",
  train: "🚆 Transport", irctc: "🚆 Transport", railway: "🚆 Transport",
  flight: "✈️ Transport", hawa: "✈️ Transport",
  petrol: "⛽ Transport", fuel: "⛽ Transport", diesel: "⛽ Transport", cng: "⛽ Transport",
  toll: "🛣️ Transport", parking: "🅿️ Transport",
  fare: "🛺 Transport", ride: "🛺 Transport", kiraya: "🛺 Transport",
  redbus: "🚌 Transport", travel: "✈️ Transport", safar: "✈️ Transport",

  // ── SHOPPING ──
  amazon: "📦 Shopping", flipkart: "📦 Shopping", myntra: "👗 Shopping",
  ajio: "👗 Shopping", meesho: "📦 Shopping", nykaa: "💄 Shopping",
  clothes: "👕 Shopping", kapde: "👕 Shopping", shoes: "👟 Shopping",
  jute: "👟 Shopping", chappal: "🩴 Shopping",
  shirt: "👕 Shopping", jeans: "👖 Shopping", dress: "👗 Shopping", kurta: "👕 Shopping",
  watch: "⌚ Shopping", bag: "🎒 Shopping", backpack: "🎒 Shopping",
  perfume: "🧴 Shopping", makeup: "💄 Shopping", cosmetics: "💄 Shopping",
  shopping: "🛍️ Shopping", mall: "🏬 Shopping", market: "🏪 Shopping",
  bazaar: "🏪 Shopping", dukaan: "🏪 Shopping",
  earphones: "🎧 Shopping", headphones: "🎧 Shopping",
  phone: "📱 Shopping", mobile: "📱 Shopping", charger: "🔌 Shopping",

  // ── GROCERIES ──
  grocery: "🛒 Groceries", groceries: "🛒 Groceries", ration: "🛒 Groceries",
  vegetables: "🥬 Groceries", sabzi: "🥬 Groceries",
  fruits: "🍎 Groceries", phal: "🍎 Groceries",
  atta: "🌾 Groceries", flour: "🌾 Groceries",
  oil: "🫒 Groceries", tel: "🫒 Groceries",
  sugar: "🧂 Groceries", cheeni: "🧂 Groceries", namak: "🧂 Groceries",
  masala: "🌶️ Groceries", mirch: "🌶️ Groceries",
  blinkit: "🛒 Groceries", zepto: "🛒 Groceries", bigbasket: "🛒 Groceries",
  instamart: "🛒 Groceries", dmart: "🛒 Groceries",
  kirana: "🏪 Groceries", bread: "🍞 Groceries", butter: "🧈 Groceries",

  // ── BILLS ──
  recharge: "📶 Bills", wifi: "📶 Bills", internet: "📶 Bills", broadband: "📶 Bills",
  electricity: "💡 Bills", bijli: "💡 Bills",
  "water bill": "💧 Bills",
  airtel: "📶 Bills", jio: "📶 Bills", vi: "📶 Bills", bsnl: "📶 Bills",
  maintenance: "🏢 Bills", gas: "🔥 Bills",

  // ── RENT ──
  rent: "🏠 Rent", pg: "🏠 Rent", hostel: "🏠 Rent",
  room: "🏠 Rent", kamra: "🏠 Rent", flat: "🏠 Rent",

  // ── FUN / ENTERTAINMENT ──
  movie: "🎬 Fun", movies: "🎬 Fun", cinema: "🎬 Fun", pvr: "🎬 Fun", inox: "🎬 Fun",
  netflix: "📺 Fun", hotstar: "📺 Fun", prime: "📺 Fun", disney: "📺 Fun",
  spotify: "🎵 Fun", youtube: "📺 Fun",
  game: "🎮 Fun", games: "🎮 Fun", gaming: "🎮 Fun",
  bowling: "🎳 Fun", pool: "🎱 Fun", billiards: "🎱 Fun",
  party: "🎉 Fun", celebration: "🎉 Fun",
  pub: "🍺 Fun", bar: "🍺 Fun", beer: "🍺 Fun", daaru: "🍺 Fun",
  drinks: "🍺 Fun", drink: "🍺 Fun", hookah: "💨 Fun",
  outing: "🎡 Fun", trip: "🏖️ Fun", vacation: "🏖️ Fun", ghoomna: "🏖️ Fun",
  subscription: "📺 Fun", masti: "🎉 Fun",

  // ── EDUCATION ──
  book: "📖 Education", books: "📖 Education", kitab: "📖 Education",
  course: "💻 Education", coaching: "📝 Education", tuition: "📝 Education",
  college: "🎓 Education", university: "🎓 Education", school: "🏫 Education",
  udemy: "💻 Education", coursera: "💻 Education",
  stationery: "✏️ Education", pen: "✏️ Education", notebook: "📓 Education",
  xerox: "🖨️ Education", photocopy: "🖨️ Education", print: "🖨️ Education",
  exam: "📝 Education", fee: "🎓 Education", fees: "🎓 Education",
  padhai: "📖 Education", pariksha: "📝 Education",

  // ── HEALTH ──
  medicine: "💊 Health", dawai: "💊 Health", doctor: "👨‍⚕️ Health",
  hospital: "🏥 Health", aspatal: "🏥 Health",
  pharmacy: "💊 Health", medical: "🏥 Health",
  gym: "🏋️ Health", fitness: "🏋️ Health", kasrat: "🏋️ Health",
  yoga: "🧘 Health",
  dental: "🦷 Health", dentist: "🦷 Health",
  "1mg": "💊 Health", pharmeasy: "💊 Health", apollo: "🏥 Health",

  // ── PERSONAL ──
  haircut: "💈 Personal", salon: "💈 Personal", parlour: "💈 Personal",
  nai: "💈 Personal", baal: "💈 Personal",
  spa: "💆 Personal", massage: "💆 Personal", malish: "💆 Personal",
  laundry: "👔 Personal", dhobi: "👔 Personal", ironing: "👔 Personal",
  grooming: "💈 Personal",

  // ── GIFTS ──
  gift: "🎁 Gifts", tohfa: "🎁 Gifts", birthday: "🎂 Gifts",
  wedding: "💒 Gifts", shaadi: "💒 Gifts", shagun: "🧧 Gifts",
  donation: "🙏 Gifts", daan: "🙏 Gifts",
  festival: "🪔 Gifts", diwali: "🪔 Gifts", holi: "🎨 Gifts",
  rakhi: "🧶 Gifts", eid: "🌙 Gifts",
  temple: "🛕 Gifts", mandir: "🛕 Gifts", masjid: "🕌 Gifts",
  gurudwara: "⛩️ Gifts", church: "⛪ Gifts",

  // ── EMI / LOANS ──
  emi: "🏦 EMI", loan: "🏦 EMI", karz: "🏦 EMI",
  installment: "🏦 EMI", "credit card": "💳 EMI", "card bill": "💳 EMI",

  // ── INCOME ──
  salary: "💰 Salary", tankhah: "💰 Salary", income: "💰 Salary",
  freelance: "💻 Freelance", cashback: "💸 Cashback",
  refund: "↩️ Refund", wapsi: "↩️ Refund",
  allowance: "🤝 Allowance", "pocket money": "🤝 Allowance",
  stipend: "💰 Salary", bonus: "💰 Salary", inam: "💰 Salary",
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
  { emoji: "🍽️", label: "Food", cat: "🍽️ Food" },
  { emoji: "☕", label: "Chai", cat: "☕ Chai/Coffee" },
  { emoji: "🍿", label: "Snacks", cat: "🍿 Snacks" },
  { emoji: "🛺", label: "Auto/Cab", cat: "🛺 Transport" },
  { emoji: "🛍️", label: "Shopping", cat: "🛍️ Shopping" },
  { emoji: "📶", label: "Bills", cat: "📶 Bills" },
  { emoji: "🏠", label: "Rent", cat: "🏠 Rent" },
  { emoji: "🎬", label: "Fun", cat: "🎬 Fun" },
  { emoji: "🛒", label: "Groceries", cat: "🛒 Groceries" },
  { emoji: "📖", label: "Education", cat: "📖 Education" },
  { emoji: "💊", label: "Health", cat: "💊 Health" },
  { emoji: "💈", label: "Personal", cat: "💈 Personal" },
];

export const CATEGORIES = [
  "🍽️ Food", "☕ Chai/Coffee", "🍿 Snacks", "🛺 Transport", "🛍️ Shopping",
  "📶 Bills", "🏠 Rent", "🎬 Fun", "🛒 Groceries", "📖 Education",
  "💊 Health", "💈 Personal", "🎁 Gifts", "🏦 EMI", "📦 Other",
];

export const PAYMENT_MODES = [
  { value: "upi", label: "UPI", emoji: "UPI" },
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
