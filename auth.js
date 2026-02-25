// База данных для авторизации
const AUTH_DB = {
    USERS_STORE: "users",
    SESSION_STORE: "sessions"
};

// Инициализация БД для авторизации
function initAuthDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open("MyDatabase", 2);
        
        request.onupgradeneeded = function(event) {
            const db = event.target.result;
            console.log("Обновление базы данных auth...");
            
            if (!db.objectStoreNames.contains(AUTH_DB.USERS_STORE)) {
                const userStore = db.createObjectStore(AUTH_DB.USERS_STORE, {
                    keyPath: "id",
                    autoIncrement: true
                });
                userStore.createIndex("username", "username", { unique: true });
                userStore.createIndex("email", "email", { unique: true });
                console.log("Хранилище users создано");
            }
            
            if (!db.objectStoreNames.contains(AUTH_DB.SESSION_STORE)) {
                const sessionStore = db.createObjectStore(AUTH_DB.SESSION_STORE, {
                    keyPath: "sessionId",
                    autoIncrement: true
                });
                sessionStore.createIndex("userId", "userId", { unique: false });
                console.log("Хранилище sessions создано");
            }
        };
        
        request.onsuccess = function(event) {
            console.log("База данных auth открыта успешно");
            resolve(event.target.result);
        };
        
        request.onerror = function(event) {
            console.error("Ошибка открытия БД auth:", event.target.error);
            reject(event.target.error);
        };
    });
}

// Функция регистрации
window.registerUser = async function() {
    console.log("Регистрация...");
    
    const username = document.getElementById('regUsername')?.value.trim();
    const email = document.getElementById('regEmail')?.value.trim();
    const password = document.getElementById('regPassword')?.value;
    const confirmPassword = document.getElementById('regConfirmPassword')?.value;
    
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
        const transaction = db.transaction([AUTH_DB.USERS_STORE], "readwrite");
        const userStore = transaction.objectStore(AUTH_DB.USERS_STORE);
        
        // Проверяем существование пользователя
        const usernameIndex = userStore.index("username");
        const existingUser = await new Promise((resolve) => {
            const request = usernameIndex.get(username);
            request.onsuccess = () => resolve(request.result);
        });
        
        if (existingUser) {
            alert('Пользователь с таким именем уже существует');
            return;
        }
        
        // Создаем пользователя
        const user = {
            username: username,
            email: email,
            password: btoa(password), // Простое кодирование (не для продакшена!)
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
};

// Функция входа
window.loginUser = async function() {
    console.log("Вход в систему...");
    
    const username = document.getElementById('loginUsername')?.value.trim();
    const password = document.getElementById('loginPassword')?.value;
    
    if (!username || !password) {
        alert('Пожалуйста, заполните все поля');
        return;
    }
    
    try {
        const db = await initAuthDB();
        const transaction = db.transaction([AUTH_DB.USERS_STORE], "readonly");
        const userStore = transaction.objectStore(AUTH_DB.USERS_STORE);
        
        // Ищем по username
        const usernameIndex = userStore.index("username");
        const user = await new Promise((resolve) => {
            const request = usernameIndex.get(username);
            request.onsuccess = () => resolve(request.result);
        });
        
        if (!user) {
            // Если не нашли по username, ищем по email
            const emailIndex = userStore.index("email");
            const emailRequest = emailIndex.get(username);
            const emailUser = await new Promise((resolve) => {
                emailRequest.onsuccess = () => resolve(emailRequest.result);
            });
            
            if (!emailUser) {
                alert('Пользователь не найден');
                return;
            }
            
            if (emailUser.password === btoa(password)) {
                await createSession(emailUser.id);
                alert('Вход выполнен успешно!');
                window.location.href = 'index.html';
            } else {
                alert('Неверный пароль');
            }
        } else {
            if (user.password === btoa(password)) {
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
};

// Создание сессии
async function createSession(userId) {
    const db = await initAuthDB();
    const transaction = db.transaction([AUTH_DB.SESSION_STORE], "readwrite");
    const sessionStore = transaction.objectStore(AUTH_DB.SESSION_STORE);
    
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
        console.log("Сессия создана");
    };
}

// Проверка авторизации
window.checkAuth = async function() {
    console.log("Проверка авторизации...");
    
    const sessionData = localStorage.getItem('currentSession');
    if (!sessionData) {
        return false;
    }
    
    try {
        const session = JSON.parse(sessionData);
        const db = await initAuthDB();
        const transaction = db.transaction([AUTH_DB.SESSION_STORE], "readonly");
        const sessionStore = transaction.objectStore(AUTH_DB.SESSION_STORE);
        
        const sessionRequest = sessionStore.get(session.sessionId);
        
        return new Promise((resolve) => {
            sessionRequest.onsuccess = function() {
                const activeSession = sessionRequest.result;
                if (activeSession && activeSession.expires > new Date().getTime()) {
                    // Обновляем приветствие
                    const welcomeEl = document.getElementById('welcomeMessage');
                    if (welcomeEl) {
                        welcomeEl.textContent = `Добро пожаловать, пользователь #${activeSession.userId}`;
                    }
                    resolve(true);
                } else {
                    window.logout();
                    resolve(false);
                }
            };
            
            sessionRequest.onerror = function() {
                resolve(false);
            };
        });
    } catch (error) {
        console.error("Ошибка проверки:", error);
        return false;
    }
};

// Выход из системы
window.logout = function() {
    console.log("Выход из системы");
    localStorage.removeItem('currentSession');
    
    // Если мы не на странице входа, перенаправляем
    if (!window.location.pathname.includes('login.html') && 
        !window.location.pathname.includes('register.html')) {
        window.location.href = 'login.html';
    }
};

// Проверяем авторизацию при загрузке страницы
document.addEventListener('DOMContentLoaded', async function() {
    console.log("Auth.js: страница загружена");
    
    // Если мы на главной странице
    if (window.location.pathname.endsWith('index.html') || window.location.pathname === '/') {
        const isAuth = await window.checkAuth();
        if (!isAuth) {
            window.location.href = 'login.html';
        } else {
            // Загружаем элементы
            if (typeof window.loadItems === 'function') {
                setTimeout(() => window.loadItems(), 500);
            }
        }
    }
});

console.log("auth.js загружен");
