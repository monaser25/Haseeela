import { DEFAULT_LOCALE, type Locale } from '../lib/locales';
import React from 'react';
import { ar, en, type MessageKey, type Messages, type MessageVars } from '@haseela/shared/messages';

export { ar, en };
export type { MessageKey, Messages, MessageVars };

const messages = {
  en,
  ar,
} satisfies Record<Locale, Messages>;

const hasMessage = (dictionary: Partial<Record<MessageKey, string>>, key: MessageKey) =>
  Object.prototype.hasOwnProperty.call(dictionary, key);

const warnMissing = (locale: Locale, key: MessageKey) => {
  if (process.env.NODE_ENV === 'development') {
    console.warn(`[i18n] Missing message "${key}" for locale "${locale}".`);
  }
};

const interpolate = (message: string, vars: MessageVars = {}) => {
  if (!Object.values(vars).some(v => typeof v !== 'string' && typeof v !== 'number')) {
    return message.replace(/\{([^{}]+)\}/g, (match, name: string) => {
      const value = vars[name];
      return value === undefined ? match : String(value);
    });
  }

  const parts = message.split(/(\{.*?\})/);
  return parts.map((part, i) => {
    if (part.startsWith('{') && part.endsWith('}')) {
      const name = part.slice(1, -1);
      const value = vars[name];
      return value === undefined ? part : <React.Fragment key={i}>{value}</React.Fragment>;
    }
    return part;
  });
};

export function getMessages(locale: Locale) {
  return messages[locale] ?? messages[DEFAULT_LOCALE];
}

export function t(locale: Locale, key: MessageKey, vars?: MessageVars): any {
  const activeMessages = getMessages(locale) as Partial<Record<MessageKey, string>>;

  if (hasMessage(activeMessages, key)) {
    return interpolate(activeMessages[key] ?? key, vars);
  }

  warnMissing(locale, key);

  const fallbackMessages = messages[DEFAULT_LOCALE] as Partial<Record<MessageKey, string>>;
  if (hasMessage(fallbackMessages, key)) {
    return interpolate(fallbackMessages[key] ?? key, vars);
  }

  warnMissing(DEFAULT_LOCALE, key);
  return key;
}
