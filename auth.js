console.log("auth.js загружается...");

// Функция инициализации БД
function initAuthDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open("MyDatabase", 1);
        
        request.onupgradeneeded = function(event) {
            const db = event.target.result;
            console.log("Создание новой базы данных...");
            
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
            console.log("База данных открыта");
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
    
    const username = document.getElementById('regUsername')?.value;
    const email = document.getElementById('regEmail')?.value;
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
    
    try {
        const db = await initAuthDB();
        
        const transaction = db.transaction(["users"], "readwrite");
        const userStore = transaction.objectStore("users");
        const usernameIndex = userStore.index("username");
        
        usernameIndex.get(username).onsuccess = function(event) {
            if (event.target.result) {
                alert('Пользователь с таким именем уже существует');
                return;
            }
            
            const user = {
                username: username,
                email: email,
                password: btoa(password),
                timestamp: Date.now()
            };
            
            userStore.add(user).onsuccess = function() {
                alert('Регистрация успешна!');
                window.location.href = 'login.html';
            };
        };
        
    } catch (error) {
        console.error('Ошибка регистрации:', error);
        alert('Ошибка при регистрации');
    }
};

// Функция входа
window.loginUser = async function() {
    console.log("Вход в систему...");
    
    const username = document.getElementById('loginUsername')?.value;
    const password = document.getElementById('loginPassword')?.value;
    
    if (!username || !password) {
        alert('Пожалуйста, заполните все поля');
        return;
    }
    
    try {
        const db = await initAuthDB();
        
        const transaction = db.transaction(["users"], "readonly");
        const userStore = transaction.objectStore("users");
        const usernameIndex = userStore.index("username");
        
        usernameIndex.get(username).onsuccess = function(event) {
            const user = event.target.result;
            
            if (user && user.password === btoa(password)) {
                const sessionTransaction = db.transaction(["sessions"], "readwrite");
                const sessionStore = sessionTransaction.objectStore("sessions");
                
                const session = {
                    userId: user.id,
                    timestamp: Date.now(),
                    expires: Date.now() + (24 * 60 * 60 * 1000)
                };
                
                sessionStore.add(session).onsuccess = function(e) {
                    localStorage.setItem('currentSession', JSON.stringify({
                        userId: user.id,
                        sessionId: e.target.result
                    }));
                    alert('Вход выполнен успешно!');
                    window.location.href = 'index.html';
                };
            } else {
                alert('Неверное имя пользователя или пароль');
            }
        };
        
    } catch (error) {
        console.error('Ошибка входа:', error);
        alert('Ошибка при входе');
    }
};

// Выход из системы
window.logout = function() {
    console.log("Выход из системы");
    localStorage.removeItem('currentSession');
    window.location.href = 'login.html';
};

// Функция для просмотра пользователей (для отладки)
window.showAllUsers = async function() {
    try {
        const db = await initAuthDB();
        const transaction = db.transaction(["users"], "readonly");
        const store = transaction.objectStore("users");
        
        store.getAll().onsuccess = function(event) {
            console.table(event.target.result);
            alert(`Пользователей: ${event.target.result.length}`);
        };
    } catch (error) {
        console.error("Ошибка:", error);
    }
};

console.log("auth.js загружен");
