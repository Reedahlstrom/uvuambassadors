import { requireRole } from "@/lib/auth";
import { importPeople } from "@/app/actions/admin";
import { CsvImport } from "@/components/csv-import";

const TEMPLATE = `name,email,role,team
Jordan Lee,jordan.lee@uvu.edu,ambassador,Team Timp
Ashley Jensen,ashley.jensen@uvu.edu,manager,Team Timp`;

export default async function ImportPeoplePage() {
  await requireRole("admin");
  return <CsvImport title="Import people" template={TEMPLATE} run={importPeople} doneHref="/admin/people" />;
}
