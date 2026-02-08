import { useState, useMemo } from "react";
import { useGame } from "../context/GameContext.js";
import { createSession } from "../services/api.js";
import type { ScenarioTemplate } from "@aetheria/shared";
import styles from "./ScenarioSelect.module.css";

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const GENRE_META: Record<string, { label: string; icon: string; color: string }> = {
  fantasy: { label: "Fantasy", icon: "\u2694\uFE0F", color: "#51cf66" },
  horror: { label: "Horror", icon: "\uD83D\uDC80", color: "#dc3545" },
  scifi: { label: "Sci-Fi", icon: "\uD83D\ude80", color: "#4dabf7" },
  mystery: { label: "Mysterium", icon: "\uD83D\uDD0D", color: "#b197fc" },
  comedy: { label: "Komoedie", icon: "\uD83C\uDFAD", color: "#ffd43b" },
};

const DIFFICULTY_META: Record<string, { label: string; stars: number; color: string; description: string }> = {
  easy: { label: "Anfaenger", stars: 1, color: "#51cf66", description: "Ideal fuer Einsteiger" },
  medium: { label: "Abenteurer", stars: 2, color: "#ffd43b", description: "Ausgewogene Herausforderung" },
  hard: { label: "Veteran", stars: 3, color: "#ff922b", description: "Fuer erfahrene Spieler" },
  legendary: { label: "Legendaer", stars: 4, color: "#dc3545", description: "Nur fuer die Tapfersten" },
};

const CLASS_ICONS: Record<string, string> = {
  warrior: "\u2694\uFE0F",
  mage: "\uD83D\uDD2E",
  rogue: "\uD83D\uDDE1\uFE0F",
  cleric: "\u2728",
  ranger: "\uD83C\uDFF9",
  bard: "\uD83C\uDFB5",
  paladin: "\uD83D\uDEE1\uFE0F",
};

