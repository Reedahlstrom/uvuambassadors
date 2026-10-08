import type { PersonProgress } from "@/lib/data";

export function StatTiles({ people, extra }: { people: PersonProgress[]; extra?: { label: string; value: number | string }[] }) {
  const tiles = [
    { label: "Behind", value: people.filter((p) => p.status === "behind").length, color: "text-warn" },
    { label: "On track", value: people.filter((p) => p.status === "on_track").length, color: "text-good" },
    { label: "Complete", value: people.filter((p) => p.status === "complete").length, color: "text-brand" },
    ...(extra ?? []).map((e) => ({ ...e, color: "text-ink", wide: true })),
  ];
  return (
    <div className={`mb-6 grid grid-cols-3 gap-3 ${tiles.length > 3 ? "md:grid-cols-4" : ""}`}>
      {tiles.map((t) => (
        <div
          key={t.label}
          className={`rounded-2xl border border-line bg-white px-5 py-4 shadow-soft ${"wide" in t ? "col-span-3 flex items-center gap-4 md:col-span-1 md:block" : ""}`}
        >
          <p className={`text-[32px] leading-none font-semibold tabular-nums ${t.color}`}>{t.value}</p>
          <p className={`text-sm text-muted ${"wide" in t ? "md:mt-2" : "mt-2"}`}>{t.label}</p>
        </div>
      ))}
    </div>
  );
}
