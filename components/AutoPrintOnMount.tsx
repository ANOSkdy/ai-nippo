'use client';

import { useEffect } from 'react';

export function AutoPrintOnMount() {
  useEffect(() => {
    const timer = window.setTimeout(() => {
      window.print();
    }, 0);

    return () => window.clearTimeout(timer);
  }, []);

  return null;
}

export default AutoPrintOnMount;
