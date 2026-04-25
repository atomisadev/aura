import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SidebarProvider>
      <AppSidebar />
      <div className="flex h-svh min-h-0 w-full flex-col overflow-hidden bg-background text-foreground">
        <header className="flex h-14 shrink-0 items-center gap-4 border-b bg-card/50 backdrop-blur-sm px-4 lg:h-[60px] lg:px-6 sticky top-0 z-10">
          <SidebarTrigger />
          <div className="font-semibold text-sm tracking-tight text-muted-foreground">
            Aura Workspace
          </div>
        </header>

        <main className="flex min-h-0 flex-1 justify-center overflow-y-auto px-4 py-6 lg:px-6">
          {children}
        </main>
      </div>
    </SidebarProvider>
  );
}
