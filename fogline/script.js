// Import nanoid
import { nanoid, customAlphabet } from 'https://cdn.jsdelivr.net/npm/nanoid@4.0.2/+esm'

// Define custom nanoid generator
const alphabet = "123456789bcdfghjkmnpqrstvwxyz";
const generatePeerId = customAlphabet(alphabet, 12); // Use this function to generate IDs

// --- PeerJS Setup ---
let peer = null;
let conn = null;
let myPeerId = null;
let localPlayerRole = null; // 1 (Host/Initiator) or 2 (Guest/Receiver)
let peerInitializationAttempted = false; // Flag to prevent error loops
let localDisplayName = "Player"; // Default display name
let opponentDisplayName = null; // Store opponent's name

function initializePeer(forceNewId = false) {
    // Prevent re-entry if already initializing, unless forcing new ID after error
    if (peerInitializationAttempted && !forceNewId) {
        console.log("Peer initialization already attempted, skipping.");
        return;
    }
    if (peer && !peer.destroyed && !forceNewId) {
        console.log("Peer object already exists and is not destroyed. Skipping initialization.");
        // Still update the display in case it wasn't set correctly
        if (myPeerId) document.getElementById('my-peer-id').textContent = myPeerId;
        return;
    }
    peerInitializationAttempted = true; // Mark that we've started initialization

    let peerIdToUse = null;
    const storedPeerId = localStorage.getItem('myPeerId');
    let isUsingStoredId = false; // Flag to track if we attempted connection with stored ID

    if (storedPeerId && !forceNewId) {
        console.log('Attempting to reuse stored Peer ID:', storedPeerId);
        peerIdToUse = storedPeerId;
        isUsingStoredId = true;
    } else {
        if (forceNewId) {
            console.log('Forcing new Peer ID generation due to previous error or request.');
        } else {
            console.log('No stored Peer ID found or new one requested, generating new nanoid.');
        }
        peerIdToUse = generatePeerId(); // Generate new ID using the custom nanoid generator
        console.log('Generated new Peer ID:', peerIdToUse);
    }

    // Destroy existing peer object if forcing a new ID
    if (forceNewId && peer && !peer.destroyed) {
        console.log("Destroying previous peer object before creating new one.");
        peer.destroy();
        peer = null;
    }

    console.log(`Initializing Peer with ID: ${peerIdToUse}`);
    // Instantiate Peer with the specific ID (generated or stored)
    peer = new Peer(peerIdToUse);
    // Pass the isUsingStoredId flag to the error handler via a temporary property
    peer._isAttemptingStoredId = isUsingStoredId; // Store flag on peer instance

    peer.on('open', id => {
        console.log('PeerJS connection open. My PeerJS ID is:', id);
        myPeerId = id; // Store the confirmed ID locally
        document.getElementById('my-peer-id').textContent = id;
        peerInitializationAttempted = false; // Reset flag on successful open

        // Store the confirmed Peer ID (could be the stored one or a new one)
        try {
            localStorage.setItem('myPeerId', id);
            console.log('Stored/Confirmed my Peer ID:', id);
        } catch (e) {
            console.error('Failed to store Peer ID in localStorage:', e);
        }

        // Check for last connected peer and attempt auto-reconnect
        const lastConnectedPeerId = localStorage.getItem('lastConnectedPeerId');
        if (lastConnectedPeerId && lastConnectedPeerId !== myPeerId) {
            console.log('Found last connected peer:', lastConnectedPeerId);
            attemptAutoReconnect(lastConnectedPeerId);
        } else {
            document.getElementById('peer-status').textContent = 'Waiting for connection...';
            // Ensure connect button is enabled if not auto-connecting
            document.getElementById('connect-button').disabled = false;
            document.getElementById('peer-id-input').disabled = false;
            document.getElementById('disconnect-button').disabled = true;
        }
    });

    peer.on('connection', incomingConn => {
        console.log('Incoming connection from:', incomingConn.peer);
        if (conn && conn.open) {
            console.log('Already connected, rejecting new connection.');
            incomingConn.close();
            return;
        }
        conn = incomingConn;
        localPlayerRole = 2; // The receiver is Player 2
        setupConnectionEvents();
    });

    peer.on('disconnected', () => {
        console.log('PeerJS disconnected.');
        logMessage('Disconnected from PeerJS server. Please refresh.');
        document.getElementById('peer-status').textContent = 'Disconnected';
        // Attempt to reconnect? Might be complex. Refresh is simpler for now.
        // peer.reconnect();
    });

    peer.on('close', () => {
        console.log('PeerJS connection closed.');
        logMessage('PeerJS connection closed. Please refresh.');
        conn = null;
        document.getElementById('peer-status').textContent = 'Closed';
    });

    peer.on('error', err => {
        console.error('PeerJS error:', err);
        logMessage(`PeerJS Error: ${err.type}`);
        document.getElementById('peer-status').textContent = `Error: ${err.type}`;
        peerInitializationAttempted = false; // Reset flag on error

        // Specific handling for ID taken
        if (err.type === 'unavailable-id') {
            const attemptedId = peer.id; // Get the ID that failed
            const wasUsingStored = peer._isAttemptingStoredId; // Check the flag we set

            if (wasUsingStored) {
                // Prompt the user only if the stored ID failed
                const proceed = window.confirm(
                    `Your stored Peer ID "${attemptedId}" is already in use (possibly another tab).\n\n` +
                    `Do you want to discard this ID and generate a new one for this session?\n\n` +
                    `Cancel: Keep the stored ID and abort connection.\n` +
                    `OK: Discard stored ID and get a new one.`
                );

                if (proceed) {
                    logMessage(`Stored Peer ID "${attemptedId}" is unavailable. Generating a new one as requested...`);
                    console.warn('Stored Peer ID was taken, user chose to generate a new one:', attemptedId);
                    // Clear the invalid stored ID
                    try {
                        localStorage.removeItem('myPeerId');
                    } catch (e) {
                        console.error('Failed to remove Peer ID from localStorage:', e);
                    }
                    // Destroy the failed peer object before recreating
                    if (peer && !peer.destroyed) {
                        peer.destroy();
                    }
                    peer = null; // Ensure old peer object is cleared
                    // Re-initialize, forcing a new ID request
                    setTimeout(() => initializePeer(true), 100); // Small delay before retry
                } else {
                    // User cancelled
                    logMessage(`Connection aborted. The stored Peer ID "${attemptedId}" is still in use elsewhere.`);
                    console.log('User cancelled connection due to unavailable stored ID.');
                    document.getElementById('peer-status').textContent = 'ID in use';
                    document.getElementById('my-peer-id').textContent = attemptedId + " (In Use)";
                    // Reset UI to allow manual actions
                    document.getElementById('connect-button').disabled = false;
                    document.getElementById('peer-id-input').disabled = false;
                    document.getElementById('disconnect-button').disabled = true;
                    peerInitializationAttempted = false; // Allow trying again later if user resolves conflict
                }
            } else {
                // This case is extremely unlikely with nanoid, but handle it defensively.
                logMessage(`The newly generated Peer ID "${attemptedId}" is unavailable. This is unexpected. Please refresh.`);
                console.error('Newly generated nanoid was unavailable:', attemptedId);
                document.getElementById('peer-status').textContent = 'Error: ID conflict';
                // Reset UI
                document.getElementById('connect-button').disabled = false;
                document.getElementById('peer-id-input').disabled = false;
                document.getElementById('disconnect-button').disabled = true;
            }
        } else if (err.type === 'network') {
            logMessage('Network error connecting to PeerJS server. Check connection.');
            // Optionally implement retry logic here
        } else if (err.type === 'server-error') {
            logMessage('PeerJS server error. Please try again later.');
        }
        // Reset button states on general error
        document.getElementById('connect-button').disabled = false;
        document.getElementById('peer-id-input').disabled = false;
        document.getElementById('disconnect-button').disabled = true;
    });
}

// --- Auto Reconnect Function ---
function attemptAutoReconnect(peerId) {
    if (!peer || peer.destroyed) {
        console.log('Peer object not ready for auto-reconnect.');
        // Ensure UI reflects waiting state if peer isn't ready
        document.getElementById('peer-status').textContent = 'Waiting for connection...';
        document.getElementById('connect-button').disabled = false;
        document.getElementById('peer-id-input').disabled = false;
        document.getElementById('disconnect-button').disabled = true;
        return;
    }
    if (peerId === myPeerId) {
        console.log('Last connected peer ID is own ID, skipping auto-reconnect.');
        document.getElementById('peer-status').textContent = 'Waiting for connection...';
        document.getElementById('connect-button').disabled = false;
        document.getElementById('peer-id-input').disabled = false;
        document.getElementById('disconnect-button').disabled = true;
        return;
    }

    console.log('Attempting auto-reconnect to:', peerId);
    logMessage(`Attempting auto-reconnect to ${peerId}...`);
    document.getElementById('peer-status').textContent = `Auto-connecting to ${peerId}...`;
    document.getElementById('peer-id-input').value = peerId; // Pre-fill input for user context
    document.getElementById('peer-id-input').disabled = true;
    document.getElementById('connect-button').disabled = true;
    document.getElementById('disconnect-button').disabled = true; // Can't disconnect during attempt

    conn = peer.connect(peerId, { reliable: true });
    localPlayerRole = 1; // Assume initiator role for auto-connect
    setupConnectionEvents(); // Will handle 'open', 'close', 'error'
}


function connectToPeer() {
    if (conn && conn.open) {
        console.log('Already connected.');
        return;
    }
    const peerIdInput = document.getElementById('peer-id-input').value.trim();
    if (!peerIdInput) {
        logMessage('Please enter a Peer ID to connect to.');
        return;
    }
    if (peerIdInput === myPeerId) {
        logMessage('Cannot connect to yourself.');
        return;
    }

    console.log('Attempting to connect to:', peerIdInput);
    document.getElementById('peer-status').textContent = `Connecting to ${peerIdInput}...`;
    document.getElementById('connect-button').disabled = true; // Disable while attempting
    document.getElementById('peer-id-input').disabled = true;
    conn = peer.connect(peerIdInput, { reliable: true });
    localPlayerRole = 1; // The initiator is Player 1
    setupConnectionEvents(); // setupConnectionEvents will handle storing the ID on 'open'
}

