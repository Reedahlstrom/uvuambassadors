import type { PersonProgress } from "@/lib/data";

export function StatTiles({ people, extra }: { people: PersonProgress[]; extra?: { label: string; value: number | string }[] }) {
  const tiles = [
    { label: "Behind", value: people.filter((p) => p.status === "behind").length, color: "text-warn" },
    { label: "On track", value: people.filter((p) => p.status === "on_track").length, color: "text-good" },
    { label: "Complete", value: people.filter((p) => p.status === "complete").length, color: "text-brand" },
    ...(extra ?? []).map((e) => ({ ...e, color: "text-ink" })),
  ];
  return (
    <div className={`mb-6 grid grid-cols-3 gap-3 ${tiles.length > 3 ? "md:grid-cols-4" : ""}`}>
      {tiles.map((t) => (
        <div key={t.label} className="rounded-2xl border border-line bg-white px-5 py-4 shadow-soft">
          <p className={`text-[32px] leading-none font-semibold tabular-nums ${t.color}`}>{t.value}</p>
          <p className="mt-2 text-sm text-muted">{t.label}</p>
        </div>
      ))}
    </div>
  );
}
