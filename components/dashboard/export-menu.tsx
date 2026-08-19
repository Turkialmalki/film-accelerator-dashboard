'use client';

import { useState } from 'react';
import { Download, FileSpreadsheet, FileText, Loader2, Table2 } from 'lucide-react';
import { useI18n } from '@/components/providers/locale-provider';
import { useSession } from '@/components/providers/session-provider';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import type { Finding, KpiSet, PortfolioMetrics, StageBar, StatusSlice, TrendPoint } from '@/lib/analytics';
import type { Form, Team } from '@/lib/data/types';
import type { CalendlySummary } from '@/lib/calendly/summary';
import {
  buildCalendlySection,
  buildOperationsSection,
  buildPortfolioSection,
} from '@/lib/export/build-sections';
import type { ExportSection } from '@/lib/export/types';
import { exportNodeAsPdf, exportSectionsAsCsv, exportSectionsAsExcel } from '@/lib/export/writers';
import { PrintLayout } from '@/components/dashboard/export-print-layout';

type Format = 'csv' | 'excel' | 'pdf';
type ScopeId = ExportSection['id'];

/**
 * The one export surface for the whole dashboard: pick which sections
 * (Mentorship sessions / Portfolio / Operations, any combination, or all)
 * and a format (CSV, a real .xlsx workbook, or a print-ready PDF), and get a
 * real file — every table is built from the same computed numbers already
 * on screen, never re-derived or approximated for the export.
 *
 * Calendly's data isn't available as a prop (the dashboard page doesn't own
 * it — `CalendlyPanel` fetches it independently), so this component fetches
 * `/api/calendly/summary` itself, once, only when "Mentorship sessions" is
 * actually part of the selection and the user presses download — not on
 * open, so choosing to export without that section costs nothing.
 */
