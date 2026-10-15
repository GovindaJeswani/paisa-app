/**
 * categories.ts — Centralized category registry with Lucide icons and hierarchy.
 *
 * Every category and subcategory is defined here once.
 * All pages, analytics, and pickers reference this single source of truth.
 *
 * Migration note: existing expenses store categories as emoji strings like "🍽️ Food".
 * The `legacyMap` maps old strings → new category IDs for backward compatibility.
 */

// ============================================================
// TYPES
// ============================================================

export interface CategoryDef {
  id: string;           // unique slug: "food", "transport", etc.
  name: string;         // display name
  icon: string;         // Lucide icon name
  color: string;        // Tailwind/CSS color value
  colorBg: string;      // background color (low opacity)
  emoji: string;        // fallback emoji for quick display
  subcategories: SubcategoryDef[];
}

export interface SubcategoryDef {
  id: string;           // unique slug: "food.delivery", "transport.metro", etc.
  name: string;
  icon: string;         // Lucide icon name
  keywords: string[];   // for auto-categorization
}

export type TransactionClassification =
  | "expense"           // ordinary purchase
  | "income"            // salary, freelance, etc.
  | "transfer"          // between own accounts
  | "savings"           // savings contribution
  | "investment"        // SIP, stocks, IPO, FD, etc.
  | "credit_card_bill"  // paying a credit card bill
  | "loan_emi"          // loan EMI payment
  | "lending"           // money lent to someone
  | "borrowing";        // money borrowed from someone

// ============================================================
// CATEGORY DEFINITIONS
// ============================================================

