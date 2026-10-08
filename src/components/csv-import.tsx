"use client";

import Papa from "papaparse";
import { useState, useTransition } from "react";
import { Download, FileUp } from "lucide-react";
import type { ImportResult } from "@/app/actions/admin";
import { Button, Card, buttonClass, inputClass } from "./ui";

export function CsvImport({
  title,
  template,
  run,
  doneHref,
}: {
  title: string;
  template: string;
  run: (rows: Record<string, string>[]) => Promise<ImportResult>;
  doneHref: string;
}) {
  const [text, setText] = useState("");
  const [result, setResult] = useState<ImportResult | null>(null);
  const [pending, start] = useTransition();

  const parsed = text.trim() ? Papa.parse<Record<string, string>>(text.trim(), { header: true, skipEmptyLines: true }) : null;
  const rows = parsed?.data ?? [];
  const cols = parsed?.meta.fields ?? [];

  const templateHref = `data:text/csv;charset=utf-8,${encodeURIComponent(template)}`;

  return (
    <Card className="mx-auto max-w-[760px] p-6 sm:p-8">
      <h1 className="font-display mb-6 text-[34px] leading-none text-ink">{title}</h1>

      <div className="mb-4 flex flex-wrap gap-2">
        <label className={buttonClass("secondary", "md", "cursor-pointer")}>
          <FileUp size={16} /> Choose CSV file
          <input
            type="file"
            accept=".csv,text/csv"
            className="sr-only"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              if (f) setText(await f.text());
              setResult(null);
            }}
          />
        </label>
        <a href={templateHref} download="template.csv" className={buttonClass("ghost", "md")}>
          <Download size={16} /> Template
        </a>
      </div>

      <textarea
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          setResult(null);
        }}
        rows={7}
        placeholder={template}
        className={inputClass + " h-auto py-3 font-mono text-[13px]"}
      />

      {rows.length > 0 && (
        <div className="mt-5">
          <p className="mb-2 text-sm font-medium text-ink-2">
            {rows.length} {rows.length === 1 ? "row" : "rows"}
          </p>
          <div className="overflow-x-auto rounded-xl border border-line">
            <table className="w-full text-left text-[13px]">
              <thead className="bg-canvas text-muted">
                <tr>
                  {cols.map((c) => (
                    <th key={c} className="px-3 py-2 font-medium whitespace-nowrap">
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {rows.slice(0, 5).map((r, i) => (
                  <tr key={i}>
                    {cols.map((c) => (
                      <td key={c} className="px-3 py-2 whitespace-nowrap text-ink">
                        {r[c]}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {result && (
        <div className={`mt-5 rounded-xl px-4 py-3 text-sm ${result.ok ? "bg-good-soft text-good" : "bg-bad-soft text-bad"}`}>
          {result.ok ? (
            <p>
              Done — {result.created} added.{" "}
              <a href={doneHref} className="font-medium underline">
                See them
              </a>
            </p>
          ) : (
            <>
              <p className="mb-1 font-medium">Nothing was imported. Fix these and try again:</p>
              <ul className="list-disc pl-5">
                {result.errors.map((e) => (
                  <li key={e}>{e}</li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}

      <Button
        size="lg"
        className="mt-6"
        disabled={pending || rows.length === 0}
        onClick={() =>
          start(async () => {
            setResult(await run(rows));
          })
        }
      >
        {pending ? "Importing…" : `Import ${rows.length || ""}`.trim()}
      </Button>
    </Card>
  );
}
