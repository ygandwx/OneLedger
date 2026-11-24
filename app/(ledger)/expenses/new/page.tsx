import { ExpenseScreen } from "../expense-screen";

export default async function NewExpense({ searchParams }: { searchParams: Promise<{ copy?: string }> }) {
  return <ExpenseScreen copy={(await searchParams).copy === "last"} />;
}