function setupConnectionEvents() {
    if (!conn) return;

    conn.on('open', () => {
        console.log('Connection established with:', conn.peer);
        // Send display name immediately
        sendData('displayName', { name: localDisplayName });

        // Update status (will be updated again if opponent name received)
        document.getElementById('peer-status').textContent = `Connected to ${opponentDisplayName || conn.peer}`;
        document.getElementById('peer-id-input').disabled = true;
        document.getElementById('connect-button').disabled = true;
        document.getElementById('disconnect-button').disabled = false; // Enable disconnect
        logMessage(`Connected to ${opponentDisplayName || conn.peer}! You are Player ${localPlayerRole}.`);

        // Store the successfully connected peer's ID
        try {
            localStorage.setItem('lastConnectedPeerId', conn.peer);
            console.log('Stored last connected peer ID:', conn.peer);
        } catch (e) {
            console.error('Failed to store last connected peer ID in localStorage:', e);
        }

        // Player 1 (Host) initiates the game setup
        if (localPlayerRole === 1) {
            resetGame(); // Host generates setup and sends it
        } else {
            logMessage("Waiting for Player 1 to start the game...");
        }
        document.getElementById('memo-toggle-button').disabled = false; // Enable memo pad after connection
    });

    conn.on('data', data => {
        console.log('Received data:', data);
        handleReceivedData(data);
    });

    conn.on('close', () => {
        console.log('Connection closed with:', conn.peer);
        logMessage('Opponent disconnected.');
        document.getElementById('peer-status').textContent = 'Disconnected';
        document.getElementById('peer-id-input').disabled = false;
        document.getElementById('connect-button').disabled = false;
        document.getElementById('peer-id-input').disabled = false; // Re-enable input
        document.getElementById('disconnect-button').disabled = true; // Disable disconnect
        document.getElementById('memo-toggle-button').disabled = true;
        conn = null;
        opponentDisplayName = null; // Reset opponent name
        // Keep lastConnectedPeerId in localStorage for potential manual reconnect
        // Optionally reset the game board or show a message
        gameState = 'DISCONNECTED';
        updateUI(); // updateUI will handle setting the correct state
    });

    conn.on('error', err => {
        console.error('Connection error:', err);
        logMessage(`Connection Error: ${err.type}`);
        document.getElementById('peer-status').textContent = `Connection Error: ${err.type}`;
        // Ensure buttons are reset on error
        document.getElementById('peer-id-input').disabled = false;
        document.getElementById('connect-button').disabled = false;
        document.getElementById('disconnect-button').disabled = true;
        document.getElementById('memo-toggle-button').disabled = true;
        conn = null; // Assume connection is lost/failed
        opponentDisplayName = null; // Reset opponent name
        gameState = 'DISCONNECTED'; // Set state to disconnected on error
        updateUI(); // Update UI to reflect disconnected state
    });
}

function sendData(type, payload) {
    if (conn && conn.open) {
        const message = { type, payload };
        console.log('Sending data:', message);
        conn.send(message);
    } else {
        console.error('Cannot send data: No open connection.');
        logMessage('Error: Not connected to opponent.');
    }
}

// --- Auto Reconnect Function ---
// Defined earlier, after initializePeer

function disconnectPeer() {
    if (conn && conn.open) {
        console.log('Manually disconnecting from peer:', conn.peer);
        logMessage('Disconnecting...');
        conn.close(); // This will trigger the 'close' event handled in setupConnectionEvents
    } else {
        console.log('No active connection to disconnect.');
        logMessage('Not connected.');
        // Ensure UI is in disconnected state if somehow disconnect was clicked while not connected
        document.getElementById('connect-button').disabled = false;
        document.getElementById('peer-id-input').disabled = false;
        document.getElementById('disconnect-button').disabled = true;
    }
}

// --- Peer ID Utility Functions ---
function copyPeerIdToClipboard() {
    const peerIdElement = document.getElementById('my-peer-id');
    const peerId = peerIdElement.textContent;
    if (peerId && peerId !== 'Waiting...') {
        navigator.clipboard.writeText(peerId).then(() => {
            logMessage(`Peer ID "${peerId}" copied to clipboard.`);
            // Optional: Provide visual feedback, e.g., change button text briefly
            const copyButton = document.getElementById('copy-peer-id-button');
            if (copyButton) {
                const originalText = copyButton.textContent;
                copyButton.textContent = 'Copied!';
                setTimeout(() => { copyButton.textContent = originalText; }, 1500);
            }
        }).catch(err => {
            console.error('Failed to copy Peer ID: ', err);
            logMessage('Failed to copy Peer ID.');
        });
    } else {
        logMessage('Cannot copy Peer ID yet.');
    }
}

// Add this function back (Only one definition needed)
function selectPeerIdText() {
    const peerIdElement = document.getElementById('my-peer-id');
    const peerId = peerIdElement.textContent;
    if (peerId && peerId !== 'Waiting...') {
        const range = document.createRange();
        range.selectNodeContents(peerIdElement);
        const selection = window.getSelection();
        selection.removeAllRanges(); // Clear previous selection
        selection.addRange(range);
        logMessage('Peer ID selected.'); // Optional feedback
    } else {
        logMessage('Peer ID not available to select.');
    }
}
// Make functions globally accessible if called directly from HTML onclick (Only one block needed)
window.connectToPeer = connectToPeer;
window.disconnectPeer = disconnectPeer;
window.resetGame = resetGame;
window.toggleMemoPad = toggleMemoPad;
window.copyPeerIdToClipboard = copyPeerIdToClipboard;
window.selectPeerIdText = selectPeerIdText; // Expose this function too

// --- Display Name Function ---
function saveDisplayName() {
    const nameInput = document.getElementById('display-name-input');
    const newName = nameInput.value.trim();
    if (newName) {
        localDisplayName = newName;
        try {
            localStorage.setItem('foglineDisplayName', newName);
            logMessage(`Display name saved as "${newName}".`);
        } catch (e) {
            console.error('Failed to save display name to localStorage:', e);
            logMessage('Failed to save display name.');
        }
        // If already connected, send the updated name
        if (conn && conn.open) {
            sendData('displayName', { name: localDisplayName });
        }
    } else {
        logMessage('Display name cannot be empty.');
        nameInput.value = localDisplayName; // Reset to current name if empty
    }
}
window.saveDisplayName = saveDisplayName; // Expose function


// --- Game Constants and Variables ---
// Stores card objects { id, unitData: {unitName, instance, stats, imagePath}, terrainData: {terrainIndex, terrainData, imagePath}, hidden, owner, gridX, gridY, element, hasImageError }
let board = [];
let currentPlayer = 1;
// playerUnits not used
let placedPositions = new Set(); // Store "x_y" strings
let selectedCardIndex = null; // Index in the board array for gameplay phase
let defeatedUnits = []; // Stores { unitData, terrainData, owner } of defeated units
let nextCardId = 0; // Unique ID for each card
let initialPlayerPairings = { 1: [], 2: [] }; // Stores { unitData, terrainData } for memo pad
let isResolvingAttack = false; // Flag to prevent clicks during attack resolution

// --- Game State & Placement Variables ---
let gameState = 'CONNECTING'; // 'CONNECTING', 'PLACEMENT', 'GAMEPLAY', 'GAMEOVER', 'DISCONNECTED'
// Stores arrays of unitData objects { unitName, instance, stats, imagePath }
let playerAvailableUnits = { 1: [], 2: [] };
// Stores arrays of terrainData objects { terrainIndex, terrainData, imagePath }
let playerAvailableTerrains = { 1: [], 2: [] };
let selectedUnitDataForPlacement = null; // Stores the selected unitData object
let selectedTerrainDataForPlacement = null; // Stores the selected terrainData object
let placedCardPairCount = 0;
const TOTAL_CARD_PAIRS_TO_PLACE = 16; // 8 units per player

const START_GRID_COORD = 10; // Start placing cards around grid cell 10,10
const CARD_IMAGE_DIR = 'cards'; // Relative path to card images

// Terrain Types & Emojis (Emojis used for fallback and memo)
const TERRAIN_TYPES = {
    PLAINS: 'Plains',
    FOREST: 'Forest',
    MOUNTAIN: 'Mountain'
};
const TERRAIN_EMOJIS = {
    [TERRAIN_TYPES.PLAINS]: '🏞️',
    [TERRAIN_TYPES.FOREST]: '🌲',
    [TERRAIN_TYPES.MOUNTAIN]: '⛰️'
};

// Unit Stats (Movement based on terrain *type*)
const unitStats = {
    'Mobile Command': { attack: 1, defense: 2, quantity: 1, canTraverse: [TERRAIN_TYPES.PLAINS], safeName: 'mobile_command' },
    'Tank': { attack: 4, defense: 4, quantity: 2, canTraverse: [TERRAIN_TYPES.PLAINS], safeName: 'tank' },
    'Infantry': { attack: 3, defense: 3, quantity: 3, canTraverse: [TERRAIN_TYPES.PLAINS, TERRAIN_TYPES.FOREST, TERRAIN_TYPES.MOUNTAIN], safeName: 'infantry' },
    'Artillery': { attack: 5, defense: 1, quantity: 1, canTraverse: [TERRAIN_TYPES.PLAINS], safeName: 'artillery' },
    'Special Ops': { attack: 3, defense: 1, quantity: 1, canTraverse: [TERRAIN_TYPES.PLAINS, TERRAIN_TYPES.FOREST, TERRAIN_TYPES.MOUNTAIN], safeName: 'special_ops' }
};

