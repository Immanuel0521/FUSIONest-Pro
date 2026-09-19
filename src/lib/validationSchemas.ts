import { z } from "zod";

// Phone number validation - international format
const phoneRegex = /^[0-9+\-\s()]{10,20}$/;

// Worker form validation schema
export const workerFormSchema = z.object({
  full_name: z.string()
    .trim()
    .min(1, "Name is required")
    .max(100, "Name must be less than 100 characters"),
  
  phone: z.string()
    .trim()
    .regex(phoneRegex, "Invalid phone number format")
    .min(10, "Phone number must be at least 10 characters")
    .max(20, "Phone number must be less than 20 characters"),
  
  address: z.string()
    .trim()
    .max(500, "Address must be less than 500 characters")
    .optional(),
  
  blood_group: z.string()
    .trim()
    .max(10, "Blood group must be less than 10 characters")
    .optional(),
  
  bank_name: z.string()
    .trim()
    .max(100, "Bank name must be less than 100 characters")
    .optional(),
  
  bank_account_number: z.string()
    .trim()
    .regex(/^[A-Z0-9]+$/i, "Account number must contain only letters and numbers")
    .max(50, "Account number must be less than 50 characters")
    .optional(),
  
  ifsc_code: z.string()
    .trim()
    .regex(/^[A-Z]{4}0[A-Z0-9]{6}$/i, "Invalid IFSC code format")
    .optional(),
  
  upi_id: z.string()
    .trim()
    .regex(/^[\w.-]+@[\w.-]+$/, "Invalid UPI ID format")
    .max(100, "UPI ID must be less than 100 characters")
    .optional(),
  
  aadhar_number: z.string()
    .trim()
    .regex(/^\d{12}$/, "Aadhar number must be 12 digits")
    .optional(),
});

// Attendance form validation schema
export const attendanceFormSchema = z.object({
  worker_id: z.string()
    .uuid("Invalid worker ID"),
  
  entry_time: z.string()
    .regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, "Invalid time format (HH:MM)"),
  
  exit_time: z.string()
    .regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, "Invalid time format (HH:MM)")
    .optional(),
  
  notes: z.string()
    .trim()
    .max(2000, "Notes must be less than 2000 characters")
    .optional(),
});

// Auth form validation schema
export const authFormSchema = z.object({
  email: z.string()
    .trim()
    .email("Invalid email address")
    .max(255, "Email must be less than 255 characters"),
  
  password: z.string()
    .min(8, "Password must be at least 8 characters")
    .max(100, "Password must be less than 100 characters")
    .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
    .regex(/[a-z]/, "Password must contain at least one lowercase letter")
    .regex(/[0-9]/, "Password must contain at least one number"),
});

// File upload validation
export const validateImageFile = (file: File): { valid: boolean; error?: string } => {
  const maxSize = 5 * 1024 * 1024; // 5MB
  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
  
  if (file.size > maxSize) {
    return { valid: false, error: 'File size must be less than 5MB' };
  }
  
  if (!allowedTypes.includes(file.type)) {
    return { valid: false, error: 'Only JPEG, PNG, and WebP images are allowed' };
  }
  
  return { valid: true };
};
