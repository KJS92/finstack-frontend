export interface ParsedTransaction {
  date: string;
  description: string;
  amount: number;
  type: 'debit' | 'credit';
  balance?: number;
}

export interface ParseResult {
  success: boolean;
  transactions: ParsedTransaction[];
  error?: string;
  summary: {
    total: number;
    credits: number;
    debits: number;
  };
}

export const transactionParser = {
  // Parse CSV file
  async parseCSV(file: File): Promise<ParseResult> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = (e) => {
        try {
          const text = e.target?.result as string;
          const transactions = this.parseCSVText(text);
          
          const summary = this.calculateSummary(transactions);
          
          resolve({
            success: true,
            transactions,
            summary
          });
        } catch (error: any) {
          resolve({
            success: false,
            transactions: [],
            error: error.message,
            summary: { total: 0, credits: 0, debits: 0 }
          });
        }
      };

      reader.onerror = () => {
        resolve({
          success: false,
          transactions: [],
          error: 'Failed to read file',
          summary: { total: 0, credits: 0, debits: 0 }
        });
      };

      reader.readAsText(file);
    });
  },

  // Parse CSV text content
  parseCSVText(text: string): ParsedTransaction[] {
    const lines = text.split('\n').filter(line => line.trim());
    if (lines.length < 2) {
      throw new Error('File appears to be empty or invalid');
    }

    // Get headers
    const headers = this.parseCSVLine(lines[0]);
    const dateIndex = this.findColumnIndex(headers, ['date', 'transaction date', 'txn date']);
    const descIndex = this.findColumnIndex(headers, ['description', 'narration', 'particulars', 'details']);
    const debitIndex = this.findColumnIndex(headers, ['debit', 'withdrawal', 'debit amount']);
    const creditIndex = this.findColumnIndex(headers, ['credit', 'deposit', 'credit amount']);
    const balanceIndex = this.findColumnIndex(headers, ['balance', 'closing balance', 'available balance']);

    if (dateIndex === -1 || descIndex === -1) {
      throw new Error('Could not find required columns (Date and Description)');
    }

    const transactions: ParsedTransaction[] = [];

    // Parse data rows (skip header)
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      const columns = this.parseCSVLine(line);
      
      const dateStr = columns[dateIndex]?.trim();
      const description = columns[descIndex]?.trim();
      const debitStr = debitIndex !== -1 ? columns[debitIndex]?.trim() : '';
      const creditStr = creditIndex !== -1 ? columns[creditIndex]?.trim() : '';
      const balanceStr = balanceIndex !== -1 ? columns[balanceIndex]?.trim() : '';

      if (!dateStr || !description) continue;

      // Parse amounts
      const debitAmount = this.parseAmount(debitStr);
      const creditAmount = this.parseAmount(creditStr);
      const balance = this.parseAmount(balanceStr);

      // Determine transaction type and amount
      let amount: number;
      let type: 'debit' | 'credit';

      if (debitAmount > 0) {
        amount = debitAmount;
        type = 'debit';
      } else if (creditAmount > 0) {
        amount = creditAmount;
        type = 'credit';
      } else {
        continue; // Skip if no amount found
      }

      transactions.push({
        date: this.parseDate(dateStr),
        description,
        amount,
        type,
        balance: balance > 0 ? balance : undefined
      });
    }

    if (transactions.length === 0) {
      throw new Error('No valid transactions found in file');
    }

    return transactions;
  },

  // Parse a single CSV line (handles quoted values)
  parseCSVLine(line: string): string[] {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        result.push(current);
        current = '';
      } else {
        current += char;
      }
    }
    
    result.push(current);
    return result;
  },

  // Find column index by possible names
  findColumnIndex(headers: string[], possibleNames: string[]): number {
    const normalizedHeaders = headers.map(h => h.toLowerCase().trim());
    
    for (const name of possibleNames) {
      const index = normalizedHeaders.findIndex(h => h.includes(name.toLowerCase()));
      if (index !== -1) return index;
    }
    
    return -1;
  },

  // Parse amount string to number
  parseAmount(str: string): number {
    if (!str) return 0;
    
    // Remove currency symbols, commas, and whitespace
    const cleaned = str.replace(/[₹$,\s]/g, '');
    const num = parseFloat(cleaned);
    
    return isNaN(num) ? 0 : Math.abs(num);
  },

  // Parse date string to ISO format
  parseDate(dateStr: string): string {
    // Try different date formats
    const formats = [
      /(\d{1,2})\/(\d{1,2})\/(\d{4})/, // DD/MM/YYYY or MM/DD/YYYY
      /(\d{4})-(\d{1,2})-(\d{1,2})/,   // YYYY-MM-DD
      /(\d{1,2})-(\d{1,2})-(\d{4})/,   // DD-MM-YYYY
    ];

    for (const format of formats) {
      const match = dateStr.match(format);
      if (match) {
        // Assume DD/MM/YYYY for slash format
        if (format === formats[0]) {
          const [, day, month, year] = match;
          return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
        }
        // Already in correct format
        if (format === formats[1]) {
          return dateStr;
        }
        // DD-MM-YYYY
        if (format === formats[2]) {
          const [, day, month, year] = match;
          return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
        }
      }
    }

    // Fallback: try to parse as Date
    const date = new Date(dateStr);
    if (!isNaN(date.getTime())) {
      return date.toISOString().split('T')[0];
    }

    return new Date().toISOString().split('T')[0]; // Fallback to today
  },

  // Calculate summary statistics
  calculateSummary(transactions: ParsedTransaction[]) {
    const credits = transactions
      .filter(t => t.type === 'credit')
      .reduce((sum, t) => sum + t.amount, 0);
    
    const debits = transactions
      .filter(t => t.type === 'debit')
      .reduce((sum, t) => sum + t.amount, 0);

    return {
      total: transactions.length,
      credits: Math.round(credits * 100) / 100,
      debits: Math.round(debits * 100) / 100
    };
  }
};
