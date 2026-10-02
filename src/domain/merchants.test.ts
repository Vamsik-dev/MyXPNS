import { fixtureTransactions, merchantRules, tx } from '../test/fixtures';
import { buildMerchantIndex, knownMerchants, merchantKey, normalizeMerchant, shouldOfferRule, suggestCategory, upsertRule } from './merchants';

const index = buildMerchantIndex(merchantRules);
const spentCats = ['Groceries', 'Dining', 'Healthcare', 'Personal Care', 'Shopping', 'Other Expense'];

describe('merchant normalization', () => {
  it.each(['DMart', 'D-Mart', 'D MART', 'dmart', ' d.mart '])('%j → DMart', (input) => {
    expect(normalizeMerchant(input, index)).toBe('DMart');
  });

  it('maps aliases to the canonical merchant', () => {
    expect(normalizeMerchant('Avenue Supermarts', index)).toBe('DMart');
    expect(normalizeMerchant('amzn', index)).toBe('Amazon');
  });

  it('reuses the spelling from history for merchants without rules', () => {
    const history = [tx({ date: '2026-10-01', type: 'SPENT', amount: 10, category: 'Personal Care', merchant: 'Raju Barber' })];
    expect(normalizeMerchant('raju  barber', index, history)).toBe('Raju Barber');
  });

  it('tidies unknown merchants without changing case', () => {
    expect(normalizeMerchant('  New   Shop ', index)).toBe('New Shop');
    expect(normalizeMerchant('   ', index)).toBe('');
  });

  it('builds keys from letters and digits only, ignoring accents', () => {
    expect(merchantKey('Café Coffee-Day!')).toBe('cafecoffeeday');
    expect(merchantKey('7-Eleven')).toBe('7eleven');
  });
});

describe('merchant rule application', () => {
  it('suggests the rule category', () => {
    expect(suggestCategory('D-Mart', 'SPENT', index, [], spentCats)).toEqual({ category: 'Groceries', source: 'rule' });
  });

  it('falls back to the most recent category used for the merchant', () => {
    const history = [
      tx({ date: '2026-09-01', type: 'SPENT', amount: 1, category: 'Shopping', merchant: 'Local Store' }),
      tx({ date: '2026-10-01', type: 'SPENT', amount: 1, category: 'Groceries', merchant: 'Local Store' }),
    ];
    expect(suggestCategory('local store', 'SPENT', index, history, spentCats)).toEqual({ category: 'Groceries', source: 'history' });
  });

  it('ignores rule categories that are not valid for the type', () => {
    expect(suggestCategory('DMart', 'RECEIVED', index, [], ['Salary'])).toBeUndefined();
  });

  it('returns nothing for unknown merchants', () => {
    expect(suggestCategory('Unknown', 'SPENT', index, fixtureTransactions(), spentCats)).toBeUndefined();
    expect(suggestCategory('', 'SPENT', index, [], spentCats)).toBeUndefined();
  });

  it('a later rule overrides an earlier one with the same key', () => {
    const idx = buildMerchantIndex([...merchantRules, { merchant: 'D Mart', aliases: [], category: 'Household' }]);
    expect(suggestCategory('DMart', 'SPENT', idx, [], [...spentCats, 'Household'])?.category).toBe('Household');
  });

  it('offers "always categorize" only when the choice differs from the rule', () => {
    expect(shouldOfferRule('DMart', 'Groceries', index)).toBe(false);
    expect(shouldOfferRule('DMart', 'Household', index)).toBe(true);
    expect(shouldOfferRule('Brand New', 'Dining', index)).toBe(true);
    expect(shouldOfferRule('', 'Dining', index)).toBe(false);
  });

  it('upsertRule updates an existing rule in place, keeping canonical name and aliases', () => {
    const { rules, rule } = upsertRule(merchantRules, 'd-mart', 'Household');
    expect(rule).toEqual({ merchant: 'DMart', aliases: ['Avenue Supermarts'], category: 'Household' });
    expect(rules).toHaveLength(merchantRules.length);
    expect(merchantRules[0]!.category).toBe('Groceries'); // input not mutated
  });

  it('upsertRule appends a new rule', () => {
    const { rules, rule } = upsertRule(merchantRules, '  Raju  Barber ', 'Personal Care');
    expect(rule).toEqual({ merchant: 'Raju Barber', aliases: [], category: 'Personal Care' });
    expect(rules).toHaveLength(merchantRules.length + 1);
    expect(normalizeMerchant('raju barber', buildMerchantIndex(rules))).toBe('Raju Barber');
  });

  it('knownMerchants lists recent merchants first without duplicates', () => {
    const list = knownMerchants(fixtureTransactions(), [], 'SPENT');
    expect(list.slice(0, 4)).toEqual(['Corner Shop', 'Apollo Pharmacy', 'Barber', 'DMart']);
    expect(new Set(list).size).toBe(list.length);
  });
});
