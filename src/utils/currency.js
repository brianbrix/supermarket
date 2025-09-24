export function formatKES(amount) {
  return new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES', minimumFractionDigits: 0 }).format(amount);
}

// Alias export for convenience across components expecting formatCurrency
export const formatCurrency = formatKES;
