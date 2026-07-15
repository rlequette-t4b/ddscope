// ============================================================
// DDS_I18N_CATALOG_EN — English (source language) string catalog
// ============================================================
//
// Flat key -> string map consumed by the DDS_I18N service (see
// src/core/DDS_I18N.js and docs/SCFlow_I18N.md). English is SCFlow's
// source language, matching the repository's language convention
// (see README.md).
//
// Empty of real content by design: the string-extraction audit (TODO
// T-058, chantier "Audit + extraction des chaines en dur") populates this
// catalog as UI text is migrated off hardcoded textContent/innerHTML. This
// file exists so the socle (DDS_I18N.ready()/t()/setLocale()) has a real,
// loadable catalog to resolve against from day one.
//
// Placeholder syntax (see DDS_I18N._format): "{name}" substitution,
// "{name, plural, one {...} other {...}}" pluralization — "#" inside a
// plural branch is replaced by the numeric value.
window.DDS_I18N_CATALOG_EN = {
  // Illustrative only — demonstrates the placeholder syntax ahead of real
  // extracted keys. Safe to remove once T-058's extraction chantier lands
  // its first real batch.
  'i18n.example.greeting': 'Hello, {name}!',
  'i18n.example.item_count': '{count, plural, one {# item} other {# items}}'
};
