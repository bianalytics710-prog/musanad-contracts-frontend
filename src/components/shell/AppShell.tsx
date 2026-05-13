import { useState, type ReactNode } from "react";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";
import { MobileTabs } from "./MobileTabs";
import { CommandPaletteProvider } from "./CommandPalette";
import { NotificationProvider } from "@/components/notifications/NotificationProvider";
import { ErrorBoundary } from "@/components/common/ErrorBoundary";
import { cn } from "@/lib/utils";
// M15 / CR-G — AI Risk Assistant floating panel (gated by ai.invoke.risk_assistant)
import { RiskAssistantPanel } from "@/features/ai/components/RiskAssistantPanel";

export function AppShell({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <NotificationProvider>
      <CommandPaletteProvider>
        <div className="min-h-screen bg-background safe-px">
        <Sidebar collapsed={collapsed} onToggle={() => setCollapsed((v) => !v)} />
        <div
          className={cn(
            "flex min-h-screen flex-col pb-16 md:pb-0",
            collapsed ? "md:ps-16" : "md:ps-60",
          )}
        >
          <TopBar />
          <main className="flex-1">
            <ErrorBoundary>{children}</ErrorBoundary>
          </main>
        </div>
          <MobileTabs />
        </div>
        {/* M15 / CR-G — AI Risk Assistant: permission-gated floating panel, visible on all routes */}
        <RiskAssistantPanel />
      </CommandPaletteProvider>
    </NotificationProvider>
  );
}
