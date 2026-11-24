"use client";
import { type ReactNode, useMemo } from "react";
import { flexRender, getCoreRowModel, getPaginationRowModel, useReactTable, type ColumnDef } from "@tanstack/react-table";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./ui/table";
export function DataTable({ headers, rows }: { headers: string[], rows: ReactNode[][] }) {
  const columns = useMemo<ColumnDef<ReactNode[]>[]>(() => headers.map((header, i) => ({
    id: String(i), header, cell: ({row}) => row.original[i],
  })), [headers]);
  const table = useReactTable({ data: rows, columns, getCoreRowModel: getCoreRowModel(), getPaginationRowModel: getPaginationRowModel(), initialState: { pagination: {pageSize: 20} } });
  return <><Table><TableHeader>{table.getHeaderGroups().map(group => <TableRow key={group.id}>{group.headers.map(h => <TableHead key={h.id}>{flexRender(h.column.columnDef.header,h.getContext())}</TableHead>)}</TableRow>)}</TableHeader>
    <TableBody>{table.getRowModel().rows.map(row => <TableRow key={row.id}>{row.getVisibleCells().map(cell => <TableCell key={cell.id}>{flexRender(cell.column.columnDef.cell,cell.getContext())}</TableCell>)}</TableRow>)}
    {!rows.length && <TableRow><TableCell colSpan={headers.length} className="empty">暂无记录</TableCell></TableRow>}</TableBody></Table>
    {table.getPageCount()>1 && <div className="actions pager"><button className="secondary" disabled={!table.getCanPreviousPage()} onClick={()=>table.previousPage()}>上一页</button><span>{table.getState().pagination.pageIndex+1} / {table.getPageCount()}</span><button className="secondary" disabled={!table.getCanNextPage()} onClick={()=>table.nextPage()}>下一页</button></div>}</>;
}