export const CATEGORY_REGISTRY: CategoryDef[] = [
  // ── A. FOOD & DINING ──
  {
    id: "food", name: "Food & Dining", icon: "Utensils", color: "#EF4444", colorBg: "rgba(239,68,68,0.1)", emoji: "🍽️",
    subcategories: [
      { id: "food.groceries", name: "Groceries", icon: "ShoppingBasket", keywords: ["grocery", "groceries", "ration", "blinkit", "zepto", "bigbasket", "instamart", "dmart", "kirana"] },
      { id: "food.vegetables", name: "Vegetables & Fruits", icon: "Apple", keywords: ["vegetables", "sabzi", "fruits", "phal", "sabji"] },
      { id: "food.milk", name: "Milk & Dairy", icon: "Milk", keywords: ["milk", "doodh", "curd", "dahi", "paneer", "cheese", "butter"] },
      { id: "food.restaurants", name: "Restaurants", icon: "UtensilsCrossed", keywords: ["restaurant", "dhaba", "hotel", "dining", "dinner", "lunch", "breakfast", "thali", "mess", "canteen"] },
      { id: "food.delivery", name: "Food Delivery", icon: "Bike", keywords: ["swiggy", "zomato", "food delivery", "order food"] },
      { id: "food.street", name: "Street Food", icon: "Flame", keywords: ["chaat", "golgappa", "pani puri", "bhel", "samosa", "kachori", "pakora", "momos", "vada pav"] },
      { id: "food.cafe", name: "Cafes / Coffee", icon: "Coffee", keywords: ["chai", "tea", "coffee", "latte", "cappuccino", "espresso", "starbucks", "ccd", "cafe", "barista", "chaai"] },
      { id: "food.snacks", name: "Snacks", icon: "Cookie", keywords: ["snack", "snacks", "munchies", "chips", "biscuit", "nashta"] },
      { id: "food.canteen", name: "Office / College Canteen", icon: "Building2", keywords: ["canteen", "mess", "tiffin", "dabba"] },
      { id: "food.friends", name: "Dining with Friends", icon: "Users", keywords: ["treat", "party food", "group dinner"] },
      { id: "food.bakery", name: "Bakery", icon: "CakeSlice", keywords: ["bakery", "cake", "pastry", "bread", "cookies"] },
      { id: "food.beverages", name: "Water / Beverages", icon: "GlassWater", keywords: ["water", "juice", "soda", "coke", "pepsi", "lassi", "smoothie", "shake", "nimbu", "shikanji"] },
    ],
  },
  // ── B. PERSONAL CARE ──
  {
    id: "personal_care", name: "Personal Care", icon: "Scissors", color: "#EC4899", colorBg: "rgba(236,72,153,0.1)", emoji: "💈",
    subcategories: [
      { id: "personal_care.haircut", name: "Haircut / Barber", icon: "Scissors", keywords: ["haircut", "barber", "nai", "baal", "trim"] },
      { id: "personal_care.haircare", name: "Haircare", icon: "Sparkles", keywords: ["shampoo", "conditioner", "hair oil", "haircare"] },
      { id: "personal_care.skincare", name: "Skincare", icon: "Droplets", keywords: ["skincare", "face wash", "moisturizer", "sunscreen", "cream"] },
      { id: "personal_care.grooming", name: "Beauty / Grooming", icon: "Sparkle", keywords: ["grooming", "beauty", "makeup", "cosmetics", "nykaa"] },
      { id: "personal_care.salon", name: "Salon / Spa", icon: "Bath", keywords: ["salon", "parlour", "spa", "massage", "malish", "facial"] },
      { id: "personal_care.cosmetics", name: "Cosmetics", icon: "Palette", keywords: ["cosmetics", "makeup", "lipstick", "foundation", "perfume"] },
      { id: "personal_care.hygiene", name: "Personal Hygiene", icon: "ShieldCheck", keywords: ["soap", "toothpaste", "deodorant", "hygiene", "sanitizer"] },
      { id: "personal_care.dental", name: "Dental Care", icon: "SmilePlus", keywords: ["dental", "toothbrush", "mouthwash", "floss"] },
      { id: "personal_care.laundry", name: "Laundry / Dry Cleaning", icon: "Shirt", keywords: ["laundry", "dhobi", "ironing", "dry clean", "washing"] },
      { id: "personal_care.tailoring", name: "Tailoring / Alterations", icon: "Ruler", keywords: ["tailor", "alteration", "stitching", "darzi"] },
      { id: "personal_care.products", name: "Personal Care Products", icon: "Package", keywords: ["personal care", "tissue", "cotton"] },
    ],
  },
  // ── C. TRANSPORT ──
  {
    id: "transport", name: "Transport", icon: "Car", color: "#F59E0B", colorBg: "rgba(245,158,11,0.1)", emoji: "🚗",
    subcategories: [
      { id: "transport.fuel", name: "Fuel", icon: "Fuel", keywords: ["petrol", "fuel", "diesel", "cng", "gas station"] },
      { id: "transport.public", name: "Public Transport", icon: "Bus", keywords: ["public transport", "bus", "bus pass"] },
      { id: "transport.metro", name: "Metro", icon: "TrainFront", keywords: ["metro", "metro card", "dmrc"] },
      { id: "transport.bus", name: "Bus", icon: "Bus", keywords: ["bus", "redbus", "volvo"] },
      { id: "transport.train", name: "Train", icon: "TrainFront", keywords: ["train", "irctc", "railway", "local train"] },
      { id: "transport.cab", name: "Cab / Uber / Ola", icon: "CarTaxiFront", keywords: ["uber", "ola", "cab", "taxi", "ride"] },
      { id: "transport.auto", name: "Auto Rickshaw", icon: "Bike", keywords: ["auto", "rickshaw", "tuk tuk", "auto rickshaw"] },
      { id: "transport.bike_maint", name: "Bike Maintenance", icon: "Wrench", keywords: ["bike service", "bike repair", "puncture", "two wheeler"] },
      { id: "transport.car_maint", name: "Car Maintenance", icon: "Wrench", keywords: ["car service", "car wash", "car repair", "servicing"] },
      { id: "transport.parking", name: "Parking", icon: "ParkingCircle", keywords: ["parking", "park"] },
      { id: "transport.toll", name: "Toll", icon: "Milestone", keywords: ["toll", "fastag"] },
      { id: "transport.insurance", name: "Vehicle Insurance", icon: "ShieldCheck", keywords: ["vehicle insurance", "car insurance", "bike insurance"] },
      { id: "transport.emi", name: "Vehicle EMI", icon: "Banknote", keywords: ["car emi", "bike emi", "vehicle loan"] },
    ],
  },
  // ── D. HOUSING & UTILITIES ──
  {
    id: "housing", name: "Housing & Utilities", icon: "Home", color: "#6366F1", colorBg: "rgba(99,102,241,0.1)", emoji: "🏠",
    subcategories: [
      { id: "housing.rent", name: "Rent", icon: "Home", keywords: ["rent", "pg", "hostel", "room", "flat", "kamra"] },
      { id: "housing.electricity", name: "Electricity", icon: "Zap", keywords: ["electricity", "bijli", "power bill", "light bill"] },
      { id: "housing.water", name: "Water", icon: "Droplets", keywords: ["water bill", "pani bill", "water supply"] },
      { id: "housing.gas", name: "Gas", icon: "Flame", keywords: ["gas", "lpg", "cylinder", "cooking gas"] },
      { id: "housing.internet", name: "Internet / Wi-Fi", icon: "Wifi", keywords: ["internet", "wifi", "broadband", "airtel", "jio", "bsnl", "vi"] },
      { id: "housing.mobile", name: "Mobile Recharge", icon: "Smartphone", keywords: ["recharge", "mobile recharge", "prepaid", "postpaid", "phone bill"] },
      { id: "housing.maintenance", name: "Maintenance", icon: "Building2", keywords: ["maintenance", "society", "association"] },
      { id: "housing.cleaning", name: "House Cleaning", icon: "Sparkles", keywords: ["maid", "cleaning", "bai", "safai"] },
      { id: "housing.furniture", name: "Furniture", icon: "Armchair", keywords: ["furniture", "sofa", "bed", "table", "chair", "ikea", "pepperfry"] },
      { id: "housing.supplies", name: "Household Supplies", icon: "Package", keywords: ["household", "supplies", "kitchen", "utensils", "bucket"] },
      { id: "housing.repairs", name: "Repairs", icon: "Hammer", keywords: ["repair", "plumber", "electrician", "carpenter", "fixer"] },
      { id: "housing.property", name: "Property-related", icon: "Building", keywords: ["property", "stamp duty", "registration", "property tax"] },
    ],
  },
  // ── E. SHOPPING ──
  {
    id: "shopping", name: "Shopping", icon: "ShoppingBag", color: "#8B5CF6", colorBg: "rgba(139,92,246,0.1)", emoji: "🛍️",
    subcategories: [
      { id: "shopping.clothing", name: "Clothing", icon: "Shirt", keywords: ["clothes", "kapde", "shirt", "jeans", "dress", "kurta", "saree", "t-shirt"] },
      { id: "shopping.footwear", name: "Footwear", icon: "Footprints", keywords: ["shoes", "footwear", "chappal", "sandals", "sneakers", "boots"] },
      { id: "shopping.electronics", name: "Electronics", icon: "Cpu", keywords: ["electronics", "gadget", "earphones", "headphones", "speaker", "charger"] },
      { id: "shopping.mobile_acc", name: "Mobile Accessories", icon: "Smartphone", keywords: ["mobile cover", "screen guard", "phone case", "cable", "adapter"] },
      { id: "shopping.laptop", name: "Laptop / Computer", icon: "Laptop", keywords: ["laptop", "computer", "pc", "monitor", "keyboard", "mouse"] },
      { id: "shopping.books", name: "Books", icon: "BookOpen", keywords: ["book", "novel", "books", "kitab"] },
      { id: "shopping.household", name: "Household Shopping", icon: "ShoppingCart", keywords: ["household", "home decor", "curtains", "bedsheet"] },
      { id: "shopping.online", name: "Online Shopping", icon: "Globe", keywords: ["amazon", "flipkart", "myntra", "ajio", "meesho", "online shopping"] },
      { id: "shopping.gifts", name: "Gifts", icon: "Gift", keywords: ["gift", "tohfa", "present", "birthday gift", "wedding gift"] },
      { id: "shopping.accessories", name: "Accessories", icon: "Watch", keywords: ["watch", "belt", "wallet", "sunglasses", "accessories", "jewellery"] },
      { id: "shopping.bags", name: "Bags / Wallets", icon: "Briefcase", keywords: ["bag", "backpack", "purse", "handbag", "wallet", "luggage"] },
      { id: "shopping.returns", name: "Shopping Returns", icon: "RotateCcw", keywords: ["return", "refund", "exchange", "replacement"] },
    ],
  },
  // ── F. HEALTH ──
  {
    id: "health", name: "Health", icon: "HeartPulse", color: "#10B981", colorBg: "rgba(16,185,129,0.1)", emoji: "💊",
    subcategories: [
      { id: "health.doctor", name: "Doctor Consultation", icon: "Stethoscope", keywords: ["doctor", "consultation", "checkup", "appointment"] },
      { id: "health.medicines", name: "Medicines", icon: "Pill", keywords: ["medicine", "dawai", "tablet", "pharmacy", "1mg", "pharmeasy", "apollo"] },
      { id: "health.tests", name: "Diagnostic Tests", icon: "TestTubes", keywords: ["test", "blood test", "lab", "diagnostic", "pathology", "x-ray"] },
      { id: "health.hospital", name: "Hospital", icon: "Hospital", keywords: ["hospital", "aspatal", "admission", "surgery"] },
      { id: "health.dental", name: "Dental", icon: "SmilePlus", keywords: ["dental", "dentist", "tooth", "daant"] },
      { id: "health.eye", name: "Eye Care", icon: "Eye", keywords: ["eye", "optician", "glasses", "lens", "spectacles"] },
      { id: "health.physio", name: "Physiotherapy", icon: "Activity", keywords: ["physio", "physiotherapy", "rehab"] },
      { id: "health.fitness", name: "Fitness", icon: "Dumbbell", keywords: ["gym", "fitness", "kasrat", "workout"] },
      { id: "health.gym", name: "Gym", icon: "Dumbbell", keywords: ["gym", "membership", "gym fees"] },
      { id: "health.sports", name: "Sports", icon: "Trophy", keywords: ["sports", "cricket", "football", "badminton", "swimming"] },
      { id: "health.insurance", name: "Health Insurance", icon: "ShieldCheck", keywords: ["health insurance", "mediclaim", "medical insurance"] },
    ],
  },
  // ── G. EDUCATION & CAREER ──
  {
    id: "education", name: "Education & Career", icon: "GraduationCap", color: "#0EA5E9", colorBg: "rgba(14,165,233,0.1)", emoji: "📖",
    subcategories: [
      { id: "education.college", name: "College Fees", icon: "Building2", keywords: ["college", "university", "school", "fee", "fees", "tuition fee"] },
      { id: "education.tuition", name: "Tuition", icon: "BookOpenCheck", keywords: ["tuition", "coaching", "classes", "tutorial"] },
      { id: "education.courses", name: "Courses", icon: "MonitorPlay", keywords: ["course", "udemy", "coursera", "online course", "workshop"] },
      { id: "education.certs", name: "Certifications", icon: "Award", keywords: ["certification", "certificate", "exam fee", "test fee"] },
      { id: "education.books", name: "Books / Study Material", icon: "BookOpen", keywords: ["textbook", "study material", "notes", "pdf"] },
      { id: "education.stationery", name: "Stationery", icon: "Pencil", keywords: ["stationery", "pen", "notebook", "xerox", "photocopy", "print"] },
      { id: "education.software", name: "Software / Tools", icon: "Code", keywords: ["software", "license", "subscription", "github", "figma", "tools"] },
      { id: "education.job", name: "Job Search", icon: "Search", keywords: ["job search", "resume", "interview", "placement"] },
      { id: "education.professional", name: "Professional Development", icon: "Briefcase", keywords: ["conference", "seminar", "networking", "professional"] },
      { id: "education.work", name: "Work-related Expenses", icon: "Laptop", keywords: ["work expense", "office expense", "business expense"] },
    ],
  },
  // ── H. ENTERTAINMENT & LIFESTYLE ──
  {
    id: "entertainment", name: "Entertainment & Lifestyle", icon: "Clapperboard", color: "#F97316", colorBg: "rgba(249,115,22,0.1)", emoji: "🎬",
    subcategories: [
      { id: "entertainment.movies", name: "Movies", icon: "Film", keywords: ["movie", "movies", "cinema", "pvr", "inox", "theatre"] },
      { id: "entertainment.ott", name: "OTT Subscriptions", icon: "MonitorPlay", keywords: ["netflix", "hotstar", "prime", "disney", "ott", "streaming"] },
      { id: "entertainment.music", name: "Music Subscriptions", icon: "Music", keywords: ["spotify", "apple music", "music", "gaana", "jio saavn"] },
      { id: "entertainment.gaming", name: "Gaming", icon: "Gamepad2", keywords: ["game", "games", "gaming", "steam", "playstation", "xbox"] },
      { id: "entertainment.events", name: "Events", icon: "CalendarCheck", keywords: ["event", "show", "exhibition", "standup"] },
      { id: "entertainment.concerts", name: "Concerts", icon: "Mic2", keywords: ["concert", "live show", "performance", "gig"] },
      { id: "entertainment.hobbies", name: "Hobbies", icon: "Palette", keywords: ["hobby", "craft", "painting", "photography", "music class"] },
      { id: "entertainment.sports", name: "Sports", icon: "Trophy", keywords: ["sports event", "match", "stadium", "ipl", "tickets"] },
      { id: "entertainment.travel", name: "Travel", icon: "Plane", keywords: ["travel", "trip", "vacation", "holiday", "flight", "safar", "ghoomna", "tourism"] },
      { id: "entertainment.holidays", name: "Holidays", icon: "Palmtree", keywords: ["holiday", "vacation", "resort", "hill station", "beach"] },
      { id: "entertainment.parties", name: "Parties", icon: "PartyPopper", keywords: ["party", "celebration", "birthday party", "masti", "pub", "bar", "hookah"] },
      { id: "entertainment.social", name: "Social Activities", icon: "Users", keywords: ["outing", "friend", "hangout", "get together"] },
    ],
  },
  // ── I. FINANCIAL COMMITMENTS ──
  {
    id: "financial", name: "Financial Commitments", icon: "Landmark", color: "#64748B", colorBg: "rgba(100,116,139,0.1)", emoji: "🏦",
    subcategories: [
      { id: "financial.credit_card", name: "Credit Card Bill", icon: "CreditCard", keywords: ["credit card", "card bill", "credit card bill", "cc bill"] },
      { id: "financial.loan_emi", name: "Loan EMI", icon: "Banknote", keywords: ["emi", "loan", "karz", "installment", "home loan", "personal loan"] },
      { id: "financial.insurance", name: "Insurance Premium", icon: "ShieldCheck", keywords: ["insurance", "premium", "lic", "term plan", "life insurance"] },
      { id: "financial.bank", name: "Bank Charges", icon: "Landmark", keywords: ["bank charge", "bank fee", "annual fee", "locker charge"] },
      { id: "financial.interest", name: "Interest", icon: "Percent", keywords: ["interest", "byaj", "interest payment"] },
      { id: "financial.taxes", name: "Taxes", icon: "Receipt", keywords: ["tax", "income tax", "gst", "tds"] },
      { id: "financial.professional", name: "Professional Fees", icon: "Briefcase", keywords: ["ca fees", "lawyer", "consultant", "professional fee"] },
    ],
  },
  // ── J. INVESTMENTS & SAVINGS ──
  {
    id: "investments", name: "Investments & Savings", icon: "TrendingUp", color: "#059669", colorBg: "rgba(5,150,105,0.1)", emoji: "📈",
    subcategories: [
      { id: "investments.sip", name: "SIP", icon: "RefreshCw", keywords: ["sip", "systematic investment"] },
      { id: "investments.mutual_funds", name: "Mutual Funds", icon: "PieChart", keywords: ["mutual fund", "mf", "amc"] },
      { id: "investments.stocks", name: "Stocks", icon: "BarChart3", keywords: ["stock", "share", "equity", "nse", "bse"] },
      { id: "investments.ipo", name: "IPO Applications", icon: "Rocket", keywords: ["ipo", "ipo application", "allotment"] },
      { id: "investments.fd", name: "Fixed Deposits", icon: "Lock", keywords: ["fd", "fixed deposit"] },
      { id: "investments.rd", name: "Recurring Deposits", icon: "Calendar", keywords: ["rd", "recurring deposit"] },
      { id: "investments.gold", name: "Gold", icon: "Gem", keywords: ["gold", "sona", "sovereign gold", "sgb"] },
      { id: "investments.emergency", name: "Emergency Fund", icon: "Umbrella", keywords: ["emergency fund", "rainy day"] },
      { id: "investments.savings", name: "Savings Contribution", icon: "PiggyBank", keywords: ["savings", "save", "bachat"] },
      { id: "investments.other", name: "Other Investments", icon: "Coins", keywords: ["ppf", "nps", "crypto", "bond"] },
    ],
  },
  // ── K. GIFTS & DONATIONS ──
  {
    id: "gifts", name: "Gifts & Donations", icon: "Gift", color: "#D946EF", colorBg: "rgba(217,70,239,0.1)", emoji: "🎁",
    subcategories: [
      { id: "gifts.family", name: "Family", icon: "Heart", keywords: ["family gift", "parents", "sibling"] },
      { id: "gifts.friends", name: "Friends", icon: "Users", keywords: ["friend gift", "birthday", "treat"] },
      { id: "gifts.donations", name: "Gifts & Donations", icon: "HandHeart", keywords: ["donation", "daan", "charity", "ngo"] },
      { id: "gifts.religious", name: "Religious", icon: "Church", keywords: ["temple", "mandir", "masjid", "gurudwara", "church", "pooja"] },
      { id: "gifts.festival", name: "Festival", icon: "Sparkles", keywords: ["diwali", "holi", "rakhi", "eid", "christmas", "festival", "shagun"] },
      { id: "gifts.wedding", name: "Wedding", icon: "Heart", keywords: ["wedding", "shaadi", "marriage", "shagun"] },
      { id: "gifts.pets", name: "Pets", icon: "PawPrint", keywords: ["pet", "dog", "cat", "vet", "pet food"] },
    ],
  },
  // ── L. OTHER ──
  {
    id: "other", name: "Other", icon: "MoreHorizontal", color: "#78716C", colorBg: "rgba(120,113,108,0.1)", emoji: "📦",
    subcategories: [
      { id: "other.travel_docs", name: "Travel Documents", icon: "FileText", keywords: ["passport", "visa", "ticket"] },
      { id: "other.government", name: "Government Fees", icon: "Building", keywords: ["government", "challan", "fine", "rto", "aadhaar"] },
      { id: "other.misc", name: "Miscellaneous", icon: "MoreHorizontal", keywords: ["misc", "miscellaneous", "other"] },
    ],
  },
];

