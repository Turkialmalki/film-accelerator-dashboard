'use client';

import { useI18n } from '@/components/providers/locale-provider';
import type { ExportSection } from '@/lib/export/types';

const NAVY = '#0F2837';
const NAVY_DEEP = '#0B1A24';
const AMBER = '#C8791B';
const INK_MUTED = '#4B5E69';
const PAPER = '#FFFFFF';
const PAPER_MUTED = '#F7F4EE';
const LINE = '#E8E3DB';

/**
 * A real, laid-out HTML report — off-screen, not `display:none` (html2canvas
 * needs an actually-painted element) — that `writers.ts` rasterizes into the
 * PDF. Styled to look like a document someone would actually want to hand
 * to an investor or a committee, not a dump of tables: a navy cover band
 * with the accent colour this whole product already uses, section cards
 * with a left accent rail, zebra-striped tables, and a footer — instead of
 * plain black-on-white HTML.
 */
export function PrintLayout({ sections }: { sections: ExportSection[] }) {
  const { t, dir, locale, fmtDate } = useI18n();
  const generatedOn = fmtDate(new Date().toISOString());

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
        background: PAPER,
        color: '#141414',
        // `--font-arabic`/`--font-latin` never existed as CSS custom
        // properties in this app — the real one, set on <html> in
        // app/[locale]/layout.tsx, is `--font-plex-arabic`. That typo meant
        // this off-screen node always fell through to the browser's generic
        // `sans-serif`, which did not shape Arabic correctly — the exported
        // title and every Arabic label in the report rendered as broken
        // glyphs. `var(--font-sans)` is the same token every other page in
        // the app uses.
        fontFamily: 'var(--font-sans, sans-serif)',
      }}
    >
      {/* Cover band — the brand navy and amber this whole product already
          uses, not a generic report header. */}
      <div
        style={{
          background: `linear-gradient(135deg, ${NAVY} 0%, #16394C 60%, ${NAVY_DEEP} 100%)`,
          padding: '30px 40px 26px',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <div
          aria-hidden
          style={{
            position: 'absolute',
            inset: 0,
            background: `radial-gradient(60% 140% at ${dir === 'rtl' ? 85 : 15}% 120%, rgba(200,121,27,0.35) 0%, rgba(200,121,27,0) 60%)`,
          }}
        />
        <div style={{ position: 'relative', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.55)' }}>
              {t.brand.commission}
            </div>
            <div style={{ marginTop: 6, fontSize: 22, fontWeight: 700, color: '#fff', letterSpacing: '-0.01em' }}>
              {t.brand.name}
            </div>
          </div>
          <div style={{ textAlign: dir === 'rtl' ? 'left' : 'right' }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#fff' }}>{t.dashboard.exportDialogTitle}</div>
            <div style={{ marginTop: 2, fontSize: 11, color: 'rgba(255,255,255,0.6)' }}>{generatedOn}</div>
          </div>
        </div>
        <div style={{ marginTop: 18, height: 3, width: 64, borderRadius: 999, background: AMBER }} />
      </div>

      <div style={{ padding: '28px 40px 36px' }}>
        {sections.map((section, si) => (
          <section
            key={section.id}
            style={{ marginBottom: si === sections.length - 1 ? 0 : 26, breakInside: 'avoid' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
              <div style={{ width: 4, height: 18, borderRadius: 999, background: AMBER }} />
              <h2 style={{ fontSize: 15, fontWeight: 700, color: NAVY, margin: 0 }}>{section.label}</h2>
            </div>

            {section.tables.map((table, ti) => (
              <div key={ti} style={{ marginBottom: 16 }}>
                {table.rows.length ? (
                  <div
                    style={{
                      borderRadius: 10,
                      border: `1px solid ${LINE}`,
                      overflow: 'hidden',
                      background: PAPER,
                    }}
                  >
                    <div
                      style={{
                        fontSize: 12,
                        fontWeight: 600,
                        color: INK_MUTED,
                        padding: '10px 14px',
                        background: PAPER_MUTED,
                        borderBottom: `1px solid ${LINE}`,
                      }}
                    >
                      {table.title}
                    </div>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                      <thead>
                        <tr>
                          {table.headers.map((h, hi) => (
                            <th
                              key={hi}
                              style={{
                                textAlign: dir === 'rtl' ? 'right' : 'left',
                                padding: '8px 14px',
                                borderBottom: `1px solid ${LINE}`,
                                fontWeight: 600,
                                color: NAVY,
                              }}
                            >
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {table.rows.map((row, ri) => (
                          <tr key={ri} style={{ background: ri % 2 === 1 ? PAPER_MUTED : PAPER }}>
                            {row.map((cell, ci) => (
                              <td
                                key={ci}
                                style={{
                                  padding: '7px 14px',
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
                  </div>
                ) : null}
              </div>
            ))}
          </section>
        ))}

        <div
          style={{
            marginTop: 30,
            paddingTop: 14,
            borderTop: `1px solid ${LINE}`,
            display: 'flex',
            justifyContent: 'space-between',
            fontSize: 10,
            color: INK_MUTED,
          }}
        >
          <span>{t.brand.name}</span>
          <span>{generatedOn}</span>
        </div>
      </div>
    </div>
  );
}
