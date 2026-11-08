import { vi } from "vitest";

type LocaleCtor = new (locales?: Intl.LocalesArgument, options?: object) => object;

function defaultLocale<C extends LocaleCtor>(Ctor: C, locale: string): C {
  const create = (args: unknown[]) => Reflect.construct(Ctor, [args[0] ?? locale, args[1]]);
  return new Proxy(Ctor, { construct: (_t, args) => create(args), apply: (_t, _this, args) => create(args) });
}

/**
 * Runs `fn` as if the browser's locale were `locale`: Intl constructors default to it,
 * `navigator.language` reports it, and `Date#toLocaleDateString` uses it.
 */
export async function withBrowserLocale<T>(locale: string, fn: () => Promise<T>): Promise<T> {
  const { DateTimeFormat, RelativeTimeFormat } = Intl;
  const toLocaleDateString = Date.prototype.toLocaleDateString;
  // Intl.RelativeTimeFormat is typed readonly but is a plain writable property at runtime.
  const setIntl = (key: "DateTimeFormat" | "RelativeTimeFormat", value: unknown) =>
    Object.defineProperty(Intl, key, { value, writable: true, configurable: true });

  setIntl("DateTimeFormat", defaultLocale(DateTimeFormat, locale));
  setIntl("RelativeTimeFormat", defaultLocale(RelativeTimeFormat, locale));
  Date.prototype.toLocaleDateString = function (locales?: Intl.LocalesArgument, opts?: Intl.DateTimeFormatOptions) {
    return toLocaleDateString.call(this, locales ?? locale, opts);
  };
  vi.stubGlobal("navigator", { ...globalThis.navigator, language: locale, languages: [locale] });
  try {
    return await fn();
  } finally {
    setIntl("DateTimeFormat", DateTimeFormat);
    setIntl("RelativeTimeFormat", RelativeTimeFormat);
    Date.prototype.toLocaleDateString = toLocaleDateString;
    vi.unstubAllGlobals();
  }
}
