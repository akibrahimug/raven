import Link from "next/link";
import { ErrorState } from "@/components/ErrorState";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col">
      <ErrorState
        title="This raven has flown."
        message="That page doesn't exist, or it's moved on."
        action={
          <Link
            href="/"
            className="mt-2 rounded-full bg-accent px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-accent-deep"
          >
            Back to your inbox
          </Link>
        }
      />
    </main>
  );
}
