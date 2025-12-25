export interface ParsedTransaction {
  transaction_date: string;
  description: string;
  transaction_type: 'debit' | 'credit';
  amount: number;
  balance: number | null;
  category?: string;
}

class TransactionParser {
  parseCSV(content: string): ParsedTransaction[] {
    const lines = content.trim().split('\n');
    if (lines.length < 2) {
      throw new Error('CSV file is empty or invalid');
    }

    const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
    const transactions: ParsedTransaction[] = [];

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map(v => v.trim());
      
      // Skip empty lines
      if (values.length < 2 || values.every(v => !v)) continue;
      
      const dateIndex = this.findHeaderIndex(headers, ['date', 'transaction date', 'txn date', 'txn. date']);
      const descIndex = this.findHeaderIndex(headers, ['description', 'narration', 'particulars', 'details']);
      const debitIndex = this.findHeaderIndex(headers, ['debit', 'withdrawal', 'debit amount', 'withdraw']);
      const creditIndex = this.findHeaderIndex(headers, ['credit', 'deposit', 'credit amount']);
      const balanceIndex = this.findHeaderIndex(headers, ['balance', 'closing balance', 'available balance', 'bal']);

      // Skip rows without valid date
      const dateStr = values[dateIndex];
      if (!dateStr || dateStr.trim() === '' || dateStr.toLowerCase() === 'date') continue;

      const transaction = this.parseTransaction(values, {
        dateIndex,
        descIndex,
        debitIndex,
        creditIndex,
        balanceIndex
      });

      // Only add if transaction has valid date
      if (transaction && transaction.transaction_date) {
        transactions.push(transaction);
      }
    }

    if (transactions.length === 0) {
      throw new Error('No valid transactions found in CSV. Please check the file format.');
    }

    return transactions;
  }

  private parseTransaction(
    values: string[],
    indices: {
      dateIndex: number;
      descIndex: number;
      debitIndex: number;
      creditIndex: number;
      balanceIndex: number;
    }
  ): ParsedTransaction | null {
    try {
      const date = this.parseDate(values[indices.dateIndex]);
      if (!date) return null; // Skip if date parsing failed

      const description = values[indices.descIndex] || 'No description';
      const debitStr = values[indices.debitIndex] || '0';
      const creditStr = values[indices.creditIndex] || '0';
      const balanceStr = values[indices.balanceIndex] || null;

      const debitAmount = this.parseAmount(debitStr);
      const creditAmount = this.parseAmount(creditStr);

      let transactionType: 'debit' | 'credit';
      let amount: number;

      if (debitAmount > 0) {
        transactionType = 'debit';
        amount = debitAmount;
      } else if (creditAmount > 0) {
        transactionType = 'credit';
        amount = creditAmount;
      } else {
        return null; // Skip transactions with no amount
      }

      const balance = balanceStr ? this.parseAmount(balanceStr) : null;

      return {
        transaction_date: date,
        description,
        transaction_type: transactionType,
        amount,
        balance,
        category: 'Uncategorized'
      };
    } catch (error) {
      console.error('Error parsing transaction:', error);
      return null;
    }
  }

  private parseDate(dateStr: string): string | null {
    if (!dateStr || dateStr.trim() === '') return null;

    try {
      const cleaned = dateStr.trim();

      // Try DD/MM/YYYY format (most common in India)
      if (cleaned.match(/^\d{1,2}\/\d{1,2}\/\d{2,4}$/)) {
        const [day, month, year] = cleaned.split('/');
        const fullYear = year.length === 2 ? `20${year}` : year;
        const paddedMonth = month.padStart(2, '0');
        const paddedDay = day.padStart(2, '0');
        return `${fullYear}-${paddedMonth}-${paddedDay}`;
      }

      // Try DD-MM-YYYY format
      if (cleaned.match(/^\d{1,2}-\d{1,2}-\d{2,4}$/)) {
        const [day, month, year] = cleaned.split('-');
        const fullYear = year.length === 2 ? `20${year}` : year;
        const paddedMonth = month.padStart(2, '0');
        const paddedDay = day.padStart(2, '0');
        return `${fullYear}-${paddedMonth}-${paddedDay}`;
      }

      // Try YYYY-MM-DD (ISO format)
      if (cleaned.match(/^\d{4}-\d{2}-\d{2}$/)) {
        return cleaned;
      }

      // Try DD-MMM-YYYY format (10-Feb-2025)
      if (cleaned.match(/^\d{1,2}-[A-Za-z]{3}-\d{2,4}$/)) {
        const [day, monthStr, year] = cleaned.split('-');
        const monthMap: { [key: string]: string } = {
          'jan': '01', 'feb': '02', 'mar': '03', 'apr': '04',
          'may': '05', 'jun': '06', 'jul': '07', 'aug': '08',
          'sep': '09', 'oct': '10', 'nov': '11', 'dec': '12'
        };
        const month = monthMap[monthStr.toLowerCase()];
        if (!month) return null;
        const fullYear = year.length === 2 ? `20${year}` : year;
        const paddedDay = day.padStart(2, '0');
        return `${fullYear}-${month}-${paddedDay}`;
      }

      // If no format matches, try standard Date parsing
      const parsedDate = new Date(cleaned);
      if (!isNaN(parsedDate.getTime())) {
        return parsedDate.toISOString().split('T')[0];
      }

      return null;
    } catch (error) {
      console.error('Date parsing error:', error);
      return null;
    }
  }

  private parseAmount(amountStr: string): number {
    if (!amountStr || amountStr.trim() === '') return 0;
    
    // Remove currency symbols, commas, and spaces
    const cleaned = amountStr
      .replace(/[₹$,\s]/g, '')
      .trim();
    
    if (cleaned === '' || cleaned === '-') return 0;
    
    const amount = parseFloat(cleaned);
    return isNaN(amount) ? 0 : Math.abs(amount);
  }

  private findHeaderIndex(headers: string[], possibleNames: string[]): number {
    for (const name of possibleNames) {
      const index = headers.findIndex(h => h.includes(name));
      if (index !== -1) return index;
    }
    return -1;
  }

  parseExcel(buffer: ArrayBuffer): ParsedTransaction[] {
    throw new Error('Excel parsing not yet implemented. Please use CSV format.');
  }

  parsePDF(buffer: ArrayBuffer): ParsedTransaction[] {
    throw new Error('PDF parsing not yet implemented. Please use CSV format.');
  }
}

export const transactionParser = new TransactionParser();