// Terrain Rules (Defense bonus based on type)
const terrainRules = {
    [TERRAIN_TYPES.PLAINS]: { defenseBonus: 0 },
    [TERRAIN_TYPES.FOREST]: { defenseBonus: 1 },
    [TERRAIN_TYPES.MOUNTAIN]: { defenseBonus: 0 }
};

// The 8 Fixed Terrain Cards (Top, Right, Bottom, Left)
// IMPORTANT: Keep this consistent across both clients
const fixedTerrainCards = [
    { top: TERRAIN_TYPES.PLAINS, right: TERRAIN_TYPES.FOREST, bottom: TERRAIN_TYPES.PLAINS, left: TERRAIN_TYPES.FOREST },
    { top: TERRAIN_TYPES.PLAINS, right: TERRAIN_TYPES.MOUNTAIN, bottom: TERRAIN_TYPES.PLAINS, left: TERRAIN_TYPES.MOUNTAIN },
    { top: TERRAIN_TYPES.FOREST, right: TERRAIN_TYPES.PLAINS, bottom: TERRAIN_TYPES.FOREST, left: TERRAIN_TYPES.PLAINS },
    { top: TERRAIN_TYPES.MOUNTAIN, right: TERRAIN_TYPES.PLAINS, bottom: TERRAIN_TYPES.MOUNTAIN, left: TERRAIN_TYPES.PLAINS },
    { top: TERRAIN_TYPES.FOREST, right: TERRAIN_TYPES.FOREST, bottom: TERRAIN_TYPES.PLAINS, left: TERRAIN_TYPES.MOUNTAIN },
    { top: TERRAIN_TYPES.MOUNTAIN, right: TERRAIN_TYPES.MOUNTAIN, bottom: TERRAIN_TYPES.PLAINS, left: TERRAIN_TYPES.FOREST },
    { top: TERRAIN_TYPES.FOREST, right: TERRAIN_TYPES.MOUNTAIN, bottom: TERRAIN_TYPES.FOREST, left: TERRAIN_TYPES.PLAINS },
    { top: TERRAIN_TYPES.MOUNTAIN, right: TERRAIN_TYPES.FOREST, bottom: TERRAIN_TYPES.MOUNTAIN, left: TERRAIN_TYPES.PLAINS }
];

function getUnitList() {
    const units = [];
    for (const type in unitStats) {
        for (let i = 0; i < unitStats[type].quantity; i++) {
            units.push(type);
        }
    }
    return units; // Should be 8 units total
}

// Fisher-Yates Shuffle
function shuffle(array) {
    let newArray = [...array]; // Create a copy to avoid modifying the original
    for (let i = newArray.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
    }
    return newArray;
}

// --- Image Path and Fallback Helpers ---

function getUnitImagePath(owner, unitName, instance) {
    const stats = unitStats[unitName];
    if (!stats || !stats.safeName) return 'path/to/default/unit_error.webp'; // Error image path (optional update)
    return `${CARD_IMAGE_DIR}/unit_player${owner}_${stats.safeName}_${instance}.webp`; // Use .webp
}

function getTerrainImagePath(owner, terrainData) {
    if (!terrainData) return 'path/to/default/terrain_error.webp'; // Error image path (optional update)
    const t = terrainData;
    const format = (type) => type ? type.toLowerCase() : 'unknown';
    return `${CARD_IMAGE_DIR}/terrain_player${owner}_${format(t.left)}_${format(t.top)}_${format(t.right)}_${format(t.bottom)}.webp`; // Use .webp
}

// Renders the original HTML structure inside a card div if the image fails
function renderHtmlCardFallback(cardDiv, cardData) {
    console.warn(`Image failed to load for card ID ${cardData.id}. Rendering HTML fallback.`);
    cardDiv.innerHTML = ''; // Clear potential broken img
    cardDiv.classList.add('has-image-error'); // Mark that error occurred

    const fallbackContent = document.createElement('div');
    fallbackContent.className = 'fallback-content';

    const unitName = cardData.unitData?.unitName || '?';
    const stats = cardData.unitData?.stats || { attack: '?', defense: '?' };
    const terrainData = cardData.terrainData?.terrainData || { top: '?', right: '?', bottom: '?', left: '?' };

    fallbackContent.innerHTML = `
        <div class="terrain-edges">
            <span class="terrain-edge edge-top">${TERRAIN_EMOJIS[terrainData.top] || '?'}</span>
            <span class="terrain-edge edge-right">${TERRAIN_EMOJIS[terrainData.right] || '?'}</span>
            <span class="terrain-edge edge-bottom">${TERRAIN_EMOJIS[terrainData.bottom] || '?'}</span>
            <span class="terrain-edge edge-left">${TERRAIN_EMOJIS[terrainData.left] || '?'}</span>
        </div>
        <div class="unit-name">${unitName}</div>
        <div class="stats">
            <span class="attack">A: ${stats.attack}</span>
            <span class="defense">D: ${stats.defense}</span>
        </div>
    `;
    cardDiv.appendChild(fallbackContent);

    // Re-apply hidden styles if necessary
    if (cardData.hidden) {
        cardDiv.classList.add('hidden'); // Ensure hidden class is on parent
    }
}

// Renders fallback for placement cards
function renderPlacementCardFallback(cardDiv, data, type) {
    console.warn(`Image failed to load for placement ${type} card. Rendering HTML fallback.`);
    cardDiv.innerHTML = ''; // Clear potential broken img
    cardDiv.classList.add('has-image-error');

    const fallbackContent = document.createElement('div');
    fallbackContent.className = 'fallback-content';

    if (type === 'unit') {
        const unitName = data.unitName || '?';
        const stats = data.stats || { attack: '?', defense: '?' };
        fallbackContent.innerHTML = `
            <div class="unit-name">${unitName}</div>
            <div class="stats">
                <span class="attack">A: ${stats.attack}</span>
                <span class="defense">D: ${stats.defense}</span>
            </div>
         `;
    } else { // terrain
        const terrainData = data.terrainData || { top: '?', right: '?', bottom: '?', left: '?' };
        fallbackContent.innerHTML = `
            <div class="terrain-edges">
                <span class="terrain-edge edge-top">${TERRAIN_EMOJIS[terrainData.top] || '?'}</span>
                <span class="terrain-edge edge-right">${TERRAIN_EMOJIS[terrainData.right] || '?'}</span>
                <span class="terrain-edge edge-bottom">${TERRAIN_EMOJIS[terrainData.bottom] || '?'}</span>
                <span class="terrain-edge edge-left">${TERRAIN_EMOJIS[terrainData.left] || '?'}</span>
            </div>
         `;
    }
    cardDiv.appendChild(fallbackContent);
}

// Renders fallback for defeated cards
function renderDefeatedCardFallback(cardDiv, defeatedData) {
    console.warn(`Image failed to load for defeated card. Rendering HTML fallback.`);
    cardDiv.innerHTML = ''; // Clear potential broken img
    cardDiv.classList.add('has-image-error');

    const fallbackContent = document.createElement('div');
    fallbackContent.className = 'fallback-content'; // Use specific class if needed

    const unitName = defeatedData.unitData?.unitName || '?';
    const stats = defeatedData.unitData?.stats || { attack: '?', defense: '?' };
    const terrainData = defeatedData.terrainData?.terrainData || { top: '?', right: '?', bottom: '?', left: '?' };

    fallbackContent.innerHTML = `
         <div class="terrain-edges">
            <span class="terrain-edge edge-top">${TERRAIN_EMOJIS[terrainData.top] || '?'}</span>
            <span class="terrain-edge edge-right">${TERRAIN_EMOJIS[terrainData.right] || '?'}</span>
            <span class="terrain-edge edge-bottom">${TERRAIN_EMOJIS[terrainData.bottom] || '?'}</span>
            <span class="terrain-edge edge-left">${TERRAIN_EMOJIS[terrainData.left] || '?'}</span>
         </div>
         <div class="unit-name">${unitName}</div>
         <div class="stats">
            <span class="attack">A:${stats.attack}</span> <span class="defense">D:${stats.defense}</span>
         </div>`;
    cardDiv.appendChild(fallbackContent);
}


// Global error handler attached to window to be accessible by onerror attribute
window.handleImageError = function (imgElement, cardData, type = 'board') {
    const parentDiv = imgElement.parentNode;
    if (!parentDiv) return;

    // Prevent infinite loops if fallback also fails somehow
    if (parentDiv.classList.contains('has-image-error')) return;

    imgElement.remove(); // Remove the broken image element

    if (type === 'board') {
        renderHtmlCardFallback(parentDiv, cardData);
    } else if (type === 'placementUnit') {
        renderPlacementCardFallback(parentDiv, cardData, 'unit');
    } else if (type === 'placementTerrain') {
        renderPlacementCardFallback(parentDiv, cardData, 'terrain');
    } else if (type === 'defeated') {
        renderDefeatedCardFallback(parentDiv, cardData);
    }
}

// --- Core Game Logic Functions (Modified for PeerJS) ---

