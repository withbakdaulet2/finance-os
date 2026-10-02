import { Card, CardContent } from "@/components/ui/card";
import { formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";

type Props = {
  label: string;
  amount: number;
  hint?: string;
  /** The one number the page is about (Free Cash): big, stacked. Others are compact rows. */
  featured?: boolean;
};

// Always full width. Real KZT amounts ("₸1,500,000.00") are too wide for a
// half-width card on a phone, so the secondary stats are label-left / amount-right
// rows instead of a grid of narrow cards. Amounts wrap rather than clip.
export function StatCard({ label, amount, hint, featured = false }: Props) {
  // Free Cash can legitimately be negative; make that visible.
  const amountClass = cn(
    "font-semibold tracking-tight tabular-nums break-words",
    amount < 0 && "text-destructive",
  );

  if (featured) {
    return (
      <Card>
        <CardContent className="flex flex-col gap-1">
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className={cn(amountClass, "text-3xl sm:text-4xl")}>
            {formatMoney(amount)}
          </p>
          {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card size="sm">
      <CardContent className="flex items-baseline justify-between gap-4">
        <p className="shrink-0 text-sm text-muted-foreground">{label}</p>
        <p className={cn(amountClass, "text-right text-xl")}>
          {formatMoney(amount)}
        </p>
      </CardContent>
    </Card>
  );
}