// ============================================================
// INCOME CATEGORIES (separate from expenses)
// ============================================================

export const INCOME_CATEGORIES: CategoryDef[] = [
  {
    id: "income_salary", name: "Salary", icon: "Wallet", color: "#059669", colorBg: "rgba(5,150,105,0.1)", emoji: "💰",
    subcategories: [
      { id: "income_salary.salary", name: "Salary", icon: "Wallet", keywords: ["salary", "tankhah"] },
      { id: "income_salary.bonus", name: "Bonus", icon: "Star", keywords: ["bonus", "inam", "incentive"] },
      { id: "income_salary.stipend", name: "Stipend", icon: "GraduationCap", keywords: ["stipend", "internship"] },
    ],
  },
  {
    id: "income_freelance", name: "Freelance", icon: "Laptop", color: "#0EA5E9", colorBg: "rgba(14,165,233,0.1)", emoji: "💻",
    subcategories: [
      { id: "income_freelance.freelance", name: "Freelance", icon: "Laptop", keywords: ["freelance", "gig", "project"] },
    ],
  },
  {
    id: "income_other", name: "Other Income", icon: "Coins", color: "#8B5CF6", colorBg: "rgba(139,92,246,0.1)", emoji: "💸",
    subcategories: [
      { id: "income_other.cashback", name: "Cashback", icon: "RotateCcw", keywords: ["cashback", "reward", "cashback offer"] },
      { id: "income_other.refund", name: "Refund", icon: "ArrowLeftRight", keywords: ["refund", "wapsi", "reversal"] },
      { id: "income_other.interest", name: "Interest Earned", icon: "Percent", keywords: ["interest earned", "interest income", "fd interest"] },
      { id: "income_other.dividend", name: "Dividend", icon: "TrendingUp", keywords: ["dividend"] },
      { id: "income_other.allowance", name: "Allowance / Pocket Money", icon: "HandCoins", keywords: ["allowance", "pocket money"] },
      { id: "income_other.gift", name: "Gift Received", icon: "Gift", keywords: ["gift received", "shagun received"] },
    ],
  },
];

