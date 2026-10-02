// Display only. Money is never calculated in the client; balances come from
// accounts.current_balance.

// Assumption: single currency. Change here if the app should show another one.
const CURRENCY = "KZT";

const moneyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: CURRENCY,
  currencyDisplay: "narrowSymbol",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formatMoney(amount: number): string {
  return moneyFormatter.format(amount);
}
