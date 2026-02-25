console.log("app.js загружается...");

let db;

const request = indexedDB.open("MyDatabase", 1);

request.onsuccess = function(event) {
    db = event.target.result;
    console.log("База данных открыта");
    
    // Загружаем элементы если есть сессия
    if (localStorage.getItem('currentSession')) {
        loadItems();
    }
};

request.onerror = function(event) {
    console.error("Ошибка:", event.target.error);
};

// Добавление элемента
window.addItem = function() {
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
        alert('Заполните все поля');
        return;
    }
    
    const transaction = db.transaction(["items"], "readwrite");
    const store = transaction.objectStore("items");
    
    store.add({
        name: name,
        value: value,
        userId: session.userId,
        timestamp: Date.now()
    }).onsuccess = function() {
        nameInput.value = '';
        valueInput.value = '';
        loadItems();
    };
};

// Загрузка элементов
window.loadItems = function() {
    const sessionData = localStorage.getItem('currentSession');
    if (!sessionData) return;
    
    const session = JSON.parse(sessionData);
    const transaction = db.transaction(["items"], "readonly");
    const store = transaction.objectStore("items");
    const index = store.index("userId");
    
    index.getAll(session.userId).onsuccess = function(event) {
        displayItems(event.target.result);
    };
};

// Отображение элементов
function displayItems(items) {
    const list = document.getElementById('itemsList');
    if (!list) return;
    
    list.innerHTML = '';
    
    if (items.length === 0) {
        list.innerHTML = '<li>Нет элементов</li>';
        return;
    }
    
    items.sort((a, b) => b.timestamp - a.timestamp);
    
    items.forEach(item => {
        const li = document.createElement('li');
        li.innerHTML = `
            <strong>${item.name}</strong>: ${item.value}
            <button onclick="deleteItem(${item.id})" class="delete-btn">Удалить</button>
        `;
        list.appendChild(li);
    });
}

// Удаление элемента
window.deleteItem = function(id) {
    const transaction = db.transaction(["items"], "readwrite");
    transaction.objectStore("items").delete(id).onsuccess = function() {
        loadItems();
    };
};

console.log("app.js загружен");
