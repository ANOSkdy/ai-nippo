'use client';

import React, { useEffect, useRef } from 'react';

type Props = {
  id?: string;
  marginMm?: number;
  orientation?: 'portrait' | 'landscape';
  children: React.ReactNode;
};

export default function ReportFitToA4({
  id = 'report-root',
  marginMm = 10,
  orientation = 'portrait',
  children,
}: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const pxPerMmRef = useRef<number | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const measurePxPerMm = () => {
      if (pxPerMmRef.current && Number.isFinite(pxPerMmRef.current)) {
        return pxPerMmRef.current;
      }
      const dummy = document.createElement('div');
      dummy.style.width = '100mm';
      dummy.style.position = 'absolute';
      dummy.style.left = '-9999px';
      dummy.style.top = '0';
      document.body.appendChild(dummy);
      const measured = dummy.getBoundingClientRect().width / 100;
      document.body.removeChild(dummy);
      pxPerMmRef.current = measured > 0 ? measured : 3.7795; // fallback to 96dpi approx.
      return pxPerMmRef.current;
    };

    const mmToPx = (mm: number) => measurePxPerMm() * mm;

    const calc = () => {
      el.style.setProperty('--print-scale', '1');

      const pageWidthMm = orientation === 'portrait' ? 210 : 297;
      const pageHeightMm = orientation === 'portrait' ? 297 : 210;
      const pageWidthPx = mmToPx(pageWidthMm - marginMm * 2);
      const pageHeightPx = mmToPx(pageHeightMm - marginMm * 2);

      const contentWidth = el.scrollWidth;
      const contentHeight = el.scrollHeight;

      const scaleWidth = pageWidthPx / contentWidth;
      const scaleHeight = pageHeightPx / contentHeight;
      let scale = Math.min(1, scaleWidth, scaleHeight);
      if (!Number.isFinite(scale) || scale <= 0) {
        scale = 1;
      }

      el.style.setProperty('--print-scale', String(scale));
      el.style.setProperty('--page-width-mm', String(pageWidthMm));
      el.style.setProperty('--page-height-mm', String(pageHeightMm));
      el.setAttribute('data-print-scale', String(scale));
    };

    const resizeObserver = new ResizeObserver(() => {
      calc();
    });
    resizeObserver.observe(el);

    calc();
    window.addEventListener('beforeprint', calc);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener('beforeprint', calc);
    };
  }, [orientation, marginMm]);

  return (
    <div ref={ref} id={id} className="a4-fit">
      {children}
      <style jsx global>{`
        @media print {
          @page {
            size: A4 ${orientation};
            margin: ${marginMm}mm;
          }

          html,
          body {
            margin: 0 !important;
          }

          body * {
            visibility: hidden;
          }

          #${id}.a4-fit,
          #${id}.a4-fit * {
            visibility: visible;
          }

          #${id}.a4-fit {
            transform-origin: top left;
            transform: scale(var(--print-scale, 1));
            width: calc((var(--page-width-mm, 210) * 1mm) / var(--print-scale, 1));
            min-height: calc(var(--page-height-mm, 297) * 1mm);
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }

          #${id}.a4-fit table,
          #${id}.a4-fit .card,
          #${id}.a4-fit .row,
          #${id}.a4-fit tr,
          #${id}.a4-fit th,
          #${id}.a4-fit td {
            page-break-inside: avoid;
          }
        }
      `}</style>
    </div>
  );
}
