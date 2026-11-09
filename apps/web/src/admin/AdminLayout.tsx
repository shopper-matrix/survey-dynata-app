import { ClipboardList, LogOut } from 'lucide-react';
import { Suspense, useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useNavigate, useOutletContext } from 'react-router';
import { ThemeToggle } from '@/app/ThemeToggle';
import { Button } from '@/components/ui/button';
import { AdminApiError, adminApi, type Me } from './api';

/** The signed-in admin, for pages inside the layout. */
export function useAdmin(): Me {
  return useOutletContext<Me>();
}

function navClass({ isActive }: { isActive: boolean }): string {
  return `flex min-h-11 items-center gap-2 rounded-md px-3 text-sm font-medium transition-colors ${
    isActive
      ? 'bg-accent text-accent-foreground'
      : 'text-muted-foreground hover:bg-accent/60 hover:text-foreground'
  }`;
}

/** Sidebar from 768 px, a top bar on phones; sends signed-out visitors to the login page. */
export default function AdminLayout() {
  const navigate = useNavigate();
  const [me, setMe] = useState<Me | null>(null);

  useEffect(() => {
    let active = true;
    adminApi
      .me()
      .then((admin) => {
        if (active) setMe(admin);
      })
      .catch((failure: unknown) => {
        if (active && failure instanceof AdminApiError && failure.status === 401) {
          void navigate('/admin/login', { replace: true });
        }
      });
    return () => {
      active = false;
    };
  }, [navigate]);

  if (!me) return <p className="p-6 text-muted-foreground">Loading…</p>;

  return (
    <div className="min-h-svh bg-background text-foreground md:grid md:grid-cols-[14rem_1fr]">
      <aside className="border-b md:sticky md:top-0 md:flex md:h-svh md:flex-col md:border-r md:border-b-0">
        <div className="flex items-center justify-between gap-2 px-4 py-2 md:py-4">
          <Link to="/admin" className="font-semibold">
            Survey Admin
          </Link>
          <ThemeToggle />
        </div>
        <nav aria-label="Admin" className="flex gap-1 px-2 pb-2 md:flex-col">
          <NavLink to="/admin" end className={navClass}>
            <ClipboardList aria-hidden className="size-4" />
            Surveys
          </NavLink>
        </nav>
        <div className="hidden px-4 py-4 text-sm text-muted-foreground md:mt-auto md:block">
          <p className="truncate">{me.email}</p>
          <p className="capitalize">{me.role}</p>
          <Button
            variant="ghost"
            className="mt-2 h-11 px-0"
            onClick={() => {
              void adminApi.logout().finally(() => {
                void navigate('/admin/login');
              });
            }}
          >
            <LogOut aria-hidden />
            Sign out
          </Button>
        </div>
      </aside>
      <main className="min-w-0 px-4 py-6 md:px-8">
        <Suspense fallback={<p className="text-muted-foreground">Loading…</p>}>
          <Outlet context={me} />
        </Suspense>
      </main>
    </div>
  );
}
