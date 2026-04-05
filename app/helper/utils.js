// simple utility functions

// format date for display
const formatDate = (date) => {
  return new Date(date).toLocaleString();
};

// check if order is overdue
const isOverdue = (scheduledTime) => {
  return new Date(scheduledTime) < new Date();
};

// get status badge color
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

// calculate days until next execution
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
