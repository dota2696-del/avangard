\// google-sheets.js - Интеграция с Google Sheets через CSV

class GoogleSheetsIntegration {
    constructor() {
        this.sheetId = null;
        this.gid = 0; // номер листа (обычно 0 для первого листа)
        this.data = [];
    }

    // Установить ID таблицы
    setSheetId(sheetId) {
        this.sheetId = sheetId;
        localStorage.setItem('googleSheetId', sheetId);
    }

    // Получить ID таблицы из localStorage
    getSheetId() {
        return localStorage.getItem('googleSheetId') || this.sheetId;
    }

    // Извлечь ID из URL Google Sheets
    extractSheetId(url) {
        // Проверяем, не является ли входная строка уже ID
        if (url.match(/^[a-zA-Z0-9-_]{20,}$/)) {
            return url;
        }

        // Извлекаем из URL
        const patterns = [
            /\/d\/([a-zA-Z0-9-_]+)/,  // /d/1rd5oiw7rVUNVS2dKSV8sy_jemSyBjMR3eTEIzngYo6o
            /id=([a-zA-Z0-9-_]+)/,     // ?id=1rd5oiw7rVUNVS2dKSV8sy_jemSyBjMR3eTEIzngYo6o
            /spreadsheets\/d\/([a-zA-Z0-9-_]+)/ // spreadsheets/d/1rd5oiw7rVUNVS2dKSV8sy_jemSyBjMR3eTEIzngYo6o
        ];

        for (let pattern of patterns) {
            const match = url.match(pattern);
            if (match) {
                return match[1];
            }
        }

        throw new Error('Не удалось извлечь ID таблицы из URL');
    }

    // Получить URL для экспорта в CSV
    getCSVUrl(sheetId, gid = 0) {
        return `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=${gid}`;
    }

    // Загрузить данные из Google Sheets через CSV
    async loadFromGoogleSheets(sheetId = null) {
        try {
            const id = sheetId || this.getSheetId();
            if (!id) {
                throw new Error('Не указан ID Google Sheets');
            }

            console.log('Загрузка данных из Google Sheets...', id);

            const csvUrl = this.getCSVUrl(id, this.gid);
            console.log('URL для загрузки:', csvUrl);

            // Загружаем CSV
            const response = await fetch(csvUrl);
            
            if (!response.ok) {
                throw new Error(`Ошибка загрузки: ${response.status} ${response.statusText}`);
            }

            const csvText = await response.text();
            
            // Парсим CSV
            const data = this.parseCSV(csvText);
            
            this.data = data;
            console.log('Загружено записей:', data.length);
            
            return data;
        } catch (error) {
            console.error('Ошибка загрузки из Google Sheets:', error);
            throw error;
        }
    }

    // Парсинг CSV
    parseCSV(csvText) {
        const lines = csvText.split('\n');
        if (lines.length === 0) return [];

        // Парсим заголовки (первая строка)
        const headers = this.parseCSVLine(lines[0]);
        
        const data = [];
        
        // Парсим данные (остальные строки)
        for (let i = 1; i < lines.length; i++) {
            if (!lines[i].trim()) continue;
            
            const values = this.parseCSVLine(lines[i]);
            const row = {};
            
            headers.forEach((header, index) => {
                let value = values[index] || '';
                // Убираем кавычки, если они есть
                if (value.startsWith('"') && value.endsWith('"')) {
                    value = value.slice(1, -1);
                }
                // Заменяем двойные кавычки на одинарные
                value = value.replace(/""/g, '"');
                row[header.trim()] = value;
            });
            
            data.push(row);
        }
        
        return data;
    }

    // Парсинг одной строки CSV (учитывает кавычки)
    parseCSVLine(line) {
        const result = [];
        let current = '';
        let inQuotes = false;
        
        for (let i = 0; i < line.length; i++) {
            const char = line[i];
            
            if (char === '"') {
                if (inQuotes && line[i + 1] === '"') {
                    // Двойные кавычки внутри кавычек
                    current += '"';
                    i++;
                } else {
                    // Переключение режима кавычек
                    inQuotes = !inQuotes;
                }
            } else if (char === ',' && !inQuotes) {
                // Конец поля
                result.push(current);
                current = '';
            } else {
                current += char;
            }
        }
        
        // Добавляем последнее поле
        result.push(current);
        
        return result;
    }

    // Сохранить данные из Google Sheets в IndexedDB
    async saveToLocalDB(data) {
        const sessionData = localStorage.getItem('currentSession');
        if (!sessionData) {
            alert('Необходимо войти в систему');
            return 0;
        }

        const session = JSON.parse(sessionData);
        
        return new Promise((resolve, reject) => {
            const request = indexedDB.open("MyDatabase", 3);
            
            request.onsuccess = (event) => {
                const db = event.target.result;
                const transaction = db.transaction(["items"], "readwrite");
                const store = transaction.objectStore("items");
                
                // Получаем все текущие записи пользователя
                const index = store.index("userId");
                index.getAll(session.userId).onsuccess = (e) => {
                    const oldItems = e.target.result;
                    let deleted = 0;
                    
                    if (oldItems.length === 0) {
                        // Добавляем новые данные
                        this.addNewItems(store, data, session.userId, resolve, reject);
                        return;
                    }
                    
                    // Удаляем старые записи
                    oldItems.forEach(item => {
                        store.delete(item.id).onsuccess = () => {
                            deleted++;
                            if (deleted === oldItems.length) {
                                // Все старые данные удалены, добавляем новые
                                this.addNewItems(store, data, session.userId, resolve, reject);
                            }
                        };
                    });
                };
            };
            
            request.onerror = () => reject(request.error);
        });
    }

