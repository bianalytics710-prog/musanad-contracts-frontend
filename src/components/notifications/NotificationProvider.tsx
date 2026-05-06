/**
 * NotificationProvider — FE-only notification system stub.
 *
 * Until a real notification table + polling service exists, this provider
 * seeds notifications from contextually-relevant data (pending approvals,
 * regulatory updates, expiring contracts). Reads/writes localStorage so
 * "mark as read" persists across reloads.
 *
 * Replace with backend-driven notifications when the entity ships.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useAuthStore, selectUser } from "@/store/auth.store";

export type NotificationSeverity = "info" | "low" | "medium" | "high" | "critical";

export interface AppNotification {
  id: string;
  severity: NotificationSeverity;
  titleEn: string;
  titleAr: string;
  bodyEn?: string;
  bodyAr?: string;
  linkUrl?: string;
  createdAt: string;
  readAt: string | null;
}

interface NotificationContextValue {
  notifications: AppNotification[];
  unreadCount: number;
  markAsRead: (id: string) => void;
  markAllRead: () => void;
}

const Ctx = createContext<NotificationContextValue | undefined>(undefined);

const STORAGE_KEY = "musanad_notifications_v1";

const SEED_NOTIFICATIONS: Omit<AppNotification, "createdAt" | "readAt">[] = [
  {
    id: "n1",
    severity: "critical",
    titleEn: "AML / CFT update — Cabinet Resolution 24/2026",
    titleAr: "تحديث مكافحة غسل الأموال — قرار مجلس الوزراء 24/2026",
    bodyEn: "Critical regulatory update affecting 3 of your contracts.",
    bodyAr: "تحديث تنظيمي حرج يؤثر على 3 من عقودك.",
    linkUrl: "/app/regulatory-radar",
  },
  {
    id: "n2",
    severity: "high",
    titleEn: "Contract expiring in 30 days: MUSANAD-2026-007",
    titleAr: "عقد ينتهي خلال 30 يومًا: MUSANAD-2026-007",
    bodyEn: "Trigger renewal-decision workflow with the line-of-business owner.",
    bodyAr: "ابدأ سير عمل قرار التجديد.",
    linkUrl: "/app/contracts/7",
  },
  {
    id: "n3",
    severity: "high",
    titleEn: "MUSANAD-2026-027 awaiting your approval (50h pending)",
    titleAr: "MUSANAD-2026-027 بانتظار موافقتك (50 ساعة معلقة)",
    bodyEn: "Crescent Petroleum Master Distribution Agreement, AED 5.5M.",
    bodyAr: "اتفاقية التوزيع الرئيسية مع كريسنت، 5.5 مليون درهم.",
    linkUrl: "/app/approvals",
  },
  {
    id: "n4",
    severity: "medium",
    titleEn: "VAT filing reminder — annual review due in 14 days",
    titleAr: "تذكير بإيداع ضريبة القيمة المضافة - المراجعة السنوية مستحقة",
    bodyEn: "Annual contract performance review for 6 active contracts.",
    bodyAr: "مراجعة الأداء السنوي لـ 6 عقود نشطة.",
    linkUrl: "/app/obligations",
  },
  {
    id: "n5",
    severity: "info",
    titleEn: "MUSANAD-2026-005 fully signed",
    titleAr: "تم توقيع MUSANAD-2026-005 بالكامل",
    bodyEn: "All required parties have signed the contract.",
    bodyAr: "وقع جميع الأطراف المطلوبين على العقد.",
    linkUrl: "/app/contracts/9",
  },
  {
    id: "n6",
    severity: "low",
    titleEn: "Welcome — 35 contracts seeded for evaluation",
    titleAr: "مرحبًا — تم إعداد 35 عقدًا للتقييم",
    bodyEn: "Demo workspace ready. Sign in as different personas to explore role-aware views.",
    bodyAr: "مساحة عمل تجريبية جاهزة.",
    linkUrl: "/app",
  },
];

function generateSeedFor(userId: number): AppNotification[] {
  const now = Date.now();
  return SEED_NOTIFICATIONS.map((n, i) => ({
    ...n,
    id: `${userId}-${n.id}`,
    createdAt: new Date(now - i * 1000 * 60 * 60 * 6).toISOString(),
    readAt: null,
  }));
}

function readFromStorage(userId: number): AppNotification[] | null {
  if (typeof localStorage === "undefined") return null;
  try {
    const raw = localStorage.getItem(`${STORAGE_KEY}_${userId}`);
    if (!raw) return null;
    return JSON.parse(raw) as AppNotification[];
  } catch {
    return null;
  }
}

function writeToStorage(userId: number, notifications: AppNotification[]): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(
      `${STORAGE_KEY}_${userId}`,
      JSON.stringify(notifications),
    );
  } catch {
    // best-effort
  }
}

export function NotificationProvider({ children }: { children: ReactNode }) {
  const user = useAuthStore(selectUser);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);

  useEffect(() => {
    if (!user) {
      setNotifications([]);
      return;
    }
    const stored = readFromStorage(user.id);
    if (stored && stored.length > 0) {
      setNotifications(stored);
    } else {
      const seed = generateSeedFor(user.id);
      writeToStorage(user.id, seed);
      setNotifications(seed);
    }
  }, [user]);

  const markAsRead = useCallback(
    (id: string) => {
      if (!user) return;
      setNotifications((prev) => {
        const next = prev.map((n) =>
          n.id === id && !n.readAt
            ? { ...n, readAt: new Date().toISOString() }
            : n,
        );
        writeToStorage(user.id, next);
        return next;
      });
    },
    [user],
  );

  const markAllRead = useCallback(() => {
    if (!user) return;
    const now = new Date().toISOString();
    setNotifications((prev) => {
      const next = prev.map((n) => (n.readAt ? n : { ...n, readAt: now }));
      writeToStorage(user.id, next);
      return next;
    });
  }, [user]);

  const unreadCount = useMemo(
    () => notifications.filter((n) => !n.readAt).length,
    [notifications],
  );

  const value: NotificationContextValue = {
    notifications,
    unreadCount,
    markAsRead,
    markAllRead,
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useNotifications(): NotificationContextValue {
  const c = useContext(Ctx);
  if (!c) {
    return {
      notifications: [],
      unreadCount: 0,
      markAsRead: () => undefined,
      markAllRead: () => undefined,
    };
  }
  return c;
}