function resetGame() {
    // Only Player 1 should initiate the reset and send setup
    if (localPlayerRole !== 1) {
        logMessage("Waiting for Player 1 to reset the game.");
        return;
    }
    if (!conn || !conn.open) {
        logMessage("Cannot reset game: Not connected.");
        return;
    }

    logMessage("Resetting game and sending setup...");

    // Reset local state first
    board = [];
    placedPositions.clear();
    selectedCardIndex = null;
    isResolvingAttack = false;
    defeatedUnits = [];
    nextCardId = 0;
    document.getElementById('board').innerHTML = '';
    document.getElementById('defeated-units').innerHTML = '<h4>Defeated Units</h4>';
    document.getElementById('memo-popover').style.display = 'none';

    // --- Generate Richer Unit/Terrain Data ---
    function generatePlayerUnitList(playerNum) {
        const units = [];
        const counters = {};
        for (const type in unitStats) {
            for (let i = 0; i < unitStats[type].quantity; i++) {
                counters[type] = (counters[type] || 0) + 1;
                const instance = counters[type];
                const imagePath = getUnitImagePath(playerNum, type, instance);
                units.push({
                    unitName: type,
                    instance: instance,
                    stats: { attack: unitStats[type].attack, defense: unitStats[type].defense },
                    imagePath: imagePath,
                    canTraverse: unitStats[type].canTraverse // Needed later
                });
            }
        }
        return shuffle(units);
    }

    function generatePlayerTerrainList(playerNum) {
        const terrainIndices = shuffle([...Array(8).keys()]);
        return terrainIndices.map(index => {
            const terrainDef = fixedTerrainCards[index];
            const imagePath = getTerrainImagePath(playerNum, terrainDef);
            return {
                terrainIndex: index,
                terrainData: terrainDef,
                imagePath: imagePath
            };
        });
    }

    const p1UnitsData = generatePlayerUnitList(1);
    const p2UnitsData = generatePlayerUnitList(2);
    const p1TerrainsData = generatePlayerTerrainList(1);
    const p2TerrainsData = generatePlayerTerrainList(2);

    // Store Player 1's lists locally
    playerAvailableUnits = { 1: p1UnitsData, 2: [] };
    playerAvailableTerrains = { 1: p1TerrainsData, 2: [] };

    // Prepare initial pairings for memo pad (using the new data structures)
    // Pairings are based on the *initial* shuffled order before players pick
    const p1InitialPairings = p1UnitsData.map((unitData, i) => ({ unitData: unitData, terrainData: p1TerrainsData[i] }));
    const p2InitialPairings = p2UnitsData.map((unitData, i) => ({ unitData: unitData, terrainData: p2TerrainsData[i] }));
    // Sort pairings for consistent memo display (e.g., alphabetically by unit name)
    const sortPairings = (a, b) => a.unitData.unitName.localeCompare(b.unitData.unitName) || a.unitData.instance - b.unitData.instance;
    p1InitialPairings.sort(sortPairings);
    p2InitialPairings.sort(sortPairings);

    // Store both pairings locally for Player 1
    initialPlayerPairings = { 1: p1InitialPairings, 2: p2InitialPairings };

    // Send setup data to Player 2
    const setupData = {
        player2Units: p2UnitsData,         // Send full objects
        player2Terrains: p2TerrainsData,   // Send full objects
        player1InitialPairings: p1InitialPairings, // Send P1's pairings for P2's memo
        player2InitialPairings: p2InitialPairings  // Send P2's pairings for P2's memo
    };
    sendData('setup', setupData);

    // Complete local setup for Player 1
    gameState = 'PLACEMENT';
    currentPlayer = 1; // Player 1 starts placement
    placedCardPairCount = 0;
    selectedUnitDataForPlacement = null;   // Reset selection objects
    selectedTerrainDataForPlacement = null;

    // Add the board click listener for placement
    const boardDiv = document.getElementById('board');
    boardDiv.removeEventListener('click', handleBoardClickForPlacement); // Remove previous if any
    boardDiv.addEventListener('click', handleBoardClickForPlacement);

    logMessage("Setup complete. Player 1's turn to place.");
    updateUI();
}

function applySetup(setupData) {
    // This is called on Player 2 when receiving the 'setup' message
    logMessage("Received game setup from Player 1.");

    // Reset local state
    board = [];
    placedPositions.clear();
    selectedCardIndex = null;
    isResolvingAttack = false;
    defeatedUnits = [];
    nextCardId = 0;
    document.getElementById('board').innerHTML = '';
    document.getElementById('defeated-units').innerHTML = '<h4>Defeated Units</h4>';
    document.getElementById('memo-popover').style.display = 'none';

    // Store Player 2's lists (now expects arrays of objects)
    playerAvailableUnits = { 1: [], 2: setupData.player2Units };
    playerAvailableTerrains = { 1: [], 2: setupData.player2Terrains };

    // Store initial pairings for memo pad (received from P1, already sorted)
    initialPlayerPairings = {
        1: setupData.player1InitialPairings,
        2: setupData.player2InitialPairings
    };

    gameState = 'PLACEMENT';
    currentPlayer = 1; // Player 1 starts placement
    placedCardPairCount = 0;
    selectedUnitDataForPlacement = null;   // Reset selection objects
    selectedTerrainDataForPlacement = null;

    // Add the board click listener for placement (but it will be disabled if not current player)
    const boardDiv = document.getElementById('board');
    boardDiv.removeEventListener('click', handleBoardClickForPlacement); // Remove previous if any
    boardDiv.addEventListener('click', handleBoardClickForPlacement);

    logMessage("Setup complete. Waiting for Player 1 to place.");
    updateUI();
}


// Place card locally (called by both players after placement action)
// Accepts full unitData and terrainData objects
function placeCard(gridX, gridY, owner, unitData, terrainDataObj, cardIdToUse = null) {
    const cardId = cardIdToUse !== null ? cardIdToUse : nextCardId++; // Use provided ID or generate new
    if (cardIdToUse === null && localPlayerRole === 2) {
        console.error("Player 2 trying to generate card ID!");
    }
    if (cardIdToUse !== null && cardIdToUse >= nextCardId) {
        nextCardId = cardIdToUse + 1; // Ensure next generated ID is higher
    }

    // Store the full data objects in the board state
    const card = {
        id: cardId,
        unitData: unitData, // { unitName, instance, stats, imagePath, canTraverse }
        terrainData: terrainDataObj, // { terrainIndex, terrainData, imagePath }
        hidden: true,
        owner: owner,
        gridX: gridX,
        gridY: gridY,
        element: null,
        hasImageError: false // Track if fallback is active
    };
    board.push(card);
    const gridKey = `${gridX}_${gridY}`;
    placedPositions.add(gridKey);

    const boardDiv = document.getElementById('board');
    const cardDiv = document.createElement('div');
    cardDiv.className = `card hidden player${owner}`;
    cardDiv.style.gridColumn = gridX;
    cardDiv.style.gridRow = gridY;
    cardDiv.dataset.id = cardId;
    // Click handler added later in applyPlacement if needed

    // --- Create Layered Structure ---
    const terrainLayerDiv = document.createElement('div');
    terrainLayerDiv.className = 'terrain-layer';

    const unitLayerDiv = document.createElement('div');
    // Start with unit hidden. If unitData is null/undefined, it should remain hidden.
    unitLayerDiv.className = `unit-layer ${!unitData || card.hidden ? 'hidden-state' : ''}`;

    // Create Terrain Image
    const terrainImg = document.createElement('img');
    terrainImg.src = terrainDataObj.imagePath;
    const terrainEdges = terrainDataObj.terrainData;
    terrainImg.alt = `Terrain [T:${terrainEdges.top}, R:${terrainEdges.right}, B:${terrainEdges.bottom}, L:${terrainEdges.left}]`;
    // Basic error handling for terrain image
    terrainImg.onerror = () => {
        card.hasImageError = true; // Mark error on the board data
        console.error(`Terrain image failed to load: ${terrainImg.src} for card ${card.id}`);
        terrainLayerDiv.innerHTML = `<div class="fallback-content" style="font-size:10px; color: red;">Terrain Load Error</div>`; // Simple fallback
    };
    terrainLayerDiv.appendChild(terrainImg);

    // Create Unit Image (only if unitData exists)
    if (unitData) {
        const unitImg = document.createElement('img');
        unitImg.src = unitData.imagePath; // Set src even if hidden initially
        unitImg.alt = `Player ${owner} ${unitData.unitName} (A:${unitData.stats.attack} D:${unitData.stats.defense})`; // Alt text for revealed state
        // Basic error handling for unit image
        unitImg.onerror = () => {
            card.hasImageError = true; // Mark error on the board data
            console.error(`Unit image failed to load: ${unitImg.src} for card ${card.id}`);
            unitLayerDiv.innerHTML = `<div class="fallback-content" style="font-size:10px; color: red;">Unit Load Error</div>`; // Simple fallback
        };
        unitLayerDiv.appendChild(unitImg);
    } else {
         // If there's no unit, ensure the unit layer is hidden and maybe add placeholder content or leave empty
         unitLayerDiv.classList.add('hidden-state');
         // unitLayerDiv.innerHTML = '<!-- No Unit -->'; // Optional placeholder
    }


    // Append layers to card div
    cardDiv.appendChild(terrainLayerDiv);
    cardDiv.appendChild(unitLayerDiv);
    // --- End Layered Structure ---

    boardDiv.appendChild(cardDiv);
    card.element = cardDiv;
    // Store references to layers if needed later, though querying might be simpler
    // card.terrainLayerElement = terrainLayerDiv;
    // card.unitLayerElement = unitLayerDiv;

    return card;
}

function applyPlacement(data) {
    // Data now contains unitData and terrainData objects directly
    const { owner, unitData, terrainData, gridX, gridY, nextPlayer, cardId } = data;

    logMessage(`Player ${owner} placed ${unitData.unitName} (Instance ${unitData.instance}) on terrain #${terrainData.terrainIndex + 1} at (${gridX}, ${gridY}).`);

    // Place the card locally using the received data objects
    const placedCard = placeCard(gridX, gridY, owner, unitData, terrainData, cardId);

    // Remove placed unit and terrain from the *correct* player's available lists locally
    // Find by imagePath or a unique combination (e.g., name + instance)
    playerAvailableUnits[owner] = playerAvailableUnits[owner].filter(u => u.imagePath !== unitData.imagePath);
    playerAvailableTerrains[owner] = playerAvailableTerrains[owner].filter(t => t.imagePath !== terrainData.imagePath);


    // Update local game state
    placedCardPairCount++;
    currentPlayer = nextPlayer;

    // Check if placement phase is over
    if (placedCardPairCount >= TOTAL_CARD_PAIRS_TO_PLACE) {
        gameState = 'GAMEPLAY';
        logMessage("Placement complete! Player 1's turn to move or attack.");
        // Remove the board click listener for placement
        document.getElementById('board').removeEventListener('click', handleBoardClickForPlacement);
        // Add card click listeners for gameplay
        board.forEach(card => {
            if (card.element) {
                card.element.onclick = () => handleCardClick(card.id);
            }
        });
    } else {
        logMessage(`Player ${currentPlayer}'s turn to place.`);
    }

    // Reset local selections (relevant for the player who just placed)
    selectedUnitDataForPlacement = null; // Reset selection object
    selectedTerrainDataForPlacement = null; // Reset selection object

    // Refresh memo pad if it's currently open to show the new pair immediately
    const memoPopover = document.getElementById('memo-popover');
    if (memoPopover && window.getComputedStyle(memoPopover).display !== 'none') {
        displayMemoPadContent(); // Refresh content for local player
    }

    updateUI();
}

