'use client';

import { useI18n } from '@/components/providers/locale-provider';
import type { ExportSection } from '@/lib/export/types';

/**
 * A real, laid-out HTML report — off-screen, not `display:none` (html2canvas
 * needs an actually-painted element) — that `writers.ts` rasterizes into the
 * PDF. Plain white background and black text regardless of the app's active
 * theme: this is a printed document, not a screenshot of the product.
 */
export function PrintLayout({ sections }: { sections: ExportSection[] }) {
  const { t, dir, locale, fmtDate } = useI18n();

  return (
    <div
      id="fba-export-print-layout"
      dir={dir}
      lang={locale}
      style={{
        position: 'fixed',
        top: 0,
        insetInlineStart: '-99999px',
        width: '794px', // A4 at 96dpi
        background: '#FFFFFF',
        color: '#141414',
        padding: '40px',
        fontFamily: 'var(--font-arabic, var(--font-latin, sans-serif))',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: '2px solid #0F2837',
          paddingBottom: 16,
          marginBottom: 24,
        }}
      >
        {/* Text, not the FbaLockup SVG mark: html2canvas renders that
            specific multi-line lockup clipped to a fraction of its width
            regardless of how it's embedded (next/image, a plain <img>, both
            clipped identically), and `foreignObjectRendering: true` — the
            usual fix for exactly this class of SVG issue — produced solid
            black pages instead, a worse failure than a missing logo. A
            clean text wordmark is the honest tradeoff until that's root-
            caused, not a silently broken image in a document meant to be
            shared externally. */}
        <div style={{ fontSize: 20, fontWeight: 700, color: '#0F2837', letterSpacing: '-0.01em' }}>
          {t.brand.name}
        </div>

        <div style={{ textAlign: dir === 'rtl' ? 'left' : 'right', fontSize: 12, color: '#4B5E69' }}>
          <div style={{ fontWeight: 600, fontSize: 14, color: '#0F2837' }}>{t.dashboard.exportDialogTitle}</div>
          <div>{fmtDate(new Date().toISOString())}</div>
        </div>
      </div>

      {sections.map((section, si) => (
        <section
          key={section.id}
          style={{ marginBottom: si === sections.length - 1 ? 0 : 28, breakInside: 'avoid' }}
        >
          <h2
            style={{
              fontSize: 16,
              fontWeight: 700,
              color: '#0F2837',
              marginBottom: 14,
              paddingBottom: 6,
              borderBottom: '1px solid #E8E3DB',
            }}
          >
            {section.label}
          </h2>
          {section.tables.map((table, ti) => (
            <div key={ti} style={{ marginBottom: 18 }}>
              {table.rows.length ? (
                <>
                  <h3 style={{ fontSize: 13, fontWeight: 600, color: '#4B5E69', marginBottom: 6 }}>
                    {table.title}
                  </h3>
                  <table
                    style={{
                      width: '100%',
                      borderCollapse: 'collapse',
                      fontSize: 11,
                    }}
                  >
                    <thead>
                      <tr>
                        {table.headers.map((h, hi) => (
                          <th
                            key={hi}
                            style={{
                              textAlign: dir === 'rtl' ? 'right' : 'left',
                              padding: '6px 8px',
                              background: '#F4F1EC',
                              borderBottom: '1px solid #D6CEC2',
                              fontWeight: 600,
                              color: '#0F2837',
                            }}
                          >
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {table.rows.map((row, ri) => (
                        <tr key={ri}>
                          {row.map((cell, ci) => (
                            <td
                              key={ci}
                              style={{
                                padding: '6px 8px',
                                borderBottom: '1px solid #F0ECE4',
                                color: '#141414',
                              }}
                            >
                              {String(cell)}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </>
              ) : null}
            </div>
          ))}
        </section>
      ))}
    </div>
  );
}
