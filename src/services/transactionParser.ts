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

    // Get headers - handle both comma and tab separated
    const separator = lines[0].includes('\t') ? '\t' : ',';
    const headers = lines[0].split(separator).map(h => h.trim());
    
    const dateIndex = this.findColumnIndex(headers, [
      'date', 'transaction date', 'txn date', 'trans date', 'value date', 
      'posting date', 'txndate', 'transdate', 'dt'
    ]);
    const descIndex = this.findColumnIndex(headers, [
      'description', 'narration', 'particulars', 'details', 'transaction details',
      'desc', 'remarks', 'transaction description', 'txn description'
    ]);
    const debitIndex = this.findColumnIndex(headers, [
      'debit', 'withdrawal', 'debit amount', 'withdrawals', 'debit amt',
      'dr', 'withdrawal amount', 'debits', 'debit (₹)', 'debit(₹)'
    ]);
    const creditIndex = this.findColumnIndex(headers, [
      'credit', 'deposit', 'credit amount', 'deposits', 'credit amt',
      'cr', 'deposit amount', 'credits', 'credit (₹)', 'credit(₹)'
    ]);
    const balanceIndex = this.findColumnIndex(headers, [
      'balance', 'closing balance', 'available balance', 'running balance',
      'bal', 'available bal', 'closing bal', 'balance (₹)', 'balance(₹)'
    ]);

    if (dateIndex === -1 || descIndex === -1) {
      const headerList = headers.join(', ');
      throw new Error(
        `Could not find required columns. Found headers: ${headerList}`
      );
    }

    if (debitIndex === -1 && creditIndex === -1) {
      throw new Error('Could not find Debit or Credit columns');
    }

    const transactions: ParsedTransaction[] = [];

    // Parse data rows (skip header)
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      const columns = line.split(separator).map(col => col.trim());
      
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

  // Find column index by possible names
  findColumnIndex(headers: string[], possibleNames: string[]): number {
    const normalizedHeaders = headers.map(h => 
      h.toLowerCase().trim().replace(/[^a-z0-9]/g, '')
    );
    
    for (const name of possibleNames) {
      const normalizedName = name.toLowerCase().replace(/[^a-z0-9]/g, '');
      const index = normalizedHeaders.findIndex(h => 
        h === normalizedName || h.includes(normalizedName) || normalizedName.includes(h)
      );
      if (index !== -1) return index;
    }
    
    return -1;
  },

  // Parse amount string to number
  parseAmount(str: string): number {
    if (!str || str === '') return 0;
    
    // Remove currency symbols, commas, and whitespace
    const cleaned = str.replace(/[₹$,\s]/g, '');
    const num = parseFloat(cleaned);
    
    return isNaN(num) ? 0 : Math.abs(num);
  },

  // Parse date string to ISO format
  parseDate(dateStr: string): string {
    // Try different date formats
    const formats = [
      /(\d{1,2})-(\d{1,2})-(\d{4})/,   // DD-MM-YYYY
      /(\d{1,2})\/(\d{1,2})\/(\d{4})/, // DD/MM/YYYY or MM/DD/YYYY
      /(\d{4})-(\d{1,2})-(\d{1,2})/,   // YYYY-MM-DD
    ];

    for (const format of formats) {
      const match = dateStr.match(format);
      if (match) {
        // DD-MM-YYYY format (your format)
        if (format === formats[0]) {
          const [, day, month, year] = match;
          return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
        }
        // DD/MM/YYYY format
        if (format === formats[1]) {
          const [, day, month, year] = match;
          return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
        }
        // Already in YYYY-MM-DD format
        if (format === formats[2]) {
          return dateStr;
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
