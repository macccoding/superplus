export const APP_NAMES: Record<string, string> = {
  'product-lookup': 'Product Lookup',
  'stock-out': "We're Out",
  'expiry-spotter': 'Expiry Spotter',
  'daily-specials': 'Daily Specials',
  'suggestion-box': 'Suggestion Box',
  'closing-checklist': 'Checklist',
  'restock-trigger': 'Restock',
  'markdown-tool': 'Markdown Tool',
  'task-board': 'Task Board',
  'issue-logger': 'Issue Logger',
  dashboard: 'Dashboard',
  calculator: 'Calculator',
};

export const LIMITS = {
  SUGGESTION_MAX_CHARS: 280,
  SEARCH_DEBOUNCE_MS: 300,
  PRODUCT_CACHE_TTL_MS: 30 * 60 * 1000, // 30 minutes
  MAX_PHOTO_SIZE_MB: 5,
  COOLER_TEMP_MAX_F: 40,
  MARKDOWN_BELOW_COST_REQUIRES_APPROVAL: true,
} as const;

export const STOCK_EVENT_TYPES = [
  'stockout',
  'restock_request',
  'delivery',
  'count',
  'expiry_flag',
] as const;
export type StockEventType = (typeof STOCK_EVENT_TYPES)[number];

export const ISSUE_TYPES = [
  'equipment',
  'supplier',
  'customer',
  'staff',
  'safety',
  'other',
] as const;
export type IssueType = (typeof ISSUE_TYPES)[number];

export const SEVERITY_LEVELS = ['low', 'medium', 'high', 'critical'] as const;
export type SeverityLevel = (typeof SEVERITY_LEVELS)[number];

export const TASK_PRIORITIES = ['low', 'normal', 'high'] as const;
export type TaskPriority = (typeof TASK_PRIORITIES)[number];

export const TASK_STATUSES = ['pending', 'in_progress', 'done'] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export const MARKDOWN_REASONS = [
  'approaching_expiry',
  'damaged',
  'overstock',
  'promo',
  'manager_directed',
  'other',
] as const;
export type MarkdownReason = (typeof MARKDOWN_REASONS)[number];

export const SUGGESTION_CATEGORIES = [
  'product_request',
  'improvement',
  'issue',
  'other',
] as const;
export type SuggestionCategory = (typeof SUGGESTION_CATEGORIES)[number];

export const CHECKLIST_TYPES = ['opening', 'closing'] as const;
export type ChecklistType = (typeof CHECKLIST_TYPES)[number];

export const EXPIRY_THRESHOLDS = {
  EXPIRED: 0,
  CRITICAL_DAYS: 3,
  WARNING_DAYS: 7,
} as const;

export const NON_FUEL_MARGINS = {
  store: 0.25,
  deli: 0.35,
  phone_cards: 0.08,
} as const;
