// --- Constants (Consider moving to a shared constants module later) ---
const START_GRID_COORD = 10;
const TOTAL_CARD_PAIRS_TO_PLACE = 16; // 8 per player

// --- Helper Functions ---

// Fisher-Yates Shuffle (if needed internally, otherwise assume input is shuffled)
// Not strictly needed here as we consume pairs sequentially, but good utility
function shuffle(array) {
    let newArray = [...array];
    for (let i = newArray.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
    }
    return newArray;
}

// --- Core Auto-Placement Logic ---

/**
 * Generates a sequence of placement actions for all cards, simulating
 * turn-by-turn placement onto random valid adjacent spots.
 * Assumes input arrays contain the full, shuffled sets of unit/terrain data objects.
 * @param {Array} p1UnitsData - Array of Player 1's unitData objects.
 * @param {Array} p1TerrainsData - Array of Player 1's terrainData objects.
 * @param {Array} p2UnitsData - Array of Player 2's unitData objects.
 * @param {Array} p2TerrainsData - Array of Player 2's terrainData objects.
 * @param {number} startingCardId - The next available card ID.
 * @returns {Array|null} An array of placement action objects: { owner, unitData, terrainData, gridX, gridY, cardId }, or null on error.
 */
export function generateAutoPlacements(p1UnitsData, p1TerrainsData, p2UnitsData, p2TerrainsData, startingCardId) {
    const finalActions = [];
    const placedPositions = new Set();
    let currentCardId = startingCardId;

    // Create the initial pairings for each player based on the input order
    // (which should already be shuffled as per the game setup)
    const p1Pairs = p1UnitsData.map((unitData, i) => ({ owner: 1, unitData, terrainData: p1TerrainsData[i] }));
    const p2Pairs = p2UnitsData.map((unitData, i) => ({ owner: 2, unitData, terrainData: p2TerrainsData[i] }));

    // Simulate turn-by-turn placement
    for (let turn = 0; turn < TOTAL_CARD_PAIRS_TO_PLACE; turn++) {
        const currentPlayer = (turn % 2) + 1; // Player 1 on turn 0, 2, ... Player 2 on turn 1, 3, ...
        const currentPairsList = (currentPlayer === 1) ? p1Pairs : p2Pairs;
        const pairIndex = Math.floor(turn / 2); // Index within the player's pair list

        if (pairIndex >= currentPairsList.length) {
            console.error(`Auto-placement error: Ran out of pairs for Player ${currentPlayer} at turn ${turn}`);
            return null; // Indicate failure
        }

        const action = currentPairsList[pairIndex]; // Get the next pair for this player

        // 1. Determine valid placement spots
        const potentialSpots = new Set();
        if (placedPositions.size === 0) {
            potentialSpots.add(`${START_GRID_COORD}_${START_GRID_COORD}`);
        } else {
            placedPositions.forEach(posKey => {
                const [x, y] = posKey.split('_').map(Number);
                // Check adjacent spots (right, left, bottom, top)
                const neighbors = [
                    `${x + 1}_${y}`, `${x - 1}_${y}`,
                    `${x}_${y + 1}`, `${x}_${y - 1}`
                ];
                neighbors.forEach(neighborKey => {
                    // Add if it's not already occupied
                    if (!placedPositions.has(neighborKey)) {
                        potentialSpots.add(neighborKey);
                    }
                });
            });
        }

        if (potentialSpots.size === 0) {
            console.error(`Auto-placement failed: No potential spots found at turn ${turn}! Placed:`, placedPositions);
            return null; // Indicate failure
        }

        // 2. Choose a *random* spot from the available potential spots
        const potentialSpotsArray = Array.from(potentialSpots);
        const randomIndex = Math.floor(Math.random() * potentialSpotsArray.length);
        const chosenSpotKey = potentialSpotsArray[randomIndex];
        const [gridX, gridY] = chosenSpotKey.split('_').map(Number);

        // 3. Add position and card ID to the action
        const completedAction = {
            ...action,
            gridX: gridX,
            gridY: gridY,
            cardId: currentCardId++
        };
        finalActions.push(completedAction);

        // 4. Update placed positions for the next turn's calculation
        placedPositions.add(chosenSpotKey);
    }

    if (finalActions.length !== TOTAL_CARD_PAIRS_TO_PLACE) {
        console.warn(`Auto-placement generated ${finalActions.length} actions, expected ${TOTAL_CARD_PAIRS_TO_PLACE}.`);
        // This might indicate an issue, but return what we have
    }

    console.log("Generated Auto Placement Actions:", finalActions);
    return finalActions;
}