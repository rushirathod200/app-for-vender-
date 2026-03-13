export function formatCurrency(value: number): string {
  if (Number.isNaN(value)) {
    return 'Rs 0';
  }

  return `Rs ${value.toFixed(2)}`;
}

export function formatDateTime(value: string | null): string {
  if (!value) {
    return '--';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString();
}

export function prettifyStatus(status: string): string {
  return status
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export function normalizeMobile(input: string): string {
  return input.replace(/\D/g, '').slice(0, 10);
}

export function normalizeIntegerInput(value: string, fallback = '0'): string {
  const digits = value.replace(/\D/g, '');

  if (!digits) {
    return fallback;
  }

  return String(Number.parseInt(digits, 10));
}
