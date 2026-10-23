import { Button } from "@/components/ui/Button";
import { LockIcon, PlusIcon } from "@/components/ui/icons";

const STEPS = [
  {
    title: "Add each account",
    body: "Name it, pick its tax type, and enter the balance.",
  },
  {
    title: "Say how it's invested",
    body: "Split it across asset classes by percent or by dollars.",
  },
  {
    title: "See the whole map",
    body: "What you own overall, and which kinds of accounts hold it.",
  },
];

export function EmptyState({
  onAddAccount,
  onLoadSample,
}: {
  onAddAccount: () => void;
  onLoadSample: () => void;
}) {
  return (
    <section className="mx-auto max-w-2xl rounded-2xl border border-line bg-surface px-5 py-10 text-center sm:px-10">
      <h2 className="text-2xl font-semibold tracking-tight">Map your portfolio</h2>
      <p className="mx-auto mt-2 max-w-md text-ink-2">
        Stash Atlas shows your asset allocation and where each asset class lives across
        taxable, pre-tax, and tax-free accounts.
      </p>

      <ol className="mt-8 grid gap-3 text-left sm:grid-cols-3">
        {STEPS.map((step, i) => (
          <li key={step.title} className="rounded-xl bg-surface-2 p-4">
            <span className="text-xs font-semibold text-accent">Step {i + 1}</span>
            <p className="mt-1 text-sm font-medium">{step.title}</p>
            <p className="mt-1 text-sm text-ink-2">{step.body}</p>
          </li>
        ))}
      </ol>

      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Button variant="primary" onClick={onAddAccount}>
          <PlusIcon /> Add your first account
        </Button>
        <Button onClick={onLoadSample}>Explore with sample data</Button>
      </div>

      <p className="mt-6 inline-flex items-center gap-1.5 text-xs text-muted">
        <LockIcon width="12" height="12" />
        Everything stays in this browser. No sign-up, no account numbers, no servers.
      </p>
    </section>
  );
}
