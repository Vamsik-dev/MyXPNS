import type { MerchantRule, Transaction, TransactionType } from './types';

/**
 * Deterministic merchant matching. No AI: a merchant "key" is the lower-cased name with
 * everything except letters and digits removed, so "DMart", "D-Mart" and "D MART" all
 * become "dmart". Rules map keys (merchant name + aliases) to a canonical name/category.
 */
export function merchantKey(name: string): string {
  return name
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]/gu, '');
}

/** Tidies free text: trims and collapses inner whitespace. Does not change case. */
export function tidyMerchant(name: string): string {
  return name.replace(/\s+/g, ' ').trim();
}

export interface MerchantIndex {
  byKey: Map<string, MerchantRule>;
}

export function buildMerchantIndex(rules: MerchantRule[]): MerchantIndex {
  const byKey = new Map<string, MerchantRule>();
  // Later rules win, so a rule appended by the user overrides an earlier default.
  for (const rule of rules) {
    for (const name of [rule.merchant, ...rule.aliases]) {
      const key = merchantKey(name);
      if (key) byKey.set(key, rule);
    }
  }
  return { byKey };
}

export function findRule(name: string, index: MerchantIndex): MerchantRule | undefined {
  const key = merchantKey(name);
  return key ? index.byKey.get(key) : undefined;
}

/**
 * Returns the canonical spelling of a merchant: the rule's name if one matches,
 * otherwise the most recent spelling used in past transactions, otherwise the tidied input.
 */
export function normalizeMerchant(name: string, index: MerchantIndex, history: Transaction[] = []): string {
  const tidy = tidyMerchant(name);
  if (!tidy) return '';
  const rule = findRule(tidy, index);
  if (rule) return rule.merchant;
  const key = merchantKey(tidy);
  const previous = latestFirst(history).find((t) => merchantKey(t.merchant) === key);
  return previous ? previous.merchant : tidy;
}

export type CategorySuggestion = { category: string; source: 'rule' | 'history' } | undefined;

/**
 * Suggests a category: an explicit rule wins; otherwise the category used the last
 * time this merchant appeared with the same transaction type.
 */
export function suggestCategory(
  name: string,
  type: TransactionType,
  index: MerchantIndex,
  history: Transaction[],
  allowed: string[],
): CategorySuggestion {
  if (!merchantKey(name)) return undefined;
  const rule = findRule(name, index);
  if (rule?.category && allowed.includes(rule.category)) return { category: rule.category, source: 'rule' };
  const key = merchantKey(name);
  const previous = latestFirst(history).find(
    (t) => t.type === type && merchantKey(t.merchant) === key && allowed.includes(t.category),
  );
  return previous ? { category: previous.category, source: 'history' } : undefined;
}

/** Should the form offer "Always categorize this merchant as …"? */
export function shouldOfferRule(name: string, category: string, index: MerchantIndex): boolean {
  if (!merchantKey(name) || !category) return false;
  const rule = findRule(name, index);
  return rule?.category !== category;
}

/**
 * Creates or updates the rule for a merchant, returning the full new rules list.
 * Matching is by key, so the existing canonical spelling and aliases are preserved.
 */
export function upsertRule(rules: MerchantRule[], name: string, category: string): { rules: MerchantRule[]; rule: MerchantRule; index: number } {
  const key = merchantKey(name);
  const pos = rules.findIndex((r) => [r.merchant, ...r.aliases].some((n) => merchantKey(n) === key));
  if (pos >= 0) {
    const existing = rules[pos]!;
    const rule = { ...existing, category };
    const next = rules.slice();
    next[pos] = rule;
    return { rules: next, rule, index: pos };
  }
  const rule: MerchantRule = { merchant: tidyMerchant(name), aliases: [], category };
  return { rules: [...rules, rule], rule, index: rules.length };
}

/** Distinct merchant names (canonical spelling), most recently used first. */
export function knownMerchants(history: Transaction[], rules: MerchantRule[], type?: TransactionType): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const t of latestFirst(history)) {
    if (type && t.type !== type) continue;
    const key = merchantKey(t.merchant);
    if (key && !seen.has(key)) {
      seen.add(key);
      out.push(t.merchant);
    }
  }
  if (type !== 'RECEIVED') {
    for (const r of rules) {
      const key = merchantKey(r.merchant);
      if (key && !seen.has(key)) {
        seen.add(key);
        out.push(r.merchant);
      }
    }
  }
  return out;
}

export function latestFirst(transactions: Transaction[]): Transaction[] {
  return transactions.slice().sort(compareLatestFirst);
}

export function compareLatestFirst(a: Transaction, b: Transaction): number {
  if (a.date !== b.date) return a.date < b.date ? 1 : -1;
  if (a.createdAt !== b.createdAt) return a.createdAt < b.createdAt ? 1 : -1;
  return 0;
}
