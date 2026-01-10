import { categoryService } from './categoryService';
import { transactionService, Transaction } from './transactionService';

// Default categorization rules (keyword matching)
const DEFAULT_RULES = {
  'Food & Dining': ['swiggy', 'zomato', 'uber eats', 'restaurant', 'cafe', 'food', 'pizza', 'dominos', 'kfc', 'mcdonald', 'burger', 'starbucks', 'dunkin'],
  'Transportation': ['uber', 'ola', 'rapido', 'taxi', 'metro', 'bus', 'train', 'petrol', 'fuel', 'parking', 'toll', 'fastag'],
  'Shopping': ['amazon', 'flipkart', 'myntra', 'ajio', 'meesho', 'shopping', 'mall', 'store', 'retail'],
  'Bills & Utilities': ['electricity', 'water', 'gas', 'internet', 'broadband', 'phone', 'mobile', 'recharge', 'bill', 'utility', 'airtel', 'jio', 'vi'],
  'Entertainment': ['netflix', 'prime', 'hotstar', 'spotify', 'youtube', 'movie', 'cinema', 'theatre', 'pvr', 'inox', 'gaming', 'xbox', 'playstation'],
  'Healthcare': ['hospital', 'doctor', 'pharmacy', 'medical', 'apollo', 'medicine', 'clinic', 'health', 'wellness', 'gym', 'fitness'],
  'Education': ['school', 'college', 'university', 'course', 'udemy', 'coursera', 'book', 'education', 'tuition', 'coaching'],
  'Travel': ['flight', 'hotel', 'airbnb', 'makemytrip', 'booking', 'goibibo', 'cleartrip', 'travel', 'vacation', 'trip'],
  'Groceries': ['grocery', 'supermarket', 'dmart', 'reliance fresh', 'bigbasket', 'blinkit', 'instamart', 'zepto', 'dunzo', 'vegetables', 'fruits'],
  'Salary': ['salary', 'wage', 'income', 'payment received', 'credited'],
  'Investment': ['mutual fund', 'stock', 'equity', 'sip', 'investment', 'zerodha', 'groww', 'upstox', 'trading']
};

class CategorizationService {
  // Match transaction description with category keywords
  matchCategory(description: string, categoryName: string): boolean {
    const lowerDesc = description.toLowerCase();
    const keywords = DEFAULT_RULES[categoryName as keyof typeof DEFAULT_RULES] || [];
    
    return keywords.some(keyword => lowerDesc.includes(keyword.toLowerCase()));
  }

  // Auto-categorize a single transaction
  async autoCategorizeSingle(transaction: Transaction): Promise<string | null> {
    const categories = await categoryService.getCategories();
    
    for (const category of categories) {
      if (this.matchCategory(transaction.description, category.name)) {
        return category.id;
      }
    }
    
    return null;
  }

  // Auto-categorize multiple transactions
  async autoCategorizeTransactions(transactions: Transaction[]): Promise<{
    categorized: number;
    uncategorized: number;
    results: Array<{ transactionId: string; categoryId: string | null }>;
  }> {
    const categories = await categoryService.getCategories();
    const results: Array<{ transactionId: string; categoryId: string | null }> = [];
    let categorized = 0;
    let uncategorized = 0;

    for (const transaction of transactions) {
      // Skip if already categorized
      if (transaction.category_id) {
        continue;
      }

      let matchedCategoryId: string | null = null;

      for (const category of categories) {
        if (this.matchCategory(transaction.description, category.name)) {
          matchedCategoryId = category.id;
          break;
        }
      }

      if (matchedCategoryId) {
        results.push({
          transactionId: transaction.id,
          categoryId: matchedCategoryId
        });
        categorized++;
      } else {
        uncategorized++;
      }
    }

    return { categorized, uncategorized, results };
  }

  // Bulk update transaction categories
  async applyCategorizationResults(results: Array<{ transactionId: string; categoryId: string | null }>): Promise<void> {
    for (const result of results) {
      if (result.categoryId) {
        await transactionService.updateTransactionCategory(result.transactionId, result.categoryId);
      }
    }
  }

  // Get categorization suggestions for a description
  async suggestCategory(description: string): Promise<string | null> {
    const categories = await categoryService.getCategories();
    
    for (const category of categories) {
      if (this.matchCategory(description, category.name)) {
        return category.id;
      }
    }
    
    return null;
  }

  // Get all categorization rules
  getDefaultRules(): typeof DEFAULT_RULES {
    return DEFAULT_RULES;
  }
}

export const categorizationService = new CategorizationService();
