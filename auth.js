console.log("auth.js загружается...");

// Функция инициализации БД
function initAuthDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open("MyDatabase", 3);
        
        request.onsuccess = function(event) {
            const db = event.target.result;
            console.log("База данных открыта, версия:", db.version);
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
    
    const username = document.getElementById('loginUsername')?.value.trim();
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
            
            if (!user) {
                // Пробуем найти по email
                const emailIndex = userStore.index("email");
                emailIndex.get(username).onsuccess = function(e) {
                    const emailUser = e.target.result;
                    
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
        alert('Ошибка при входе');
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
    
    sessionStore.add(session).onsuccess = function(e) {
        localStorage.setItem('currentSession', JSON.stringify({
            userId: userId,
            sessionId: e.target.result
        }));
        alert('Вход выполнен успешно!');
        window.location.href = 'index.html';
    };
}

// Выход из системы
window.logout = function() {
    console.log("Выход из системы");
    localStorage.removeItem('currentSession');
    window.location.href = 'login.html';
};

// Проверка авторизации для index.html
if (window.location.pathname.includes('index.html')) {
    if (!localStorage.getItem('currentSession')) {
        window.location.href = 'login.html';
    }
}

console.log("auth.js загружен");

