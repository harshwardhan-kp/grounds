import Link from "next/link";
import { DepositionGrid } from "@/components/DepositionGrid";

export const metadata = {
  title: "Deposition — Grounds",
  description: "Run a live audit against generative search answers.",
};

/**
 * Live audit screen. Kept deliberately thin: the grid owns all streaming state,
 * this page only frames it and states the cost up front, since every run spends
 * real search budget.
 */
export default function DeposePage() {
  return (
    <main className="mx-auto flex max-w-[1100px] flex-col gap-6 px-5 py-12">
      <div className="flex flex-col gap-2">
        <Link href="/" className="meta text-accent no-underline hover:underline">
          ← Grounds
        </Link>
        <h1 className="font-serif text-3xl">Deposition</h1>
        <p className="max-w-[62ch] text-muted">
          Ask generative search the questions a customer, regulator, or journalist
          would actually type, then test every assertion it makes against the
          sources it cites. Each cell below is one live search.
        </p>
      </div>
      <DepositionGrid />
    </main>
  );
}
