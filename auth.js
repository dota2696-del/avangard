console.log("auth.js загружается...");

// Функция инициализации БД - ИСПРАВЛЯЕМ ВЕРСИЮ
function initAuthDB() {
    return new Promise((resolve, reject) => {
        // Используем версию 3, так как база уже существует с версией 3
        const request = indexedDB.open("MyDatabase", 3);
        
        request.onupgradeneeded = function(event) {
            const db = event.target.result;
            console.log("Обновление базы данных...");
            
            // Создаем хранилища, если их нет
            if (!db.objectStoreNames.contains("users")) {
                const userStore = db.createObjectStore("users", {
                    keyPath: "id",
                    autoIncrement: true
                });
                userStore.createIndex("username", "username", { unique: true });
                userStore.createIndex("email", "email", { unique: true });
                console.log("Хранилище users создано");
            }
            
            if (!db.objectStoreNames.contains("sessions")) {
                const sessionStore = db.createObjectStore("sessions", {
                    keyPath: "sessionId",
                    autoIncrement: true
                });
                sessionStore.createIndex("userId", "userId", { unique: false });
                console.log("Хранилище sessions создано");
            }
            
            if (!db.objectStoreNames.contains("items")) {
                const itemsStore = db.createObjectStore("items", {
                    keyPath: "id",
                    autoIncrement: true
                });
                itemsStore.createIndex("name", "name", { unique: false });
                itemsStore.createIndex("value", "value", { unique: false });
                itemsStore.createIndex("timestamp", "timestamp", { unique: false });
                itemsStore.createIndex("userId", "userId", { unique: false });
                console.log("Хранилище items создано");
            }
        };
        
        request.onsuccess = function(event) {
            const db = event.target.result;
            console.log("База данных открыта, версия:", db.version);
            console.log("Доступные хранилища:", Array.from(db.objectStoreNames));
            resolve(db);
        };
        
        request.onerror = function(event) {
            console.error("Ошибка открытия БД:", event.target.error);
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
        console.log("БД получена, начинаем транзакцию...");
        
        // Проверяем наличие хранилища
        if (!db.objectStoreNames.contains("users")) {
            console.error("Хранилище users не найдено!");
            alert("Ошибка инициализации базы данных. Обновите страницу.");
            return;
        }
        
        const transaction = db.transaction(["users"], "readwrite");
        const userStore = transaction.objectStore("users");
        const usernameIndex = userStore.index("username");
        
        // Проверяем существование пользователя
        const checkRequest = usernameIndex.get(username);
        
        checkRequest.onsuccess = function() {
            if (checkRequest.result) {
                alert('Пользователь с таким именем уже существует');
                return;
            }
            
            // Создаем пользователя
            const user = {
                username: username,
                email: email,
                password: btoa(password),
                timestamp: Date.now()
            };
            
            const addRequest = userStore.add(user);
            
            addRequest.onsuccess = function() {
                console.log("Пользователь создан, ID:", addRequest.result);
                alert('Регистрация успешна! Теперь вы можете войти.');
                window.location.href = 'login.html';
            };
            
            addRequest.onerror = function(error) {
                console.error("Ошибка добавления:", error);
                alert('Ошибка при создании пользователя');
            };
        };
        
        checkRequest.onerror = function(error) {
            console.error("Ошибка проверки:", error);
            alert('Ошибка при проверке пользователя');
        };
        
    } catch (error) {
        console.error('Ошибка регистрации:', error);
        alert('Ошибка при регистрации: ' + error.message);
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
        
        if (!db.objectStoreNames.contains("users")) {
            alert("Ошибка базы данных. Обновите страницу.");
            return;
        }
        
        const transaction = db.transaction(["users"], "readonly");
        const userStore = transaction.objectStore("users");
        const usernameIndex = userStore.index("username");
        
        // Ищем по username
        const request = usernameIndex.get(username);
        
        request.onsuccess = function() {
            const user = request.result;
            
            if (!user) {
                // Пробуем найти по email
                const emailIndex = userStore.index("email");
                const emailRequest = emailIndex.get(username);
                
                emailRequest.onsuccess = function() {
                    const emailUser = emailRequest.result;
                    
                    if (!emailUser) {
                        alert('Пользователь не найден');
                        return;
                    }
                    
                    if (emailUser.password === btoa(password)) {
                        createSession(db, emailUser.id);
                    } else {
                        alert('Неверный пароль');
                    }
                };
            } else {
                if (user.password === btoa(password)) {
                    createSession(db, user.id);
                } else {
                    alert('Неверный пароль');
                }
            }
        };
        
    } catch (error) {
        console.error('Ошибка входа:', error);
        alert('Ошибка при входе: ' + error.message);
    }
};

// Создание сессии
async function createSession(db, userId) {
    const transaction = db.transaction(["sessions"], "readwrite");
    const sessionStore = transaction.objectStore("sessions");
    
    const session = {
        userId: userId,
        timestamp: Date.now(),
        expires: Date.now() + (24 * 60 * 60 * 1000)
    };
    
    const addRequest = sessionStore.add(session);
    
    addRequest.onsuccess = function() {
        localStorage.setItem('currentSession', JSON.stringify({
            userId: userId,
            sessionId: addRequest.result
        }));
        console.log("Сессия создана");
        alert('Вход выполнен успешно!');
        window.location.href = 'index.html';
    };
}

// Проверка авторизации
window.checkAuth = function() {
    return localStorage.getItem('currentSession') !== null;
};

// Выход из системы
window.logout = function() {
    console.log("Выход из системы");
    localStorage.removeItem('currentSession');
    window.location.href = 'login.html';
};

// Функция для просмотра всех пользователей
window.showAllUsers = async function() {
    try {
        const db = await initAuthDB();
        const transaction = db.transaction(["users"], "readonly");
        const store = transaction.objectStore("users");
        
        const request = store.getAll();
        
        request.onsuccess = function() {
            const users = request.result;
            console.log("=== ВСЕ ПОЛЬЗОВАТЕЛИ ===");
            console.table(users.map(u => ({
                ID: u.id,
                Имя: u.username,
                Email: u.email,
                Пароль: u.password,
                Дата: new Date(u.timestamp).toLocaleString()
            })));
            alert(`Найдено пользователей: ${users.length}\nСмотрите консоль (F12)`);
        };
    } catch (error) {
        console.error("Ошибка:", error);
    }
};

// При загрузке страницы
document.addEventListener('DOMContentLoaded', function() {
    console.log("Auth.js: страница загружена");
    
    // Инициализируем БД при загрузке
    initAuthDB().then(db => {
        console.log("БД готова к работе");
    }).catch(err => {
        console.error("Ошибка инициализации БД:", err);
    });
});

console.log("auth.js загружен");