export function ExportMenu({
  portfolio,
  findings,
  teams,
  kpis,
  status,
  trend,
  stages,
  forms,
}: {
  portfolio: PortfolioMetrics;
  findings: Finding[];
  teams: Team[];
  kpis: KpiSet;
  status: StatusSlice[];
  trend: TrendPoint[];
  stages: StageBar[];
  forms: Form[];
}) {
  const { t, tf, b, fmtNumber, fmtDate } = useI18n();
  const { isAdmin } = useSession();
  const [open, setOpen] = useState(false);
  const [scope, setScope] = useState<Set<ScopeId>>(
    new Set<ScopeId>(['calendly', 'portfolio', 'operations']),
  );
  const [format, setFormat] = useState<Format>('excel');
  const [phase, setPhase] = useState<'idle' | 'working' | 'done' | 'error'>('idle');
  const [printSections, setPrintSections] = useState<ExportSection[] | null>(null);

  if (!isAdmin) return null;

  const toggle = (id: ScopeId) => {
    setScope((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const i18n = { t, tf, b, fmtNumber, fmtDate };

  async function buildSelectedSections(): Promise<ExportSection[]> {
    const sections: ExportSection[] = [];

    if (scope.has('calendly')) {
      let summary: CalendlySummary | null = null;
      try {
        const res = await fetch('/api/calendly/summary');
        const body = await res.json();
        if (res.ok && body.data) summary = body.data as CalendlySummary;
      } catch {
        // A failed Calendly fetch must not block exporting the sections that
        // don't depend on it — the table just comes back empty, same as the
        // dashboard panel's own "not connected" state, not a thrown error.
      }
      sections.push(buildCalendlySection(summary, i18n));
    }
    if (scope.has('portfolio')) {
      sections.push(buildPortfolioSection(portfolio, findings, teams, i18n));
    }
    if (scope.has('operations')) {
      sections.push(buildOperationsSection(kpis, status, trend, stages, forms, i18n));
    }
    return sections;
  }

  async function handleDownload() {
    if (scope.size === 0) return;
    setPhase('working');
    try {
      const sections = await buildSelectedSections();
      if (format === 'csv') {
        exportSectionsAsCsv(sections, 'fba-dashboard');
      } else if (format === 'excel') {
        await exportSectionsAsExcel(sections, 'fba-dashboard');
      } else {
        // The PDF needs real, laid-out DOM to rasterize (see writers.ts for
        // why) — render it off-screen, wait a frame so the browser actually
        // paints it, capture it, then tear it down.
        setPrintSections(sections);
        await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
        const node = document.getElementById('fba-export-print-layout');
        if (node) {
          // The brand lockup in the print header is an <img>. A frame of
          // paint doesn't guarantee an image has actually decoded — without
          // this, html2canvas sometimes captured mid-load and the logo came
          // out clipped to whatever partial width had rendered so far.
          await Promise.all(
            Array.from(node.querySelectorAll('img')).map((img) =>
              img.complete
                ? Promise.resolve()
                : new Promise<void>((resolve) => {
                    img.addEventListener('load', () => resolve(), { once: true });
                    img.addEventListener('error', () => resolve(), { once: true });
                  }),
            ),
          );
          await exportNodeAsPdf(node, 'fba-dashboard');
        }
        setPrintSections(null);
      }
      setPhase('done');
      setTimeout(() => setPhase('idle'), 1800);
    } catch (error) {
      console.error('[export] failed', error);
      setPhase('error');
      setTimeout(() => setPhase('idle'), 2600);
    }
  }

  const scopeOptions: { id: ScopeId; label: string }[] = [
    { id: 'calendly', label: t.calendly.sectionTitle },
    { id: 'portfolio', label: t.portfolio.sectionEyebrow },
    { id: 'operations', label: t.dashboard.operationsTitle },
  ];

  const formatOptions: { id: Format; label: string; hint: string; icon: typeof Table2 }[] = [
    { id: 'csv', label: 'CSV', hint: t.dashboard.exportFormatCsvHint, icon: Table2 },
    { id: 'excel', label: 'Excel', hint: t.dashboard.exportFormatExcelHint, icon: FileSpreadsheet },
    { id: 'pdf', label: 'PDF', hint: t.dashboard.exportFormatPdfHint, icon: FileText },
  ];

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button variant="secondary" size="sm">
            <Download aria-hidden />
            {t.dashboard.exportButton}
          </Button>
        </DialogTrigger>
        <DialogContent size="md">
          <DialogHeader>
            <DialogTitle>{t.dashboard.exportDialogTitle}</DialogTitle>
            <DialogDescription>{t.dashboard.exportDialogSubtitle}</DialogDescription>
          </DialogHeader>
          <DialogBody className="space-y-6">
            <div>
              <p className="text-sm font-medium text-ink">{t.dashboard.exportScopeLabel}</p>
              <div className="mt-2.5 grid grid-cols-1 gap-2 sm:grid-cols-3">
                {scopeOptions.map((opt) => {
                  const checked = scope.has(opt.id);
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => toggle(opt.id)}
                      aria-pressed={checked}
                      className={cn(
                        'rounded-lg border px-3.5 py-3 text-start text-sm font-medium transition-colors',
                        checked
                          ? 'border-accent bg-accent-soft text-ink'
                          : 'border-line bg-surface text-ink-muted hover:border-line-strong',
                      )}
                    >
                      <span
                        className={cn(
                          'mb-1.5 inline-flex size-4 items-center justify-center rounded border',
                          checked ? 'border-accent bg-accent text-accent-ink' : 'border-line-strong',
                        )}
                        aria-hidden
                      >
                        {checked ? (
                          <svg viewBox="0 0 12 12" className="size-2.5" fill="none">
                            <path
                              d="M2 6l2.5 2.5L10 3"
                              stroke="currentColor"
                              strokeWidth="1.6"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </svg>
                        ) : null}
                      </span>
                      <span className="block">{opt.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <p className="text-sm font-medium text-ink">{t.dashboard.exportFormatLabel}</p>
              <div className="mt-2.5 grid grid-cols-1 gap-2 sm:grid-cols-3">
                {formatOptions.map((opt) => {
                  const active = format === opt.id;
                  const Icon = opt.icon;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setFormat(opt.id)}
                      aria-pressed={active}
                      className={cn(
                        'flex flex-col items-start gap-1.5 rounded-lg border px-3.5 py-3 text-start transition-colors',
                        active
                          ? 'border-accent bg-accent-soft'
                          : 'border-line bg-surface hover:border-line-strong',
                      )}
                    >
                      <span
                        className={cn(
                          'flex size-8 items-center justify-center rounded-md',
                          active ? 'bg-accent text-accent-ink' : 'bg-surface-muted text-ink-muted',
                        )}
                      >
                        <Icon className="size-4" aria-hidden />
                      </span>
                      <span className="text-sm font-semibold text-ink">{opt.label}</span>
                      <span className="text-xs leading-snug text-ink-subtle">{opt.hint}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {scope.size === 0 ? (
              <p className="text-xs text-danger">{t.dashboard.exportEmptySelection}</p>
            ) : null}
          </DialogBody>
          <DialogFooter>
            <Button
              onClick={handleDownload}
              disabled={scope.size === 0 || phase === 'working'}
              className="w-full sm:w-auto"
            >
              {phase === 'working' ? (
                <>
                  <Loader2 className="animate-spin" aria-hidden />
                  {t.dashboard.exportPreparing}
                </>
              ) : phase === 'done' ? (
                t.dashboard.exportDone
              ) : phase === 'error' ? (
                t.dashboard.exportFailed
              ) : (
                <>
                  <Download aria-hidden />
                  {t.dashboard.exportCta}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rendered off-screen, real DOM, only while a PDF is being generated —
          see writers.ts for why the PDF is rasterized from this rather than
          drawn from text directly. */}
      {printSections ? <PrintLayout sections={printSections} /> : null}
    </>
  );
}
