// Глобальные переменные
let currentUser = null;
const USERS_STORE = "users";
const SESSION_STORE = "sessions";

// Инициализация базы данных для пользователей
function initAuthDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open("MyDatabase", 2); // Увеличиваем версию до 2
        
        request.onupgradeneeded = function(event) {
            const db = event.target.result;
            
            // Создаем хранилище для пользователей, если его нет
            if (!db.objectStoreNames.contains(USERS_STORE)) {
                const userStore = db.createObjectStore(USERS_STORE, {
                    keyPath: "id",
                    autoIncrement: true
                });
                userStore.createIndex("username", "username", { unique: true });
                userStore.createIndex("email", "email", { unique: true });
                userStore.createIndex("timestamp", "timestamp", { unique: false });
            }
            
            // Создаем хранилище для сессий
            if (!db.objectStoreNames.contains(SESSION_STORE)) {
                const sessionStore = db.createObjectStore(SESSION_STORE, {
                    keyPath: "sessionId",
                    autoIncrement: true
                });
                sessionStore.createIndex("userId", "userId", { unique: false });
                sessionStore.createIndex("timestamp", "timestamp", { unique: false });
            }
            
            console.log("База данных обновлена для аутентификации!");
        };
        
        request.onsuccess = function(event) {
            resolve(event.target.result);
        };
        
        request.onerror = function(event) {
            reject(event.target.error);
        };
    });
}

// Функция регистрации
async function registerUser() {
    const username = document.getElementById('regUsername').value.trim();
    const email = document.getElementById('regEmail').value.trim();
    const password = document.getElementById('regPassword').value;
    const confirmPassword = document.getElementById('regConfirmPassword').value;
    
    // Валидация
    if (!username || !email || !password || !confirmPassword) {
        alert('Пожалуйста, заполните все поля');
        return;
    }
    
    if (password !== confirmPassword) {
        alert('Пароли не совпадают');
        return;
    }
    
    if (password.length < 6) {
        alert('Пароль должен быть не менее 6 символов');
        return;
    }
    
    try {
        const db = await initAuthDB();
        const transaction = db.transaction([USERS_STORE], "readwrite");
        const userStore = transaction.objectStore(USERS_STORE);
        
        // Проверяем, существует ли пользователь
        const usernameIndex = userStore.index("username");
        const existingUser = await new Promise((resolve) => {
            const request = usernameIndex.get(username);
            request.onsuccess = () => resolve(request.result);
        });
        
        if (existingUser) {
            alert('Пользователь с таким именем уже существует');
            return;
        }
        
        // Хешируем пароль (упрощенная версия, в реальном проекте используйте bcrypt)
        const hashedPassword = btoa(password); // base64 кодирование (не безопасно для продакшена!)
        
        const user = {
            username: username,
            email: email,
            password: hashedPassword,
            timestamp: new Date().getTime()
        };
        
        const addRequest = userStore.add(user);
        
        addRequest.onsuccess = function() {
            alert('Регистрация успешна! Теперь вы можете войти.');
            window.location.href = 'login.html';
        };
        
    } catch (error) {
        console.error('Ошибка регистрации:', error);
        alert('Ошибка при регистрации');
    }
}

// Функция входа
async function loginUser() {
    const username = document.getElementById('loginUsername').value.trim();
    const password = document.getElementById('loginPassword').value;
    
    if (!username || !password) {
        alert('Пожалуйста, заполните все поля');
        return;
    }
    
    try {
        const db = await initAuthDB();
        const transaction = db.transaction([USERS_STORE], "readonly");
        const userStore = transaction.objectStore(USERS_STORE);
        
        // Ищем пользователя по имени
        const usernameIndex = userStore.index("username");
        const user = await new Promise((resolve) => {
            const request = usernameIndex.get(username);
            request.onsuccess = () => resolve(request.result);
        });
        
        // Если не нашли по имени, ищем по email
        if (!user) {
            const emailIndex = userStore.index("email");
            const emailRequest = emailIndex.get(username);
            const emailUser = await new Promise((resolve) => {
                emailRequest.onsuccess = () => resolve(emailRequest.result);
            });
            
            if (emailUser) {
                const hashedPassword = btoa(password);
                if (emailUser.password === hashedPassword) {
                    await createSession(emailUser.id);
                    alert('Вход выполнен успешно!');
                    window.location.href = 'index.html';
                } else {
                    alert('Неверный пароль');
                }
            } else {
                alert('Пользователь не найден');
            }
        } else {
            const hashedPassword = btoa(password);
            if (user.password === hashedPassword) {
                await createSession(user.id);
                alert('Вход выполнен успешно!');
                window.location.href = 'index.html';
            } else {
                alert('Неверный пароль');
            }
        }
        
    } catch (error) {
        console.error('Ошибка входа:', error);
        alert('Ошибка при входе');
    }
}

// Создание сессии
async function createSession(userId) {
    const db = await initAuthDB();
    const transaction = db.transaction([SESSION_STORE], "readwrite");
    const sessionStore = transaction.objectStore(SESSION_STORE);
    
    const session = {
        userId: userId,
        timestamp: new Date().getTime(),
        expires: new Date().getTime() + (24 * 60 * 60 * 1000) // 24 часа
    };
    
    const addRequest = sessionStore.add(session);
    
    addRequest.onsuccess = function() {
        localStorage.setItem('currentSession', JSON.stringify({
            userId: userId,
            sessionId: addRequest.result
        }));
        currentUser = userId;
    };
}

// Проверка авторизации
async function checkAuth() {
    const sessionData = localStorage.getItem('currentSession');
    if (!sessionData) {
        return false;
    }
    
    const session = JSON.parse(sessionData);
    const db = await initAuthDB();
    const transaction = db.transaction([SESSION_STORE], "readonly");
    const sessionStore = transaction.objectStore(SESSION_STORE);
    
    const sessionRequest = sessionStore.get(session.sessionId);
    
    return new Promise((resolve) => {
        sessionRequest.onsuccess = function() {
            const activeSession = sessionRequest.result;
            if (activeSession && activeSession.expires > new Date().getTime()) {
                currentUser = activeSession.userId;
                resolve(true);
            } else {
                logout();
                resolve(false);
            }
        };
    });
}

// Выход из системы
function logout() {
    localStorage.removeItem('currentSession');
    currentUser = null;
    window.location.href = 'login.html';
}

// Обновим файл sw.js - добавим новые страницы в кэш
// Добавьте в массив urlsToCache:
// '/register.html',
// '/login.html',
// '/auth.js'

// При загрузке страницы проверяем авторизацию
document.addEventListener('DOMContentLoaded', async function() {
    // Пропускаем страницы регистрации и входа
    const currentPath = window.location.pathname;
    if (currentPath.includes('register.html') || currentPath.includes('login.html')) {
        return;
    }
    
    const isAuthenticated = await checkAuth();
    if (!isAuthenticated && !currentPath.includes('index.html')) {
        window.location.href = 'login.html';
    }
});