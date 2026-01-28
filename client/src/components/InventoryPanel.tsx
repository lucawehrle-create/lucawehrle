import React, { useEffect } from "react";
import { useGame } from "../context/GameContext.js";
import { getInventory } from "../services/api.js";
import type { Item, ItemRarity } from "@aetheria/shared";
import styles from "./InventoryPanel.module.css";

const RARITY_COLORS: Record<ItemRarity, string> = {
  common: "#adb5bd",
  uncommon: "#51cf66",
  rare: "#339af0",
  epic: "#b197fc",
  legendary: "#ffd43b",
  artifact: "#ff6b6b",
};

interface InventoryPanelProps {
  onClose: () => void;
}

export function InventoryPanel({ onClose }: InventoryPanelProps) {
  const { state, dispatch } = useGame();

  useEffect(() => {
    if (state.selectedCharacter && !state.inventory) {
      getInventory(state.selectedCharacter.id).then((result) => {
        if (result.success && result.data) {
          dispatch({ type: "SET_INVENTORY", inventory: result.data });
        }
      });
    }
  }, [state.selectedCharacter, state.inventory, dispatch]);

  const inventory = state.inventory;

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <h3 className={styles.title}>Inventory</h3>
        <button className={styles.closeButton} onClick={onClose}>
          Close
        </button>
      </div>

      {inventory && (
        <>
          <div className={styles.goldBar}>
            <span className={styles.goldIcon}>Gold</span>
            <span className={styles.goldAmount}>{inventory.gold}</span>
          </div>

          <div className={styles.slotInfo}>
            {inventory.items.length} / {inventory.maxSlots} slots used
          </div>

          <div className={styles.itemList}>
            {inventory.items.length === 0 ? (
              <p className={styles.emptyMessage}>
                Your bags are empty. Discover items in your adventure or scan real-world objects!
              </p>
            ) : (
              inventory.items.map((item) => (
                <ItemCard key={item.id} item={item} />
              ))
            )}
          </div>
        </>
      )}

      {!inventory && (
        <p className={styles.emptyMessage}>Loading inventory...</p>
      )}
    </div>
  );
}

function ItemCard({ item }: { item: Item }) {
  const rarityColor = RARITY_COLORS[item.rarity];

  return (
    <div className={styles.itemCard} style={{ borderLeftColor: rarityColor }}>
      <div className={styles.itemHeader}>
        <span className={styles.itemName} style={{ color: rarityColor }}>
          {item.name}
        </span>
        <span className={styles.itemCategory}>{item.category}</span>
      </div>
      <p className={styles.itemDesc}>{item.description}</p>
      <div className={styles.itemMeta}>
        <span className={styles.rarity} style={{ color: rarityColor }}>
          {item.rarity}
        </span>
        {item.scanData && <span className={styles.scannedBadge}>Scanned</span>}
        <span className={styles.itemValue}>{item.properties.value}g</span>
      </div>
      {item.properties.effects.length > 0 && (
        <div className={styles.effects}>
          {item.properties.effects.map((effect, i) => (
            <span key={i} className={styles.effect}>
              {effect.description}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
