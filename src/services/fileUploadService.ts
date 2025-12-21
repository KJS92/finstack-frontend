import { supabase } from '../config/supabase';

export interface FileUploadRecord {
  id: string;
  user_id: string;
  account_id: string | null;
  file_name: string;
  file_type: string;
  file_size: number;
  file_path: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  transactions_count: number;
  error_message: string | null;
  created_at: string;
}

export const fileUploadService = {
  // Upload file to storage
  async uploadFile(file: File, accountId: string): Promise<string> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    // Create unique file path: userId/timestamp_filename
    const timestamp = Date.now();
    const fileName = `${timestamp}_${file.name}`;
    const filePath = `${user.id}/${fileName}`;

    // Upload to Supabase storage
    const { data, error } = await supabase.storage
      .from('statements')
      .upload(filePath, file);

    if (error) throw error;

    // Record upload in database
    await this.createUploadRecord({
      file_name: file.name,
      file_type: file.type,
      file_size: file.size,
      file_path: filePath,
      account_id: accountId
    });

    return filePath;
  },

  // Create upload record
  async createUploadRecord(data: {
    file_name: string;
    file_type: string;
    file_size: number;
    file_path: string;
    account_id: string;
  }): Promise<FileUploadRecord> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { data: record, error } = await supabase
      .from('file_uploads')
      .insert([{
        user_id: user.id,
        ...data,
        status: 'pending'
      }])
      .select()
      .single();

    if (error) throw error;
    return record;
  },

  // Get user's upload history
  async getUploadHistory(): Promise<FileUploadRecord[]> {
    const { data, error } = await supabase
      .from('file_uploads')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  // Update upload status
  async updateUploadStatus(
    uploadId: string, 
    status: FileUploadRecord['status'], 
    transactionsCount?: number,
    errorMessage?: string
  ): Promise<void> {
    const updates: any = { status };
    if (transactionsCount !== undefined) updates.transactions_count = transactionsCount;
    if (errorMessage) updates.error_message = errorMessage;

    const { error } = await supabase
      .from('file_uploads')
      .update(updates)
      .eq('id', uploadId);

    if (error) throw error;
  },

  // Validate file type
  validateFile(file: File): { valid: boolean; error?: string } {
    const allowedTypes = [
      'text/csv',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/pdf'
    ];

    const allowedExtensions = ['.csv', '.xls', '.xlsx', '.pdf'];
    const fileExtension = file.name.toLowerCase().substring(file.name.lastIndexOf('.'));

    if (!allowedExtensions.includes(fileExtension)) {
      return { 
        valid: false, 
        error: 'Invalid file type. Please upload CSV, XLS, XLSX, or PDF files only.' 
      };
    }

    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      return { 
        valid: false, 
        error: 'File size exceeds 10MB limit.' 
      };
    }

    return { valid: true };
  }
};