// ============================================================
// LOOKUP HELPERS
// ============================================================

/** Map: category ID → CategoryDef */
const _catById = new Map<string, CategoryDef>();
/** Map: subcategory ID → { parent, sub } */
const _subById = new Map<string, { parent: CategoryDef; sub: SubcategoryDef }>();
/** Map: legacy emoji string → category ID */
const _legacyMap = new Map<string, string>();

// Build indexes
function _buildIndexes() {
  const allCats = [...CATEGORY_REGISTRY, ...INCOME_CATEGORIES];
  for (const cat of allCats) {
    _catById.set(cat.id, cat);
    for (const sub of cat.subcategories) {
      _subById.set(sub.id, { parent: cat, sub });
    }
  }

  // Legacy emoji string → new category ID mapping
  const legacyMappings: Record<string, string> = {
    "🍽️ Food": "food", "🍳 Food": "food", "🍱 Food": "food", "🍛 Food": "food",
    "🍕 Food": "food", "🍔 Food": "food", "🥟 Food": "food", "🫓 Food": "food",
    "🍜 Food": "food", "🍝 Food": "food", "🥐 Food": "food", "🥘 Food": "food",
    "🧀 Food": "food", "🍗 Food": "food", "🍖 Food": "food", "🐟 Food": "food",
    "🥚 Food": "food", "🍚 Food": "food", "🫘 Food": "food", "🥪 Food": "food",
    "🌯 Food": "food", "🎂 Food": "food", "🧁 Food": "food", "🍦 Food": "food",
    "🍫 Food": "food", "🍬 Food": "food", "🧃 Food": "food", "🥛 Food": "food",
    "🥤 Food": "food", "💧 Food": "food", "🍋 Food": "food", "📦 Food": "food",
    "☕ Chai/Coffee": "food",
    "🍿 Snacks": "food",
    "🛺 Transport": "transport", "🚖 Transport": "transport", "🏍️ Transport": "transport",
    "🚌 Transport": "transport", "🚇 Transport": "transport", "🚆 Transport": "transport",
    "✈️ Transport": "transport", "⛽ Transport": "transport", "🛣️ Transport": "transport",
    "🅿️ Transport": "transport",
    "🛍️ Shopping": "shopping", "📦 Shopping": "shopping", "👗 Shopping": "shopping",
    "💄 Shopping": "shopping", "👕 Shopping": "shopping", "👟 Shopping": "shopping",
    "🩴 Shopping": "shopping", "👖 Shopping": "shopping", "⌚ Shopping": "shopping",
    "🎒 Shopping": "shopping", "🧴 Shopping": "shopping", "🏬 Shopping": "shopping",
    "🏪 Shopping": "shopping", "🎧 Shopping": "shopping", "📱 Shopping": "shopping",
    "🔌 Shopping": "shopping",
    "🛒 Groceries": "food", "🥬 Groceries": "food", "🍎 Groceries": "food",
    "🌾 Groceries": "food", "🫒 Groceries": "food", "🧂 Groceries": "food",
    "🌶️ Groceries": "food", "🏪 Groceries": "food", "🍞 Groceries": "food",
    "🧈 Groceries": "food",
    "📶 Bills": "housing",
    "💡 Bills": "housing",
    "💧 Bills": "housing",
    "🔥 Bills": "housing",
    "🏢 Bills": "housing",
    "🏠 Rent": "housing",
    "🎬 Fun": "entertainment", "📺 Fun": "entertainment", "🎵 Fun": "entertainment",
    "🎮 Fun": "entertainment", "🎳 Fun": "entertainment", "🎱 Fun": "entertainment",
    "🎉 Fun": "entertainment", "🍺 Fun": "entertainment", "💨 Fun": "entertainment",
    "🎡 Fun": "entertainment", "🏖️ Fun": "entertainment",
    "📖 Education": "education", "💻 Education": "education", "📝 Education": "education",
    "🎓 Education": "education", "🏫 Education": "education", "✏️ Education": "education",
    "📓 Education": "education", "🖨️ Education": "education",
    "💊 Health": "health", "👨‍⚕️ Health": "health", "🏥 Health": "health",
    "🏋️ Health": "health", "🧘 Health": "health", "🦷 Health": "health",
    "💈 Personal": "personal_care",
    "💆 Personal": "personal_care",
    "👔 Personal": "personal_care",
    "🎁 Gifts": "gifts", "🎂 Gifts": "gifts", "💒 Gifts": "gifts",
    "🧧 Gifts": "gifts", "🙏 Gifts": "gifts", "🪔 Gifts": "gifts",
    "🎨 Gifts": "gifts", "🧶 Gifts": "gifts", "🌙 Gifts": "gifts",
    "🛕 Gifts": "gifts", "⛩️ Gifts": "gifts", "⛪ Gifts": "gifts",
    "🕌 Gifts": "gifts",
    "🏦 EMI": "financial",
    "💳 EMI": "financial",
    "📦 Other": "other",
    // Income
    "💰 Salary": "income_salary",
    "💻 Freelance": "income_freelance",
    "💸 Cashback": "income_other",
    "↩️ Refund": "income_other",
    "🤝 Allowance": "income_other",
  };

  for (const [legacy, newId] of Object.entries(legacyMappings)) {
    _legacyMap.set(legacy, newId);
  }
}

