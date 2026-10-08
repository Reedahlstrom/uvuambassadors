import { verifyLink } from "@/app/actions/auth";
import { Button } from "@/components/ui";

export default async function VerifyPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  // The token is only used when the button is pressed, so email link scanners can't burn it.
  return (
    <main className="hero-glow flex min-h-dvh items-center justify-center px-4">
      <form
        action={async () => {
          "use server";
          await verifyLink(token ?? "");
        }}
        className="w-full max-w-[380px] rounded-3xl bg-white p-8 text-center shadow-pop"
      >
        <h1 className="font-display mb-6 text-4xl text-ink">Welcome back</h1>
        <Button type="submit" size="lg" className="w-full">
          Continue
        </Button>
      </form>
    </main>
  );
}
