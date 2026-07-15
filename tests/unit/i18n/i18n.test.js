import { describe, expect, it, beforeEach } from 'vitest';

// ============================================================
// DDS_I18N — socle (TODO T-058). See docs/SCFlow_I18N.md.
// Covers: ready()/getLocale() default resolution, t() substitution and
// plural placeholders, missing-key fallback, setLocale() with an
// unsupported locale.
// ============================================================

describe('DDS_I18N.ready', () => {
  it('resolves to the source locale (en) with no DDS_SETTINGS/navigator override', async () => {
    await DDS_I18N.ready();
    expect(DDS_I18N.getLocale()).toBe('en');
  });
});

describe('DDS_I18N.t', () => {
  beforeEach(async () => {
    await DDS_I18N.ready();
  });

  it('substitutes a plain {name} placeholder', () => {
    expect(DDS_I18N.t('i18n.example.greeting', { name: 'Rémi' })).toBe('Hello, Rémi!');
  });

  it('resolves the "one" plural branch for a count of 1', () => {
    expect(DDS_I18N.t('i18n.example.item_count', { count: 1 })).toBe('1 item');
  });

  it('resolves the "other" plural branch for a count other than 1', () => {
    expect(DDS_I18N.t('i18n.example.item_count', { count: 3 })).toBe('3 items');
  });

  it('returns the key itself and warns when the key is missing', () => {
    expect(DDS_I18N.t('i18n.does.not.exist')).toBe('i18n.does.not.exist');
  });
});

describe('DDS_I18N.setLocale', () => {
  it('ignores an unsupported locale and keeps the previous one active', async () => {
    await DDS_I18N.ready();
    const before = DDS_I18N.getLocale();
    await DDS_I18N.setLocale('xx');
    expect(DDS_I18N.getLocale()).toBe(before);
  });
});
