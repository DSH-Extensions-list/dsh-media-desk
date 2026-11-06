// Interface text. The plugin ships in English only: `t` fills {name}
// placeholders and `plural` picks the singular form for a count of one.

/**
 * Fill the placeholders in a piece of interface text.
 * @param {string} text - English text; `{name}` marks a placeholder.
 * @param {Record<string, unknown>} [vars] - Values for the placeholders.
 * @returns {string} The text with placeholders replaced.
 */
export function t(text, vars) {
  return vars ? text.replace(/\{(\w+)\}/g, (match, key) => (vars[key] === undefined ? match : String(vars[key]))) : text
}

/** Singular form when n is 1, plural form otherwise. */
export function plural(n, one, other) {
  return n === 1 ? one : other
}

/** The plugin has a single interface language. */
export function lang() {
  return 'en'
}

/** Kept so components can subscribe to a language that never changes. */
export function subscribeLang() {
  return () => {}
}

/** Kept for components that re-read the interface language. */
export function useLang() {
  return 'en'
}