type GenreFilter = "all" | "fantasy" | "horror" | "scifi" | "mystery" | "comedy";
type DifficultyFilter = "all" | "easy" | "medium" | "hard" | "legendary";
type SortOption = "title" | "difficulty" | "genre";

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function ScenarioSelect() {
  const { state, dispatch } = useGame();
  const character = state.selectedCharacter;

  const [genreFilter, setGenreFilter] = useState<GenreFilter>("all");
  const [difficultyFilter, setDifficultyFilter] = useState<DifficultyFilter>("all");
  const [sortBy, setSortBy] = useState<SortOption>("title");
  const [searchQuery, setSearchQuery] = useState("");
  const [hoveredCard, setHoveredCard] = useState<string | null>(null);

  /* -- Filtering & sorting -- */
  const filteredScenarios = useMemo(() => {
    let result = [...state.scenarios];

    if (genreFilter !== "all") {
      result = result.filter((s) => s.genre === genreFilter);
    }
    if (difficultyFilter !== "all") {
      result = result.filter((s) => s.difficulty === difficultyFilter);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (s) =>
          s.title.toLowerCase().includes(q) ||
          s.description.toLowerCase().includes(q) ||
          s.tags.some((t) => t.toLowerCase().includes(q)),
      );
    }

    result.sort((a, b) => {
      if (sortBy === "title") return a.title.localeCompare(b.title, "de");
      if (sortBy === "difficulty") {
        const order = ["easy", "medium", "hard", "legendary"];
        return order.indexOf(a.difficulty) - order.indexOf(b.difficulty);
      }
      return a.genre.localeCompare(b.genre);
    });

    return result;
  }, [state.scenarios, genreFilter, difficultyFilter, sortBy, searchQuery]);

  /* -- Featured scenario: hardest available -- */
  const featured = useMemo(() => {
    const order = ["legendary", "hard", "medium", "easy"];
    for (const diff of order) {
      const match = state.scenarios.find((s) => s.difficulty === diff);
      if (match) return match;
    }
    return state.scenarios[0] ?? null;
  }, [state.scenarios]);

  /* -- Handlers -- */
  async function handleSelectScenario(scenario: ScenarioTemplate) {
    if (!character) return;
    dispatch({ type: "SET_LOADING", isLoading: true });

    const result = await createSession({
      characterId: character.id,
      scenarioId: scenario.id,
    });

    if (result.success && result.data) {
      dispatch({
        type: "START_SESSION",
        session: result.data.session,
        turn: result.data.turn,
        character: result.data.character,
        journeyNarrative: result.data.journeyNarrative,
        questLog: result.data.questLog,
      });
    } else {
      dispatch({ type: "SET_ERROR", error: result.error?.message ?? "Sitzung konnte nicht gestartet werden" });
    }
    dispatch({ type: "SET_LOADING", isLoading: false });
  }

  function handleRandomScenario() {
    const pool = filteredScenarios.length > 0 ? filteredScenarios : state.scenarios;
    if (pool.length === 0) return;
    const random = pool[Math.floor(Math.random() * pool.length)];
    handleSelectScenario(random);
  }

  function renderStars(count: number) {
    return Array.from({ length: 4 }, (_, i) => (
      <span
        key={i}
        className={i < count ? styles.starFilled : styles.starEmpty}
      >
        {"\u2605"}
      </span>
    ));
  }

  const genreCountMap = useMemo(() => {
    const map: Record<string, number> = {};
    for (const s of state.scenarios) {
      map[s.genre] = (map[s.genre] ?? 0) + 1;
    }
    return map;
  }, [state.scenarios]);

  /* ---------------------------------------------------------------- */
  /*  Render                                                           */
  /* ---------------------------------------------------------------- */

  return (
    <div className={styles.page}>
      {/* Ambient background */}
      <div className={styles.ambientBg}>
        <div className={styles.ambientOrb1} />
        <div className={styles.ambientOrb2} />
      </div>

      {/* Navigation */}
      <nav className={styles.nav}>
        <div className={styles.navLeft}>
          <button
            className={styles.backBtn}
            onClick={() => dispatch({ type: "SET_VIEW", view: "character_select" })}
          >
            {"\u2190"}
          </button>
          <div className={styles.logo}>
            <span className={styles.logoIcon}>{"\u2728"}</span>
            <span className={styles.logoText}>Aetheria AI</span>
          </div>
        </div>
        <div className={styles.navRight}>
          {state.user && <span className={styles.username}>{state.user.username}</span>}
          <button
            className={styles.iconBtn}
            onClick={() => dispatch({ type: "SET_VIEW", view: "settings" })}
            title="Einstellungen"
          >
            {"\u2699"}
          </button>
        </div>
      </nav>

      {/* Hero: Character + Heading */}
      <section className={styles.hero}>
        <div className={styles.heroContent}>
          <div className={styles.heroBadge}>
            <span>{"\uD83C\uDFAF"}</span> Abenteuer auswaehlen
          </div>
          <h1 className={styles.heroTitle}>
            Wohin fuehrt dein
            <br />
            <span className={styles.heroHighlight}>Schicksal?</span>
          </h1>
          <p className={styles.heroSubtitle}>
            Waehle ein Szenario und tauche ein in eine Welt voller Geheimnisse,
            Gefahren und unvergesslicher Momente.
          </p>
        </div>

        {character && (
          <div className={styles.characterCard}>
            <div className={styles.characterCardGlow} />
            <div className={styles.characterCardInner}>
              <div className={styles.characterPortrait}>
                {character.portraitUrl ? (
                  <img src={character.portraitUrl} alt={character.name} className={styles.portraitImg} />
                ) : (
                  <span className={styles.portraitIcon}>
                    {CLASS_ICONS[character.characterClass] ?? "\u2728"}
                  </span>
                )}
              </div>
              <div className={styles.characterInfo}>
                <h3 className={styles.characterName}>{character.name}</h3>
                <p className={styles.characterMeta}>
                  {character.race} &middot; {character.characterClass} &middot; Stufe {character.level}
                </p>
                <div className={styles.characterStats}>
                  <div className={styles.miniStat}>
                    <span className={styles.miniStatIcon}>{"\u2764\uFE0F"}</span>
                    <span>{character.hitPoints}/{character.maxHitPoints}</span>
                  </div>
                  <div className={styles.miniStat}>
                    <span className={styles.miniStatIcon}>{"\uD83D\uDEE1\uFE0F"}</span>
                    <span>RK {character.armorClass}</span>
                  </div>
                  <div className={styles.miniStat}>
                    <span className={styles.miniStatIcon}>{"\u2B50"}</span>
                    <span>{character.experience} XP</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </section>

      {/* Featured Scenario */}
      {featured && (
        <section className={styles.featuredSection}>
          <div className={styles.sectionInner}>
            <div className={styles.featuredBadge}>{"\uD83C\uDF1F"} Empfohlenes Abenteuer</div>
            <button
              className={styles.featuredCard}
              onClick={() => handleSelectScenario(featured)}
              style={{ "--genre-color": GENRE_META[featured.genre]?.color ?? "#9370db" } as React.CSSProperties}
            >
              <div className={styles.featuredLeft}>
                <div className={styles.featuredIcon}>
                  {GENRE_META[featured.genre]?.icon ?? "\u2728"}
                </div>
              </div>
              <div className={styles.featuredContent}>
                <div className={styles.featuredMeta}>
                  <span
                    className={styles.featuredGenre}
                    style={{ color: GENRE_META[featured.genre]?.color }}
                  >
                    {GENRE_META[featured.genre]?.label ?? featured.genre}
                  </span>
                  <span className={styles.featuredDifficulty}>
                    <span className={styles.difficultyStars}>
                      {renderStars(DIFFICULTY_META[featured.difficulty]?.stars ?? 1)}
                    </span>
                    {DIFFICULTY_META[featured.difficulty]?.label}
                  </span>
                </div>
                <h2 className={styles.featuredTitle}>{featured.title}</h2>
                <p className={styles.featuredDesc}>{featured.description}</p>
                <div className={styles.featuredTags}>
                  {featured.tags.map((tag) => (
                    <span key={tag} className={styles.featuredTag}>{tag}</span>
                  ))}
                </div>
              </div>
              <div className={styles.featuredAction}>
                <span className={styles.playIcon}>{"\u25B6"}</span>
              </div>
            </button>
          </div>
        </section>
      )}

      {/* Filters & Controls */}
      <section className={styles.controlsSection}>
        <div className={styles.sectionInner}>
          {/* Genre Filter Tabs */}
          <div className={styles.genreTabs}>
            <button
              className={`${styles.genreTab} ${genreFilter === "all" ? styles.genreTabActive : ""}`}
              onClick={() => setGenreFilter("all")}
            >
              <span className={styles.genreTabIcon}>{"\uD83C\uDF0D"}</span>
              <span className={styles.genreTabLabel}>Alle</span>
              <span className={styles.genreTabCount}>{state.scenarios.length}</span>
            </button>
            {Object.entries(GENRE_META).map(([key, meta]) => (
              <button
                key={key}
                className={`${styles.genreTab} ${genreFilter === key ? styles.genreTabActive : ""}`}
                onClick={() => setGenreFilter(key as GenreFilter)}
                style={{ "--genre-color": meta.color } as React.CSSProperties}
              >
                <span className={styles.genreTabIcon}>{meta.icon}</span>
                <span className={styles.genreTabLabel}>{meta.label}</span>
                <span className={styles.genreTabCount}>{genreCountMap[key] ?? 0}</span>
              </button>
            ))}
          </div>

          {/* Second row: difficulty + search + sort + random */}
          <div className={styles.filterRow}>
            <div className={styles.difficultyFilter}>
              {(["all", "easy", "medium", "hard", "legendary"] as DifficultyFilter[]).map((d) => (
                <button
                  key={d}
                  className={`${styles.difficultyBtn} ${difficultyFilter === d ? styles.difficultyBtnActive : ""}`}
                  onClick={() => setDifficultyFilter(d)}
                  style={d !== "all" ? { "--diff-color": DIFFICULTY_META[d]?.color } as React.CSSProperties : undefined}
                >
                  {d === "all" ? "Alle" : DIFFICULTY_META[d].label}
                </button>
              ))}
            </div>

            <div className={styles.searchBox}>
              <span className={styles.searchIcon}>{"\uD83D\uDD0D"}</span>
              <input
                type="text"
                placeholder="Abenteuer suchen..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={styles.searchInput}
              />
              {searchQuery && (
                <button className={styles.searchClear} onClick={() => setSearchQuery("")}>
                  {"\u2715"}
                </button>
              )}
            </div>

            <select
              className={styles.sortSelect}
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortOption)}
            >
              <option value="title">A-Z</option>
              <option value="difficulty">Schwierigkeit</option>
              <option value="genre">Genre</option>
            </select>

            <button className={styles.randomBtn} onClick={handleRandomScenario} title="Zufaelliges Abenteuer">
              <span>{"\uD83C\uDFB2"}</span> Zufaellig
            </button>
          </div>
        </div>
      </section>

      {/* Scenario Grid */}
      <section className={styles.gridSection}>
        <div className={styles.sectionInner}>
          {filteredScenarios.length === 0 ? (
            <div className={styles.emptyState}>
              <div className={styles.emptyIcon}>{"\uD83D\uDD2E"}</div>
              <h3 className={styles.emptyTitle}>Keine Abenteuer gefunden</h3>
              <p className={styles.emptyText}>
                Versuche andere Filter oder eine andere Suche.
              </p>
              <button
                className={styles.resetBtn}
                onClick={() => {
                  setGenreFilter("all");
                  setDifficultyFilter("all");
                  setSearchQuery("");
                }}
              >
                Filter zuruecksetzen
              </button>
            </div>
          ) : (
            <div className={styles.grid}>
              {filteredScenarios.map((scenario) => {
                const genre = GENRE_META[scenario.genre];
                const diff = DIFFICULTY_META[scenario.difficulty];
                const isHovered = hoveredCard === scenario.id;

                return (
                  <button
                    key={scenario.id}
                    className={`${styles.card} ${isHovered ? styles.cardHovered : ""}`}
                    onClick={() => handleSelectScenario(scenario)}
                    onMouseEnter={() => setHoveredCard(scenario.id)}
                    onMouseLeave={() => setHoveredCard(null)}
                    style={{ "--genre-color": genre?.color ?? "#9370db" } as React.CSSProperties}
                  >
                    {/* Top accent bar */}
                    <div className={styles.cardAccent} />

                    {/* Card header */}
                    <div className={styles.cardHeader}>
                      <div className={styles.cardGenre}>
                        <span className={styles.cardGenreIcon}>{genre?.icon ?? "\u2728"}</span>
                        <span style={{ color: genre?.color }}>{genre?.label ?? scenario.genre}</span>
                      </div>
                      <div className={styles.cardDifficulty} style={{ color: diff?.color }}>
                        <span className={styles.difficultyStars}>
                          {renderStars(diff?.stars ?? 1)}
                        </span>
                        <span className={styles.difficultyLabel}>{diff?.label}</span>
                      </div>
                    </div>

                    {/* Title */}
                    <h3 className={styles.cardTitle}>{scenario.title}</h3>

                    {/* Description */}
                    <p className={styles.cardDescription}>{scenario.description}</p>

                    {/* Setting preview */}
                    <div className={styles.cardSetting}>
                      <span className={styles.settingIcon}>{"\uD83C\uDFAD"}</span>
                      <span className={styles.settingText}>
                        {scenario.setting
                          ? scenario.setting.length > 100
                            ? scenario.setting.slice(0, 100) + "..."
                            : scenario.setting
                          : "Unbekanntes Terrain"}
                      </span>
                    </div>

                    {/* Tags */}
                    <div className={styles.cardTags}>
                      {scenario.tags.map((tag) => (
                        <span key={tag} className={styles.cardTag}>{tag}</span>
                      ))}
                    </div>

                    {/* Bottom action */}
                    <div className={styles.cardFooter}>
                      <span className={styles.cardPlay}>
                        Abenteuer starten <span>{"\u2192"}</span>
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* Info Section */}
      <section className={styles.infoSection}>
        <div className={styles.sectionInner}>
          <div className={styles.infoGrid}>
            <div className={styles.infoCard}>
              <div className={styles.infoIcon}>{"\u267E\uFE0F"}</div>
              <h4 className={styles.infoTitle}>Unendliche Variationen</h4>
              <p className={styles.infoText}>
                Jedes Abenteuer verlaeuft anders. Die KI erschafft einzigartige Geschichten basierend auf deinen Entscheidungen.
              </p>
            </div>
            <div className={styles.infoCard}>
              <div className={styles.infoIcon}>{"\uD83C\uDFB2"}</div>
              <h4 className={styles.infoTitle}>D&D 5e Regeln</h4>
              <p className={styles.infoText}>
                Authentische Wuerfelwuerfe, Faehigkeitschecks und Kampfmechaniken in jedem Szenario.
              </p>
            </div>
            <div className={styles.infoCard}>
              <div className={styles.infoIcon}>{"\uD83D\uDCAB"}</div>
              <h4 className={styles.infoTitle}>KI-generierte Bilder</h4>
              <p className={styles.infoText}>
                Jede Szene wird mit einzigartigen, KI-generierten Bildern zum Leben erweckt.
              </p>
            </div>
            <div className={styles.infoCard}>
              <div className={styles.infoIcon}>{"\uD83D\uDCBE"}</div>
              <h4 className={styles.infoTitle}>Auto-Speichern</h4>
              <p className={styles.infoText}>
                Dein Fortschritt wird automatisch gespeichert. Setze jederzeit dort fort, wo du aufgehoert hast.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className={styles.footer}>
        <p>{"\u00A9"} 2024 Aetheria AI {"\u2014"} Unendliche Abenteuer, angetrieben von KI.</p>
      </footer>
    </div>
  );
}
