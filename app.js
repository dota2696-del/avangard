console.log("app.js загружается...");

let db;

const request = indexedDB.open("MyDatabase", 3);

request.onsuccess = function(event) {
    db = event.target.result;
    console.log("База данных открыта, версия:", db.version);
};

request.onerror = function(event) {
    console.error("Ошибка:", event.target.error);
};

// Эти функции остаются для обратной совместимости
window.addItem = function() {
    if (sheets) {
        sheets.addRow();
    }
};

console.log("app.js загружен");
