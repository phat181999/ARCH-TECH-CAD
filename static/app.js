let currentDeckId = null;
let reviewCards = [];
let reviewIndex = 0;

// Load decks on page load
document.addEventListener('DOMContentLoaded', loadDecks);

async function loadDecks() {
    const res = await fetch('/api/decks');
    const decks = await res.json();
    const list = document.getElementById('deck-list');
    list.innerHTML = '';
    if (decks.length === 0) {
        document.getElementById('empty-state').classList.remove('hidden');
        document.getElementById('deck-view').classList.add('hidden');
        document.getElementById('review-view').classList.add('hidden');
        return;
    }
    document.getElementById('empty-state').classList.add('hidden');
    decks.forEach(deck => {
        const li = document.createElement('li');
        li.dataset.id = deck.id;
        li.innerHTML = `${deck.name} <span class="deck-count">${deck.cards.length}</span>`;
        li.addEventListener('click', () => selectDeck(deck.id));
        list.appendChild(li);
    });
    // Select first deck if none selected
    if (!currentDeckId || !decks.find(d => d.id === currentDeckId)) {
        selectDeck(decks[0].id);
    } else {
        selectDeck(currentDeckId);
    }
}

async function selectDeck(deckId) {
    currentDeckId = deckId;
    // Highlight in sidebar
    document.querySelectorAll('.deck-list li').forEach(li => {
        li.classList.toggle('active', li.dataset.id === deckId);
    });
    // Load deck data
    const res = await fetch(`/api/decks/${deckId}`);
    const deck = await res.json();
    document.getElementById('deck-title').textContent = deck.name;
    const cardList = document.getElementById('card-list');
    cardList.innerHTML = '';
    if (deck.cards.length === 0) {
        cardList.innerHTML = '<p style="color:#999;text-align:center;padding:40px;">No cards yet. Add some!</p>';
    } else {
        deck.cards.forEach(card => {
            const div = document.createElement('div');
            div.className = 'card-item';
            div.innerHTML = `
                <div class="card-front-text">${escapeHtml(card.front)}</div>
                <div class="card-back-text">${escapeHtml(card.back)}</div>
                <button class="delete-card" onclick="deleteCard('${card.id}')" title="Delete card">&times;</button>
            `;
            cardList.appendChild(div);
        });
    }
    document.getElementById('deck-view').classList.remove('hidden');
    document.getElementById('review-view').classList.add('hidden');
}

function showCreateDeck() {
    document.getElementById('new-deck-name').value = '';
    document.getElementById('new-deck-desc').value = '';
    document.getElementById('create-deck-modal').classList.remove('hidden');
    setTimeout(() => document.getElementById('new-deck-name').focus(), 100);
}

async function createDeck() {
    const name = document.getElementById('new-deck-name').value.trim();
    if (!name) return;
    const desc = document.getElementById('new-deck-desc').value.trim();
    await fetch('/api/decks', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({name, description: desc})
    });
    closeModal('create-deck-modal');
    loadDecks();
}

function showAddCard() {
    document.getElementById('card-front-input').value = '';
    document.getElementById('card-back-input').value = '';
    document.getElementById('add-card-modal').classList.remove('hidden');
    setTimeout(() => document.getElementById('card-front-input').focus(), 100);
}

async function addCard() {
    const front = document.getElementById('card-front-input').value.trim();
    const back = document.getElementById('card-back-input').value.trim();
    if (!front || !back) return;
    await fetch(`/api/decks/${currentDeckId}/cards`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({front, back})
    });
    closeModal('add-card-modal');
    selectDeck(currentDeckId);
}

async function deleteCard(cardId) {
    if (!confirm('Delete this card?')) return;
    await fetch(`/api/decks/${currentDeckId}/cards/${cardId}`, {method: 'DELETE'});
    selectDeck(currentDeckId);
    loadDecks();
}

async function deleteCurrentDeck() {
    if (!confirm('Delete this entire deck?')) return;
    await fetch(`/api/decks/${currentDeckId}`, {method: 'DELETE'});
    currentDeckId = null;
    loadDecks();
}

function closeModal(id) {
    document.getElementById(id).classList.add('hidden');
}

// Review mode
async function startReview() {
    const res = await fetch(`/api/decks/${currentDeckId}`);
    const deck = await res.json();
    if (deck.cards.length === 0) {
        alert('This deck has no cards!');
        return;
    }
    reviewCards = [...deck.cards];
    reviewIndex = 0;
    document.getElementById('review-deck-name').textContent = deck.name;
    document.getElementById('deck-view').classList.add('hidden');
    document.getElementById('review-view').classList.remove('hidden');
    showReviewCard();
}

function showReviewCard() {
    if (reviewIndex >= reviewCards.length) {
        document.getElementById('card-front').textContent = '🎉 All done!';
        document.getElementById('card-back').textContent = 'Great job!';
        document.getElementById('review-buttons').classList.add('hidden');
        document.querySelector('.hint').textContent = 'Click to end review';
        document.querySelector('.card-review').onclick = endReview;
        return;
    }
    const card = reviewCards[reviewIndex];
    document.getElementById('card-front').textContent = card.front;
    document.getElementById('card-back').textContent = card.back;
    document.getElementById('review-count').textContent = `${reviewIndex + 1}/${reviewCards.length}`;
    document.querySelector('.card-review').classList.remove('flipped');
    document.getElementById('review-buttons').classList.add('hidden');
    document.querySelector('.hint').textContent = 'Click the card to flip it';
    document.querySelector('.card-review').onclick = flipCard;
}

function flipCard() {
    document.querySelector('.card-review').classList.add('flipped');
    document.getElementById('review-buttons').classList.remove('hidden');
    document.querySelector('.hint').textContent = 'How well did you know this?';
}

function rateCard(rating) {
    // rating: 1=hard, 2=good, 3=easy
    // For now, just move to next card
    reviewIndex++;
    showReviewCard();
}

function endReview() {
    document.getElementById('review-view').classList.add('hidden');
    document.getElementById('deck-view').classList.remove('hidden');
    document.querySelector('.card-review').onclick = flipCard;
    selectDeck(currentDeckId);
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}