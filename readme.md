# 🎖️ Fogline  
*A Tactical War Game of Hidden Forces and Strategic Terrain*

**Fogline** is a two-player tactical battle game using only custom cards. It’s a spatial, fog-of-war strategy experience — no dice, no luck, just clever positioning, surprise reveals, and calculated attacks. Think *chess meets Stratego*, built entirely with cards.

---

## 🎯 Objective

Capture your opponent’s **Mobile Command** or eliminate all their other movable units. Outsmart your opponent with timing, terrain, and tactical reveals.

---

## 🧩 Components

Each player has an identical set of **16 cards**:

- **8 Unit Cards**  
  Each unit has:
  - **Attack** value (when attacking)
  - **Defense** value (when defending)
  - Movement restrictions (based on terrain type)

- **8 Terrain Cards**  
  Each terrain card has **four sides** (Top, Right, Bottom, Left), each displaying a terrain type represented by an emoji:
  - 🏞️ **Plains**: Open — all units can enter/exit via this edge.
  - 🌲 **Forest**: Only Infantry and Special Ops can enter/exit via this edge. Grants +1 Defense bonus to the unit on the card if attacked *from* this edge.
  - ⛰️ **Mountain**: Only Infantry and Special Ops can enter/exit via this edge. No defense bonus.

  Movement and combat depend on the specific terrain type on the **edge** being crossed or attacked from.

---

## 🗺️ The Terrain Cards

Both players use the exact same set of 8 terrain cards. The sides are listed in Top, Right, Bottom, Left order:

1.  🏞️ 🌲 🏞️ 🌲
2.  🏞️ ⛰️ 🏞️ ⛰️
3.  🌲 🏞️ 🌲 🏞️
4.  ⛰️ 🏞️ ⛰️ 🏞️
5.  🌲 🌲 🏞️ ⛰️
6.  ⛰️ ⛰️ 🏞️ 🌲
7.  🌲 ⛰️ 🌲 🏞️
8.  ⛰️ 🌲 ⛰️ 🏞️

*(Note: Every card has at least one Plains 🏞️ side, and no card is entirely Mountain ⛰️).*

---

## 🛠 Setup

1.  Players **take turns placing one of their unit/terrain pairs**:
    -   Place the **unit card face-down**.
    -   Cover it with one of their **terrain cards face-up**. The orientation is fixed (Top edge always points "up" relative to the board setup).
    -   The first card can be placed anywhere. Subsequent cards must touch another card already on the table **by one full side** (orthogonally, not diagonally).

2.  After 8 placements per player (16 total pairs), the **battlefield is ready**.

---

## 🔁 Turn Sequence

Players alternate turns. On your turn:

1.  **Select one of your units**. If it's face-down, it is revealed.
2.  **Choose an adjacent tile** (orthogonally) to:
    -   **Move** into (if the tile is empty AND your unit can enter via the connecting edge's terrain type), OR
    -   **Attack** (if the tile is occupied by an enemy unit AND your unit can enter via the connecting edge's terrain type).

3.  **Resolve Combat** (if attacking):
    -   Compare your unit's **Attack** vs. the enemy unit's **Defense**.
    -   Add terrain bonus: If the terrain on the defender's edge *facing the attacker* is 🌲 Forest, the defender gets +1 Defense.
    -   **Defender wins ties**.

4.  **Remove the defeated unit**. If the attacker won, move the attacking unit into the now-empty tile.

---

## 🚫 Movement Rules

-   Only **orthogonal** movement (no diagonals).
-   Movement into an adjacent tile is only possible if the unit type is allowed to traverse the terrain type on the **destination tile's edge** that connects to the starting tile.
    -   *Example:* To move Right into a tile, the unit must be allowed to enter the terrain type shown on the **Left edge** of the destination tile.
-   Units cannot stack on the same tile.
-   Once revealed, units stay face-up.

---

## 🏁 Victory

You win by either:

✅ Capturing the **enemy Mobile Command**, or
✅ Eliminating all other **movable enemy units** (excluding the Mobile Command).

---

## 📋 Units Summary

| Unit            | Qty | Attack | Defense | Can Traverse Edge Type |
|-----------------|-----|--------|---------|------------------------|
| Mobile Command  | 1   | 1      | 2       | 🏞️ Plains              |
| Tank            | 2   | 4      | 4       | 🏞️ Plains              |
| Infantry        | 3   | 3      | 3       | 🏞️ Plains, 🌲 Forest, ⛰️ Mountain |
| Artillery       | 1   | 5      | 1       | 🏞️ Plains              |
| Special Ops     | 1   | 3      | 1       | 🏞️ Plains, 🌲 Forest, ⛰️ Mountain |

---

## 🧠 Strategic Notes

-   **Bluffing is key**: Hide powerful units under terrain cards whose edges might suggest weaker units or restricted access.
-   **Control movement lanes**: Use the terrain edges strategically to block enemy movement or create safe paths for your units.
-   **Reveal wisely**: Once revealed, units stay exposed. Time your reveals carefully.
-   **Trade effectively**: Each unit is precious — consider the terrain interactions before attacking.

---

## 🔄 Example Turn

> 🎮 Player 1 reveals an Infantry (3 Att) on a tile.
> 👉 Selects an adjacent enemy-occupied tile to the Right. The **Left edge** of the target tile shows 🌲 Forest. Infantry can traverse Forest.
> 🕵️ The target tile is revealed: enemy Tank (4 Def). The attack is initiated *from* the Left towards the Right.
> 🌲 The **Left edge** of the defender's tile (where the attack is coming from) is Forest 🌲. Defender gets +1 Defense.
> 💥 Combat: Infantry (3 Att) vs Tank (4 Def + 1 Bonus = 5 Def).
> 🛡️ Defender wins! The attacking Infantry is removed. The Tank remains.

---

### 🔚 The Fog Clears

Every card placement, movement, and reveal in **Fogline** shifts the shape of battle. Victory belongs to the player who sees through the fog — and hides best within it.