function applyReveal(data) {
    const { cardId, unitName } = data;
    const cardIndex = findCardIndexById(cardId);
    if (cardIndex === -1) return;
    const card = board[cardIndex];
    if (card.hidden) {
        card.hidden = false;
        // No need to log here, updateUI will handle visual change
        // If using alt text, it's already correct. If using fallback, updateUI will reveal it.
        updateUI(); // Update to show the revealed unit visually
    }
}

function applyMove(data) {
    const { attackerCardId, targetCardId, nextPlayer } = data;
    const attackerCardIndex = findCardIndexById(attackerCardId);
    const targetCardIndex = findCardIndexById(targetCardId);

    if (attackerCardIndex === -1 || targetCardIndex === -1) {
        console.error("Invalid card ID received for move.");
        return;
    }

    const attackerCard = board[attackerCardIndex];
    const targetCard = board[targetCardIndex];

    const directionInfo = getDirectionInfo(attackerCard, targetCard);
    // Access terrain data correctly
    const entryTerrainType = targetCard.terrainData.terrainData[directionInfo.opposite];

    logMessage(`Player ${attackerCard.owner} moved ${attackerCard.unitData.unitName} via ${entryTerrainType}.`);

    // Update board state - Data moves (transfer unitData, keep terrainData)
    targetCard.unitData = attackerCard.unitData; // Move the unit object
    targetCard.owner = attackerCard.owner;
    targetCard.hidden = false; // Moved unit is revealed

    attackerCard.unitData = null; // Remove unit object from original spot
    attackerCard.owner = null;
    attackerCard.hidden = true; // Previous spot becomes empty/hidden

    selectedCardIndex = null; // Deselect on both clients
    currentPlayer = nextPlayer;
    isResolvingAttack = false; // Ensure flag is reset

    updateUI();
}

function applyAttackResult(data) {
    const { winnerCardId, loserCardId, defeatedUnitData, attackerMoved, nextPlayer, gameOver, winMessage } = data;

    const winnerCardIndex = findCardIndexById(winnerCardId);
    const loserCardIndex = findCardIndexById(loserCardId);

    if (winnerCardIndex === -1 || loserCardIndex === -1) {
        console.error("Invalid card ID received for attack result.");
        return; // Or request resync
    }

    const winnerCard = board[winnerCardIndex];
    const loserCard = board[loserCardIndex];

    logMessage(`Combat resolved: ${winnerCard.unitData.unitName} defeats ${loserCard.unitData.unitName}.`);

    // Add loser to defeated units list (defeatedUnitData now contains unitData and terrainData)
    defeatedUnits.push(defeatedUnitData);

    // Update board state based on result
    if (attackerMoved) {
        // Attacker won and moved into loser's spot
        loserCard.unitData = winnerCard.unitData; // Winner's unit data moves
        loserCard.owner = winnerCard.owner;
        loserCard.hidden = false; // Reveal the winner in the new spot

        winnerCard.unitData = null; // Original spot becomes empty
        winnerCard.owner = null;
        winnerCard.hidden = true;
    } else {
        // Defender won, attacker is removed (loser is attacker)
        loserCard.unitData = null; // Loser's spot becomes empty
        loserCard.owner = null;
        loserCard.hidden = true;

        winnerCard.hidden = false; // Winner (defender) remains revealed
    }

    selectedCardIndex = null; // Deselect on both clients
    isResolvingAttack = false; // Unlock UI

    if (gameOver) {
        gameState = 'GAMEOVER';
        logMessage(winMessage);
    } else {
        currentPlayer = nextPlayer;
    }

    updateUI();
}


function findCardIndexById(id) {
    return board.findIndex(card => card && card.id === id);
}
function findCardById(id) {
    return board.find(card => card && card.id === id);
}
function findCardByGrid(gridX, gridY) {
    // Ensure card exists and has grid coordinates before checking
    return board.find(card => card && card.gridX === gridX && card.gridY === gridY);
}

function getDirectionInfo(card1, card2) {
    if (!card1 || !card2) return null;
    const dx = card2.gridX - card1.gridX;
    const dy = card2.gridY - card1.gridY;

    if (dx === 1 && dy === 0) return { direction: 'right', opposite: 'left' };
    if (dx === -1 && dy === 0) return { direction: 'left', opposite: 'right' };
    if (dx === 0 && dy === 1) return { direction: 'bottom', opposite: 'top' }; // Grid Y increases downwards
    if (dx === 0 && dy === -1) return { direction: 'top', opposite: 'bottom' }; // Grid Y decreases upwards
    return null; // Not adjacent or same card
}

function canUnitTraverse(unitData, terrainType) {
    // unitData is expected to be { unitName, instance, stats, imagePath, canTraverse }
    if (!unitData || !unitData.canTraverse || !terrainType) return false;
    return unitData.canTraverse.includes(terrainType);
}

// --- Event Handlers (Modified for PeerJS) ---

function handleCardClick(cardId) {
    if (gameState !== 'GAMEPLAY' || isResolvingAttack) return;
    if (currentPlayer !== localPlayerRole) {
        logMessage("It's not your turn.");
        return;
    }

    const clickedCardIndex = findCardIndexById(cardId);
    if (clickedCardIndex === -1) return;
    const clickedCard = board[clickedCardIndex];

    logMessage(""); // Clear previous message

    if (selectedCardIndex === null) {
        // --- Selecting a unit ---
        if (clickedCard.owner !== currentPlayer) {
            logMessage("Cannot select opponent's card."); return;
        }
        // Check unitData to see if unit exists
        if (!clickedCard.unitData) {
            logMessage("Cannot select an empty space."); return;
        }

        if (clickedCard.hidden) {
            // Reveal locally first
            clickedCard.hidden = false;
            logMessage(`You revealed ${clickedCard.unitData.unitName}.`);
            // Send reveal action to peer - only need cardId, receiver updates based on their board state
            sendData('reveal', { cardId: clickedCard.id });
            // Note: Previously sent unitName, but receiver should already have it. Sending less is better.
        }

        selectedCardIndex = clickedCardIndex;
        // Update UI locally immediately for responsiveness
        updateUI();

    } else {
        // --- Target selected ---
        const attackerCard = board[selectedCardIndex];

        if (clickedCardIndex === selectedCardIndex) { // Deselecting
            selectedCardIndex = null;
            logMessage("Card deselected.");
            updateUI();
            return;
        }

        const directionInfo = getDirectionInfo(attackerCard, clickedCard);
        if (!directionInfo) {
            logMessage("Target is not adjacent."); return;
        }

        // Check Movement Legality
        const entryTerrainType = clickedCard.terrainData.terrainData[directionInfo.opposite];
        // Pass the attacker's unitData object to canUnitTraverse
        if (!canUnitTraverse(attackerCard.unitData, entryTerrainType)) {
            logMessage(`${attackerCard.unitData.unitName} cannot enter via ${entryTerrainType} (${directionInfo.opposite} edge of target).`);
            return;
        }

        // Process Action: Move or Attack
        if (clickedCard.owner === currentPlayer) {
            logMessage("Cannot move/attack your own unit."); return;
        }

        const nextPlayer = currentPlayer === 1 ? 2 : 1;

        // Check if target has a unit
        if (!clickedCard.unitData) {
            // --- Moving to empty adjacent tile ---
            logMessage(`Moving ${attackerCard.unitData.unitName} via ${entryTerrainType}...`);
            // Send move action
            sendData('move', {
                attackerCardId: attackerCard.id,
                targetCardId: clickedCard.id,
                nextPlayer: nextPlayer
            });
            // Apply move locally (will also be applied on receiver)
            applyMove({ attackerCardId: attackerCard.id, targetCardId: clickedCard.id, nextPlayer: nextPlayer });

        } else {
            // --- Attacking an enemy unit ---
            logMessage(`Attacking ${clickedCard.unitData.unitName} with ${attackerCard.unitData.unitName}...`);
            isResolvingAttack = true; // Lock UI locally

            // Reveal defender locally if hidden (peer will reveal on their side too)
            if (clickedCard.hidden) {
                clickedCard.hidden = false;
                logMessage(`Revealed defender: ${clickedCard.unitData.unitName}.`);
                // Send reveal action for the defender (only ID needed)
                sendData('reveal', { cardId: clickedCard.id });
                updateUI(); // Show revealed defender locally
            }

            // Resolve attack locally first to determine outcome
            const attackResultData = resolveAttackLocally(selectedCardIndex, clickedCardIndex, nextPlayer);

            // Send the *result* of the attack to the peer
            sendData('attackResult', attackResultData);

            // Apply the result locally after a short delay (simulates network + animation)
            // Note: applyAttackResult handles the UI update and state changes
            setTimeout(() => {
                applyAttackResult(attackResultData);
                // isResolvingAttack is set to false within applyAttackResult
            }, 500); // Shorter delay as resolution is deterministic
        }
        // Don't update UI immediately here for attack, wait for applyAttackResult
    }
}

