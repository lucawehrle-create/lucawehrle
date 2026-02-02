import React, { useEffect, useState } from "react";
import { useGame } from "../context/GameContext.js";
import { getInventory, discardItem } from "../services/api.js";
import type { Item, ItemRarity, ItemCategory } from "@aetheria/shared";
import styles from "./InventoryPanel.module.css";

const RARITY_COLORS: Record<ItemRarity, string> = {
  common: "#adb5bd",
  uncommon: "#51cf66",
  rare: "#339af0",
  epic: "#b197fc",
  legendary: "#ffd43b",
  artifact: "#ff6b6b",
};

const RARITY_LABELS: Record<ItemRarity, string> = {
  common: "Gewoehnlich",
  uncommon: "Ungewoehnlich",
  rare: "Selten",
  epic: "Episch",
  legendary: "Legendaer",
  artifact: "Artefakt",
};

const CATEGORY_LABELS: Record<ItemCategory, string> = {
  weapon: "Waffe",
  armor: "Ruestung",
  potion: "Trank",
  scroll: "Schriftrolle",
  key: "Schluessel",
  quest: "Quest",
  material: "Material",
  food: "Nahrung",
  tool: "Werkzeug",
  scanned_object: "Gescannt",
};

interface InventoryPanelProps {
  onClose: () => void;
}

const RARITY_ORDER: Record<string, number> = {
  artifact: 0,
  legendary: 1,
  epic: 2,
  rare: 3,
  uncommon: 4,
  common: 5,
};

const CATEGORY_ICONS: Record<string, string> = {
  weapon: "\u2694\uFE0F",
  armor: "\uD83D\uDEE1\uFE0F",
  potion: "\uD83E\uDDEA",
  scroll: "\uD83D\uDCDC",
  key: "\uD83D\uDD11",
  quest: "\u2B50",
  material: "\uD83D\uDC8E",
  food: "\uD83C\uDF56",
  tool: "\uD83D\uDD27",
  scanned_object: "\uD83D\uDCF7",
};

type SortMode = "rarity" | "name" | "value";

export function InventoryPanel({ onClose }: InventoryPanelProps) {
  const { state, dispatch } = useGame();
  const [filterCategory, setFilterCategory] = useState<string | null>(null);
  const [sortMode, setSortMode] = useState<SortMode>("rarity");

  useEffect(() => {
    if (state.selectedCharacter && !state.inventory) {
      getInventory(state.selectedCharacter.id).then((result) => {
        if (result.success && result.data) {
          dispatch({ type: "SET_INVENTORY", inventory: result.data });
        }
      });
    }
  }, [state.selectedCharacter, state.inventory, dispatch]);

  const handleDiscard = async (itemId: string) => {
    if (!state.selectedCharacter) return;
    const result = await discardItem(state.selectedCharacter.id, itemId);
    if (result.success && result.data) {
      dispatch({ type: "SET_INVENTORY", inventory: result.data });
    }
  };

  const inventory = state.inventory;

  // Compute available categories from items
  const categories = inventory
    ? [...new Set(inventory.items.map((i) => i.category))]
    : [];

  // Filter and sort items
  const displayItems = inventory
    ? inventory.items
        .filter((item) => !filterCategory || item.category === filterCategory)
        .sort((a, b) => {
          if (sortMode === "rarity") return (RARITY_ORDER[a.rarity] ?? 5) - (RARITY_ORDER[b.rarity] ?? 5);
          if (sortMode === "name") return a.name.localeCompare(b.name);
          return (b.properties.value ?? 0) - (a.properties.value ?? 0);
        })
    : [];

  const cycleSortMode = () => {
    setSortMode((prev) =>
      prev === "rarity" ? "name" : prev === "name" ? "value" : "rarity"
    );
  };

  const sortLabels: Record<SortMode, string> = {
    rarity: "Seltenheit",
    name: "Name",
    value: "Wert",
  };

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <h3 className={styles.title}>Inventar</h3>
        <button className={styles.closeButton} onClick={onClose}>
          Schliessen
        </button>
      </div>

      {inventory && (
        <>
          <div className={styles.goldBar}>
            <span className={styles.goldIcon}>Gold</span>
            <span className={styles.goldAmount}>{inventory.gold}</span>
          </div>

          <div className={styles.slotInfo}>
            <span>{inventory.items.length} / {inventory.maxSlots} Plaetze belegt</span>
            {inventory.items.length >= inventory.maxSlots && (
              <span className={styles.fullBadge}>VOLL</span>
            )}
          </div>

          {/* Filter + Sort bar */}
          {inventory.items.length > 0 && (
            <div className={styles.filterBar}>
              <div className={styles.filterTabs}>
                <button
                  className={`${styles.filterTab} ${!filterCategory ? styles.filterTabActive : ""}`}
                  onClick={() => setFilterCategory(null)}
                >
                  Alle
                </button>
                {categories.map((cat) => (
                  <button
                    key={cat}
                    className={`${styles.filterTab} ${filterCategory === cat ? styles.filterTabActive : ""}`}
                    onClick={() => setFilterCategory(filterCategory === cat ? null : cat)}
                    title={CATEGORY_LABELS[cat] ?? cat}
                  >
                    {CATEGORY_ICONS[cat] ?? "?"}{" "}
                    <span className={styles.filterCount}>
                      {inventory.items.filter((i) => i.category === cat).length}
                    </span>
                  </button>
                ))}
              </div>
              <button className={styles.sortButton} onClick={cycleSortMode}>
                {"\u2195"} {sortLabels[sortMode]}
              </button>
            </div>
          )}

          <div className={styles.itemList}>
            {displayItems.length === 0 && inventory.items.length > 0 ? (
              <p className={styles.emptyMessage}>
                Keine Gegenstaende in dieser Kategorie.
              </p>
            ) : displayItems.length === 0 ? (
              <p className={styles.emptyMessage}>
                Dein Inventar ist leer. Entdecke Gegenstaende auf deinem Abenteuer oder scanne reale Objekte!
              </p>
            ) : (
              displayItems.map((item) => (
                <ItemCard key={item.id} item={item} onDiscard={handleDiscard} />
              ))
            )}
          </div>
        </>
      )}

      {!inventory && (
        <p className={styles.emptyMessage}>Inventar wird geladen...</p>
      )}
    </div>
  );
}

