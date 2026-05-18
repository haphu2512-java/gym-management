// Format currency to VND
export const formatCurrency = (value) => {
  if (!value && value !== 0) return '0₫';
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
  }).format(value);
};

// Format date to DD-MM-YYYY
// Handles both date-only strings (YYYY-MM-DD) and full ISO timestamps correctly.
// Parsing a date-only string with `new Date()` treats it as UTC midnight, causing
// a timezone shift (e.g., -1 day in UTC+7). We detect this case and parse directly.
export const formatDate = (date) => {
  if (!date) return '';
  const str = String(date);
  // If it's a pure date string (YYYY-MM-DD), parse parts directly to avoid UTC shift
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    const [year, month, day] = str.split('-');
    return `${day}-${month}-${year}`;
  }
  // For full timestamps, use local time from Date object
  const d = new Date(str);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}-${month}-${year}`;
};

// Format date and time to DD-MM-YYYY HH:mm
export const formatDateTime = (date) => {
  if (!date) return '';
  const d = new Date(date);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  return `${day}-${month}-${year} ${hours}:${minutes}`;
};

// Get local ISO date string (YYYY-MM-DD) without UTC shift
export const getLocalISODate = (date = new Date()) => {
  const d = new Date(date);
  const offset = d.getTimezoneOffset();
  const localDate = new Date(d.getTime() - (offset * 60 * 1000));
  return localDate.toISOString().split('T')[0];
};

// Format time to HH:MM
export const formatTime = (time) => {
  if (!time) return '';
  const [hours, minutes] = time.split(':');
  return `${hours}:${minutes}`;
};

// Format phone number
export const formatPhoneNumber = (phone) => {
  if (!phone) return '';
  // Assuming Vietnamese phone format: 0xxx-xxx-xxx
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.length === 10) {
    return `${cleaned.slice(0, 4)}-${cleaned.slice(4, 7)}-${cleaned.slice(7)}`;
  }
  return phone;
};

// Truncate text to specified length
export const truncateText = (text, maxLength = 50) => {
  if (!text) return '';
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength)}...`;
};

// Get status badge color
export const getStatusColor = (status) => {
  const statusMap = {
    active: 'success',
    inactive: 'danger',
    pending: 'warning',
    completed: 'success',
    cancelled: 'danger',
  };
  return statusMap[status?.toLowerCase()] || 'secondary';
};

export const addMonths = (dateInput, months) => {
  let d;
  if (typeof dateInput === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateInput)) {
    const [year, month, day] = dateInput.split('-').map(Number);
    d = new Date(year, month - 1, day);
  } else {
    d = new Date(dateInput);
  }
  d.setMonth(d.getMonth() + Number(months || 1));
  return d;
};
