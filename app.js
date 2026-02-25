// Глобальная переменная для базы данных
let db;

// Открываем (или создаем) базу данных при загрузке страницы
const request = indexedDB.open("MyDatabase", 1);

// Этот код выполняется при создании базы данных или обновлении версии
request.onupgradeneeded = function(event) {
    const db = event.target.result;
    
    // Создаем хранилище объектов (как таблица в SQL)
    // keyPath: "id" означает, что у каждого элемента будет уникальный id
    // autoIncrement: true — id будет увеличиваться автоматически
    const objectStore = db.createObjectStore("items", { 
        keyPath: "id", 
        autoIncrement: true 
    });
    
    // Создаем индексы для быстрого поиска
    objectStore.createIndex("name", "name", { unique: false });
    objectStore.createIndex("value", "value", { unique: false });
    objectStore.createIndex("timestamp", "timestamp", { unique: false });
    
    console.log("База данных создана!");
};

// Успешное открытие базы данных
request.onsuccess = function(event) {
    db = event.target.result;
    console.log("База данных открыта успешно!");
    
    // Загружаем сохраненные элементы
    loadItems();
};

// Обработка ошибок
request.onerror = function(event) {
    console.error("Ошибка при открытии базы данных:", event.target.error);
};

// Функция для добавления элемента в базу данных
window.addItem = function() {
    const nameInput = document.getElementById('itemName');
    const valueInput = document.getElementById('itemValue');
    
    const name = nameInput.value.trim();
    const value = valueInput.value.trim();
    
    if (!name || !value) {
        alert('Пожалуйста, заполните оба поля');
        return;
    }
    
    // Начинаем транзакцию
    const transaction = db.transaction(["items"], "readwrite");
    const objectStore = transaction.objectStore("items");
    
    // Создаем объект для сохранения
    const item = {
        name: name,
        value: value,
        timestamp: new Date().getTime()
    };
    
    // Добавляем в базу данных
    const addRequest = objectStore.add(item);
    
    addRequest.onsuccess = function() {
        console.log("Элемент добавлен!");
        nameInput.value = '';
        valueInput.value = '';
        loadItems(); // Обновляем список
    };
    
    addRequest.onerror = function(event) {
        console.error("Ошибка при добавлении:", event.target.error);
    };
    
    transaction.oncomplete = function() {
        console.log("Транзакция завершена");
    };
};

// Функция для загрузки и отображения всех элементов
function loadItems() {
    const transaction = db.transaction(["items"], "readonly");
    const objectStore = transaction.objectStore("items");
    
    // Получаем все элементы
    const getAllRequest = objectStore.getAll();
    
    getAllRequest.onsuccess = function() {
        const items = getAllRequest.result;
        displayItems(items);
    };
    
    getAllRequest.onerror = function(event) {
        console.error("Ошибка при загрузке:", event.target.error);
    };
}

// Функция для отображения элементов на странице
function displayItems(items) {
    const itemsList = document.getElementById('itemsList');
    itemsList.innerHTML = '';
    
    if (items.length === 0) {
        itemsList.innerHTML = '<li>Пока нет сохраненных элементов</li>';
        return;
    }
    
    // Сортируем по времени добавления (новые сверху)
    items.sort((a, b) => b.timestamp - a.timestamp);
    
    items.forEach(item => {
        const li = document.createElement('li');
        li.innerHTML = `
            <strong>${escapeHtml(item.name)}</strong>: ${escapeHtml(item.value)}
            <button onclick="deleteItem(${item.id})" class="delete-btn">Удалить</button>
        `;
        itemsList.appendChild(li);
    });
}

// Функция для удаления элемента
window.deleteItem = function(id) {
    const transaction = db.transaction(["items"], "readwrite");
    const objectStore = transaction.objectStore("items");
    
    const deleteRequest = objectStore.delete(id);
    
    deleteRequest.onsuccess = function() {
        console.log("Элемент удален");
        loadItems(); // Обновляем список
    };
    
    deleteRequest.onerror = function(event) {
        console.error("Ошибка при удалении:", event.target.error);
    };
};

// Функция для защиты от XSS-атак (экранирование HTML)
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Функция для получения данных из опубликованного Google Sheets
async function fetchPublicSheetData() {
    // ID вашей таблицы из ссылки (это длинный код в URL)
    const sheetId = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRqdXk5jgRvFFBo_g0BlnH7Geb9UxjcLQjwcv0gEz_Pb4BBThGflh0gvlE6yAhyiGFbwVEAOppr9dPO/pubhtml?gid=0&single=true_ID'; 
    
    // Номер листа (обычно 1 для первого листа)
    const gid = 0;
    
    // Формат CSV — самый простой для парсинга
    const url = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=${gid}`;
    
    try {
        const response = await fetch(url);
        const csvText = await response.text();
        
        // Парсим CSV в массив объектов
        const rows = csvText.split('\n');
        const headers = rows[0].split(',');
        const data = rows.slice(1).map(row => {
            const values = row.split(',');
            return headers.reduce((obj, header, index) => {
                obj[header.trim()] = values[index]?.trim() || '';
                return obj;
            }, {});
        });
        
        console.log('Данные из Google Sheets:', data);
        return data;
    } catch (error) {
        console.error('Ошибка загрузки:', error);
    }
}

// Вызовите при загрузке страницы
fetchPublicSheetData();