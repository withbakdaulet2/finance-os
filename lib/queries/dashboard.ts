import { currentMonthRange, type MonthRange } from "@/lib/dates";
import { createClient } from "@/lib/supabase/server";

export type PeriodSummary = {
  income: number;
  expenses: number;
  capital: number;
  freeCash: number;
};

// Income / Expenses / Capital / Free Cash for the current Asia/Almaty month.
// Summed in Postgres (numeric, no float drift) over activity_transactions, which
// leaves out opening-balance rows. Free Cash = Income - Expenses - Capital.
// The numbers are for display only: never do further money math on them here.
export async function getCurrentMonthSummary(): Promise<{
  month: MonthRange;
  summary: PeriodSummary;
}> {
  const supabase = await createClient();
  const month = currentMonthRange();

  const { data, error } = await supabase
    .rpc("period_summary", {
      p_from: month.from,
      p_to_exclusive: month.toExclusive,
    })
    .single();

  if (error) {
    throw new Error(`Failed to load the monthly summary: ${error.message}`);
  }

  return {
    month,
    summary: {
      income: data.income,
      expenses: data.expenses,
      capital: data.capital,
      freeCash: data.free_cash,
    },
  };
}
