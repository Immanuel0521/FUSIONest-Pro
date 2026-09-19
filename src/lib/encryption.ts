/**
 * Server-side encryption utility for sensitive data
 * Calls the secure-data Edge Function for encryption/decryption
 * 
 * Security: Encryption key is stored securely on the server, never exposed to client
 */

import { supabase } from '@/lib/supabase';

const ENCRYPTION_PREFIX = 'ENC:';

/**
 * Encrypt sensitive data via server-side Edge Function
 * Returns encrypted string or original if encryption fails
 */
export const encryptData = async (plaintext: string): Promise<string> => {
  if (!plaintext || plaintext.trim() === '') {
    return plaintext;
  }
  
  // Don't re-encrypt already encrypted data
  if (plaintext.startsWith(ENCRYPTION_PREFIX)) {
    return plaintext;
  }
  
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData?.session?.access_token;
    
    if (!accessToken) {
      console.warn('No auth session - cannot encrypt data');
      return plaintext;
    }

    const response = await supabase.functions.invoke('secure-data', {
      body: { operation: 'encrypt', data: plaintext }
    });

    if (response.error) {
      console.error('Encryption error:', response.error);
      return plaintext;
    }

    return response.data?.result || plaintext;
  } catch (error) {
    console.error('Encryption error:', error);
    return plaintext;
  }
};

/**
 * Decrypt encrypted data via server-side Edge Function
 * Returns decrypted string or masked placeholder if decryption fails
 */
export const decryptData = async (ciphertext: string): Promise<string> => {
  if (!ciphertext || ciphertext.trim() === '') {
    return ciphertext;
  }
  
  // Check if data is encrypted - if not, return as-is (backward compatibility)
  if (!ciphertext.startsWith(ENCRYPTION_PREFIX)) {
    return ciphertext;
  }
  
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData?.session?.access_token;
    
    if (!accessToken) {
      console.warn('No auth session - cannot decrypt data');
      return '••••••••';
    }

    const response = await supabase.functions.invoke('secure-data', {
      body: { operation: 'decrypt', data: ciphertext }
    });

    if (response.error) {
      console.error('Decryption error:', response.error);
      return '••••••••';
    }

    return response.data?.result || '••••••••';
  } catch (error) {
    console.error('Decryption error:', error);
    return '••••••••';
  }
};

/**
 * Check if a string is encrypted
 */
export const isEncrypted = (data: string): boolean => {
  return data?.startsWith(ENCRYPTION_PREFIX) ?? false;
};
