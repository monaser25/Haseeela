import type React from 'react';

export { en } from './en';
export { ar } from './ar';
export type { Messages, MessageKey } from './en';

export type MessageVars = Record<string, string | number | React.ReactNode>;
