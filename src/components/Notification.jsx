import { useAtom } from 'jotai';
import { useEffect } from 'react';
import { notificationAtom } from '../atoms';

const Notification = () => {
  const [notification, setNotification] = useAtom(notificationAtom);

  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => {
        setNotification(null);
      }, 5000); // Auto-hide after 5 seconds

      return () => clearTimeout(timer);
    }
  }, [notification, setNotification]);

  if (!notification) return null;

  const { type, message } = notification;

  return (
    <div className={`notification notification-${type}`}>
      {type === 'success' && '✅ '}
      {type === 'error' && '❌ '}
      {type === 'warning' && '⚠️ '}
      {message}
      <button
        onClick={() => setNotification(null)}
        className="notification-close"
      >
        ×
      </button>
    </div>
  );
};

export default Notification;