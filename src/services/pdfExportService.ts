import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Transaction } from './transactionService';
import { Account } from './accountService';
import { Category } from './categoryService';

export interface PdfExportOptions {
  transactions: Transaction[];
  accounts: Account[];
  categories: Category[];
  filters: {
    accountName: string;
    categoryName: string;
    typeName: string;
    dateLabel: string;
    searchQuery: string;
  };
  summary: {
    count: number;
    credits: number;
    debits: number;
  };
  generatedBy: string; // user email
}

const formatINR = (n: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(n);

const formatDate = (d: string) =>
  new Date(d).toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' });

const today = () =>
  new Date().toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' });

export const pdfExportService = {
  exportTransactions(opts: PdfExportOptions): void {
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    const margin = 14;

    // ── Header bar ────────────────────────────────────────────
    doc.setFillColor(15, 23, 42); // #0F172A
    doc.rect(0, 0, pageW, 22, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.setTextColor(255, 255, 255);
    doc.text('FinStack', margin, 14);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(180, 190, 210);
    doc.text('Transaction Report', margin + 38, 14);

    doc.setTextColor(180, 190, 210);
    doc.setFontSize(9);
    doc.text(`Generated: ${today()}`, pageW - margin, 10, { align: 'right' });
    doc.text(`By: ${opts.generatedBy}`, pageW - margin, 16, { align: 'right' });

    let y = 30;

    // ── Applied Filters row ───────────────────────────────────
    const filterParts = [
      opts.filters.dateLabel !== 'All Time' ? `Date: ${opts.filters.dateLabel}` : null,
      opts.filters.accountName !== 'All Accounts' ? `Account: ${opts.filters.accountName}` : null,
      opts.filters.categoryName !== 'All Categories' ? `Category: ${opts.filters.categoryName}` : null,
      opts.filters.typeName !== 'All Types' ? `Type: ${opts.filters.typeName}` : null,
      opts.filters.searchQuery ? `Search: "${opts.filters.searchQuery}"` : null,
    ].filter(Boolean);

    if (filterParts.length > 0) {
      doc.setFillColor(241, 245, 249); // light slate
      doc.roundedRect(margin, y - 4, pageW - margin * 2, 10, 2, 2, 'F');
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(100, 116, 139);
      doc.text('Filters: ' + filterParts.join('  |  '), margin + 3, y + 2);
      y += 14;
    }

    // ── Summary cards (3 boxes) ─────────────────────────────
    const cardW = (pageW - margin * 2 - 12) / 4;
    const cards = [
      { label: 'Transactions', value: opts.summary.count.toString(), color: [15, 23, 42] as [number,number,number] },
      { label: 'Total Income', value: formatINR(opts.summary.credits), color: [21, 128, 61] as [number,number,number] },
      { label: 'Total Expenses', value: formatINR(opts.summary.debits), color: [190, 18, 60] as [number,number,number] },
      { label: 'Net Balance', value: formatINR(opts.summary.credits - opts.summary.debits), color: [29, 78, 216] as [number,number,number] },
    ];

    cards.forEach((card, i) => {
      const x = margin + i * (cardW + 4);
      doc.setDrawColor(229, 231, 235);
      doc.setFillColor(255, 255, 255);
      doc.roundedRect(x, y, cardW, 18, 2, 2, 'FD');

      // coloured top stripe
      doc.setFillColor(...card.color);
      doc.roundedRect(x, y, cardW, 3, 1, 1, 'F');

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(100, 116, 139);
      doc.text(card.label.toUpperCase(), x + cardW / 2, y + 7, { align: 'center' });

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(...card.color);
      doc.text(card.value, x + cardW / 2, y + 14, { align: 'center' });
    });

    y += 26;

    // ── Table ──────────────────────────────────────────────────
    const getAccount = (id: string | null) =>
      id ? (opts.accounts.find(a => a.id === id)?.name ?? id.slice(0, 8)) : 'N/A';

    const getCategory = (id: string | null) =>
      id ? (opts.categories.find(c => c.id === id)?.name ?? 'Unknown') : 'Uncategorized';

    const rows = opts.transactions.map(t => [
      formatDate(t.transaction_date),
      getAccount(t.account_id),
      t.description ?? '',
      getCategory(t.category_id),
      t.transaction_type === 'credit' ? 'Income' : 'Expense',
      formatINR(t.amount),
      t.balance ? formatINR(t.balance) : '-',
    ]);

    autoTable(doc, {
      startY: y,
      head: [['Date', 'Account', 'Description', 'Category', 'Type', 'Amount', 'Balance']],
      body: rows,
      margin: { left: margin, right: margin },
      styles: {
        fontSize: 8,
        cellPadding: 3,
        lineColor: [229, 231, 235],
        lineWidth: 0.2,
        textColor: [55, 65, 81],
      },
      headStyles: {
        fillColor: [15, 23, 42],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 8,
      },
      alternateRowStyles: { fillColor: [249, 250, 251] },
      columnStyles: {
        0: { cellWidth: 24 },
        1: { cellWidth: 32 },
        2: { cellWidth: 'auto' },
        3: { cellWidth: 28 },
        4: { cellWidth: 20 },
        5: { cellWidth: 30, halign: 'right', fontStyle: 'bold' },
        6: { cellWidth: 30, halign: 'right' },
      },
      didParseCell(data) {
        if (data.section === 'body' && data.column.index === 4) {
          const val = data.cell.raw as string;
          data.cell.styles.textColor = val === 'Income' ? [21, 128, 61] : [190, 18, 60];
          data.cell.styles.fontStyle = 'bold';
        }
        if (data.section === 'body' && data.column.index === 5) {
          const txn = opts.transactions[data.row.index];
          if (txn) {
            data.cell.styles.textColor =
              txn.transaction_type === 'credit' ? [21, 128, 61] : [190, 18, 60];
          }
        }
      },
      // Footer row with totals
      foot: [[
        '', '', '', '',
        `${opts.summary.count} rows`,
        formatINR(opts.summary.credits - opts.summary.debits),
        '',
      ]],
      footStyles: {
        fillColor: [241, 245, 249],
        textColor: [15, 23, 42],
        fontStyle: 'bold',
        fontSize: 8,
      },
      showFoot: 'lastPage',
    });

    // ── Page numbers ───────────────────────────────────────
    const totalPages = (doc as any).internal.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(156, 163, 175);
      doc.text(`Page ${i} of ${totalPages}`, pageW / 2, pageH - 6, { align: 'center' });
      doc.text('FinStack — Personal Finance Manager', margin, pageH - 6);
    }

    // ── Save ─────────────────────────────────────────────────
    const filename = `finstack-transactions-${new Date().toISOString().slice(0, 10)}.pdf`;
    doc.save(filename);
  },
};
