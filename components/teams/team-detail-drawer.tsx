'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  Activity,
  Check,
  ClipboardCopy,
  FileText,
  Loader2,
  Lock,
  Mail,
  Pencil,
  Ticket,
  Trash2,
} from 'lucide-react';
import {
  Drawer,
  DrawerBody,
  DrawerContent,
  DrawerFooter,
  DrawerHeader,
} from '@/components/ui/drawer';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input, NativeSelect, Textarea } from '@/components/ui/input';
import {
  Field,
  Progress,
  Separator,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/misc';
import { useI18n } from '@/components/providers/locale-provider';
import { getRepository } from '@/lib/data';
import type { Form, Invitation, Role, Submission, Team } from '@/lib/data/types';

export function TeamDetailDrawer({
  team,
  open,
  onOpenChange,
  onEdit,
}: {
  team: Team | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit: (team: Team) => void;
}) {
  const { t, b, fmtDate, fmtDateTime, fmtNumber } = useI18n();
  const [forms, setForms] = useState<Form[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [notes, setNotes] = useState('');
  const [notesSaved, setNotesSaved] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<Role>('participant');
  const [inviting, setInviting] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!team) return;
    const repo = getRepository();
    const [allForms, teamSubs, allInvites] = await Promise.all([
      repo.listForms(),
      repo.listSubmissionsForTeam(team.id),
      repo.listInvitations(),
    ]);
    const audiences = await Promise.all(allForms.map((f) => repo.listAudience(f.id)));
    setForms(
      allForms.filter((form, i) => {
        if (form.status === 'draft') return false;
        const audience = audiences[i];
        if (!audience.length || audience.some((a) => a.scope === 'all')) return true;
        return audience.some((a) => a.team_id === team.id);
      }),
    );
    setSubmissions(teamSubs);
    setInvitations(allInvites.filter((inv) => inv.team_id === team.id));
  }, [team]);

  useEffect(() => {
    if (!open || !team) return;
    setNotes(team.internal_notes);
    setNotesSaved(false);
    void load();
  }, [open, team, load]);

  if (!team) return null;

  const submissionsByForm = new Map(submissions.map((s) => [s.form_id, s]));

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent width="max-w-2xl">
        <DrawerHeader>
          <p className="text-xs font-medium uppercase tracking-wide text-ink-subtle">
            {t.teams.detailTitle}
          </p>
          <h2 className="text-lg font-semibold text-ink">{b(team.name)}</h2>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <Badge tone="accent">{t.stages[team.stage]}</Badge>
            <Badge tone="neutral">{b(team.track)}</Badge>
            <Badge tone={team.status === 'active' ? 'success' : 'warning'}>
              {team.status === 'active' ? t.common.active : t.common.archived}
            </Badge>
          </div>
        </DrawerHeader>

        <DrawerBody className="pt-4">
          <Tabs defaultValue="profile">
            <TabsList className="mb-4 flex-wrap">
              <TabsTrigger value="profile">{t.teams.detailTitle}</TabsTrigger>
              <TabsTrigger value="forms">{t.teams.assignedForms}</TabsTrigger>
              <TabsTrigger value="invites">{t.teams.invitations}</TabsTrigger>
              <TabsTrigger value="activity">{t.teams.activity}</TabsTrigger>
            </TabsList>

            {/* ------------------------------------------------------ profile */}
            <TabsContent value="profile" className="flex flex-col gap-5">
              <div>
                <p className="mb-1.5 flex items-baseline justify-between text-sm">
                  <span className="font-medium text-ink">{t.teams.readiness}</span>
                  <span className="tnum text-ink-muted">{fmtNumber(team.readiness)}%</span>
                </p>
                <Progress value={team.readiness} />
              </div>

              <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                <Detail label={t.teams.city} value={b(team.city)} />
                <Detail label={t.teams.teamSize} value={fmtNumber(team.team_size)} />
                <Detail label={t.teams.revenue} value={team.revenue_band} />
                <Detail label={t.teams.businessModel} value={b(team.business_model)} />
              </dl>

              {b(team.description) ? (
                <div>
                  <p className="mb-1 text-sm font-medium text-ink">{t.teams.description}</p>
                  <p className="text-sm leading-relaxed text-ink-muted">{b(team.description)}</p>
                </div>
              ) : null}

              {team.founders.length ? (
                <div>
                  <p className="mb-2 text-sm font-medium text-ink">{t.teams.founders}</p>
                  <ul className="flex flex-col gap-2">
                    {team.founders.map((founder, i) => (
                      <li
                        key={`${founder.name.ar}-${i}`}
                        className="flex items-center justify-between rounded-md border border-line bg-surface-muted/50 px-3 py-2 text-sm"
                      >
                        <span className="font-medium text-ink">{b(founder.name)}</span>
                        <span className="text-ink-subtle">{b(founder.role)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {team.key_strengths.length ? (
                <ListBlock title={t.teams.strengths} items={team.key_strengths} tone="success" />
              ) : null}
              {team.challenges.length ? (
                <ListBlock title={t.teams.challenges} items={team.challenges} tone="warning" />
              ) : null}
              {team.growth_path ? (
                <div>
                  <p className="mb-1 text-sm font-medium text-ink">{t.teams.growthPath}</p>
                  <p className="text-sm leading-relaxed text-ink-muted">{team.growth_path}</p>
                </div>
              ) : null}

              <Separator />

              <Field
                label={
                  <span className="inline-flex items-center gap-1.5">
                    <Lock className="size-3.5 text-ink-subtle" aria-hidden />
                    {t.teams.internalNotes}
                  </span>
                }
                hint={t.teams.internalNotesHint}
                htmlFor="internalNotes"
              >
                <Textarea
                  id="internalNotes"
                  rows={3}
                  value={notes}
                  onChange={(e) => {
                    setNotes(e.target.value);
                    setNotesSaved(false);
                  }}
                />
              </Field>
              <Button
                variant="secondary"
                size="sm"
                className="w-fit"
                onClick={async () => {
                  await getRepository().updateTeam(team.id, { internal_notes: notes });
                  setNotesSaved(true);
                }}
              >
                {notesSaved ? <Check aria-hidden /> : null}
                {notesSaved ? t.common.saved : t.common.save}
              </Button>
            </TabsContent>

            {/* -------------------------------------------------------- forms */}
            <TabsContent value="forms" className="flex flex-col gap-4">
              <div>
                <p className="mb-2 text-sm font-medium text-ink">{t.teams.assignedForms}</p>
                {forms.length === 0 ? (
                  <p className="text-sm text-ink-subtle">{t.teams.noAssigned}</p>
                ) : (
                  <ul className="flex flex-col gap-2">
                    {forms.map((form) => {
                      const submission = submissionsByForm.get(form.id);
                      return (
                        <li
                          key={form.id}
                          className="flex items-center gap-3 rounded-md border border-line px-3 py-2.5"
                        >
                          <FileText className="size-4 shrink-0 text-ink-subtle" aria-hidden />
                          <span className="min-w-0 flex-1 truncate text-sm text-ink">
                            {b(form.title)}
                          </span>
                          <Badge
                            tone={
                              !submission
                                ? 'neutral'
                                : submission.status === 'reviewed'
                                  ? 'success'
                                  : submission.status === 'submitted'
                                    ? 'accent'
                                    : 'warning'
                            }
                          >
                            {!submission
                              ? t.results.notResponded
                              : submission.status === 'reviewed'
                                ? t.dashboard.statusReviewed
                                : submission.status === 'submitted'
                                  ? t.dashboard.statusSubmitted
                                  : t.dashboard.statusDraft}
                          </Badge>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>

              <Separator />

              <div>
                <p className="mb-2 text-sm font-medium text-ink">{t.teams.submissionHistory}</p>
                {submissions.length === 0 ? (
                  <p className="text-sm text-ink-subtle">{t.teams.noSubmissions}</p>
                ) : (
                  <ul className="flex flex-col gap-2">
                    {submissions
                      .slice()
                      .sort((a, b2) => (b2.submitted_at ?? '').localeCompare(a.submitted_at ?? ''))
                      .map((submission) => {
                        const form = forms.find((f) => f.id === submission.form_id);
                        return (
                          <li
                            key={submission.id}
                            className="flex items-center justify-between gap-3 rounded-md border border-line px-3 py-2.5 text-sm"
                          >
                            <span className="min-w-0 truncate text-ink">
                              {form ? b(form.title) : submission.form_id}
                            </span>
                            <span className="tnum shrink-0 text-xs text-ink-subtle">
                              {fmtDateTime(submission.submitted_at ?? submission.started_at)}
                            </span>
                          </li>
                        );
                      })}
                  </ul>
                )}
              </div>
            </TabsContent>

            {/* ------------------------------------------------------ invites */}
            <TabsContent value="invites" className="flex flex-col gap-4">
              <div className="flex flex-col gap-3 rounded-lg border border-line bg-surface-muted/50 p-4">
                <Field label={t.teams.inviteEmail} htmlFor="inviteEmail">
                  <Input
                    id="inviteEmail"
                    type="email"
                    dir="ltr"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    placeholder="founder@example.com"
                  />
                </Field>
                <Field label={t.teams.inviteRole} htmlFor="inviteRole">
                  <NativeSelect
                    id="inviteRole"
                    value={inviteRole}
                    onChange={(e) => setInviteRole(e.target.value as Role)}
                  >
                    <option value="participant">{t.roles.participant}</option>
                    <option value="reviewer">{t.roles.reviewer}</option>
                    <option value="admin">{t.roles.admin}</option>
                  </NativeSelect>
                </Field>
                <Button
                  size="sm"
                  className="w-fit"
                  disabled={!inviteEmail.includes('@') || inviting}
                  onClick={async () => {
                    setInviting(true);
                    await getRepository().createInvitation({
                      email: inviteEmail,
                      role: inviteRole,
                      team_id: team.id,
                    });
                    setInviteEmail('');
                    await load();
                    setInviting(false);
                  }}
                >
                  {inviting ? <Loader2 className="animate-spin" aria-hidden /> : <Mail aria-hidden />}
                  {t.teams.sendInvite}
                </Button>
              </div>

              {invitations.length === 0 ? (
                <p className="text-sm text-ink-subtle">{t.teams.noInvites}</p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {invitations.map((invitation) => (
                    <li
                      key={invitation.id}
                      className="flex flex-wrap items-center gap-3 rounded-md border border-line px-3 py-2.5"
                    >
                      <Ticket className="size-4 shrink-0 text-ink-subtle" aria-hidden />
                      <span className="min-w-0 flex-1 truncate text-sm text-ink" dir="ltr">
                        {invitation.email}
                      </span>
                      <code className="tnum rounded bg-surface-muted px-2 py-0.5 text-xs text-ink" dir="ltr">
                        {invitation.code}
                      </code>
                      <Badge
                        tone={
                          invitation.status === 'accepted'
                            ? 'success'
                            : invitation.status === 'pending'
                              ? 'accent'
                              : 'danger'
                        }
                      >
                        {invitation.status}
                      </Badge>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={t.common.copy}
                        onClick={async () => {
                          await navigator.clipboard.writeText(invitation.code);
                          setCopied(invitation.id);
                          setTimeout(() => setCopied(null), 1600);
                        }}
                      >
                        {copied === invitation.id ? <Check aria-hidden /> : <ClipboardCopy aria-hidden />}
                      </Button>
                      {invitation.status === 'pending' ? (
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label={t.common.delete}
                          onClick={async () => {
                            await getRepository().revokeInvitation(invitation.id);
                            await load();
                          }}
                        >
                          <Trash2 aria-hidden />
                        </Button>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
            </TabsContent>

            {/* ----------------------------------------------------- activity */}
            <TabsContent value="activity">
              <ol className="relative flex flex-col gap-5 ps-5">
                <span
                  aria-hidden
                  className="absolute inset-y-1 w-px bg-line ltr:left-[3px] rtl:right-[3px]"
                />
                <TimelineItem
                  label={t.common.create}
                  detail={b(team.name)}
                  when={fmtDate(team.created_at)}
                />
                {submissions
                  .slice()
                  .sort((a, b2) => (b2.submitted_at ?? '').localeCompare(a.submitted_at ?? ''))
                  .slice(0, 8)
                  .map((submission) => (
                    <TimelineItem
                      key={submission.id}
                      label={
                        submission.status === 'draft'
                          ? t.dashboard.statusDraft
                          : t.dashboard.statusSubmitted
                      }
                      detail={
                        forms.find((f) => f.id === submission.form_id)
                          ? b(forms.find((f) => f.id === submission.form_id)!.title)
                          : submission.form_id
                      }
                      when={fmtDateTime(submission.submitted_at ?? submission.started_at)}
                    />
                  ))}
                <TimelineItem
                  label={t.common.edit}
                  detail={b(team.name)}
                  when={fmtDate(team.updated_at)}
                />
              </ol>
            </TabsContent>
          </Tabs>
        </DrawerBody>

        <DrawerFooter>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            {t.common.close}
          </Button>
          <Button onClick={() => onEdit(team)}>
            <Pencil aria-hidden />
            {t.common.edit}
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-ink-subtle">{label}</dt>
      <dd className="font-medium text-ink">{value || '—'}</dd>
    </div>
  );
}

function ListBlock({
  title,
  items,
  tone,
}: {
  title: string;
  items: string[];
  tone: 'success' | 'warning';
}) {
  return (
    <div>
      <p className="mb-2 text-sm font-medium text-ink">{title}</p>
      <ul className="flex flex-col gap-1.5">
        {items.map((item, i) => (
          <li key={i} className="flex gap-2.5 text-sm leading-relaxed text-ink-muted">
            <span
              aria-hidden
              className="mt-2 size-1.5 shrink-0 rounded-full"
              style={{ backgroundColor: tone === 'success' ? 'var(--c-success)' : 'var(--c-warning)' }}
            />
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

function TimelineItem({ label, detail, when }: { label: string; detail: string; when: string }) {
  return (
    <li className="relative">
      <span
        aria-hidden
        className="absolute top-1.5 size-[7px] rounded-full bg-accent ltr:-left-5 rtl:-right-5"
      />
      <p className="flex items-center gap-2 text-sm font-medium text-ink">
        <Activity className="size-3.5 text-ink-subtle" aria-hidden />
        {label}
      </p>
      <p className="text-sm text-ink-muted">{detail}</p>
      <p className="tnum text-xs text-ink-subtle">{when}</p>
    </li>
  );
}
