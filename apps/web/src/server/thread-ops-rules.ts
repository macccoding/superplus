import { ThreadCategory } from '@superplus/db';

export type OpsSuggestionType =
  | 'STOCK_OUT'
  | 'MAINTENANCE'
  | 'CUSTOMER_COMPLAINT'
  | 'INCIDENT'
  | 'EXPIRY'
  | 'CHECKLIST';

export type OpsSuggestion = {
  id: OpsSuggestionType;
  icon: string;
  title: string;
  body: string;
  action: 'CREATE_TASK' | 'LOG_INCIDENT' | 'REPORT_STOCK_OUT' | 'OPEN_EXPIRY' | 'LINK_SOP';
  taskCategory?: string;
  priority: 'NORMAL' | 'HIGH' | 'URGENT';
};

const rules: Array<{
  id: OpsSuggestionType;
  icon: string;
  title: string;
  body: string;
  action: OpsSuggestion['action'];
  taskCategory?: string;
  priority: OpsSuggestion['priority'];
  category?: ThreadCategory;
  words: RegExp;
}> = [
  {
    id: 'STOCK_OUT',
    icon: 'inventory',
    title: 'Possible stock issue',
    body: 'This looks like stock is low or out. Make a task or stock-out report.',
    action: 'REPORT_STOCK_OUT',
    taskCategory: 'Inventory',
    priority: 'HIGH',
    category: ThreadCategory.INVENTORY,
    words: /\b(stock.?out|out of stock|low stock|empty shelf|no stock|sold out|restock)\b/i,
  },
  {
    id: 'MAINTENANCE',
    icon: 'build',
    title: 'Possible maintenance issue',
    body: 'This may need a maintenance follow-up task.',
    action: 'CREATE_TASK',
    taskCategory: 'Maintenance',
    priority: 'HIGH',
    category: ThreadCategory.MAINTENANCE,
    words: /\b(leak|broken|repair|maintenance|not working|faulty|damage|freezer|fridge|light|pipe)\b/i,
  },
  {
    id: 'CUSTOMER_COMPLAINT',
    icon: 'support_agent',
    title: 'Possible customer complaint',
    body: 'This sounds customer-facing. Create a follow-up task for a supervisor.',
    action: 'CREATE_TASK',
    taskCategory: 'Customer',
    priority: 'HIGH',
    words: /\b(customer|complaint|complain|refund|angry|upset|rude|service issue)\b/i,
  },
  {
    id: 'INCIDENT',
    icon: 'report_problem',
    title: 'Possible incident',
    body: 'This may need to be logged as an incident.',
    action: 'LOG_INCIDENT',
    taskCategory: 'Safety',
    priority: 'URGENT',
    category: ThreadCategory.URGENT,
    words: /\b(injury|hurt|fall|slip|accident|theft|fight|fire|unsafe|emergency)\b/i,
  },
  {
    id: 'EXPIRY',
    icon: 'event_available',
    title: 'Possible expiry concern',
    body: 'This may need an expiry alert or pull task.',
    action: 'OPEN_EXPIRY',
    taskCategory: 'Expiry',
    priority: 'HIGH',
    words: /\b(expir|spoiled|bad date|near date|pull date|old product)\b/i,
  },
  {
    id: 'CHECKLIST',
    icon: 'checklist',
    title: 'Possible checklist follow-up',
    body: 'This looks like handover or checklist work.',
    action: 'CREATE_TASK',
    taskCategory: 'Checklist',
    priority: 'NORMAL',
    words: /\b(checklist|handover|opening|closing|not done|missed)\b/i,
  },
];

export function detectThreadOpsSuggestions(input: { title?: string | null; body?: string | null; category?: ThreadCategory | string | null }) {
  const text = `${input.title || ''}\n${input.body || ''}`;
  const suggestions = rules.filter((rule) => rule.words.test(text) || (rule.category && rule.category === input.category));
  const seen = new Set<string>();
  return suggestions.filter((suggestion) => {
    if (seen.has(suggestion.id)) return false;
    seen.add(suggestion.id);
    return true;
  }).map(({ words: _words, category: _category, ...suggestion }) => suggestion);
}
