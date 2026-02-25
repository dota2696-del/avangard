// Глобальная переменная для базы данных
let db;

// Открываем базу данных
const request = indexedDB.open("MyDatabase", 2);

request.onupgradeneeded = function(event) {
    const db = event.target.result;
    console.log("Обновление базы данных...");
    
    if (!db.objectStoreNames.contains("items")) {
        const objectStore = db.createObjectStore("items", { 
            keyPath: "id", 
            autoIncrement: true 
        });
        
        objectStore.createIndex("name", "name", { unique: false });
        objectStore.createIndex("value", "value", { unique: false });
        objectStore.createIndex("timestamp", "timestamp", { unique: false });
        objectStore.createIndex("userId", "userId", { unique: false });
        
        console.log("Хранилище items создано!");
    }
};

request.onsuccess = function(event) {
    db = event.target.result;
    console.log("База данных открыта успешно!");
};

request.onerror = function(event) {
    console.error("Ошибка при открытии базы данных:", event.target.error);
};

// Функция для добавления элемента
window.addItem = function() {
    console.log("Функция addItem вызвана!");
    
    const sessionData = localStorage.getItem('currentSession');
    if (!sessionData) {
        alert('Необходимо войти в систему');
        window.location.href = 'login.html';
        return;
    }
    
    const session = JSON.parse(sessionData);
    const nameInput = document.getElementById('itemName');
    const valueInput = document.getElementById('itemValue');
    
    const name = nameInput.value.trim();
    const value = valueInput.value.trim();
    
    if (!name || !value) {
        alert('Пожалуйста, заполните оба поля');
        return;
    }
    
    const transaction = db.transaction(["items"], "readwrite");
    const objectStore = transaction.objectStore("items");
    
    const item = {
        name: name,
        value: value,
        userId: session.userId,
        timestamp: new Date().getTime()
    };
    
    const addRequest = objectStore.add(item);
    
    addRequest.onsuccess = function() {
        console.log("Элемент добавлен!");
        nameInput.value = '';
        valueInput.value = '';
        loadItems();
    };
    
    addRequest.onerror = function(event) {
        console.error("Ошибка при добавлении:", event.target.error);
    };
};

// Функция для загрузки элементов
window.loadItems = function() {
    console.log("Загрузка элементов...");
    
    const sessionData = localStorage.getItem('currentSession');
    if (!sessionData) {
        console.log("Нет сессии");
        return;
    }
    
    try {
        const session = JSON.parse(sessionData);
        const transaction = db.transaction(["items"], "readonly");
        const objectStore = transaction.objectStore("items");
        const index = objectStore.index("userId");
        
        const getAllRequest = index.getAll(session.userId);
        
        getAllRequest.onsuccess = function() {
            const items = getAllRequest.result;
            console.log("Загружено элементов:", items.length);
            displayItems(items);
        };
    } catch (error) {
        console.error("Ошибка загрузки:", error);
    }
};

// Функция для отображения элементов
function displayItems(items) {
    const itemsList = document.getElementById('itemsList');
    if (!itemsList) return;
    
    itemsList.innerHTML = '';
    
    if (items.length === 0) {
        itemsList.innerHTML = '<li>Пока нет сохранённых элементов</li>';
        return;
    }
    
    items.sort((a, b) => b.timestamp - a.timestamp);
    
    items.forEach(item => {
        const li = document.createElement('li');
        li.innerHTML = `
            <strong>${escapeHtml(item.name)}</strong>: ${escapeHtml(item.value)}
            <button onclick="window.deleteItem(${item.id})" class="delete-btn">Удалить</button>
        `;
        itemsList.appendChild(li);
    });
}

// Функция для удаления элемента
window.deleteItem = function(id) {
    console.log("Удаление элемента:", id);
    
    const transaction = db.transaction(["items"], "readwrite");
    const objectStore = transaction.objectStore("items");
    
    const deleteRequest = objectStore.delete(id);
    
    deleteRequest.onsuccess = function() {
        console.log("Элемент удалён");
        loadItems();
    };
    
    deleteRequest.onerror = function(event) {
        console.error("Ошибка при удалении:", event.target.error);
    };
};

// Функция для защиты от XSS
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

console.log("app.js загружен");
