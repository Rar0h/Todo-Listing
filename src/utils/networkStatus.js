class NetworkStatus {
  constructor() {
    this.isOnline = navigator.onLine;
    this.listeners = new Set();
    
    this.init();
  }
  
  init() {
    window.addEventListener('online', this.handleOnline.bind(this));
    window.addEventListener('offline', this.handleOffline.bind(this));
  }
  
  handleOnline() {
    console.log('Сетевое подключение восстановлено');
    this.isOnline = true;
    this.notifyListeners();
    
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.ready.then(registration => {
        if (registration.sync) {
          registration.sync.register('sync-tasks')
            .then(() => console.log('Синхронизация запущена после восстановления сети'))
            .catch(err => console.warn('Ошибка регистрации синхронизации:', err));
        }
      });
    }
  }
  
  handleOffline() {
    console.log('Сетевое подключение потеряно');
    this.isOnline = false;
    this.notifyListeners();
  }
  
  addListener(callback) {
    this.listeners.add(callback);
    callback(this.isOnline);
  }
  
  removeListener(callback) {
    this.listeners.delete(callback);
  }
  
  notifyListeners() {
    this.listeners.forEach(callback => callback(this.isOnline));
  }
  
  getStatus() {
    return this.isOnline;
  }
  
  getStatusText() {
    return this.isOnline ? 'онлайн' : 'офлайн';
  }
  
  destroy() {
    window.removeEventListener('online', this.handleOnline.bind(this));
    window.removeEventListener('offline', this.handleOffline.bind(this));
    this.listeners.clear();
  }
}

export const networkStatus = new NetworkStatus();