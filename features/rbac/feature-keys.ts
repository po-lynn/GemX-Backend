// Feature keys for configurable internal permissions.
// NOTE: categories management is ALWAYS admin-only and intentionally excluded.
// Users management is included but restricted: internal users cannot see or
// assign the admin role.
export const FEATURE_KEYS = {
  USERS:                     "users",
  PRODUCTS:                  "products",
  CREDIT_PACKAGES:           "credit.packages",
  CREDIT_PURCHASE_REQUESTS:  "credit.purchase_requests",
  CREDIT_SUBSCRIPTIONS:      "credit.subscriptions",
  CREDIT_TRANSACTIONS:       "credit.transactions",
  NEWS:                      "news",
  ARTICLES:                  "articles",
  ORIGIN:                    "origin",
  LABORATORY:                "laboratory",
  MESSAGES:                  "messages",
  CHAT_DASHBOARD:            "chat_dashboard",
  COLLECTOR_REQUESTS:        "collector_requests",
  SETTINGS_RATING_TAGS:      "settings.rating_tags",
  SETTINGS_ESCROW:           "settings.escrow",
} as const

export type FeatureKey = (typeof FEATURE_KEYS)[keyof typeof FEATURE_KEYS]

export const FEATURE_GROUPS: Array<{
  label: string
  features: Array<{ key: FeatureKey; label: string }>
}> = [
  {
    label: "Users",
    features: [
      { key: FEATURE_KEYS.USERS, label: "User Management" },
    ],
  },
  {
    label: "Marketplace",
    features: [
      { key: FEATURE_KEYS.PRODUCTS,           label: "Products" },
      { key: FEATURE_KEYS.ORIGIN,             label: "Origin" },
      { key: FEATURE_KEYS.LABORATORY,         label: "Laboratory" },
      { key: FEATURE_KEYS.COLLECTOR_REQUESTS, label: "Collector Requests" },
    ],
  },
  {
    label: "Points & Credits",
    features: [
      { key: FEATURE_KEYS.CREDIT_PACKAGES,          label: "Point Packages" },
      { key: FEATURE_KEYS.CREDIT_PURCHASE_REQUESTS, label: "Payment Transactions" },
      { key: FEATURE_KEYS.CREDIT_SUBSCRIPTIONS,     label: "Dealer Subscriptions" },
      { key: FEATURE_KEYS.CREDIT_TRANSACTIONS,      label: "All Transactions" },
    ],
  },
  {
    label: "Communication",
    features: [
      { key: FEATURE_KEYS.MESSAGES,       label: "Messages" },
      { key: FEATURE_KEYS.CHAT_DASHBOARD, label: "Chat Dashboard" },
    ],
  },
  {
    label: "Content",
    features: [
      { key: FEATURE_KEYS.NEWS,     label: "News" },
      { key: FEATURE_KEYS.ARTICLES, label: "Articles" },
    ],
  },
  {
    label: "Settings",
    features: [
      { key: FEATURE_KEYS.SETTINGS_RATING_TAGS, label: "Seller Rating Tags" },
      { key: FEATURE_KEYS.SETTINGS_ESCROW,      label: "Escrow Service" },
    ],
  },
]
