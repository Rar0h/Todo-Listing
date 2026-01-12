import { useState, useEffect, useCallback } from "react";
import { todoDB } from "./db";
import { networkStatus } from "./utils/networkStatus";
import "./App.css";

function App() {
  const [inputValue, setInput] = useState("");
  const [tasks, setTasks] = useState([]);
  const [isOnline, setIsOnline] = useState(true);
  const [isDbReady, setIsDbReady] = useState(false);
  const [pendingSyncCount, setPendingSyncCount] = useState(0);
  const [installPrompt, setInstallPrompt] = useState(null);
  const [isAppInstalled, setIsAppInstalled] = useState(false);

  // Инициализация приложения
  const initApp = useCallback(async () => {
    try {
      // Инициализация IndexedDB
      await todoDB.init();
      setIsDbReady(true);
      
      // Загрузка задач из локальной БД
      const savedTasks = await todoDB.getAllTasks();
      setTasks(savedTasks);
      
      // Подсчет задач, ожидающих синхронизации
      const pendingTasks = savedTasks.filter(task => task.syncStatus === 'pending');
      setPendingSyncCount(pendingTasks.length);
      
      console.log('Приложение инициализировано, загружено задач:', savedTasks.length);
    } catch (error) {
      console.error('Ошибка инициализации приложения:', error);
      alert('Ошибка инициализации локального хранилища. Проверьте поддержку IndexedDB в браузере.');
    }
  }, []);

  // Регистрация Service Worker
  const registerServiceWorker = useCallback(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/service-worker.js')
        .then((registration) => {
          console.log('Service Worker зарегистрирован:', registration);
          
          // Проверяем наличие обновлений
          registration.addEventListener('updatefound', () => {
            const newWorker = registration.installing;
            console.log('Обнаружено обновление Service Worker');
            
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                console.log('Новая версия Service Worker установлена. Перезагрузите страницу.');
                // Здесь можно показать уведомление пользователю
              }
            });
          });
        })
        .catch((error) => {
          console.error('Ошибка регистрации Service Worker:', error);
        });
    }
  }, []);

  // Обработчик установки PWA
  const handleBeforeInstallPrompt = useCallback((e) => {
    e.preventDefault();
    setInstallPrompt(e);
    
    // Проверяем, установлено ли уже приложение
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsAppInstalled(true);
    }
  }, []);

  // Установка приложения
  const handleInstallClick = useCallback(async () => {
    if (!installPrompt) return;
    
    installPrompt.prompt();
    
    const choiceResult = await installPrompt.userChoice;
    console.log('Результат выбора пользователя:', choiceResult.outcome);
    
    if (choiceResult.outcome === 'accepted') {
      console.log('Пользователь принял установку');
      setIsAppInstalled(true);
    }
    
    setInstallPrompt(null);
  }, [installPrompt]);

  // Эффект при монтировании компонента
  useEffect(() => {
    // Инициализация приложения
    initApp();
    
    // Регистрация Service Worker
    registerServiceWorker();
    
    // Подписка на сетевой статус
    const handleNetworkChange = (online) => {
      setIsOnline(online);
    };
    networkStatus.addListener(handleNetworkChange);
    
    // Обработчик установки PWA
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    
    // Проверка режима отображения (установленное PWA)
    const checkDisplayMode = () => {
      setIsAppInstalled(window.matchMedia('(display-mode: standalone)').matches);
    };
    checkDisplayMode();
    
    // Запрос разрешения на уведомления
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().then(permission => {
        console.log('Разрешение на уведомления:', permission);
      });
    }
    
    // Очистка при размонтировании
    return () => {
      networkStatus.removeListener(handleNetworkChange);
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, [initApp, registerServiceWorker, handleBeforeInstallPrompt]);

  // Добавление задачи
  const addTask = useCallback(async () => {
    if (inputValue.trim() === "") {
      alert("Название задачи не может быть пустым");
      return;
    }
    
    const newTask = {
      id: Date.now(),
      text: inputValue.trim(),
      createdAt: Date.now(),
      syncStatus: 'pending'
    };
    
    try {
      if (isDbReady) {
        // Сохраняем в IndexedDB
        const savedTask = await todoDB.saveTask(newTask);
        setTasks(prev => [...prev, savedTask]);
        setPendingSyncCount(prev => prev + 1);
      } else {
        // Fallback на state (если IndexedDB не готов)
        setTasks(prev => [...prev, newTask]);
      }
      
      setInput("");
      
      // Показываем уведомление
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification('Задача добавлена', {
          body: newTask.text,
          icon: '/pwa-192x192.png',
          tag: 'task-added'
        });
      }
      
      console.log('Задача добавлена:', newTask);
    } catch (error) {
      console.error('Ошибка добавления задачи:', error);
      alert('Не удалось сохранить задачу. Проверьте локальное хранилище.');
    }
  }, [inputValue, isDbReady]);

  // Удаление задачи
  const deleteTask = useCallback(async (id) => {
    try {
      if (isDbReady) {
        await todoDB.deleteTask(id);
        setPendingSyncCount(prev => prev + 1);
      }
      
      setTasks(prev => prev.filter(task => task.id !== id));
      console.log('Задача удалена:', id);
    } catch (error) {
      console.error('Ошибка удаления задачи:', error);
      alert('Не удалось удалить задачу');
    }
  }, [isDbReady]);

  // Редактирование задачи
  const editTask = useCallback(async (id, currentText) => {
    const editedValue = prompt("Редактировать задачу:", currentText);
    
    if (editedValue !== null && editedValue.trim() !== "") {
      const updatedTask = {
        id,
        text: editedValue.trim(),
        updatedAt: Date.now(),
        syncStatus: 'pending'
      };
      
      try {
        if (isDbReady) {
          const savedTask = await todoDB.saveTask(updatedTask);
          setTasks(prev => 
            prev.map(task => task.id === id ? savedTask : task)
          );
          setPendingSyncCount(prev => prev + 1);
        } else {
          setTasks(prev => 
            prev.map(task => 
              task.id === id ? { ...task, text: editedValue.trim() } : task
            )
          );
        }
        
        console.log('Задача отредактирована:', id);
      } catch (error) {
        console.error('Ошибка редактирования задачи:', error);
        alert('Не удалось сохранить изменения');
      }
    }
  }, [isDbReady]);

  // Принудительная синхронизация
  const handleForceSync = useCallback(async () => {
    if (!isOnline) {
      alert('Нет сетевого подключения. Синхронизация будет выполнена при восстановлении связи.');
      return;
    }
    
    try {
      // Здесь будет вызов API синхронизации
      // Для демонстрации просто обновляем статус
      const updatedTasks = tasks.map(task => ({
        ...task,
        syncStatus: 'synced'
      }));
      
      setTasks(updatedTasks);
      setPendingSyncCount(0);
      
      alert('Синхронизация выполнена успешно!');
      
      // В реальном приложении здесь будет вызов к серверу
      console.log('Запущена принудительная синхронизация');
      
    } catch (error) {
      console.error('Ошибка синхронизации:', error);
      alert('Ошибка при синхронизации. Попробуйте позже.');
    }
  }, [isOnline, tasks]);

  // Очистка всех данных (для отладки)
  const handleClearData = useCallback(async () => {
    if (window.confirm('Вы уверены? Все задачи будут удалены без возможности восстановления.')) {
      try {
        if (isDbReady) {
          await todoDB.clearDatabase();
        }
        setTasks([]);
        setPendingSyncCount(0);
        alert('Все данные очищены');
      } catch (error) {
        console.error('Ошибка очистки данных:', error);
      }
    }
  }, [isDbReady]);

  // Обработчик нажатия клавиши Enter
  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Enter') {
      addTask();
    }
  }, [addTask]);

  return (
    <div className="container">
      <h1 className="app-title">
        Умный список задач 
        {isAppInstalled && <span className="pwa-badge">PWA</span>}
      </h1>
      
      {/* Панель статуса */}
      <div className="status-panel">
        <div className={`network-status ${isOnline ? 'online' : 'offline'}`}>
          <span className="status-indicator"></span>
          {isOnline ? 'Онлайн' : 'Офлайн'}
        </div>
        
        <div className="sync-status">
          {pendingSyncCount > 0 ? (
            <span className="pending-sync">
              ⚡ Ожидают синхронизации: {pendingSyncCount}
            </span>
          ) : (
            <span className="synced">✓ Все синхронизировано</span>
          )}
        </div>
      </div>
      
      {/* Кнопка установки PWA */}
      {installPrompt && !isAppInstalled && (
        <div className="install-promo">
          <p>Установите приложение для работы в офлайн-режиме</p>
          <button 
            className="install-btn"
            onClick={handleInstallClick}
          >
            📲 Установить приложение
          </button>
        </div>
      )}
      
      {/* Основной интерфейс */}
      <div className="todo-container">
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Введите новую задачу..."
          disabled={!isDbReady}
        />
        <button 
          onClick={addTask}
          disabled={!isDbReady || inputValue.trim() === ""}
        >
          Добавить
        </button>
      </div>
      
      {/* Список задач */}
      <div className="tasks-container">
        {tasks.length === 0 ? (
          <div className="empty-state">
            <p>Список задач пуст</p>
            <p className="hint">Добавьте первую задачу. Она сохранится даже в офлайн-режиме.</p>
          </div>
        ) : (
          <ol className="list-container">
            {tasks.map((task) => (
              <li key={task.id} className="task-item">
                <div className="task-content">
                  <span className="task-text">{task.text}</span>
                  <div className="task-meta">
                    {task.syncStatus === 'pending' && (
                      <span className="sync-pending-badge">ожидает синхронизации</span>
                    )}
                    <span className="task-date">
                      {new Date(task.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>
                <div className="task-actions">
                  <button 
                    className="edit-btn"
                    onClick={() => editTask(task.id, task.text)}
                    title="Редактировать"
                  >
                    ✏️
                  </button>
                  <button 
                    className="delete-btn"
                    onClick={() => deleteTask(task.id)}
                    title="Удалить"
                  >
                    🗑️
                  </button>
                </div>
              </li>
            ))}
          </ol>
        )}
      </div>
      
      {/* Панель управления */}
      <div className="control-panel">
        <button 
          className="sync-btn"
          onClick={handleForceSync}
          disabled={pendingSyncCount === 0 || !isOnline}
        >
          🔄 Синхронизировать ({pendingSyncCount})
        </button>
        
        <div className="stats">
          <span>Всего задач: {tasks.length}</span>
          <span>Локальное хранилище: {isDbReady ? '✓' : '✗'}</span>
          <span>Service Worker: {'serviceWorker' in navigator ? '✓' : '✗'}</span>
        </div>
        
        {/* Кнопка для отладки */}
        <button 
          className="debug-btn"
          onClick={handleClearData}
          title="Очистить все данные (только для отладки)"
        >
          🧹 Очистить данные
        </button>
      </div>
      
      {/* Информационная панель */}
      <div className="info-panel">
        <details>
          <summary>ℹ️ О приложении</summary>
          <div className="info-content">
            <p><strong>Умный список задач - PWA (Progressive Web App)</strong></p>
            <ul>
              <li>📱 Работает в офлайн-режиме</li>
              <li>⚡ Фоновая синхронизация при восстановлении сети</li>
              <li>💾 Локальное хранение в IndexedDB</li>
              <li>🔔 Push-уведомления</li>
              <li>🎯 Установка на домашний экран</li>
            </ul>
            <p className="tech-info">
              Технологии: React, Service Workers, IndexedDB, Web App Manifest, Background Sync
            </p>
          </div>
        </details>
      </div>
    </div>
  );
}

export default App;