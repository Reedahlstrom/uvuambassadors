import { requireRole } from "@/lib/auth";
import { AdminTabs } from "./tabs";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireRole("admin");
  return (
    <div>
      <AdminTabs />
      {children}
    </div>
  );
}
