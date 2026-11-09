import { Suspense } from 'react';
import { BarChart3, ClipboardList } from 'lucide-react';
import { Link, NavLink, Outlet } from 'react-router';
import { ThemeToggle } from '@/app/ThemeToggle';

const nav = [
  { to: '/admin/surveys', label: 'Surveys', icon: ClipboardList },
  { to: '/admin/dashboard', label: 'Dashboard', icon: BarChart3 },
];

function navClass({ isActive }: { isActive: boolean }): string {
  return `flex min-h-11 items-center gap-2 rounded-md px-3 text-sm font-medium transition-colors ${
    isActive ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:bg-accent/60'
  }`;
}

/** Sidebar from 768 px; a compact top bar on phones. */
export default function AdminLayout() {
  return (
    <div className="min-h-svh bg-background text-foreground md:grid md:grid-cols-[14rem_1fr]">
      <aside className="border-b md:sticky md:top-0 md:h-svh md:border-r md:border-b-0">
        <div className="flex items-center justify-between gap-2 px-4 py-2 md:py-4">
          <Link to="/" className="font-semibold">
            Survey Admin
          </Link>
          <ThemeToggle />
        </div>
        <nav aria-label="Admin" className="flex gap-1 px-2 pb-2 md:flex-col">
          {nav.map(({ to, label, icon: Icon }) => (
            <NavLink key={to} to={to} className={navClass}>
              <Icon aria-hidden className="size-4" />
              {label}
            </NavLink>
          ))}
        </nav>
      </aside>
      <main className="min-w-0 px-4 py-6 md:px-8">
        <Suspense fallback={<p className="text-muted-foreground">Loading…</p>}>
          <Outlet />
        </Suspense>
      </main>
    </div>
  );
}
