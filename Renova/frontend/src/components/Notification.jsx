"use client";

import { useEffect, useState } from 'react';
import '../styles/notification.css';

let notificationQueue = [];
let listeners = [];

const showNotification = (config) => {
  const id = Date.now() + Math.random();
  const notification = { id, ...config };
  notificationQueue.push(notification);
  listeners.forEach(fn => fn([...notificationQueue]));
  
  // Auto-dismiss after duration
  const duration = config.duration || 5000;
  setTimeout(() => {
    notificationQueue = notificationQueue.filter(n => n.id !== id);
    listeners.forEach(fn => fn([...notificationQueue]));
  }, duration);
};

export const notification = {
  error: (config) => showNotification({ ...config, type: 'error' }),
  success: (config) => showNotification({ ...config, type: 'success' }),
  warning: (config) => showNotification({ ...config, type: 'warning' }),
  info: (config) => showNotification({ ...config, type: 'info' }),
};

export default function NotificationContainer() {
  const [notifications, setNotifications] = useState([]);

  useEffect(() => {
    const listener = (queue) => setNotifications(queue);
    listeners.push(listener);
    return () => {
      listeners = listeners.filter(l => l !== listener);
    };
  }, []);

  return (
    <div className="notification-container">
      {notifications.map((notif) => (
        <div key={notif.id} className={`notification notification-${notif.type}`}>
          <div className="notification-icon">
            {notif.type === 'error' && '✕'}
            {notif.type === 'success' && '✓'}
            {notif.type === 'warning' && '⚠'}
            {notif.type === 'info' && 'ℹ'}
          </div>
          <div className="notification-content">
            <div className="notification-message">{notif.message}</div>
            {notif.description && (
              <div className="notification-description">{notif.description}</div>
            )}
          </div>
          <button
            className="notification-close"
            onClick={() => {
              notificationQueue = notificationQueue.filter(n => n.id !== notif.id);
              listeners.forEach(fn => fn([...notificationQueue]));
            }}
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}
