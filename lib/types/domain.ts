import type { Database } from "./database.types";

type Tables = Database["public"]["Tables"];

export type Account = Tables["accounts"]["Row"];
export type Category = Tables["categories"]["Row"];
export type Transaction = Tables["transactions"]["Row"];

export type AccountType = Account["type"];

// Order = order shown in the account type picker.
export const ACCOUNT_TYPES: { value: AccountType; label: string }[] = [
  { value: "cash", label: "Cash" },
  { value: "bank", label: "Bank" },
  { value: "emergency_fund", label: "Emergency fund" },
  { value: "investment", label: "Investment" },
  { value: "umrah_fund", label: "Umrah fund" },
  { value: "business_fund", label: "Business fund" },
  { value: "other", label: "Other" },
];

export function isAccountType(value: string): value is AccountType {
  return ACCOUNT_TYPES.some((t) => t.value === value);
}

export function accountTypeLabel(type: AccountType): string {
  return ACCOUNT_TYPES.find((t) => t.value === type)?.label ?? type;
}

export type TransactionType = Transaction["type"];

// Order = order of the type switch in the Add Transaction form.
export const TRANSACTION_TYPES: {
  value: TransactionType;
  label: string;
}[] = [
  { value: "expense", label: "Expense" },
  { value: "income", label: "Income" },
  { value: "capital_allocation", label: "Capital" },
];

export function isTransactionType(value: string): value is TransactionType {
  return TRANSACTION_TYPES.some((t) => t.value === value);
}

export function transactionTypeLabel(type: TransactionType): string {
  return TRANSACTION_TYPES.find((t) => t.value === type)?.label ?? type;
}

// A transaction may only use a category of the matching kind.
export function categoryTypeFor(type: TransactionType): CategoryType {
  return type === "capital_allocation" ? "capital" : type;
}

export type CategoryType = Category["type"];

// Order = order of the sections on the Categories page.
export const CATEGORY_TYPES: {
  value: CategoryType;
  label: string; // section heading
  singular: string; // "New <singular> category"
}[] = [
  { value: "income", label: "Income", singular: "income" },
  { value: "expense", label: "Expenses", singular: "expense" },
  { value: "capital", label: "Capital", singular: "capital" },
];

export function isCategoryType(value: string): value is CategoryType {
  return CATEGORY_TYPES.some((t) => t.value === value);
}