function resolveAttackLocally(attackerIndex, defenderIndex, nextPlayer) {
    // This function calculates the outcome but DOES NOT modify the board state directly.
    // It returns the data needed for applyAttackResult.
    const attackerCard = board[attackerIndex];
    const defenderCard = board[defenderIndex];

    // Basic validation using unitData
    if (!attackerCard || !attackerCard.unitData || !defenderCard || !defenderCard.unitData) {
        console.error("Resolve attack locally failed: unitData missing.");
        return { error: true }; // Indicate error
    }

    // Access stats from unitData
    const attackerStats = attackerCard.unitData.stats;
    const defenderStats = defenderCard.unitData.stats;
    const directionInfo = getDirectionInfo(attackerCard, defenderCard);
    // Access terrain data correctly
    const defenseEdgeTerrain = defenderCard.terrainData.terrainData[directionInfo.opposite];
    const terrainBonus = terrainRules[defenseEdgeTerrain]?.defenseBonus || 0;
    const attackValue = attackerStats.attack;
    const defenseValue = defenderStats.defense + terrainBonus;

    console.log(`Local Resolution: ${attackerCard.unitData.unitName} (A:${attackValue}) vs ${defenderCard.unitData.unitName} (D:${defenderStats.defense} + ${terrainBonus} Bonus = ${defenseValue})`);

    let winnerCard, loserCard, attackerWins, attackerMoved;
    let defeatedUnitData = null; // Will store { unitData, terrainData, owner }

    attackerWins = attackValue > defenseValue; // Defender wins ties

    if (attackerWins) {
        winnerCard = attackerCard;
        loserCard = defenderCard;
        attackerMoved = true; // Attacker moves into the space
        console.log(`Local Resolution: Attacker wins!`);
    } else { // Defender wins
        winnerCard = defenderCard;
        loserCard = attackerCard;
        attackerMoved = false; // Attacker is removed, defender stays
        console.log(`Local Resolution: Defender wins!`);
    }

    // Store the full unitData and terrainData of the loser
    defeatedUnitData = {
        unitData: loserCard.unitData,
        terrainData: loserCard.terrainData, // Store the terrain the loser was on
        owner: loserCard.owner
    };

    // Check for win conditions based on the *potential* outcome
    const commandUnitName = 'Mobile Command';
    let gameOver = false;
    let winMessage = "";

    // Simulate board state *after* this combat resolution
    const loserOwner = loserCard.owner;
    const loserIsCommand = loserCard.unitData.unitName === commandUnitName;

    if (loserIsCommand) {
        gameOver = true;
        winMessage = `Player ${winnerCard.owner} wins by capturing the Mobile Command!`;
    } else {
        // Count remaining non-command units for the loser *after* this loss
        const remainingUnitsLoser = board.filter(c =>
            c && c.owner === loserOwner && c.unitData && c.unitData.unitName !== commandUnitName && c.id !== loserCard.id // Exclude the unit being defeated
        ).length;
        // Check if command still exists for the loser
        const commandLoserExists = board.some(c => c && c.unitData && c.unitData.unitName === commandUnitName && c.owner === loserOwner && c.id !== loserCard.id);

        if (remainingUnitsLoser === 0 && commandLoserExists) {
            gameOver = true;
            winMessage = `Player ${winnerCard.owner} wins by eliminating all other movable units!`;
        }
    }


    return {
        winnerCardId: winnerCard.id,
        loserCardId: loserCard.id,
        defeatedUnitData: defeatedUnitData, // Contains full unit/terrain data
        attackerMoved: attackerMoved,
        nextPlayer: gameOver ? currentPlayer : nextPlayer, // If game over, turn doesn't switch
        gameOver: gameOver,
        winMessage: winMessage
    };
}


function handleBoardClickForPlacement(event) {
    if (gameState !== 'PLACEMENT') return;
    if (currentPlayer !== localPlayerRole) {
        logMessage("It's not your turn to place.");
        return;
    }
    if (!conn || !conn.open) {
        logMessage("Not connected to opponent.");
        return;
    }

    // Ensure a unit and terrain object are selected
    if (selectedUnitDataForPlacement === null || selectedTerrainDataForPlacement === null) {
        logMessage("Please select both a unit and a terrain card first.");
        return;
    }

    // Determine target grid cell (must be a placeholder)
    let targetGridX = null;
    let targetGridY = null;
    if (event.target.classList.contains('placement-placeholder')) {
        targetGridX = parseInt(event.target.dataset.gridX, 10);
        targetGridY = parseInt(event.target.dataset.gridY, 10);
        logMessage(`Attempting placement at placeholder (${targetGridX}, ${targetGridY})`);
    } else {
        logMessage("Invalid placement spot. Click on one of the dashed outlines.");
        return; // Click was not on a valid placeholder
    }

    const gridKey = `${targetGridX}_${targetGridY}`;

    // --- Validate Placement Location (redundant check, but safe) ---
    const potentialSpots = new Set();
    if (placedPositions.size === 0) {
        potentialSpots.add(`${START_GRID_COORD}_${START_GRID_COORD}`);
    } else {
        placedPositions.forEach(posKey => {
            const [x, y] = posKey.split('_').map(Number);
            const neighbors = [`${x + 1}_${y}`, `${x - 1}_${y}`, `${x}_${y + 1}`, `${x}_${y - 1}`];
            neighbors.forEach(neighborKey => {
                if (!placedPositions.has(neighborKey)) potentialSpots.add(neighborKey);
            });
        });
    }
    if (!potentialSpots.has(gridKey)) {
        logMessage("Invalid placement spot (validation failed). Click on one of the dashed outlines.");
        return;
    }

    // --- Prepare and Send Placement Data ---
    const nextPlayer = currentPlayer === 1 ? 2 : 1;
    const cardIdForPlacement = nextCardId; // Determine ID before sending

    // Send the selected unitData and terrainData objects directly
    const placementData = {
        owner: currentPlayer,
        unitData: selectedUnitDataForPlacement,     // Send the whole object
        terrainData: selectedTerrainDataForPlacement, // Send the whole object
        gridX: targetGridX,
        gridY: targetGridY,
        nextPlayer: nextPlayer,
        cardId: cardIdForPlacement // Include the ID for synchronization
    };

    sendData('placement', placementData);

    // Apply placement locally immediately
    applyPlacement(placementData);
}

// Updated selection functions to store the whole object
function selectUnitForPlacement(unitData) {
    if (gameState !== 'PLACEMENT' || currentPlayer !== localPlayerRole) return;
    selectedUnitDataForPlacement = unitData;
    logMessage(`Selected Unit: ${unitData.unitName} (Instance ${unitData.instance})`);
    updateUI();
}

function selectTerrainForPlacement(terrainDataObj) {
    if (gameState !== 'PLACEMENT' || currentPlayer !== localPlayerRole) return;
    selectedTerrainDataForPlacement = terrainDataObj;
    const tData = terrainDataObj.terrainData;
    logMessage(`Selected Terrain: #${terrainDataObj.terrainIndex + 1} [${TERRAIN_EMOJIS[tData.top]}, ...]`);
    updateUI();
}

// --- Memo Pad Functions (Updated for new data structure) ---
function displayMemoPadContent() { // No longer needs player argument
    const memoPopover = document.getElementById('memo-popover');
    if (!localPlayerRole) {
        memoPopover.innerHTML = `<h5>Your Memo Pad</h5><p>Not connected.</p>`;
        return;
    }

    const playerPairings = initialPlayerPairings[localPlayerRole];

    if (!playerPairings || playerPairings.length === 0) {
        memoPopover.innerHTML = `<h5>Your Memo Pad</h5><p>No pairings data found.</p>`;
        return;
    }

    let content = '';

    if (gameState === 'PLACEMENT') {
        // Count how many pairs the local player has actually placed
        const placedByMeCount = board.filter(card => card && card.owner === localPlayerRole && card.unitData && card.terrainData).length;
        content = `<h5>Your Placement Memo (${placedByMeCount}/${playerPairings.length})</h5><ul>`;

        // Get the imagePaths of units placed by the local player
        const placedUnitImagePaths = new Set(
            board
                .filter(card => card && card.owner === localPlayerRole && card.unitData)
                .map(card => card.unitData.imagePath)
        );

        // Iterate through ALL initial pairings for the local player
        playerPairings.forEach(pair => {
            const unitName = pair.unitData.unitName;
            const instance = pair.unitData.instance;
            const terrain = pair.terrainData.terrainData; // Get the actual terrain edges object
            const terrainEmojis = `
                <span class="memo-edge-top">${TERRAIN_EMOJIS[terrain.top] || '?'}</span>
                <span class="memo-edge-right">${TERRAIN_EMOJIS[terrain.right] || '?'}</span>
                <span class="memo-edge-bottom">${TERRAIN_EMOJIS[terrain.bottom] || '?'}</span>
                <span class="memo-edge-left">${TERRAIN_EMOJIS[terrain.left] || '?'}</span>
            `;

            // Check if this specific unit (by imagePath) has been placed
            const isUnitPlaced = placedUnitImagePaths.has(pair.unitData.imagePath);
            const unitDisplay = isUnitPlaced ? `${unitName} #${instance}` : '---'; // Show name or placeholder

            content += `<li><span class="memo-terrain">${terrainEmojis}</span><span class="memo-unit">${unitDisplay}</span></li>`;
        });

    } else { // GAMEPLAY or GAMEOVER
        content = `<h5>Your Initial Pairings</h5><ul>`;
        // Show all initial pairings with unit names
        playerPairings.forEach(pair => {
            const unitName = pair.unitData.unitName;
            const instance = pair.unitData.instance;
            const terrain = pair.terrainData.terrainData; // Get the actual terrain edges object
            const terrainEmojis = `
                <span class="memo-edge-top">${TERRAIN_EMOJIS[terrain.top] || '?'}</span>
                <span class="memo-edge-right">${TERRAIN_EMOJIS[terrain.right] || '?'}</span>
                <span class="memo-edge-bottom">${TERRAIN_EMOJIS[terrain.bottom] || '?'}</span>
                <span class="memo-edge-left">${TERRAIN_EMOJIS[terrain.left] || '?'}</span>
            `;
            content += `<li><span class="memo-terrain">${terrainEmojis}</span><span class="memo-unit">${unitName} #${instance}</span></li>`;
        });
    }

    content += `</ul>`;
    memoPopover.innerHTML = content;
}


