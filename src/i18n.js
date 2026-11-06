// User-facing text on the Host side. The plugin ships in English only, so `tr`
// is a placeholder formatter: {name} marks a value, and `{name}` is substituted.

/**
 * Fill the placeholders in a piece of user-facing text.
 * @param {string} text - English text; `{name}` marks a placeholder.
 * @param {Record<string, unknown>} [vars] - Values for the placeholders.
 * @returns {string} The text with placeholders replaced.
 */
export function tr(text, vars) {
  return vars ? text.replace(/\{(\w+)\}/g, (match, key) => (vars[key] === undefined ? match : String(vars[key]))) : text
}
