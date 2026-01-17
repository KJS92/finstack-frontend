import Papa from 'papaparse';

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
    const result = Papa.parse(content, {
  header: true,
  skipEmptyLines: true,
  delimiter: ',',
 // delimitersToGuess: [',', ';', '\t', '|'],
  transformHeader: (header: string) => header.trim().toLowerCase().replace(/"/g, '')
});

// 🔍 NEW DEBUG LOGS - Add these
console.log('==== PAPAPARSE DEBUG ====');
console.log('Raw content (first 200 chars):', content.substring(0, 200));
console.log('Detected delimiter:', result.meta.delimiter);
console.log('Fields found:', result.meta.fields);
console.log('Number of rows:', result.data.length);
console.log('First row keys:', result.data[0] ? Object.keys(result.data[0]) : 'No data');
console.log('First row values:', result.data[0]);
console.log('========================');

if (result.errors.length > 0) {
  console.error('CSV parsing errors:', result.errors);
}

    console.log('Parsed CSV rows:', result.data.length);

    const transactions: ParsedTransaction[] = [];

      result.data.forEach((row: any, index: number) => {
    // Debug: Show what keys are available
    if (index === 0) {
      console.log('CSV Column Names:', Object.keys(row));
      console.log('First Row Data:', row);
    }
  
    // Find date field (try multiple possible names)
    const dateField = row.date || row['transaction date'] || row['txn date'] || row['txn. date'] || row['Date'];
    
    // Skip rows without valid date
    if (!dateField || dateField.trim() === '' || dateField.toLowerCase() === 'date') {
      console.log(`Row ${index + 1} - Available keys:`, Object.keys(row));
      console.log(`Row ${index + 1} - Date field value:`, dateField);
      return;
    }

      const transaction = this.parseTransactionFromObject(row, index + 1);
      if (transaction && transaction.transaction_date) {
        console.log(`✅ Row ${index + 1}: ${transaction.description.substring(0, 40)}...`);
        transactions.push(transaction);
      } else {
        console.log(`❌ Row ${index + 1}: Failed to parse`);
      }
    });

    console.log(`Total transactions parsed: ${transactions.length} out of ${result.data.length}`);

    if (transactions.length === 0) {
      throw new Error('No valid transactions found in CSV. Please check the file format.');
    }

    return transactions;
  }

  private parseTransactionFromObject(row: any, rowNumber: number): ParsedTransaction | null {
  try {
   // 🔍 DEBUG: Log first row details
    if (rowNumber === 1) {
      console.log('=== ROW 1 DEBUG ===');
      console.log('All keys:', Object.keys(row));
      console.log('Raw row object:', row);  // See all fields
      console.log('Date:', row.date);
      console.log('Description:', row.description);
      console.log('Transaction Details:', row['transaction details']);
      console.log('Debit:', row.debit);
      console.log('Credit:', row.credit);
      console.log('Balance:', row.balance);
      console.log('==================');
    }
    // Find date field
    const dateStr = row.date || row['transaction date'] || row['txn date'] || row['txn. date'];
    const date = this.parseDate(dateStr);
    if (!date) {
      console.log(`Row ${rowNumber}: Invalid date format: ${dateStr}`);
      return null;
    }

    // Find description field
    const description = row['transaction details'] || row.description || 
                   row.narration || row.particulars || row.details || 'No description';

    // Find debit field
    const debitStr = row.debit || row.withdrawal || row['debit amount'] || row.withdraw || '0';
    
    // Find credit field
    const creditStr = row.credit || row.deposit || row['credit amount'] || '0';
    
    // Find balance field
    const balanceStr = row.balance || row['balance"'] || row['closing balance'] || row['available balance'] || row.bal || null;
    // 🔍 DEBUG balance parsing
if (rowNumber <= 3) {
  console.log(`Row ${rowNumber} balance debug:`, {
    rawBalance: row.balance,
    balanceStr,
    parsedBalance: balanceStr ? this.parseAmount(balanceStr) : null
  });
}
   const balance = balanceStr ? this.parseAmount(balanceStr) : null;

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
  // Check if this is an opening balance row
  const txnDetails = row['transaction details'] || '';
  const balanceValue = this.parseAmount(row.balance || '0');
  
  if (txnDetails.toLowerCase().includes('opening') && balanceValue > 0) {
    transactionType = 'credit';
    amount = balanceValue;
    console.log(`✅ Row ${rowNumber}: Opening balance detected: ${balanceValue}`);
  } else {
    console.log(`Row ${rowNumber}: No debit or credit amount found`);
    return null;
  }
}

    return {
      transaction_date: date,
      description,
      transaction_type: transactionType,
      amount,
      balance,
      category: 'Uncategorized'
    };
  } catch (error) {
    console.error(`Row ${rowNumber} parsing error:`, error);
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
