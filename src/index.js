import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// Дополнительная инициализация при загрузке
window.addEventListener('load', () => {
  // Регистрируем Service Worker из основного потока
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/service-worker.js')
      .then(registration => {
        console.log('Service Worker зарегистрирован с областью:', registration.scope);
        
        // Проверяем, контролирует ли страницу Service Worker
        if (navigator.serviceWorker.controller) {
          console.log('Страница контролируется Service Worker');
        }
      })
      .catch(error => {
        console.error('Ошибка регистрации Service Worker:', error);
      });
  }
  
  // Показываем статус поддержки PWA
  const pwaSupport = {
    serviceWorker: 'serviceWorker' in navigator,
    indexedDB: 'indexedDB' in window,
    syncManager: 'SyncManager' in window,
    notification: 'Notification' in window
  };
  
  console.log('Поддержка PWA функций:', pwaSupport);
});