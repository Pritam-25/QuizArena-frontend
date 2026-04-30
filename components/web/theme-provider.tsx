'use client';

import * as React from 'react';
import { ThemeProvider as NextThemesProvider } from 'next-themes';

// Suppress React 19 false-positive warning from next-themes
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
  const originalError = console.error;

  console.error = (...args: unknown[]) => {
    const message = args[0];

    if (
      typeof message === 'string' &&
      message.includes(
        'Encountered a script tag while rendering React component'
      )
    ) {
      return; // ignore noise
    }

    originalError(...args);
  };
}

export function ThemeProvider({
  children,
  ...props
}: React.ComponentProps<typeof NextThemesProvider>) {
  return <NextThemesProvider {...props}>{children}</NextThemesProvider>;
}