function toggleMemoPad() {
    if (!conn || !conn.open || !localPlayerRole) return; // Only allow if connected and role assigned
    const memoPopover = document.getElementById('memo-popover');
    const currentDisplay = window.getComputedStyle(memoPopover).display;

    if (currentDisplay === 'none') {
        // Always display memo for the local player
        displayMemoPadContent(); // Call without argument
        memoPopover.style.display = 'block';
    } else {
        memoPopover.style.display = 'none';
    }
}

// --- Data Handling ---
function handleReceivedData(data) {
    const { type, payload } = data;
    switch (type) {
        case 'setup':
            applySetup(payload);
            break;
        case 'placement':
            applyPlacement(payload);
            break;
        case 'reveal':
            applyReveal(payload);
            break;
        case 'move':
            applyMove(payload);
            break;
        case 'attackResult':
            applyAttackResult(payload);
            break;
        case 'displayName':
            opponentDisplayName = payload.name;
            console.log(`Opponent's display name set to: ${opponentDisplayName}`);
            logMessage(`Opponent is "${opponentDisplayName}".`);
            // Update UI elements that show peer info
            if (conn && conn.open) {
                document.getElementById('peer-status').textContent = `Connected to ${opponentDisplayName} (${conn.peer})`;
            }
            updateUI(); // Refresh UI with the new name
            break;
        // Add other message types if needed (e.g., chat, sync requests)
        default:
            console.warn('Received unknown data type:', type);
    }
}

