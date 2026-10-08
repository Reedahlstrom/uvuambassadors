"use client";

import { createContext, useCallback, useContext, useState } from "react";
import { CircleAlert, CircleCheck } from "lucide-react";

type Toast = { id: number; text: string; kind: "ok" | "error" };
const Ctx = createContext<(text: string, kind?: Toast["kind"]) => void>(() => {});

export function useToast() {
  return useContext(Ctx);
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const push = useCallback((text: string, kind: Toast["kind"] = "ok") => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, text, kind }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3200);
  }, []);
  return (
    <Ctx.Provider value={push}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-24 z-[70] flex flex-col items-center gap-2 px-4 md:bottom-8" aria-live="polite">
        {toasts.map((t) => (
          <div
            key={t.id}
            className="anim-sheet flex items-center gap-2.5 rounded-2xl bg-ink px-4 py-3 text-[15px] font-medium text-white shadow-pop"
          >
            {t.kind === "ok" ? <CircleCheck size={18} className="text-[#7ee2a8]" /> : <CircleAlert size={18} className="text-[#ffb4b4]" />}
            {t.text}
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}
