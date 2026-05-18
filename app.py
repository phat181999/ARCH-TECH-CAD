import json
import os
from flask import Flask, render_template, request, jsonify

app = Flask(__name__)

DATA_FILE = os.path.join(os.path.dirname(__file__), 'data.json')


def load_data():
    if not os.path.exists(DATA_FILE):
        return {'decks': []}
    with open(DATA_FILE, 'r') as f:
        return json.load(f)


def save_data(data):
    with open(DATA_FILE, 'w') as f:
        json.dump(data, f, indent=2)


@app.route('/')
def index():
    return render_template('index.html')


@app.route('/api/decks', methods=['GET'])
def get_decks():
    data = load_data()
    return jsonify(data['decks'])


@app.route('/api/decks', methods=['POST'])
def create_deck():
    data = load_data()
    deck = request.json
    deck['id'] = str(len(data['decks']) + 1)
    deck['cards'] = []
    data['decks'].append(deck)
    save_data(data)
    return jsonify(deck), 201


@app.route('/api/decks/<deck_id>', methods=['GET'])
def get_deck(deck_id):
    data = load_data()
    for deck in data['decks']:
        if deck['id'] == deck_id:
            return jsonify(deck)
    return jsonify({'error': 'Deck not found'}), 404


@app.route('/api/decks/<deck_id>/cards', methods=['POST'])
def add_card(deck_id):
    data = load_data()
    for deck in data['decks']:
        if deck['id'] == deck_id:
            card = request.json
            card['id'] = str(len(deck['cards']) + 1)
            deck['cards'].append(card)
            save_data(data)
            return jsonify(card), 201
    return jsonify({'error': 'Deck not found'}), 404


@app.route('/api/decks/<deck_id>/cards/<card_id>', methods=['DELETE'])
def delete_card(deck_id, card_id):
    data = load_data()
    for deck in data['decks']:
        if deck['id'] == deck_id:
            deck['cards'] = [c for c in deck['cards'] if c['id'] != card_id]
            save_data(data)
            return jsonify({'ok': True})
    return jsonify({'error': 'Deck not found'}), 404


@app.route('/api/decks/<deck_id>', methods=['DELETE'])
def delete_deck(deck_id):
    data = load_data()
    data['decks'] = [d for d in data['decks'] if d['id'] != deck_id]
    save_data(data)
    return jsonify({'ok': True})


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=51530, debug=True)