import { requireRole } from "@/lib/auth";
import { importEvents } from "@/app/actions/admin";
import { CsvImport } from "@/components/csv-import";

const TEMPLATE = `title,type,date,start,end,location,spots,with_ac,notes
Campus tour,tour,2026-10-14,10:00,11:00,Welcome Center,2,,
Orem High,hs visit,10/15/2026,8:30 AM,11:00 AM,Orem High,3,yes,Carpool from the Welcome Center
Preview Day,event,2026-10-17,9:00,12:00,Sorensen Student Center,8,,`;

export default async function ImportEventsPage() {
  await requireRole("admin");
  return <CsvImport title="Import events" template={TEMPLATE} run={importEvents} doneHref="/admin/events" />;
}
