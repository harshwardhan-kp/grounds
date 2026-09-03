import Link from "next/link";
import { DepositionGrid } from "@/components/DepositionGrid";
import { Bracket, Rule, Wordmark } from "@/components/ui";

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
    <main className="mx-auto flex max-w-[1100px] flex-col gap-8 px-5 py-12 min-[720px]:py-16">
      <header className="flex flex-col gap-4">
        <div>
          <Link
            href="/"
            className="group meta inline-flex items-center no-underline"
          >
            <Bracket
              tone="muted"
              className="transition-colors group-hover:text-ink"
            >
              ← grounds
            </Bracket>
          </Link>
        </div>

        <div className="flex flex-col gap-2">
          <div className="flex items-baseline gap-2.5">
            <Bracket tone="muted">01</Bracket>
            <h1 className="display text-3xl leading-tight text-ink min-[720px]:text-4xl">
              Deposition
            </h1>
          </div>
          <p className="max-w-[62ch] text-sm leading-normal text-muted">
            Ask generative search the questions a customer, regulator, or journalist
            would actually type, then test every assertion it makes against the
            sources it cites. Each cell below is one live search.
          </p>
        </div>
      </header>

      <Rule />

      <div className="scroll-x w-full">
        <DepositionGrid />
      </div>

      <Rule />

      <Wordmark text="grounds" />
    </main>
  );
}
