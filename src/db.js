// Модуль для работы с IndexedDB (локальное хранилище)

const DB_NAME = 'TodoPWA_DB';
const DB_VERSION = 2;
const STORE_TASKS = 'tasks';
const STORE_SYNC_QUEUE = 'sync_queue';

export class TodoDB {
  constructor() {
    this.db = null;
    this.isInitialized = false;
  }

  // Инициализация базы данных
  async init() {
    if (this.isInitialized) return this.db;
    
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      
      request.onerror = (event) => {
        console.error('Ошибка открытия IndexedDB:', event.target.error);
        reject(event.target.error);
      };
      
      request.onsuccess = (event) => {
        this.db = event.target.result;
        this.isInitialized = true;
        console.log('IndexedDB успешно инициализирована');
        resolve(this.db);
      };
      
      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        console.log('Обновление схемы IndexedDB до версии', event.newVersion);
        
        // Создание хранилища для задач
        if (!db.objectStoreNames.contains(STORE_TASKS)) {
          const taskStore = db.createObjectStore(STORE_TASKS, { keyPath: 'id' });
          taskStore.createIndex('syncStatus', 'syncStatus', { unique: false });
          taskStore.createIndex('createdAt', 'createdAt', { unique: false });
          taskStore.createIndex('updatedAt', 'updatedAt', { unique: false });
          console.log('Создано хранилище задач');
        }
        
        // Создание хранилища для очереди синхронизации
        if (!db.objectStoreNames.contains(STORE_SYNC_QUEUE)) {
          const syncStore = db.createObjectStore(STORE_SYNC_QUEUE, { 
            keyPath: 'id',
            autoIncrement: true 
          });
          syncStore.createIndex('status', 'status', { unique: false });
          syncStore.createIndex('createdAt', 'createdAt', { unique: false });
          console.log('Создано хранилище очереди синхронизации');
        }
      };
    });
  }

  // Сохранение задачи (создание или обновление)
  async saveTask(task) {
    await this.ensureInitialized();
    
    const taskWithMeta = {
      ...task,
      syncStatus: 'pending', // pending, synced, error
      createdAt: task.createdAt || Date.now(),
      updatedAt: Date.now(),
      version: (task.version || 0) + 1
    };
    
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([STORE_TASKS, STORE_SYNC_QUEUE], 'readwrite');
      
      // Сохраняем задачу
      const taskStore = transaction.objectStore(STORE_TASKS);
      const taskRequest = taskStore.put(taskWithMeta);
      
      // Добавляем в очередь синхронизации
      const syncStore = transaction.objectStore(STORE_SYNC_QUEUE);
      const syncItem = {
        action: task.id ? 'update' : 'create',
        taskId: taskWithMeta.id,
        taskData: taskWithMeta,
        status: 'pending',
        createdAt: Date.now(),
        retryCount: 0
      };
      const syncRequest = syncStore.add(syncItem);
      
      transaction.oncomplete = () => {
        console.log('Задача сохранена локально:', taskWithMeta.id);
        resolve(taskWithMeta);
        
        // Регистрируем фоновую синхронизацию
        this.registerBackgroundSync();
      };
      
      transaction.onerror = (event) => {
        console.error('Ошибка сохранения задачи:', event.target.error);
        reject(event.target.error);
      };
    });
  }

  // Удаление задачи
  async deleteTask(taskId) {
    await this.ensureInitialized();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([STORE_TASKS, STORE_SYNC_QUEUE], 'readwrite');
      
      // Удаляем задачу
      const taskStore = transaction.objectStore(STORE_TASKS);
      const taskRequest = taskStore.delete(taskId);
      
      // Добавляем запись об удалении в очередь синхронизации
      const syncStore = transaction.objectStore(STORE_SYNC_QUEUE);
      const syncItem = {
        action: 'delete',
        taskId: taskId,
        status: 'pending',
        createdAt: Date.now(),
        retryCount: 0
      };
      const syncRequest = syncStore.add(syncItem);
      
      transaction.oncomplete = () => {
        console.log('Задача помечена на удаление:', taskId);
        resolve(true);
        
        // Регистрируем фоновую синхронизацию
        this.registerBackgroundSync();
      };
      
      transaction.onerror = (event) => {
        console.error('Ошибка удаления задачи:', event.target.error);
        reject(event.target.error);
      };
    });
  }

  // Получение всех задач
  async getAllTasks() {
    await this.ensureInitialized();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(STORE_TASKS, 'readonly');
      const store = transaction.objectStore(STORE_TASKS);
      const index = store.index('createdAt');
      const request = index.getAll();
      
      request.onsuccess = () => {
        resolve(request.result || []);
      };
      
      request.onerror = (event) => {
        console.error('Ошибка получения задач:', event.target.error);
        reject(event.target.error);
      };
    });
  }

  // Получение задач, ожидающих синхронизации
  async getPendingSyncTasks() {
    await this.ensureInitialized();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(STORE_SYNC_QUEUE, 'readonly');
      const store = transaction.objectStore(STORE_SYNC_QUEUE);
      const index = store.index('status');
      const request = index.getAll('pending');
      
      request.onsuccess = () => {
        resolve(request.result || []);
      };
      
      request.onerror = (event) => {
        reject(event.target.error);
      };
    });
  }

  // Регистрация фоновой синхронизации
  async registerBackgroundSync() {
    if ('serviceWorker' in navigator && 'SyncManager' in window) {
      try {
        const registration = await navigator.serviceWorker.ready;
        await registration.sync.register('sync-tasks');
        console.log('Фоновая синхронизация зарегистрирована');
      } catch (error) {
        console.warn('Ошибка регистрации фоновой синхронизации:', error);
      }
    } else {
      console.log('Background Sync API не поддерживается');
    }
  }

  // Вспомогательная функция для проверки инициализации
  async ensureInitialized() {
    if (!this.isInitialized) {
      await this.init();
    }
  }

  // Очистка базы данных (для отладки)
  async clearDatabase() {
    await this.ensureInitialized();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([STORE_TASKS, STORE_SYNC_QUEUE], 'readwrite');
      
      transaction.objectStore(STORE_TASKS).clear();
      transaction.objectStore(STORE_SYNC_QUEUE).clear();
      
      transaction.oncomplete = () => {
        console.log('База данных очищена');
        resolve();
      };
      
      transaction.onerror = (event) => {
        reject(event.target.error);
      };
    });
  }
}

// Создаем и экспортируем единственный экземпляр
export const todoDB = new TodoDB();