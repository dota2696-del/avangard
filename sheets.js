console.log("sheets.js загружается...");

class SheetsTable {
    constructor() {
        this.data = [];
        this.columns = [
            { field: 'id', title: 'ID', type: 'number', readonly: true },
            { field: 'name', title: 'Название', type: 'text' },
            { field: 'value', title: 'Значение', type: 'text' },
            { field: 'category', title: 'Категория', type: 'select', 
              options: ['Работа', 'Личное', 'Учеба', 'Другое'] },
            { field: 'date', title: 'Дата', type: 'date' },
            { field: 'completed', title: 'Статус', type: 'checkbox' }
        ];
        this.editingRow = null;
        this.editValues = {};
        this.init();
    }

    init() {
        this.render();
        this.loadData();
    }

    async loadData() {
        const sessionData = localStorage.getItem('currentSession');
        if (!sessionData) return;

        const session = JSON.parse(sessionData);
        
        try {
            const db = await this.getDB();
            const transaction = db.transaction(["items"], "readonly");
            const store = transaction.objectStore("items");
            const index = store.index("userId");
            
            index.getAll(session.userId).onsuccess = (event) => {
                this.data = event.target.result.map(item => ({
                    ...item,
                    date: item.date ? new Date(item.date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
                    completed: item.completed || false
                }));
                this.renderTable();
                this.updateStats();
            };
        } catch (error) {
            console.error("Ошибка загрузки:", error);
        }
    }

    getDB() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open("MyDatabase", 3);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    render() {
        const container = document.getElementById('sheetsContainer');
        if (!container) return;

        container.innerHTML = `
            <div class="sheets-container">
                <div class="sheets-toolbar">
                    <button onclick="sheets.addRow()" class="primary">
                        ➕ Добавить строку
                    </button>
                    <button onclick="sheets.exportToCSV()">
                        📥 Экспорт в CSV
                    </button>
                    <button onclick="sheets.sortByName()">
                        🔤 Сортировать по имени
                    </button>
                    <button onclick="sheets.sortByDate()">
                        📅 Сортировать по дате
                    </button>
                    <button onclick="sheets.showStats()">
                        📊 Статистика
                    </button>
                </div>
                
                <div class="sheets-table-wrapper">
                    <table class="sheets-table" id="sheetsTable">
                        <thead>
                            <tr>
                                ${this.columns.map(col => 
                                    `<th>${col.title}</th>`
                                ).join('')}
                                <th>Действия</th>
                            </tr>
                        </thead>
                        <tbody id="sheetsTableBody">
                            <tr>
                                <td colspan="${this.columns.length + 1}" style="text-align: center; padding: 20px;">
                                    Загрузка данных...
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
                
                <div class="sheets-footer" id="sheetsFooter">
                    <span>Записей: <span id="recordCount">0</span></span>
                    <span>Последнее обновление: <span id="lastUpdate">-</span></span>
                </div>
            </div>

            <!-- Модальное окно для добавления/редактирования -->
            <div class="modal" id="sheetModal">
                <div class="modal-content">
                    <div class="modal-header">
                        <h3 id="modalTitle">Добавить запись</h3>
                        <button class="close-btn" onclick="sheets.closeModal()">×</button>
                    </div>
                    <div class="modal-body" id="modalBody">
                        <!-- Динамически заполняется -->
                    </div>
                    <div class="modal-footer">
                        <button onclick="sheets.closeModal()">Отмена</button>
                        <button onclick="sheets.saveRow()" class="primary">Сохранить</button>
                    </div>
                </div>
            </div>
        `;
    }

    renderTable() {
        const tbody = document.getElementById('sheetsTableBody');
        if (!tbody) return;

        if (this.data.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="${this.columns.length + 1}" style="text-align: center; padding: 20px;">
                        Нет данных. Нажмите "Добавить строку" для создания первой записи.
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = this.data.map(item => this.renderRow(item)).join('');
    }

    renderRow(item) {
        if (this.editingRow === item.id) {
            return this.renderEditRow(item);
        }

        return `
            <tr data-id="${item.id}">
                ${this.columns.map(col => {
                    let value = item[col.field];
                    
                    if (col.type === 'checkbox') {
                        value = value ? '✓' : '✗';
                    } else if (col.field === 'date' && value) {
                        value = new Date(value).toLocaleDateString('ru-RU');
                    }
                    
                    return `<td class="editable-cell" ondblclick="sheets.editCell(${item.id}, '${col.field}')">${value || '-'}</td>`;
                }).join('')}
                <td class="actions-cell">
                    <button class="edit-btn" onclick="sheets.editRow(${item.id})">✏️</button>
                    <button class="delete-btn" onclick="sheets.deleteRow(${item.id})">🗑️</button>
                </td>
            </tr>
        `;
    }

    renderEditRow(item) {
        return `
            <tr data-id="${item.id}" class="editing">
                ${this.columns.map(col => {
                    if (col.readonly) {
                        return `<td>${item[col.field]}</td>`;
                    }

                    let value = this.editValues[col.field] !== undefined ? 
                                this.editValues[col.field] : item[col.field];

                    if (col.type === 'select') {
                        return `
                            <td>
                                <select onchange="sheets.updateEditValue('${col.field}', this.value)">
                                    ${col.options.map(opt => 
                                        `<option value="${opt}" ${value === opt ? 'selected' : ''}>${opt}</option>`
                                    ).join('')}
                                </select>
                            </td>
                        `;
                    } else if (col.type === 'checkbox') {
                        return `
                            <td>
                                <input type="checkbox" 
                                       ${value ? 'checked' : ''} 
                                       onchange="sheets.updateEditValue('${col.field}', this.checked)">
                            </td>
                        `;
                    } else if (col.type === 'date') {
                        return `
                            <td>
                                <input type="date" 
                                       value="${value || ''}" 
                                       onchange="sheets.updateEditValue('${col.field}', this.value)">
                            </td>
                        `;
                    } else {
                        return `
                            <td>
                                <input type="${col.type || 'text'}" 
                                       value="${value || ''}" 
                                       onchange="sheets.updateEditValue('${col.field}', this.value)"
                                       placeholder="${col.title}">
                            </td>
                        `;
                    }
                }).join('')}
                <td class="actions-cell">
                    <button class="save-btn" onclick="sheets.saveEdit(${item.id})">💾</button>
                    <button class="cancel-btn" onclick="sheets.cancelEdit()">✖️</button>
                </td>
            </tr>
        `;
    }

    addRow() {
        this.editValues = {};
        this.editingRow = 'new';
        
        const modalBody = document.getElementById('modalBody');
        const modalTitle = document.getElementById('modalTitle');
        
        modalTitle.textContent = 'Добавить новую запись';
        modalBody.innerHTML = this.columns
            .filter(col => !col.readonly)
            .map(col => `
                <div class="form-group">
                    <label>${col.title}:</label>
                    ${this.renderFormField(col)}
                </div>
            `).join('');
        
        document.getElementById('sheetModal').classList.add('active');
    }

    renderFormField(col) {
        if (col.type === 'select') {
            return `
                <select id="modal_${col.field}">
                    ${col.options.map(opt => 
                        `<option value="${opt}">${opt}</option>`
                    ).join('')}
                </select>
            `;
        } else if (col.type === 'checkbox') {
            return `<input type="checkbox" id="modal_${col.field}">`;
        } else if (col.type === 'date') {
            return `<input type="date" id="modal_${col.field}" value="${new Date().toISOString().split('T')[0]}">`;
        } else {
            return `<input type="${col.type || 'text'}" id="modal_${col.field}" placeholder="${col.title}">`;
        }
    }

    saveRow() {
        const sessionData = localStorage.getItem('currentSession');
        if (!sessionData) {
            alert('Необходимо войти в систему');
            return;
        }

        const session = JSON.parse(sessionData);
        const newItem = { userId: session.userId, timestamp: Date.now() };

        this.columns
            .filter(col => !col.readonly)
            .forEach(col => {
                const element = document.getElementById(`modal_${col.field}`);
                if (element) {
                    if (col.type === 'checkbox') {
                        newItem[col.field] = element.checked;
                    } else {
                        newItem[col.field] = element.value;
                    }
                }
            });

        this.saveToDB(newItem);
        this.closeModal();
    }

    async saveToDB(item) {
        try {
            const db = await this.getDB();
            const transaction = db.transaction(["items"], "readwrite");
            const store = transaction.objectStore("items");
            
            store.add(item).onsuccess = () => {
                this.loadData();
            };
        } catch (error) {
            console.error("Ошибка сохранения:", error);
            alert("Ошибка при сохранении");
        }
    }

    editRow(id) {
        const item = this.data.find(d => d.id === id);
        if (!item) return;

        this.editingRow = id;
        this.editValues = { ...item };
        this.renderTable();
    }

    editCell(id, field) {
        const item = this.data.find(d => d.id === id);
        if (!item) return;

        const col = this.columns.find(c => c.field === field);
        if (col && col.readonly) return;

        this.editRow(id);
    }

    updateEditValue(field, value) {
        this.editValues[field] = value;
    }

    saveEdit(id) {
        const sessionData = localStorage.getItem('currentSession');
        if (!sessionData) return;

        this.getDB().then(db => {
            const transaction = db.transaction(["items"], "readwrite");
            const store = transaction.objectStore("items");
            
            store.get(id).onsuccess = (event) => {
                const item = event.target.result;
                Object.assign(item, this.editValues);
                
                store.put(item).onsuccess = () => {
                    this.editingRow = null;
                    this.editValues = {};
                    this.loadData();
                };
            };
        });
    }

    cancelEdit() {
        this.editingRow = null;
        this.editValues = {};
        this.renderTable();
    }

    deleteRow(id) {
        if (!confirm('Удалить эту запись?')) return;

        this.getDB().then(db => {
            const transaction = db.transaction(["items"], "readwrite");
            transaction.objectStore("items").delete(id).onsuccess = () => {
                this.loadData();
            };
        });
    }

    closeModal() {
        document.getElementById('sheetModal').classList.remove('active');
        this.editingRow = null;
        this.editValues = {};
    }

    exportToCSV() {
        if (this.data.length === 0) {
            alert('Нет данных для экспорта');
            return;
        }

        const headers = this.columns.map(col => col.title).join(',');
        const rows = this.data.map(item => 
            this.columns.map(col => `"${item[col.field] || ''}"`).join(',')
        ).join('\n');

        const csv = `${headers}\n${rows}`;
        const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `sheets_export_${new Date().toISOString().split('T')[0]}.csv`;
        link.click();
    }

    sortByName() {
        this.data.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
        this.renderTable();
    }

    sortByDate() {
        this.data.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
        this.renderTable();
    }

    showStats() {
        const total = this.data.length;
        const completed = this.data.filter(item => item.completed).length;
        const categories = {};
        
        this.data.forEach(item => {
            if (item.category) {
                categories[item.category] = (categories[item.category] || 0) + 1;
            }
        });

        const stats = [
            `Всего записей: ${total}`,
            `Выполнено: ${completed}`,
            `Осталось: ${total - completed}`,
            '\nПо категориям:',
            ...Object.entries(categories).map(([cat, count]) => `  ${cat}: ${count}`)
        ].join('\n');

        alert(stats);
    }

    updateStats() {
        const countEl = document.getElementById('recordCount');
        const updateEl = document.getElementById('lastUpdate');
        
        if (countEl) countEl.textContent = this.data.length;
        if (updateEl) updateEl.textContent = new Date().toLocaleTimeString('ru-RU');
    }
}

// Инициализация таблицы
let sheets;
document.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('sheetsContainer')) {
        sheets = new SheetsTable();
    }
});
