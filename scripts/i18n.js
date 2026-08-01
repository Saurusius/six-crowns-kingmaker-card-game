export function currentLocale() {
  const language = globalThis.game?.i18n?.lang;
  return typeof language === "string" && language.trim() ? language : "fr";
}

export function formatDateTime(value, options = {}) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat(currentLocale(), {
    dateStyle: "short",
    timeStyle: "short",
    ...options
  }).format(date);
}
