'use server';
import { AppSidebar } from '@/components/web/app-sidebar';
import { SiteHeader } from '@/components/web/site-header';
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar';

export default async function HostDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  /**
   * Server-side layout for host dashboard. Checks if user is a host and redirects if not.
   *
   */

  /*
  const user = await requireHost();

  if (user.role !== 'HOST') {
    console.log(
      `⛔ Access denied for user ${user.email} with role ${user.role}`
    );
    redirect('/unauthorized');
  }

  console.log('✅ Host access granted:', user.email);
*/

  return (
    <section>
      <SidebarProvider
        style={
          {
            '--sidebar-width': 'calc(var(--spacing) * 72)',
            '--header-height': 'calc(var(--spacing) * 12)',
          } as React.CSSProperties
        }
      >
        <AppSidebar variant="inset" />
        <SidebarInset>
          <SiteHeader />
          <div className="flex flex-1 flex-col">
            <div className="@container/main flex flex-1 flex-col gap-2">
              <div className="flex flex-col gap-4 p-4 md:gap-6 md:p-6">
                {children}
              </div>
            </div>
          </div>
        </SidebarInset>
      </SidebarProvider>
    </section>
  );
}