_buildIndexes();

// ============================================================
// PUBLIC API
// ============================================================

/** Get a category by its ID. */
export function getCategoryById(id: string): CategoryDef | undefined {
  return _catById.get(id);
}

/** Get subcategory info by its full ID. */
export function getSubcategoryById(id: string): { parent: CategoryDef; sub: SubcategoryDef } | undefined {
  return _subById.get(id);
}

/** Resolve a legacy emoji category string (e.g. "🍽️ Food") to the new category ID. */
export function resolveLegacyCategory(legacyStr: string): string {
  return _legacyMap.get(legacyStr) || "other";
}

/** Get the Lucide icon name for a category (by ID or legacy string). */
export function getCategoryIcon(catIdOrLegacy: string): string {
  const cat = _catById.get(catIdOrLegacy);
  if (cat) return cat.icon;
  const resolved = _legacyMap.get(catIdOrLegacy);
  if (resolved) {
    const rCat = _catById.get(resolved);
    if (rCat) return rCat.icon;
  }
  return "MoreHorizontal";
}

/** Get color for a category (by ID or legacy string). */
export function getCategoryColor(catIdOrLegacy: string): string {
  const cat = _catById.get(catIdOrLegacy);
  if (cat) return cat.color;
  const resolved = _legacyMap.get(catIdOrLegacy);
  if (resolved) {
    const rCat = _catById.get(resolved);
    if (rCat) return rCat.color;
  }
  return "#78716C";
}

