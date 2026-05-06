// Format currency to VND
export const formatCurrency = (value) => {
  if (!value && value !== 0) return '0₫';
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
  }).format(value);
};

// Format date to DD/MM/YYYY
export const formatDate = (date) => {
  if (!date) return '';
  const d = new Date(date);
  return d.toLocaleDateString('vi-VN');
};

// Format date and time to DD/MM/YYYY HH:MM
export const formatDateTime = (date) => {
  if (!date) return '';
  const d = new Date(date);
  return d.toLocaleString('vi-VN');
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
  const d = new Date(dateInput);
  d.setMonth(d.getMonth() + Number(months || 1));
  return d;
};
