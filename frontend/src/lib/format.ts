export function formatScheduledTime(dateString: string): string {
  const date = new Date(dateString);
  const formatter = new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  });
  return formatter.format(date);
}

export function formatFullDateTime(dateString: string): string {
  const date = new Date(dateString);
  const formatter = new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
    timeZoneName: 'short',
  });
  return formatter.format(date);
}

export function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffInSeconds = (date.getTime() - now.getTime()) / 1000;

  const formatter = new Intl.RelativeTimeFormat('en-US', { numeric: 'auto' });

  const absSeconds = Math.abs(diffInSeconds);

  if (absSeconds < 60) {
    return formatter.format(Math.round(diffInSeconds), 'second');
  } else if (absSeconds < 3600) {
    return formatter.format(Math.round(diffInSeconds / 60), 'minute');
  } else if (absSeconds < 86400) {
    return formatter.format(Math.round(diffInSeconds / 3600), 'hour');
  } else {
    return formatter.format(Math.round(diffInSeconds / 86400), 'day');
  }
}

export function formatDateTime(dateString: string | null | undefined): string {
  if (!dateString) return '-';
  const date = new Date(dateString);
  return date.toLocaleString();
}