/** Get background color for a category. */
export function getCategoryColorBg(catIdOrLegacy: string): string {
  const cat = _catById.get(catIdOrLegacy);
  if (cat) return cat.colorBg;
  const resolved = _legacyMap.get(catIdOrLegacy);
  if (resolved) {
    const rCat = _catById.get(resolved);
    if (rCat) return rCat.colorBg;
  }
  return "rgba(120,113,108,0.1)";
}

/** Get parent category name for a legacy string or category ID. */
export function getParentCategoryName(catIdOrLegacy: string): string {
  const cat = _catById.get(catIdOrLegacy);
  if (cat) return cat.name;
  const resolved = _legacyMap.get(catIdOrLegacy);
  if (resolved) {
    const rCat = _catById.get(resolved);
    if (rCat) return rCat.name;
  }
  return "Other";
}

// ============================================================
// IMPROVED AUTO-CATEGORIZATION
// ============================================================

export interface CategoryGuess {
  categoryId: string;
  categoryName: string;
  subcategoryId?: string;
  subcategoryName?: string;
  icon: string;
  color: string;
  colorBg: string;
  /** Legacy format string for backward compatibility */
  legacyString: string;
}

/**
 * Auto-categorize a description, returning structured result.
 * Checks subcategory keywords first for more precise matching.
 */
