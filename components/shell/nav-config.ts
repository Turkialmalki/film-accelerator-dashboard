import type { Dict } from '@/lib/i18n/dictionaries';
import type { Role } from '@/lib/data/types';
import { isAdminRole } from '@/lib/routes';

export interface NavItem {
  href: string;
  label: (t: Dict) => string;
  icon: string;
}

export interface NavSection {
  key: string;
  label: (t: Dict) => string;
  items: NavItem[];
}

const ADMIN_MAIN: NavItem[] = [
  { href: '/dashboard', label: (t) => t.nav.dashboard, icon: 'LayoutDashboard' },
  { href: '/teams', label: (t) => t.nav.teams, icon: 'Users' },
  { href: '/forms', label: (t) => t.nav.forms, icon: 'FileText' },
  { href: '/results', label: (t) => t.nav.results, icon: 'BarChart3' },
];

const ADMIN_ACCOUNT: NavItem[] = [
  { href: '/appearance', label: (t) => t.nav.appearance, icon: 'Palette' },
  { href: '/settings', label: (t) => t.nav.settings, icon: 'Settings' },
  { href: '/help', label: (t) => t.nav.help, icon: 'CircleHelp' },
  { href: '/profile', label: (t) => t.nav.profile, icon: 'UserRound' },
];

const PARTICIPANT_MAIN: NavItem[] = [
  { href: '/overview', label: (t) => t.nav.overview, icon: 'LayoutDashboard' },
  { href: '/my-team', label: (t) => t.nav.myTeam, icon: 'Users' },
  { href: '/assigned-forms', label: (t) => t.nav.assignedForms, icon: 'FileText' },
  { href: '/my-submissions', label: (t) => t.nav.mySubmissions, icon: 'Inbox' },
];

const PARTICIPANT_ACCOUNT: NavItem[] = [
  { href: '/help', label: (t) => t.nav.help, icon: 'CircleHelp' },
  { href: '/profile', label: (t) => t.nav.profile, icon: 'UserRound' },
];

export function navFor(role: Role | null | undefined): NavSection[] {
  const admin = isAdminRole(role);
  return [
    {
      key: 'main',
      label: (t) => t.nav.sectionMain,
      items: admin ? ADMIN_MAIN : PARTICIPANT_MAIN,
    },
    {
      key: 'account',
      label: (t) => t.nav.sectionAccount,
      items: admin ? ADMIN_ACCOUNT : PARTICIPANT_ACCOUNT,
    },
  ];
}
