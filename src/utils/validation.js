// Shared validation utilities
// Centralizes patterns and rule helpers for reuse across forms.

// Kenyan phone: allows formats starting with +2547 / +2541 / 07 / 01 followed by 8 digits
export const KENYAN_PHONE_REGEX = /^(?:\+?254|0)(?:7|1)\d{8}$/;

export const messages = {
  requiredName: 'Name required',
  requiredPhone: 'Phone required',
  invalidPhone: 'Invalid Kenyan phone',
  invalidEmail: 'Invalid email address',
  requiredAddress: 'Address required for delivery'
};

// React Hook Form rule helpers
export const nameRules = {
  required: messages.requiredName,
  validate: v => v.trim() !== '' || messages.requiredName
};

export const phoneRules = {
  required: messages.requiredPhone,
  pattern: { value: KENYAN_PHONE_REGEX, message: messages.invalidPhone }
};

export const addressRules = (isDelivery) => isDelivery ? { required: messages.requiredAddress } : {};

export const optionalPhoneRules = {
  validate: (value) => {
    if (!value || String(value).trim() === '') return true;
    return KENYAN_PHONE_REGEX.test(String(value).trim()) || messages.invalidPhone;
  }
};

export const optionalEmailRules = {
  validate: (value) => {
    if (!value || String(value).trim() === '') return true;
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailPattern.test(String(value).trim()) || messages.invalidEmail;
  }
};
