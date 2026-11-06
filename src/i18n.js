// User-facing text on the Host side. The plugin ships in English only: `tr`
// fills {name} placeholders, and the helpers below keep call sites readable
// where they ask for "the current language" or pick a wording.

/**
 * Fill the placeholders in a piece of user-facing text.
 * @param {string} text - English text; `{name}` marks a placeholder.
 * @param {Record<string, unknown>} [vars] - Values for the placeholders.
 * @returns {string} The text with placeholders replaced.
 */
export function tr(text, vars) {
  return vars ? text.replace(/\{(\w+)\}/g, (match, key) => (vars[key] === undefined ? match : String(vars[key]))) : text
}

/** The plugin has a single language. */
export function currentLang() {
  return 'en'
}

/** Run fn as the work of the current request. */
export function withLang(_lang, fn) {
  return fn()
}

/** Normalise an incoming language tag. The plugin only speaks English. */
export function normalizeLang() {
  return 'en'
}

/** Pick the English wording of a language-dependent fragment. */
export function byLang(_zh, en) {
  return en
}

/** Platform values are stored in English, so the stored value is the name. */
export function platformName(platform) {
  return platform
}
