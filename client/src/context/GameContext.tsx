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
  QuestLog,
} from "@aetheria/shared";

/** A notification about game events (items, XP, level-up, quests) */
export interface GameNotification {
  id: string;
  type: "item_acquired" | "item_lost" | "xp_gained" | "level_up" | "quest_complete" | "quest_start";
  text: string;
  subtext?: string;
  color?: string;
}

/** Application view state */
export type AppView =
  | "landing"
  | "login"
  | "character_select"
  | "character_create"
  | "scenario_select"
  | "game_intro"
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
  questLog: QuestLog | null;
  notifications: GameNotification[];
  combatState: CombatantInfo | null;
  mood: SceneMood;
  journeyNarrative: string | null;
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
  | { type: "START_SESSION"; session: GameSession; turn: GameTurn; character?: Character; journeyNarrative?: string; questLog?: QuestLog | null }
  | { type: "ADD_TURN"; turn: GameTurn }
  | { type: "UPDATE_SESSION"; session: GameSession }
  | { type: "UPDATE_CHARACTER"; character: Character }
  | { type: "SET_INVENTORY"; inventory: Inventory }
  | { type: "SET_QUEST_LOG"; questLog: QuestLog | null }
  | { type: "PROCESS_EVENTS"; events: GameEvent[]; inventory: Inventory; character: Character; xpGained: number; diceRolls: DiceRoll[]; questLog?: QuestLog | null }
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
  view: "landing",
  user: null,
  characters: [],
  selectedCharacter: null,
  scenarios: [],
  session: null,
  turns: [],
  inventory: null,
  questLog: null,
  notifications: [],
  combatState: null,
  mood: "exploration",
  journeyNarrative: null,
  isLoading: false,
  error: null,
};

/* ------------------------------------------------------------------ */
/*  Session persistence via localStorage                               */
/* ------------------------------------------------------------------ */

const SESSION_KEY = "aetheria_session";

interface PersistedSession {
  user: User;
  session: GameSession;
  turns: GameTurn[];
  selectedCharacter: Character;
  combatState: CombatantInfo | null;
  mood: SceneMood;
  journeyNarrative: string | null;
}

function initState(initial: GameState): GameState {
  try {
    const userId = localStorage.getItem("aetheria_user_id");
    const saved = localStorage.getItem(SESSION_KEY);
    if (userId && saved) {
      const data = JSON.parse(saved) as PersistedSession;
      if (data.session && data.turns?.length > 0 && data.selectedCharacter && data.user) {
        return {
          ...initial,
          user: data.user,
          session: data.session,
          turns: data.turns,
          selectedCharacter: data.selectedCharacter,
          combatState: data.combatState ?? null,
          mood: data.mood ?? "exploration",
          journeyNarrative: data.journeyNarrative ?? null,
          view: "game",
        };
      }
    }
  } catch {
    try {
      localStorage.removeItem(SESSION_KEY);
    } catch {
      // Ignore - localStorage may be completely unavailable
    }
  }
  return initial;
}

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
        selectedCharacter: action.character ?? state.selectedCharacter,
        journeyNarrative: action.journeyNarrative ?? null,
        questLog: action.questLog ?? null,
        view: "game_intro",
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
    case "SET_QUEST_LOG":
      return { ...state, questLog: action.questLog };
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
          case "quest_complete":
            newNotifs.push({
              id: `${evt.turnId}_quest_complete_${ei}_${ts}`,
              type: "quest_complete",
              text: String(p.questTitle ?? "Quest"),
              subtext: "Quest abgeschlossen!",
              color: "#ffd43b",
            });
            break;
          case "quest_start":
            newNotifs.push({
              id: `${evt.turnId}_quest_start_${ei}_${ts}`,
              type: "quest_start",
              text: String(p.questTitle ?? "Neue Quest"),
              subtext: "Neue Quest erhalten!",
              color: "#339af0",
            });
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
        questLog: action.questLog ?? state.questLog,
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
      try {
        localStorage.removeItem(SESSION_KEY);
      } catch {
        // Ignore localStorage errors
      }
      return {
        ...state,
        session: null,
        turns: [],
        inventory: null,
        questLog: null,
        notifications: [],
        combatState: null,
        mood: "exploration",
        journeyNarrative: null,
        view: "character_select",
        error: null,
      };
    case "LOGOUT":
      try {
        localStorage.removeItem(SESSION_KEY);
        localStorage.removeItem("aetheria_user_id");
      } catch {
        // Ignore localStorage errors
      }
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
  const [state, dispatch] = useReducer(gameReducer, initialState, initState);

  // Apply mood to body for CSS theming
  useEffect(() => {
    document.body.setAttribute("data-mood", state.mood);
  }, [state.mood]);

  // Persist active session to localStorage (with size limits to avoid quota errors)
  useEffect(() => {
    if (state.session && state.selectedCharacter && state.user && state.view === "game") {
      // Only keep the last 5 turns to avoid localStorage quota issues
      // Strip large fields (imageUrl, imagePrompt) from older turns to save space
      const MAX_STORED_TURNS = 5;
      const turnsToStore = state.turns.slice(-MAX_STORED_TURNS).map((turn, idx, arr) => {
        // Keep full data only for the latest turn
        if (idx === arr.length - 1) return turn;
        // Strip large fields from older turns
        return {
          ...turn,
          imageUrl: undefined,
          imagePrompt: undefined,
        };
      });

      const data: PersistedSession = {
        user: state.user,
        session: state.session,
        turns: turnsToStore,
        selectedCharacter: state.selectedCharacter,
        combatState: state.combatState,
        mood: state.mood,
        journeyNarrative: state.journeyNarrative,
      };

      try {
        localStorage.setItem(SESSION_KEY, JSON.stringify(data));
      } catch (err) {
        // localStorage quota exceeded - clear old session data and continue
        // The game can still function without persistence
        console.warn("[GameContext] localStorage quota exceeded, clearing session cache:", err);
        try {
          localStorage.removeItem(SESSION_KEY);
        } catch {
          // Ignore errors when clearing
        }
      }
    }
  }, [state.session, state.turns, state.selectedCharacter, state.user, state.combatState, state.mood, state.journeyNarrative, state.view]);

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
