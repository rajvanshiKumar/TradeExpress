import { create } from "zustand";

const KEY = "tx.session";

interface Persisted {
  accessToken: string | null;
  refreshToken: string | null;
  orgId: string | null;
}

interface SessionState extends Persisted {
  hydrated: boolean;
  setTokens: (access: string, refresh: string) => void;
  setOrg: (orgId: string | null) => void;
  hydrate: () => void;
  clear: () => void;
}

export const DEFAULT_SESSION: Persisted = {
  accessToken: "demo-live-access-token",
  refreshToken: "demo-live-refresh-token",
  orgId: "00000000-0000-0000-0000-000000000001",
};

function persist(s: Persisted) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* storage unavailable: session lives in memory */
  }
}

export const useSession = create<SessionState>((set, get) => ({
  accessToken: DEFAULT_SESSION.accessToken,
  refreshToken: DEFAULT_SESSION.refreshToken,
  orgId: DEFAULT_SESSION.orgId,
  hydrated: false,
  setTokens: (accessToken, refreshToken) => {
    set({ accessToken, refreshToken });
    persist({ accessToken, refreshToken, orgId: get().orgId });
  },
  setOrg: (orgId) => {
    set({ orgId });
    persist({ accessToken: get().accessToken, refreshToken: get().refreshToken, orgId });
  },
  hydrate: () => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<Persisted>;
        set({
          accessToken: parsed.accessToken !== undefined ? parsed.accessToken : DEFAULT_SESSION.accessToken,
          refreshToken: parsed.refreshToken !== undefined ? parsed.refreshToken : DEFAULT_SESSION.refreshToken,
          orgId: parsed.orgId !== undefined ? parsed.orgId : DEFAULT_SESSION.orgId,
        });
      }
    } catch {
      /* ignore */
    }
    set({ hydrated: true });
  },
  clear: () => {
    set({ accessToken: null, refreshToken: null, orgId: null });
    try {
      localStorage.removeItem(KEY);
    } catch {
      /* ignore */
    }
  },
}));
