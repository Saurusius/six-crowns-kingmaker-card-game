import { ROWS } from "../constants.js";
import { calculateSideScores } from "./scoring.js";

function emptyRows() {
  return Object.fromEntries(ROWS.map((row) => [row, []]));
}

export function createPrototypeState() {
  return {
    round: 1,
    message: "Prototype local : jouez quelques cartes pour tester le plateau.",
    weather: Object.fromEntries(ROWS.map((row) => [row, false])),
    player: {
      name: "Royaume des Six Couronnes",
      passed: false,
      lives: 2,
      rows: emptyRows(),
      hand: [
        { id: "SC-04", name: "Champion des Six Couronnes", strength: 10, rows: ["avant-garde"], abilities: ["hero"] },
        { id: "SC-03", name: "Elias, maître espion", strength: 4, rows: ["escarmouche"], abilities: ["spy"] },
        { id: "SC-08", name: "Éclaireurs de la Sellen", strength: 4, rows: ["escarmouche"], abilities: ["muster"] },
        { id: "SC-10", name: "Milice du Moulin", strength: 3, rows: ["avant-garde"], abilities: ["tight-bond"] },
        { id: "SC-12", name: "Temple d’Erastil", strength: 5, rows: ["domaine"], abilities: ["medic"] },
        { id: "SC-16", name: "Garde-chasse royal", strength: 5, rows: ["avant-garde", "escarmouche"], abilities: ["agile"] }
      ]
    },
    opponent: {
      name: "Maison Aldori",
      passed: false,
      lives: 2,
      rows: {
        "avant-garde": [
          { id: "AL-08-A", name: "Cadets aldori", strength: 3, rows: ["avant-garde"], abilities: ["tight-bond"] },
          { id: "AL-15-A", name: "Garde d’honneur de Restov", strength: 8, rows: ["avant-garde"], abilities: [] }
        ],
        "escarmouche": [
          { id: "AL-16-A", name: "Messagère de la Maison Aldori", strength: 4, rows: ["escarmouche"], abilities: ["logistics"] }
        ],
        "domaine": []
      },
      handCount: 6
    }
  };
}

export function createBoardViewModel(state) {
  return {
    ...state,
    playerScore: calculateSideScores(state.player.rows, state.weather),
    opponentScore: calculateSideScores(state.opponent.rows, state.weather)
  };
}

export function playPrototypeCard(state, cardId, row) {
  if (state.player.passed) throw new Error("Vous avez déjà passé cette manche.");
  const index = state.player.hand.findIndex((card) => card.id === cardId);
  if (index < 0) throw new Error("Cette carte n'est plus dans votre main.");

  const card = state.player.hand[index];
  if (!card.rows.includes(row)) throw new Error("Cette carte ne peut pas être jouée sur cette ligne.");

  state.player.hand.splice(index, 1);
  state.player.rows[row].push(card);
  state.message = `${card.name} rejoint la ligne ${row}.`;
  return state;
}