function ItemCard({ item, onDiscard }: { item: Item; onDiscard: (id: string) => void }) {
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const rarityColor = RARITY_COLORS[item.rarity];

  return (
    <div
      className={`${styles.itemCard} ${expanded ? styles.itemCardExpanded : ""}`}
      style={{ borderLeftColor: rarityColor }}
      onClick={() => setExpanded(!expanded)}
    >
      <div className={styles.itemRow}>
        {/* Item image */}
        {item.imageUrl ? (
          <img
            src={item.imageUrl}
            alt={item.name}
            className={styles.itemImage}
          />
        ) : (
          <div className={styles.itemImagePlaceholder} style={{ borderColor: rarityColor }}>
            {CATEGORY_ICONS[item.category] ?? CATEGORY_LABELS[item.category]?.[0] ?? "?"}
          </div>
        )}

        <div className={styles.itemDetails}>
          <div className={styles.itemHeader}>
            <span className={styles.itemName} style={{ color: rarityColor }}>
              {item.name}
            </span>
            <span className={styles.itemCategory}>
              {CATEGORY_LABELS[item.category] ?? item.category}
            </span>
          </div>
          <p className={`${styles.itemDesc} ${expanded ? styles.itemDescExpanded : ""}`}>
            {item.description}
          </p>
          <div className={styles.itemMeta}>
            <span className={styles.rarity} style={{ color: rarityColor }}>
              {RARITY_LABELS[item.rarity] ?? item.rarity}
            </span>
            {item.scanData && <span className={styles.scannedBadge}>Gescannt</span>}
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
      </div>

      {/* Discard action (only visible when expanded) */}
      {expanded && (
        <div className={styles.itemActions} onClick={(e) => e.stopPropagation()}>
          {confirmDiscard ? (
            <div className={styles.confirmRow}>
              <span className={styles.confirmText}>Wegwerfen?</span>
              <button
                className={styles.confirmYes}
                onClick={() => { onDiscard(item.id); setConfirmDiscard(false); }}
              >
                Ja
              </button>
              <button
                className={styles.confirmNo}
                onClick={() => setConfirmDiscard(false)}
              >
                Nein
              </button>
            </div>
          ) : (
            <button
              className={styles.discardButton}
              onClick={() => setConfirmDiscard(true)}
              title="Gegenstand wegwerfen"
            >
              Wegwerfen
            </button>
          )}
        </div>
      )}
    </div>
  );
}
