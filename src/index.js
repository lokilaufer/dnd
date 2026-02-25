import './styles/main.css';

class TrelloClone {
  constructor() {
    this.state = this.loadState() || {
      todo: ['Покормить кота', 'Сделать DnD проект', 'Купить продукты'],
      'in-progress': ['Пишу код', 'Исправляю баги'],
      done: ['Выпить кофе', 'Посмотреть урок']
    };

    this.draggedCard = null;
    this.draggedCardData = null;
    this.placeholder = null;

    this.init();
  }

  loadState() {
    try {
      const saved = localStorage.getItem('trello-state');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  }

  saveState() {
    localStorage.setItem('trello-state', JSON.stringify(this.state));
  }

  init() {
    this.renderBoard();
    this.setupEventListeners();
  }

  renderBoard() {
    for (const [columnId, cards] of Object.entries(this.state)) {
      const container = document.querySelector(`[data-column="${columnId}"] .cards-container`);
      if (!container) continue;

      container.innerHTML = '';

      cards.forEach((cardText) => {
        const card = this.createCardElement(cardText, columnId);
        container.appendChild(card);
      });
    }
  }

  createCardElement(text, columnId) {
    const card = document.createElement('div');
    card.className = 'card';
    card.setAttribute('draggable', 'true');
    card.setAttribute('data-column', columnId);
    card.setAttribute('data-text', text);

    const textSpan = document.createElement('span');
    textSpan.className = 'card-text';
    textSpan.textContent = text; // ЗДЕСЬ ВСТАВЛЯЕТСЯ ТЕКСТ КАРТОЧКИ

    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'delete-btn';
    deleteBtn.title = 'Удалить карточку';
    deleteBtn.innerHTML = '×';

    card.appendChild(textSpan);
    card.appendChild(deleteBtn);

    // Добавляем обработчики  на карточку
    card.addEventListener('dragstart', this.handleDragStart.bind(this));
    card.addEventListener('dragend', this.handleDragEnd.bind(this));

    return card;
  }

  setupEventListeners() {
    // Кнопки добавления
    document.querySelectorAll('.add-card-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const column = e.target.closest('.column');
        const columnId = column.dataset.column;
        this.addCard(columnId);
      });
    });

    // Удаление карточек
    document.addEventListener('click', (e) => {
      if (e.target.classList.contains('delete-btn')) {
        const card = e.target.closest('.card');
        this.deleteCard(card);
      }
    });

    // Глобальные обработчики для drag and drop
    document.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      this.handleDragOver(e);
    });

    document.addEventListener('drop', (e) => {
      e.preventDefault();
      this.handleDrop(e);
    });

    // Для Firefox
    document.addEventListener('dragenter', (e) => {
      e.preventDefault();
    });

    document.addEventListener('dragleave', (e) => {
      e.preventDefault();
    });
  }

  handleDragStart(e) {
    const card = e.target.closest('.card');
    if (!card) return;

    // Сохраняем данные карточки
    this.draggedCard = card;
    this.draggedCardData = {
      text: card.dataset.text,
      sourceColumn: card.dataset.column,
      element: card
    };

    card.classList.add('dragging');

    // Устанавливаем данные для перетаскивания
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', JSON.stringify({
      text: card.dataset.text,
      sourceColumn: card.dataset.column
    }));

    // Убираем стандартное изображение
    e.dataTransfer.setDragImage(new Image(), 0, 0);

    // Для Firefox
    if (navigator.userAgent.includes('Firefox')) {
      e.dataTransfer.setData('text/plain', card.dataset.text);
    }
  }

  handleDragEnd(e) {
    const card = e.target.closest('.card');
    if (card) {
      card.classList.remove('dragging');
    }

    // Очищаем все данные
    this.draggedCard = null;
    this.draggedCardData = null;
    this.removePlaceholder();
  }

  handleDragOver(e) {
    if (!this.draggedCardData) return;

    const target = e.target.closest('.card, .cards-container');
    if (!target) return;

    const container = target.classList.contains('cards-container')
      ? target
      : target.parentNode;

    if (!container.classList.contains('cards-container')) return;

    const mouseY = e.clientY;
    const cards = [...container.querySelectorAll('.card:not(.dragging)')];

    this.removePlaceholder();

    this.placeholder = document.createElement('div');
    this.placeholder.className = 'placeholder';

    if (cards.length === 0) {
      container.appendChild(this.placeholder);
    } else {
      let inserted = false;
      for (let i = 0; i < cards.length; i++) {
        const rect = cards[i].getBoundingClientRect();
        const cardCenter = rect.top + rect.height / 2;

        if (mouseY < cardCenter) {
          container.insertBefore(this.placeholder, cards[i]);
          inserted = true;
          break;
        }
      }
      if (!inserted) {
        container.appendChild(this.placeholder);
      }
    }
  }

  handleDrop(e) {
    e.preventDefault();

    if (!this.draggedCardData) return;

    const target = e.target.closest('.card, .cards-container');
    if (!target) return;

    const container = target.classList.contains('cards-container')
      ? target
      : target.parentNode;

    if (!container.classList.contains('cards-container')) return;

    const targetColumnId = container.closest('.column').dataset.column;

    // Определяем позицию вставки
    const mouseY = e.clientY;
    const cards = [...container.querySelectorAll('.card')];
    let targetIndex = cards.length;

    for (let i = 0; i < cards.length; i++) {
      const rect = cards[i].getBoundingClientRect();
      const cardCenter = rect.top + rect.height / 2;

      if (mouseY < cardCenter) {
        targetIndex = i;
        break;
      }
    }

    const { text, sourceColumn } = this.draggedCardData;


    if (sourceColumn === targetColumnId) {
      const currentIndex = this.state[sourceColumn].findIndex(t => t === text);
      if (currentIndex === targetIndex) {
        this.cleanup();
        return;
      }
    }

    // СОЗДАЕМ КОПИЮ МАССИВА для безопасного изменения
    const newState = { ...this.state };

    // Удаляем из исходной колонки
    newState[sourceColumn] = newState[sourceColumn].filter(t => t !== text);

    // Вставляем в целевую колонку
    newState[targetColumnId] = [
      ...newState[targetColumnId].slice(0, targetIndex),
      text,
      ...newState[targetColumnId].slice(targetIndex)
    ];

    // Обновляем состояние
    this.state = newState;

    // Сохраняем
    this.saveState();

    // Очищаем и перерисовываем
    this.cleanup();
    this.renderBoard();
  }

  removePlaceholder() {
    if (this.placeholder && this.placeholder.parentNode) {
      this.placeholder.parentNode.removeChild(this.placeholder);
      this.placeholder = null;
    }
  }

  cleanup() {
    this.removePlaceholder();
    this.draggedCard = null;
    this.draggedCardData = null;
  }

  addCard(columnId) {
    const text = prompt('Введите название карточки:');
    if (!text || !text.trim()) return;

    this.state[columnId].push(text.trim());
    this.saveState();
    this.renderBoard();
  }

  deleteCard(cardElement) {
    const columnId = cardElement.dataset.column;
    const cardText = cardElement.dataset.text;

    this.state[columnId] = this.state[columnId].filter(text => text !== cardText);
    this.saveState();
    this.renderBoard();
  }
}

document.addEventListener('DOMContentLoaded', () => {
  new TrelloClone();
});