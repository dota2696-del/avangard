// google-sheets.js - Интеграция с Google Sheets

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

    // Загрузить данные из Google Sheets через Clipsheet
    async loadFromGoogleSheets(sheetUrl = null, query = '', columnMapping = {}) {
        try {
            // Если URL не указан, используем сохраненный ID
            if (!sheetUrl && this.getSheetId()) {
                sheetUrl = `https://docs.google.com/spreadsheets/d/${this.getSheetId()}/edit`;
            }

            if (!sheetUrl) {
                throw new Error('Не указан URL Google Sheets');
            }

            console.log('Загрузка данных из Google Sheets...', sheetUrl);

            // Используем Clipsheet для загрузки данных
            const data = await clipsheet(sheetUrl, query, columnMapping);
            
            this.data = data;
            console.log('Загружено записей:', data.length);
            
            return data;
        } catch (error) {
            console.error('Ошибка загрузки из Google Sheets:', error);
            throw error;
        }
    }

    // Сохранить данные из Google Sheets в IndexedDB
    async saveToLocalDB(data) {
        const sessionData = localStorage.getItem('currentSession');
        if (!sessionData) {
            alert('Необходимо войти в систему');
            return;
        }

        const session = JSON.parse(sessionData);
        
        return new Promise((resolve, reject) => {
            const request = indexedDB.open("MyDatabase", 3);
            
            request.onsuccess = (event) => {
                const db = event.target.result;
                const transaction = db.transaction(["items"], "readwrite");
                const store = transaction.objectStore("items");
                
                // Сначала очищаем старые данные пользователя
                const index = store.index("userId");
                index.getAll(session.userId).onsuccess = (e) => {
                    const oldItems = e.target.result;
                    let deleted = 0;
                    
                    if (oldItems.length === 0) {
                        // Добавляем новые данные
                        this.addNewItems(store, data, session.userId, resolve, reject);
                        return;
                    }
                    
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
        let added = 0;
        
        if (data.length === 0) {
            resolve(0);
            return;
        }
        
        data.forEach(row => {
            const item = {
                ...row,
                userId: userId,
                timestamp: Date.now(),
                fromGoogleSheets: true
            };
            
            store.add(item).onsuccess = () => {
                added++;
                if (added === data.length) {
                    console.log(`Добавлено ${added} записей`);
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
            
            if (window.sheets) {
                window.sheets.loadData();
            }
            
            alert(`Синхронизация завершена! Загружено ${count} записей`);
            return data;
        } catch (error) {
            console.error('Ошибка синхронизации:', error);
            alert('Ошибка синхронизации: ' + error.message);
        }
    }

    // Отобразить форму для ввода ID таблицы
    renderSheetInputForm() {
        const container = document.getElementById('googleSheetsInput');
        if (!container) return;

        const savedId = this.getSheetId();
        
        container.innerHTML = `
            <div class="google-sheets-input">
                <h3>📊 Импорт из Google Sheets</h3>
                <p>Вставьте ID вашей Google таблицы или полную ссылку</p>
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

            // Пробуем загрузить первые 5 строк
            const data = await this.loadFromGoogleSheets(
                `https://docs.google.com/spreadsheets/d/${sheetId}/edit`,
                'SELECT * LIMIT 5'
            );

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
            await this.syncFromGoogleSheets();
            statusDiv.innerHTML = '✅ Импорт завершен!';
            statusDiv.className = 'status-message success';
        } catch (error) {
            statusDiv.innerHTML = `❌ Ошибка: ${error.message}`;
            statusDiv.className = 'status-message error';
        }
    }

    // Извлечь ID из URL
    extractSheetId(url) {
        // Проверяем, не является ли входная строка уже ID
        if (url.match(/^[a-zA-Z0-9-_]{20,}$/)) {
            return url;
        }

        // Извлекаем из URL
        const match = url.match(/\/d\/([a-zA-Z0-9-_]+)/);
        if (match) {
            return match[1];
        }

        throw new Error('Не удалось извлечь ID таблицы из URL');
    }

    // Показать превью данных
    showPreview(data) {
        const container = document.getElementById('googleSheetsPreview');
        if (!container) return;

        if (!data || data.length === 0) {
            container.innerHTML = '<p>Нет данных для предпросмотра</p>';
            return;
        }

        const headers = Object.keys(data[0]);
        let html = `
            <div class="preview-container">
                <h4>Предпросмотр данных (первые 5 строк)</h4>
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
        `;

        container.innerHTML = html;
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
});
