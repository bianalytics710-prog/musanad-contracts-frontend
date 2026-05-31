import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import {
  PenLine,
  Sun,
  Languages,
  LogOut,
  Sparkles,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { useAuthStore, selectUser, selectRefreshToken, selectHasPermission } from "@/store/auth.store";
import { useTheme } from "@/lib/design-system/theme-provider";
import { authService } from "@/services/api/auth.service";
import { modulesForRole } from "@/config/sidebar";

interface CommandPaletteContext {
  open: () => void;
  close: () => void;
  toggle: () => void;
}
const Ctx = createContext<CommandPaletteContext | undefined>(undefined);

export function useCommandPalette() {
  const c = useContext(Ctx);
  if (!c) {
    return {
      open: () => undefined,
      close: () => undefined,
      toggle: () => undefined,
    };
  }
  return c;
}

export function CommandPaletteProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const user = useAuthStore(selectUser);
  const refreshToken = useAuthStore(selectRefreshToken);
  // R0 audit bug 3.1: gate "New contract" by contract.draft so non-drafters
  // (approvers, recipients, etc.) don't see an action they can't perform.
  const canDraft = useAuthStore(selectHasPermission("contract.draft"));
  // L95 — Surface "Ask AI" in Cmd-K for personas with the risk-assistant perm.
  const canAskAi = useAuthStore(selectHasPermission("ai.invoke.risk_assistant"));
  const logoutAction = useAuthStore((s) => s.logout);
  const { toggleTheme, locale, setLocale } = useTheme();

  const items = modulesForRole(user?.role.name);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        e.stopPropagation();
        setIsOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const go = useCallback(
    (to: string) => {
      setIsOpen(false);
      void navigate({ to });
    },
    [navigate],
  );

  const handleSignOut = useCallback(async () => {
    setIsOpen(false);
    try {
      if (refreshToken) await authService.logout({ refreshToken });
    } catch {
      // best-effort
    } finally {
      logoutAction();
      void navigate({ to: "/auth/login" });
    }
  }, [refreshToken, logoutAction, navigate]);

  const handleToggleLang = () => {
    const next = locale === "ar" ? "en" : "ar";
    setLocale(next);
    void i18n.changeLanguage(next);
    setIsOpen(false);
  };

  return (
    <Ctx.Provider
      value={{
        open: () => setIsOpen(true),
        close: () => setIsOpen(false),
        toggle: () => setIsOpen((v) => !v),
      }}
    >
      {children}
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-lg overflow-hidden rounded-xl border border-border bg-card p-0">
          <VisuallyHidden>
            <DialogTitle>
              {t("commandPalette.title", { defaultValue: "Command palette" })}
            </DialogTitle>
          </VisuallyHidden>
          <Command>
            <CommandInput
              placeholder={t("commandPalette.placeholder", {
                defaultValue: "Search pages, run actions…",
              })}
            />
            <CommandList>
              <CommandEmpty>
                {t("commandPalette.empty", { defaultValue: "No matches." })}
              </CommandEmpty>

              {items.length > 0 && (
                <CommandGroup
                  heading={t("commandPalette.pages", { defaultValue: "Pages" })}
                >
                  {items.map((item) => {
                    const Icon = item.icon;
                    return (
                      <CommandItem key={item.key} onSelect={() => go(item.to)}>
                        <Icon className="me-2 h-4 w-4" />
                        {t(item.labelKey, { defaultValue: item.defaultLabel })}
                      </CommandItem>
                    );
                  })}
                </CommandGroup>
              )}

              <CommandSeparator />

              <CommandGroup
                heading={t("commandPalette.actions", { defaultValue: "Actions" })}
              >
                {canAskAi && (
                  <CommandItem
                    onSelect={() => {
                      setIsOpen(false);
                      window.dispatchEvent(new CustomEvent("open-risk-assistant"));
                    }}
                  >
                    <Sparkles className="me-2 h-4 w-4" />
                    {t("commandPalette.actions.askAi", {
                      defaultValue: "Ask AI risk assistant",
                    })}
                  </CommandItem>
                )}
                {canDraft && (
                  <CommandItem onSelect={() => go("/app/contracts/compose")}>
                    <PenLine className="me-2 h-4 w-4" />
                    {t("commandPalette.actions.newContract", {
                      defaultValue: "New contract",
                    })}
                    <span className="ms-auto font-mono text-xs text-ink-subtle">⌘N</span>
                  </CommandItem>
                )}
                <CommandItem
                  onSelect={() => {
                    toggleTheme();
                    setIsOpen(false);
                  }}
                >
                  <Sun className="me-2 h-4 w-4" />
                  {t("commandPalette.actions.toggleTheme", {
                    defaultValue: "Toggle theme",
                  })}
                </CommandItem>
                <CommandItem onSelect={handleToggleLang}>
                  <Languages className="me-2 h-4 w-4" />
                  {t("commandPalette.actions.toggleLanguage", {
                    defaultValue: "Toggle language",
                  })}{" "}
                  ({locale === "ar" ? "ع" : "EN"})
                </CommandItem>
                {user && (
                  <CommandItem
                    onSelect={() => {
                      void handleSignOut();
                    }}
                    className="text-terracotta data-[selected=true]:bg-terracotta/10 data-[selected=true]:text-terracotta"
                  >
                    <LogOut className="me-2 h-4 w-4" />
                    {t("commandPalette.actions.signOut", {
                      defaultValue: "Sign out",
                    })}
                  </CommandItem>
                )}
              </CommandGroup>
            </CommandList>
          </Command>
        </DialogContent>
      </Dialog>
    </Ctx.Provider>
  );
}
