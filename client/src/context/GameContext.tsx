import React, { createContext, useContext, useReducer, useEffect } from "react";
import type {
  User,
  Character,
  GameSession,
  GameTurn,
  Inventory,
  SceneMood,
  ScenarioTemplate,
  GameEvent,
  DiceRoll,
  CombatantInfo,
} from "@aetheria/shared";

/** A notification about game events (items, XP, level-up) */
export interface GameNotification {
  id: string;
  type: "item_acquired" | "item_lost" | "xp_gained" | "level_up";
  text: string;
  subtext?: string;
  color?: string;
}

/** Application view state */
export type AppView =
  | "login"
  | "character_select"
  | "character_create"
  | "scenario_select"
  | "game"
  | "inventory"
  | "settings";

/** Full application state */
export interface GameState {
  view: AppView;
  user: User | null;
  characters: Character[];
  selectedCharacter: Character | null;
  scenarios: ScenarioTemplate[];
  session: GameSession | null;
  turns: GameTurn[];
  inventory: Inventory | null;
  notifications: GameNotification[];
  combatState: CombatantInfo | null;
  mood: SceneMood;
  isLoading: boolean;
  error: string | null;
}

/** State actions */
export type GameAction =
  | { type: "SET_VIEW"; view: AppView }
  | { type: "SET_USER"; user: User }
  | { type: "SET_CHARACTERS"; characters: Character[] }
  | { type: "SELECT_CHARACTER"; character: Character }
  | { type: "SET_SCENARIOS"; scenarios: ScenarioTemplate[] }
  | { type: "START_SESSION"; session: GameSession; turn: GameTurn }
  | { type: "ADD_TURN"; turn: GameTurn }
  | { type: "UPDATE_SESSION"; session: GameSession }
  | { type: "UPDATE_CHARACTER"; character: Character }
  | { type: "SET_INVENTORY"; inventory: Inventory }
  | { type: "PROCESS_EVENTS"; events: GameEvent[]; inventory: Inventory; character: Character; xpGained: number; diceRolls: DiceRoll[] }
  | { type: "DISMISS_NOTIFICATION"; id: string }
  | { type: "SET_MOOD"; mood: SceneMood }
  | { type: "SET_LOADING"; isLoading: boolean }
  | { type: "SET_ERROR"; error: string | null }
  | { type: "LEAVE_GAME" }
  | { type: "LOGOUT" };

const RARITY_COLORS: Record<string, string> = {
  common: "#adb5bd",
  uncommon: "#51cf66",
  rare: "#339af0",
  epic: "#b197fc",
  legendary: "#ffd43b",
  artifact: "#ff6b6b",
};

const initialState: GameState = {
  view: "login",
  user: null,
  characters: [],
  selectedCharacter: null,
  scenarios: [],
  session: null,
  turns: [],
  inventory: null,
  notifications: [],
  combatState: null,
  mood: "exploration",
  isLoading: false,
  error: null,
};

function gameReducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case "SET_VIEW":
      return { ...state, view: action.view, error: null };
    case "SET_USER":
      return { ...state, user: action.user };
    case "SET_CHARACTERS":
      return { ...state, characters: action.characters };
    case "SELECT_CHARACTER":
      return { ...state, selectedCharacter: action.character };
    case "SET_SCENARIOS":
      return { ...state, scenarios: action.scenarios };
    case "START_SESSION":
      return {
        ...state,
        session: action.session,
        turns: [action.turn],
        mood: action.turn.mood,
        view: "game",
      };
    case "ADD_TURN":
      return {
        ...state,
        turns: [...state.turns, action.turn],
        mood: action.turn.mood,
      };
    case "UPDATE_SESSION":
      return { ...state, session: action.session };
    case "UPDATE_CHARACTER":
      return { ...state, selectedCharacter: action.character };
    case "SET_INVENTORY":
      return { ...state, inventory: action.inventory };
    case "PROCESS_EVENTS": {
      // Single-pass: process notifications, combat state, and damage together
      const newNotifs: GameNotification[] = [];
      let newCombatState = state.combatState;
      const ts = Date.now();

      for (let ei = 0; ei < action.events.length; ei++) {
        const evt = action.events[ei];
        const p = evt.payload as Record<string, unknown>;
        switch (evt.type) {
          case "item_acquired":
            newNotifs.push({
              id: `${evt.turnId}_acq_${ei}_${ts}`,
              type: "item_acquired",
              text: String(p.name ?? "Gegenstand"),
              subtext: "Gegenstand erhalten",
              color: RARITY_COLORS[String(p.rarity ?? "common")] ?? "#adb5bd",
            });
            break;
          case "item_lost":
            newNotifs.push({
              id: `${evt.turnId}_lost_${ei}_${ts}`,
              type: "item_lost",
              text: String(p.name ?? "Gegenstand"),
              subtext: "Gegenstand verloren",
              color: "#dc3545",
            });
            break;
          case "level_up":
            newNotifs.push({
              id: `${evt.turnId}_levelup_${ts}`,
              type: "level_up",
              text: `Stufe ${p.newLevel}!`,
              subtext: "Aufgestiegen!",
              color: "#ffd43b",
            });
            break;
          case "combat_start":
            newCombatState = {
              name: String(p.enemy ?? "Gegner"),
              hp: Number(p.enemyHp ?? 30),
              maxHp: Number(p.enemyMaxHp ?? 30),
              ac: Number(p.enemyAc ?? 15),
            };
            break;
          case "combat_end":
            newCombatState = null;
            break;
        }
      }

      // XP notification
      if (action.xpGained > 0) {
        const turnId = action.events[0]?.turnId ?? "turn";
        newNotifs.unshift({
          id: `${turnId}_xp_${action.xpGained}_${ts}`,
          type: "xp_gained",
          text: `+${action.xpGained} XP`,
          color: "#51cf66",
        });
      }

      // Apply damage from dice rolls to enemy HP
      if (newCombatState) {
        let totalDamage = 0;
        for (const roll of action.diceRolls) {
          const purposeLower = roll.purpose.toLowerCase();
          if ((purposeLower.includes("damage") || purposeLower.includes("schaden")) && roll.total > 0) {
            totalDamage += roll.total;
          }
        }
        if (totalDamage > 0) {
          newCombatState = {
            ...newCombatState,
            hp: Math.max(0, newCombatState.hp - totalDamage),
          };
        }
      }

      return {
        ...state,
        inventory: action.inventory,
        selectedCharacter: action.character,
        notifications: [...state.notifications, ...newNotifs],
        combatState: newCombatState,
      };
    }
    case "DISMISS_NOTIFICATION":
      return {
        ...state,
        notifications: state.notifications.filter((n) => n.id !== action.id),
      };
    case "SET_MOOD":
      return { ...state, mood: action.mood };
    case "SET_LOADING":
      return { ...state, isLoading: action.isLoading };
    case "SET_ERROR":
      return { ...state, error: action.error, isLoading: false };
    case "LEAVE_GAME":
      return {
        ...state,
        session: null,
        turns: [],
        inventory: null,
        notifications: [],
        combatState: null,
        mood: "exploration",
        view: "character_select",
        error: null,
      };
    case "LOGOUT":
      localStorage.removeItem("aetheria_user_id");
      return { ...initialState };
    default:
      return state;
  }
}

interface GameContextValue {
  state: GameState;
  dispatch: React.Dispatch<GameAction>;
}

const GameContext = createContext<GameContextValue | null>(null);

export function GameProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(gameReducer, initialState);

  // Apply mood to body for CSS theming
  useEffect(() => {
    document.body.setAttribute("data-mood", state.mood);
  }, [state.mood]);

  return (
    <GameContext.Provider value={{ state, dispatch }}>
      {children}
    </GameContext.Provider>
  );
}

export function useGame(): GameContextValue {
  const context = useContext(GameContext);
  if (!context) {
    throw new Error("useGame must be used within a GameProvider");
  }
  return context;
}
