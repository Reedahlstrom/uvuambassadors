import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { Nav } from "@/components/nav";
import { ToastProvider } from "@/components/toast";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  if (!user.onboardedAt) redirect("/welcome");
  return (
    <ToastProvider>
      <div className="min-h-dvh pb-24 md:pb-0">
        <Nav user={{ name: user.name, role: user.role }} />
        <main className="mx-auto w-full max-w-[1400px] px-4 pt-5 pb-10 sm:px-6 md:pt-8">{children}</main>
      </div>
    </ToastProvider>
  );
}
