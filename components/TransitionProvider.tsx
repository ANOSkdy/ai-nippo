'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';

const DURATION = 320;
const EASING = 'cubic-bezier(0.22, 1, 0.36, 1)';

function usePrefersReducedMotion() {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const updatePreference = () => setPrefersReducedMotion(mediaQuery.matches);

    updatePreference();
    mediaQuery.addEventListener('change', updatePreference);

    return () => mediaQuery.removeEventListener('change', updatePreference);
  }, []);

  return prefersReducedMotion;
}

type TransitionNode = {
  key: string;
  node: React.ReactNode;
};

type TransitionProviderProps = {
  children: React.ReactNode;
};

export default function TransitionProvider({ children }: TransitionProviderProps) {
  const pathname = usePathname();
  const prefersReducedMotion = usePrefersReducedMotion();

  const [current, setCurrent] = useState<TransitionNode>({
    key: pathname,
    node: children,
  });
  const [previous, setPrevious] = useState<TransitionNode | null>(null);

  useEffect(() => {
    setCurrent((prev) => {
      if (prev.key !== pathname) {
        setPrevious(prefersReducedMotion ? null : prev);
      }

      return { key: pathname, node: children };
    });
  }, [pathname, children, prefersReducedMotion]);

  useEffect(() => {
    if (prefersReducedMotion) {
      setPrevious(null);
    }
  }, [prefersReducedMotion]);

  const scheduleCleanup = useCallback(() => {
    if (prefersReducedMotion) {
      setPrevious(null);
      return () => undefined;
    }

    const timeout = setTimeout(() => setPrevious(null), DURATION);
    return () => clearTimeout(timeout);
  }, [prefersReducedMotion]);

  useEffect(() => {
    if (!previous) {
      return;
    }

    return scheduleCleanup();
  }, [previous, scheduleCleanup]);

  const enteringStyle = prefersReducedMotion
    ? undefined
    : ({
        animation: `transition-fade-in ${DURATION}ms ${EASING}`,
      } as React.CSSProperties);
  const exitingStyle = prefersReducedMotion
    ? undefined
    : ({
        animation: `transition-fade-out ${DURATION}ms ${EASING}`,
      } as React.CSSProperties);

  return (
    <div className="relative isolate">
      {previous ? (
        <div
          key={previous.key}
          aria-hidden
          className="pointer-events-none absolute inset-0 overflow-hidden"
          style={exitingStyle}
        >
          {previous.node}
        </div>
      ) : null}
      <div key={current.key} style={enteringStyle}>
        {current.node}
      </div>
      {prefersReducedMotion ? null : (
        <style jsx>{`
          @keyframes transition-fade-in {
            from {
              opacity: 0;
              transform: scale(0.985);
            }

            to {
              opacity: 1;
              transform: scale(1);
            }
          }

          @keyframes transition-fade-out {
            from {
              opacity: 1;
              transform: scale(1);
            }

            to {
              opacity: 0;
              transform: scale(0.995);
            }
          }
        `}</style>
      )}
    </div>
  );
}