    addNewItems(store, data, userId, resolve, reject) {
        if (data.length === 0) {
            resolve(0);
            return;
        }

        let added = 0;
        
        data.forEach((row, index) => {
            // Преобразуем данные в формат для таблицы
            const item = {
                name: row['Название'] || row['name'] || row['Name'] || `Запись ${index + 1}`,
                value: row['Значение'] || row['value'] || row['Value'] || '',
                category: row['Категория'] || row['category'] || row['Category'] || 'Другое',
                date: row['Дата'] || row['date'] || row['Date'] || new Date().toISOString().split('T')[0],
                completed: row['Статус'] === 'Да' || row['completed'] === 'true' || false,
                userId: userId,
                timestamp: Date.now(),
                fromGoogleSheets: true
            };
            
            store.add(item).onsuccess = () => {
                added++;
                if (added === data.length) {
                    console.log(`✅ Добавлено ${added} записей`);
                    resolve(added);
                }
            };
        });
    }

    // Синхронизация данных из Google Sheets
    async syncFromGoogleSheets() {
        try {
            const data = await this.loadFromGoogleSheets();
            const count = await this.saveToLocalDB(data);
            
            // Обновляем таблицу на странице
            if (window.sheets && typeof window.sheets.loadData === 'function') {
                await window.sheets.loadData();
            }
            
            alert(`✅ Синхронизация завершена! Загружено ${count} записей`);
            return data;
        } catch (error) {
            console.error('❌ Ошибка синхронизации:', error);
            throw error;
        }
    }

    // Проверить подключение
    async testConnection() {
        const input = document.getElementById('sheetUrlInput');
        if (!input) return;

        const url = input.value.trim();
        if (!url) {
            alert('Введите URL или ID таблицы');
            return;
        }

        const statusDiv = document.getElementById('connectionStatus');
        statusDiv.innerHTML = '⏳ Проверка подключения...';
        statusDiv.className = 'status-message loading';

        try {
            // Извлекаем ID из URL
            const sheetId = this.extractSheetId(url);
            this.setSheetId(sheetId);

            // Пробуем загрузить данные
            const data = await this.loadFromGoogleSheets(sheetId);

            statusDiv.innerHTML = `✅ Подключение успешно! Найдено строк: ${data.length}`;
            statusDiv.className = 'status-message success';

            // Показываем превью
            this.showPreview(data);
        } catch (error) {
            statusDiv.innerHTML = `❌ Ошибка: ${error.message}`;
            statusDiv.className = 'status-message error';
        }
    }

    // Импортировать данные
    async importData() {
        const statusDiv = document.getElementById('connectionStatus');
        statusDiv.innerHTML = '⏳ Импорт данных...';
        statusDiv.className = 'status-message loading';

        try {
            const count = await this.syncFromGoogleSheets();
            statusDiv.innerHTML = `✅ Импорт завершен! Загружено ${count} записей`;
            statusDiv.className = 'status-message success';
        } catch (error) {
            statusDiv.innerHTML = `❌ Ошибка: ${error.message}`;
            statusDiv.className = 'status-message error';
        }
    }

    // Показать превью данных
    showPreview(data) {
        const container = document.getElementById('googleSheetsPreview');
        if (!container) return;

        if (!data || data.length === 0) {
            container.innerHTML = '<p>📭 Нет данных для предпросмотра</p>';
            return;
        }

        const headers = Object.keys(data[0]);
        let html = `
            <div class="preview-container">
                <h4>📋 Предпросмотр данных (первые 5 строк)</h4>
                <div class="table-responsive">
                    <table class="preview-table">
                        <thead>
                            <tr>
                                ${headers.map(h => `<th>${h}</th>`).join('')}
                            </tr>
                        </thead>
                        <tbody>
        `;

        data.slice(0, 5).forEach(row => {
            html += '<tr>';
            headers.forEach(h => {
                html += `<td>${row[h] || '—'}</td>`;
            });
            html += '</tr>';
        });

        html += `
                        </tbody>
                    </table>
                </div>
                <p class="preview-note">Всего строк: ${data.length}</p>
            </div>
        `;

        container.innerHTML = html;
    }

    // Отобразить форму для ввода ID таблицы
    renderSheetInputForm() {
        const container = document.getElementById('googleSheetsInput');
        if (!container) return;

        const savedId = this.getSheetId();
        
        container.innerHTML = `
            <div class="google-sheets-input">
                <div class="input-header">
                    <span class="header-icon">📊</span>
                    <h3>Импорт из Google Sheets</h3>
                </div>
                <p class="input-description">
                    1. Сделайте таблицу публичной (доступ по ссылке)<br>
                    2. Вставьте ссылку или ID таблицы ниже
                </p>
                <input type="text" 
                       id="sheetUrlInput" 
                       placeholder="https://docs.google.com/spreadsheets/d/... или ID таблицы"
                       value="${savedId ? `https://docs.google.com/spreadsheets/d/${savedId}/edit` : ''}">
                <div class="button-group">
                    <button onclick="googleSheets.testConnection()" class="secondary-btn">
                        🔍 Проверить подключение
                    </button>
                    <button onclick="googleSheets.importData()" class="primary-btn">
                        📥 Импортировать данные
                    </button>
                </div>
                <div id="connectionStatus" class="status-message"></div>
            </div>
        `;
    }
}

// Глобальная переменная
let googleSheets;

// Инициализация
document.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('googleSheetsInput')) {
        googleSheets = new GoogleSheetsIntegration();
        googleSheets.renderSheetInputForm();
    }
})
