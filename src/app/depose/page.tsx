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
    <main className="mx-auto flex max-w-[1100px] flex-col gap-10 px-5 pt-12 pb-0 min-[720px]:pt-16">
      <header className="mx-auto flex w-full max-w-[1080px] flex-col gap-6">
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

        <div className="flex flex-col gap-3">
          <div className="flex items-baseline justify-center gap-2.5 text-center">
            <Bracket tone="muted">01</Bracket>
            <h1 className="display text-[2rem] leading-tight text-ink">
              Deposition
            </h1>
          </div>
          <p className="mx-auto max-w-[64ch] text-[1.02rem] leading-relaxed text-muted">
            Ask generative search the questions a customer, regulator, or journalist
            would actually type, then test every assertion it makes against the
            sources it cites. Each cell below is one live search.
          </p>
        </div>
      </header>

      <Rule className="mx-auto max-w-[1080px]" />

      <div className="scroll-x mx-auto w-full max-w-[1080px]">
        <DepositionGrid />
      </div>

      <Rule className="mx-auto max-w-[1080px]" />

      <Wordmark text="grounds" />
    </main>
  );
}
