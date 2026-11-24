import { ExpenseScreen } from "../expense-screen";

export default async function EditExpense({ params }: { params: Promise<{ id: string }> }) {
  return <ExpenseScreen id={(await params).id} />;
}
