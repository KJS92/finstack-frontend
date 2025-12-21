import * as XLSX from 'xlsx';

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
  // Main parse function - detects file type
  async parseFile(file: File): Promise<ParseResult> {
    const extension = file.name.toLowerCase().substring(file.name.lastIndexOf('.'));
    
    if (extension === '.csv') {
      return this.parseCSV(file);
    } else if (extension === '.xls' || extension === '.xlsx') {
      return this.parseExcel(file);
    } else {
      return {
        success: false,
        transactions: [],
        error: 'Unsupported file format. Please upload CSV or Excel files.',
        summary: { total: 0, credits: 0, debits: 0 }
      };
    }
  },

  // Parse Excel file
  async parseExcel(file: File): Promise<ParseResult> {
    return new Promise((resolve) => {
      const reader = new FileReader();

      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array' });
          
          // Get first sheet
          const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
          
          // Convert to CSV format
          const csvText = XLSX.utils.sheet_to_csv(firstSheet);
          
          // Parse as CSV
          const transactions = this.parseCSVText(csvText);
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

      reader.readAsArrayBuffer(file);
    });
  },

  // Parse CSV file
  async parseCSV(file: File): Promise<ParseResult> {
    return new Promise((resolve) => {
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

  // Rest of the functions remain the same...
  parseCSVText(text: string): ParsedTransaction[] {
    const lines = text.split('\n').filter(line => line.trim());
    if (lines.length < 2) {
      throw new Error('File appears to be empty or invalid');
    }

    // Detect separator (comma, tab, or semicolon)
    const separator = lines[0].includes('\t') ? '\t' : 
                     lines[0].includes(';') ? ';' : ',';
    
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

      const debitAmount = this.parseAmount(debitStr);
      const creditAmount = this.parseAmount(creditStr);
      const balance = this.parseAmount(balanceStr);

      let amount: number;
      let type: 'debit' | 'credit';

      if (debitAmount > 0) {
        amount = debitAmount;
        type = 'debit';
      } else if (creditAmount > 0) {
        amount = creditAmount;
        type = 'credit';
      } else {
        continue;
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

  parseAmount(str: string): number {
    if (!str || str === '') return 0;
    const cleaned = str.replace(/[₹$,\s]/g, '');
    const num = parseFloat(cleaned);
    return isNaN(num) ? 0 : Math.abs(num);
  },

  parseDate(dateStr: string): string {
    const formats = [
      /(\d{1,2})-(\d{1,2})-(\d{4})/,
      /(\d{1,2})\/(\d{1,2})\/(\d{4})/,
      /(\d{4})-(\d{1,2})-(\d{1,2})/,
    ];

    for (const format of formats) {
      const match = dateStr.match(format);
      if (match) {
        if (format === formats[0] || format === formats[1]) {
          const [, day, month, year] = match;
          return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
        }
        if (format === formats[2]) {
          return dateStr;
        }
      }
    }

    const date = new Date(dateStr);
    if (!isNaN(date.getTime())) {
      return date.toISOString().split('T')[0];
    }

    return new Date().toISOString().split('T')[0];
  },

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

