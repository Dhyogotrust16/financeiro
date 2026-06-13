export function formatCurrency(value: number | undefined | null): string {
  if (value === undefined || value === null) return 'R$ 0,00';
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}

export function formatDate(dateString: string | undefined | null): string {
  if (!dateString) return '';
  const date = new Date(dateString);
  // add timezone offset manually to avoid timezone shift issue
  const localDate = new Date(date.getTime() + date.getTimezoneOffset() * 60000);
  return new Intl.DateTimeFormat('pt-BR').format(localDate);
}

export function formatDateTime(dateString: string | undefined | null): string {
  if (!dateString) return '';
  const date = new Date(dateString);
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(date);
}