export function smartGuessCategory(text: string): CategoryGuess {
  const lower = text.toLowerCase().trim();
  const words = lower.split(/\s+/);

  // Check each subcategory's keywords across all categories
  for (const cat of CATEGORY_REGISTRY) {
    for (const sub of cat.subcategories) {
      for (const keyword of sub.keywords) {
        if (lower === keyword || lower.includes(keyword) || words.includes(keyword)) {
          return {
            categoryId: cat.id,
            categoryName: cat.name,
            subcategoryId: sub.id,
            subcategoryName: sub.name,
            icon: sub.icon,
            color: cat.color,
            colorBg: cat.colorBg,
            legacyString: `${cat.emoji} ${cat.name.split(" ")[0]}`,
          };
        }
      }
    }
  }

  // Fallback to "Other"
  const other = CATEGORY_REGISTRY.find((c) => c.id === "other")!;
  return {
    categoryId: other.id,
    categoryName: other.name,
    icon: other.icon,
    color: other.color,
    colorBg: other.colorBg,
    legacyString: "📦 Other",
  };
}

/**
 * Get the "frequently used" categories (first 8) for quick add.
 */
export function getQuickCategories(): Array<{ cat: CategoryDef; emoji: string; label: string }> {
  const quickIds = ["food", "transport", "shopping", "housing", "personal_care", "entertainment", "health", "education", "financial", "investments", "gifts", "other"];
  return quickIds.map((id) => {
    const cat = _catById.get(id);
    if (!cat) return null;
    return { cat, emoji: cat.emoji, label: cat.name.split(" &")[0].split(" /")[0] };
  }).filter(Boolean) as Array<{ cat: CategoryDef; emoji: string; label: string }>;
}

/**
 * Search categories by name.
 */
export function searchCategories(query: string): Array<{ cat: CategoryDef; sub?: SubcategoryDef }> {
  if (!query.trim()) return CATEGORY_REGISTRY.map((c) => ({ cat: c }));
  const q = query.toLowerCase();
  const results: Array<{ cat: CategoryDef; sub?: SubcategoryDef }> = [];

  for (const cat of CATEGORY_REGISTRY) {
    if (cat.name.toLowerCase().includes(q)) {
      results.push({ cat });
    }
    for (const sub of cat.subcategories) {
      if (sub.name.toLowerCase().includes(q) || sub.keywords.some((k) => k.includes(q))) {
        results.push({ cat, sub });
      }
    }
  }

  return results;
}
