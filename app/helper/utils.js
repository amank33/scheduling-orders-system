// simple helpers

const formatDate = (date) => {
  return new Date(date).toLocaleString();
};

const isOverdue = (scheduledTime) => {
  return new Date(scheduledTime) < new Date();
};

const getStatusColor = (status) => {
  switch(status) {
    case 'active':
      return 'success';
    case 'paused':
      return 'warning';
    case 'completed':
      return 'info';
    case 'cancelled':
      return 'danger';
    default:
      return 'secondary';
  }
};

const daysUntil = (futureDate) => {
  const now = new Date();
  const target = new Date(futureDate);
  const diff = target - now;
  const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
  return days;
};

module.exports = {
  formatDate,
  isOverdue,
  getStatusColor,
  daysUntil
};
