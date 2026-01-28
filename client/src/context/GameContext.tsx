import React, { createContext, useContext, useReducer, useEffect } from "react";
import type {
  User,
  Character,
  GameSession,
  GameTurn,
  Inventory,
  SceneMood,
  ScenarioTemplate,
} from "@aetheria/shared";

/** Application view state */
export type AppView =
  | "login"
  | "character_select"
  | "character_create"
  | "scenario_select"
  | "game"
  | "inventory";

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
  | { type: "SET_INVENTORY"; inventory: Inventory }
  | { type: "SET_MOOD"; mood: SceneMood }
  | { type: "SET_LOADING"; isLoading: boolean }
  | { type: "SET_ERROR"; error: string | null }
  | { type: "LOGOUT" };

const initialState: GameState = {
  view: "login",
  user: null,
  characters: [],
  selectedCharacter: null,
  scenarios: [],
  session: null,
  turns: [],
  inventory: null,
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
    case "SET_INVENTORY":
      return { ...state, inventory: action.inventory };
    case "SET_MOOD":
      return { ...state, mood: action.mood };
    case "SET_LOADING":
      return { ...state, isLoading: action.isLoading };
    case "SET_ERROR":
      return { ...state, error: action.error, isLoading: false };
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