// --- UI Update Function ---
function updateUI() {
    const placementControlsDiv = document.getElementById('placement-controls');
    const infoDiv = document.getElementById('info');
    const memoButton = document.getElementById('memo-toggle-button');
    const boardDiv = document.getElementById('board');
    const bodyEl = document.body;
    const connectionDetails = document.getElementById('connection-details'); // Get details element
    const connectionSummary = document.getElementById('connection-summary'); // Get summary element
    const peerStatusSpan = document.getElementById('peer-status'); // Get status span inside controls

    // Update Connection Summary Text (use opponent name if available)
    let statusText = peerStatusSpan.textContent;
    if (conn && conn.open && opponentDisplayName) {
        statusText = `Connected to ${opponentDisplayName}`;
    } else if (conn && conn.open) {
        statusText = `Connected to ${conn.peer}`;
    } else if (myPeerId) {
        statusText = 'Waiting for connection...';
    } else {
        statusText = 'Initializing...';
    }
    connectionSummary.textContent = `Connection Status: ${statusText}`;
    // Also update the status span inside the details view
    peerStatusSpan.textContent = statusText;


    // Set body class based on whose turn it is locally
    if (localPlayerRole === currentPlayer && (gameState === 'PLACEMENT' || gameState === 'GAMEPLAY')) {
        bodyEl.classList.add('my-turn');
    } else {
        bodyEl.classList.remove('my-turn');
    }

    // --- State-Specific UI Updates ---
    boardDiv.querySelectorAll('.placement-placeholder').forEach(el => el.remove()); // Clean placeholders

    if (gameState === 'CONNECTING' || gameState === 'DISCONNECTED') {
        placementControlsDiv.style.display = 'none';
        infoDiv.textContent = gameState === 'CONNECTING' ? 'Connecting...' : 'Disconnected. Please refresh or reconnect.';
        memoButton.style.display = 'none';
        boardDiv.style.cursor = 'default';

        // Ensure connect controls are enabled when disconnected
        if (gameState === 'DISCONNECTED') {
            const peerReady = peer && !peer.disconnected && !peer.destroyed;
            const notConnecting = !conn;
            document.getElementById('peer-id-input').disabled = !peerReady || !notConnecting;
            document.getElementById('connect-button').disabled = !peerReady || !notConnecting;
            document.getElementById('disconnect-button').disabled = true;
        } else { // Connecting state
            document.getElementById('peer-id-input').disabled = true;
            document.getElementById('connect-button').disabled = true;
            document.getElementById('disconnect-button').disabled = true;
        }
        connectionDetails.open = true; // Keep connection details open when not connected/connecting
        connectionDetails.style.pointerEvents = 'auto'; // Allow interaction with controls inside
        connectionSummary.style.cursor = 'default'; // Summary itself is not clickable to close
        // Disable the toggle functionality via CSS might be cleaner, but JS works too
        connectionSummary.onclick = (e) => e.preventDefault(); // Prevent toggling via summary click

    } else if (gameState === 'PLACEMENT') {
        placementControlsDiv.style.display = 'block';
        infoDiv.style.display = 'none';
        // Allow connection details to be collapsed when game starts
        if (!connectionDetails.hasAttribute('data-initially-closed')) {
            connectionDetails.open = false; // Close by default once placement starts
            connectionDetails.setAttribute('data-initially-closed', 'true'); // Mark that we've set initial state
        }
        connectionDetails.style.pointerEvents = 'auto'; // Ensure interaction is enabled
        connectionSummary.style.cursor = 'pointer'; // Make summary clickable
        connectionSummary.onclick = null; // Remove the toggle prevention

        memoButton.style.display = 'inline-block';
        boardDiv.style.cursor = (localPlayerRole === currentPlayer) ? 'copy' : 'not-allowed';
        const potentialSpots = new Set();
        if (placedPositions.size === 0) {
            potentialSpots.add(`${START_GRID_COORD}_${START_GRID_COORD}`);
        } else {
            placedPositions.forEach(posKey => {
                const [x, y] = posKey.split('_').map(Number);
                const neighbors = [`${x + 1}_${y}`, `${x - 1}_${y}`, `${x}_${y + 1}`, `${x}_${y - 1}`];
                neighbors.forEach(neighborKey => {
                    if (!placedPositions.has(neighborKey)) potentialSpots.add(neighborKey);
                });
            });
        }
        potentialSpots.forEach(spotKey => {
            const [x, y] = spotKey.split('_').map(Number);
            const placeholder = document.createElement('div');
            placeholder.className = 'placement-placeholder';
            placeholder.style.setProperty('--grid-x', x);
            placeholder.style.setProperty('--grid-y', y);
            placeholder.dataset.gridX = x;
            placeholder.dataset.gridY = y;
            boardDiv.appendChild(placeholder);
        });

        // Update placement title and instructions
        const opponentNameText = opponentDisplayName ? `(Opponent: ${opponentDisplayName})` : "(Opponent's Turn)";
        document.getElementById('placement-title').textContent = `Placement Phase - Player ${currentPlayer}'s Turn ${currentPlayer === localPlayerRole ? '(Your Turn)' : opponentNameText}`;
        document.getElementById('placement-instructions').textContent = `Select one unit and one terrain, then click an empty, valid spot on the board. (${placedCardPairCount}/${TOTAL_CARD_PAIRS_TO_PLACE} placed)`;

        // Populate available units/terrains for the *current* player
        const unitsArea = document.getElementById('placement-units-area');
        const terrainsArea = document.getElementById('placement-terrains-area');
        unitsArea.innerHTML = '';
        terrainsArea.innerHTML = '';

        if (localPlayerRole === currentPlayer) { // Only show selection cards if it's your turn
            // Iterate over unitData objects
            playerAvailableUnits[currentPlayer].forEach((unitData) => {
                const cardDiv = document.createElement('div');
                cardDiv.className = 'placement-unit-card';
                const img = document.createElement('img');
                img.src = unitData.imagePath;
                img.alt = `Unit: ${unitData.unitName} (A:${unitData.stats.attack} D:${unitData.stats.defense})`;
                // Pass unitData for fallback
                img.onerror = () => window.handleImageError(img, unitData, 'placementUnit');
                cardDiv.appendChild(img);

                cardDiv.onclick = () => selectUnitForPlacement(unitData); // Pass the whole object
                // Check if this object is the selected one
                if (selectedUnitDataForPlacement && selectedUnitDataForPlacement.imagePath === unitData.imagePath) {
                    cardDiv.classList.add('selected-for-placement');
                }
                unitsArea.appendChild(cardDiv);
            });

            // Iterate over terrainData objects
            playerAvailableTerrains[currentPlayer].forEach(terrainDataObj => {
                const cardDiv = document.createElement('div');
                cardDiv.className = `placement-terrain-card player${currentPlayer}`;
                const img = document.createElement('img');
                img.src = terrainDataObj.imagePath;
                const tData = terrainDataObj.terrainData;
                img.alt = `Terrain #${terrainDataObj.terrainIndex + 1}: [T:${tData.top}, R:${tData.right}, B:${tData.bottom}, L:${tData.left}]`;
                // Pass terrainDataObj for fallback
                img.onerror = () => window.handleImageError(img, terrainDataObj, 'placementTerrain');
                cardDiv.appendChild(img);

                cardDiv.onclick = () => selectTerrainForPlacement(terrainDataObj); // Pass the whole object
                // Check if this object is the selected one
                if (selectedTerrainDataForPlacement && selectedTerrainDataForPlacement.imagePath === terrainDataObj.imagePath) {
                    cardDiv.classList.add('selected-for-placement');
                }
                terrainsArea.appendChild(cardDiv);
            });
        } else {
            unitsArea.innerHTML = '<i>Waiting for opponent...</i>';
            terrainsArea.innerHTML = '<i>Waiting for opponent...</i>';
        }


    } else if (gameState === 'GAMEPLAY' || gameState === 'GAMEOVER') {
        placementControlsDiv.style.display = 'none';
        infoDiv.style.display = 'block';
        // Allow connection details to be collapsed
        if (!connectionDetails.hasAttribute('data-initially-closed')) {
            connectionDetails.open = false; // Close by default if not already handled in placement
            connectionDetails.setAttribute('data-initially-closed', 'true');
        }
        connectionDetails.style.pointerEvents = 'auto'; // Ensure interaction is enabled
        connectionSummary.style.cursor = 'pointer'; // Make summary clickable
        connectionSummary.onclick = null; // Remove the toggle prevention

        memoButton.style.display = 'inline-block';
        boardDiv.style.cursor = 'default';

        // Update Info Bar (use unitData to count)
        const p1Units = board.filter(c => c && c.owner === 1 && c.unitData).length;
        const p2Units = board.filter(c => c && c.owner === 2 && c.unitData).length;
        const opponentNameText = opponentDisplayName ? `(${opponentDisplayName}'s Turn)` : "(Opponent's Turn)";
        let turnText = gameState === 'GAMEOVER' ? "Game Over" : `Current Turn: Player ${currentPlayer} ${currentPlayer === localPlayerRole ? `(${localDisplayName}'s Turn)` : opponentNameText}`;
        const p1Name = localPlayerRole === 1 ? localDisplayName : (opponentDisplayName || 'Player 1');
        const p2Name = localPlayerRole === 2 ? localDisplayName : (opponentDisplayName || 'Player 2');

        infoDiv.innerHTML = `
            <span class="player1-text">${p1Name} Units: ${p1Units}</span> |
            <span class="${currentPlayer === 1 ? 'player1-text' : 'player2-text'}">${turnText}</span> |
            <span class="player2-text">${p2Name} Units: ${p2Units}</span>
         `;

        // Update Memo Toggle Button Text and Color (based on local player)
        if (memoButton) {
            memoButton.textContent = `${localDisplayName}'s Memo`; // Use local display name
            memoButton.style.backgroundColor = localPlayerRole === 1 ? '#4a90e2' : '#e94e77'; // Color based on local player role
        }
        // If memo pad is open, update its content for the local player
        const memoPopover = document.getElementById('memo-popover');
        if (memoPopover && window.getComputedStyle(memoPopover).display !== 'none') {
            displayMemoPadContent(); // Call without argument to update local player's memo
        }
    }

    // --- Common UI Updates (Cards, Defeated Area) ---
    const attackerCard = selectedCardIndex !== null ? board[selectedCardIndex] : null;

    board.forEach((card, i) => {
        if (!card || !card.element) return;

        const div = card.element;
        // Reset classes, handle owner potentially being null for empty spots
        div.className = `card player${card.owner || 0}`;
        // Remove state classes AND shift classes
        div.classList.remove(
            'selectable-initial', 'selectable-move', 'selectable-attack', 'not-selectable',
            'selected', 'hidden',
            'shifted-left', 'shifted-right', 'shifted-up', 'shifted-down'
        );
        div.style.zIndex = ''; // Reset z-index

        // Add hidden class based on board state (affects image via CSS)
        if (card.hidden) div.classList.add('hidden');
        if (i === selectedCardIndex) div.classList.add('selected');

        // --- Update Layer Visibility and Content ---
        const terrainLayer = div.querySelector('.terrain-layer');
        const unitLayer = div.querySelector('.unit-layer');
        const terrainImg = terrainLayer?.querySelector('img');
        const unitImg = unitLayer?.querySelector('img');
        // const fallbackDiv = div.querySelector('.fallback-content'); // TODO: Re-integrate fallback if needed

        if (terrainLayer && unitLayer && terrainImg && unitImg) {
            const terrainEdges = card.terrainData.terrainData;
            const terrainAltText = `Terrain [T:${terrainEdges.top}, R:${terrainEdges.right}, B:${terrainEdges.bottom}, L:${terrainEdges.left}]`;

            // Update Terrain Alt Text (always relevant)
            terrainImg.alt = terrainAltText;

            // Determine Unit Layer Visibility and Content
            if (card.hidden || !card.unitData) {
                // Hide Unit Layer
                if (!unitLayer.classList.contains('hidden-state')) {
                    unitLayer.classList.add('hidden-state');
                }
                // Ensure parent .card.hidden class is set if no unit (for potential other styling)
                if (!card.unitData && !div.classList.contains('hidden')) {
                     div.classList.add('hidden');
                }
            } else {
                // Show Unit Layer
                if (unitLayer.classList.contains('hidden-state')) {
                    unitLayer.classList.remove('hidden-state');
                }
                // Update Unit Alt Text (only relevant when shown)
                unitImg.alt = `Player ${card.owner} ${card.unitData.unitName} (A:${card.unitData.stats.attack} D:${card.unitData.stats.defense}) on ${terrainAltText}`;
                 // Ensure parent .card.hidden class is removed if unit is revealed
                if (div.classList.contains('hidden')) {
                    div.classList.remove('hidden');
                }
            }
            // Image sources (src) are set once in placeCard and assumed not to change.
            // If src could change (e.g., different unit images based on state), update here.

        } else {
             console.warn(`Card ID ${card.id} is missing expected layer elements.`);
             // Handle missing elements, maybe show an error state
             div.innerHTML = '<div style="color:red; font-size:10px;">Render Error</div>';
        }
        // --- End Layer Update ---


        // Determine Selectable State only during GAMEPLAY and if it's the local player's turn
        if (gameState === 'GAMEPLAY' && localPlayerRole === currentPlayer) {
            if (selectedCardIndex === null) { // Selecting initial unit
                // Check unitData exists and belongs to current player
                if (card.owner === currentPlayer && card.unitData) {
                    div.classList.add('selectable-initial');
                } else {
                    div.classList.add('not-selectable');
                }
            } else { // Unit selected, selecting target
                if (i === selectedCardIndex) {
                    div.classList.add('not-selectable'); // Can't target self, but allow deselect click
                } else {
                    const directionInfo = getDirectionInfo(attackerCard, card);
                    if (directionInfo && attackerCard.unitData) { // Is adjacent and attacker has unit
                        const entryTerrainType = card.terrainData.terrainData[directionInfo.opposite];
                        // Use attacker's unitData for traversal check
                        if (canUnitTraverse(attackerCard.unitData, entryTerrainType)) {
                            // Check if target has unitData
                            if (card.unitData === null || card.unitData === undefined) { // Empty, valid square
                                div.classList.add('selectable-move');
                            } else if (card.owner !== currentPlayer) { // Enemy unit
                                div.classList.add('selectable-attack');
                            } else { // Own unit
                                div.classList.add('not-selectable');
                            }
                        } else { // Invalid terrain edge
                            div.classList.add('not-selectable');
                        }
                    } else { // Not adjacent or attacker invalid
                        div.classList.add('not-selectable');
                    }
                }
            }
        } else { // Not player's turn or not gameplay phase
            div.classList.add('not-selectable');
        }
    });

    // --- Apply shifts to neighbors of selected card ---
    if (selectedCardIndex !== null && gameState === 'GAMEPLAY') {
        const selected = board[selectedCardIndex];
        if (selected && selected.element) {
            // Selected card z-index is handled by the .selected CSS rule now
            // selected.element.style.zIndex = '10'; // Ensure selected is on top

            const neighbors = [
                { dx: 1, dy: 0, shiftClass: 'shifted-right' }, // Right neighbor shifts right
                { dx: -1, dy: 0, shiftClass: 'shifted-left' },  // Left neighbor shifts left
                { dx: 0, dy: 1, shiftClass: 'shifted-down' }, // Bottom neighbor shifts down
                { dx: 0, dy: -1, shiftClass: 'shifted-up' }    // Top neighbor shifts up
            ];

            neighbors.forEach(n => {
                const neighborCard = findCardByGrid(selected.gridX + n.dx, selected.gridY + n.dy);
                // Apply shift ONLY if the neighbor card exists, has an element, AND has unitData
                if (neighborCard && neighborCard.element && neighborCard.unitData) {
                    // Find the unit layer within the neighbor's element
                    const neighborUnitLayer = neighborCard.element.querySelector('.unit-layer');
                    if (neighborUnitLayer) {
                        // Add the shift class to the unit layer, not the parent card
                        neighborUnitLayer.classList.add(n.shiftClass);
                    }
                }
            });
        }
    }
    // --- End Apply shifts ---

    // Update Defeated Units Area
    const defeatedDiv = document.getElementById('defeated-units');
    defeatedDiv.innerHTML = '<h4>Defeated Units</h4>';
    // defeatedUnits now contains objects { unitData, terrainData, owner }
    defeatedUnits.forEach(defeated => {
        const defeatedCardDiv = document.createElement('div');
        defeatedCardDiv.className = `defeated-card player${defeated.owner}`;

        const img = document.createElement('img');
        img.src = defeated.unitData.imagePath; // Use unit image path

        // Generate Alt Text for defeated card
        const unitName = defeated.unitData.unitName;
        const stats = defeated.unitData.stats;
        const terrainEdges = defeated.terrainData.terrainData;
        img.alt = `Defeated: Player ${defeated.owner} ${unitName} (A:${stats.attack} D:${stats.defense}) on Terrain [T:${terrainEdges.top}, R:${terrainEdges.right}, B:${terrainEdges.bottom}, L:${terrainEdges.left}]`;

        // Add error handler for fallback, passing the defeated data object
        img.onerror = () => window.handleImageError(img, defeated, 'defeated');

        defeatedCardDiv.appendChild(img);
        defeatedDiv.appendChild(defeatedCardDiv);
    });
}

function logMessage(msg) {
    document.getElementById('message-log').textContent = msg;
    console.log(msg); // Keep console logs for debugging
}

// --- Initialization ---
document.addEventListener("DOMContentLoaded", () => {
    // Initial UI state before connection attempt
    document.getElementById('info').textContent = 'Initializing Peer connection...';
    document.getElementById('peer-status').textContent = 'Initializing...';
    document.getElementById('connect-button').disabled = true;
    document.getElementById('peer-id-input').disabled = true;
    document.getElementById('disconnect-button').disabled = true;
    // Load saved display name
    const savedName = localStorage.getItem('foglineDisplayName');
    if (savedName) {
        localDisplayName = savedName;
        document.getElementById('display-name-input').value = savedName;
    } else {
        document.getElementById('display-name-input').value = localDisplayName; // Show default if none saved
    }

    // Add blur event listener for saving display name
    const displayNameInput = document.getElementById('display-name-input');

    displayNameInput.addEventListener('blur', () => {
        window.saveDisplayName()
    });

    updateUI(); // Set initial UI state (will reflect CONNECTING)

    initializePeer(); // Start the peer initialization process
});