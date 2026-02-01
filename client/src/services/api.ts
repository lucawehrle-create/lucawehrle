import type {
  ApiResponse,
  User,
  Character,
  GameSession,
  GameTurn,
  ScenarioTemplate,
  Inventory,
  GameEvent,
  Item,
  CreateCharacterRequest,
  CreateSessionRequest,
  SubmitActionRequest,
  ScanObjectRequest,
  CreateScenarioRequest,
  EnergyCosts,
  ObjectScanResponse,
} from "@aetheria/shared";

const API_BASE = "/api";

async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...((options.headers as Record<string, string>) ?? {}),
  };

  // Include user ID if available
  const userId = localStorage.getItem("aetheria_user_id");
  if (userId) {
    headers["x-user-id"] = userId;
  }

  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });

  return response.json() as Promise<ApiResponse<T>>;
}

// --- User API ---

export async function registerUser(
  username: string,
  email: string
): Promise<ApiResponse<User>> {
  const result = await request<User>("/users", {
    method: "POST",
    body: JSON.stringify({ username, email }),
  });
  if (result.success && result.data) {
    localStorage.setItem("aetheria_user_id", result.data.id);
  }
  return result;
}

export async function getUser(userId: string): Promise<ApiResponse<User>> {
  return request<User>(`/users/${userId}`);
}

export async function purchaseEnergy(
  userId: string,
  energyAmount: number
): Promise<ApiResponse<User>> {
  return request<User>(`/users/${userId}/energy/purchase`, {
    method: "POST",
    body: JSON.stringify({ energyAmount }),
  });
}

export async function getEnergyCosts(
  userId: string
): Promise<ApiResponse<EnergyCosts>> {
  return request<EnergyCosts>(`/users/${userId}/energy/costs`);
}

// --- Character API ---

export async function createCharacter(
  userId: string,
  data: CreateCharacterRequest
): Promise<ApiResponse<Character>> {
  return request<Character>(`/users/${userId}/characters`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function getCharacters(
  userId: string
): Promise<ApiResponse<Character[]>> {
  return request<Character[]>(`/users/${userId}/characters`);
}

// --- Game API ---

export async function getScenarios(): Promise<ApiResponse<ScenarioTemplate[]>> {
  return request<ScenarioTemplate[]>("/scenarios");
}

export async function createSession(
  data: CreateSessionRequest
): Promise<ApiResponse<{ session: GameSession; turn: GameTurn }>> {
  return request<{ session: GameSession; turn: GameTurn }>("/game/sessions", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function getSession(
  sessionId: string
): Promise<ApiResponse<{ session: GameSession; turns: GameTurn[] }>> {
  return request<{ session: GameSession; turns: GameTurn[] }>(
    `/game/sessions/${sessionId}`
  );
}

export async function submitAction(
  sessionId: string,
  action: SubmitActionRequest["action"]
): Promise<ApiResponse<{ turn: GameTurn; events: GameEvent[]; inventory: Inventory; character: Character; xpGained: number }>> {
  return request<{ turn: GameTurn; events: GameEvent[]; inventory: Inventory; character: Character; xpGained: number }>(
    `/game/sessions/${sessionId}/action`,
    {
      method: "POST",
      body: JSON.stringify({ sessionId, action }),
    }
  );
}

export async function scanObject(
  sessionId: string,
  imageData: string,
  format: "base64" | "url"
): Promise<ApiResponse<{ item: Item; analysis: ObjectScanResponse }>> {
  return request<{ item: Item; analysis: ObjectScanResponse }>(
    `/game/sessions/${sessionId}/scan`,
    {
      method: "POST",
      body: JSON.stringify({ sessionId, imageData, format }),
    }
  );
}

export async function getInventory(
  characterId: string
): Promise<ApiResponse<Inventory>> {
  return request<Inventory>(`/game/inventory/${characterId}`);
}

export async function discardItem(
  characterId: string,
  itemId: string
): Promise<ApiResponse<Inventory>> {
  return request<Inventory>(`/game/inventory/${characterId}/items/${itemId}`, {
    method: "DELETE",
  });
}

export async function getTurnImage(
  sessionId: string,
  turnId: string
): Promise<ApiResponse<{ imageUrl: string | null }>> {
  return request<{ imageUrl: string | null }>(
    `/game/sessions/${sessionId}/turns/${turnId}/image`
  );
}
