let board;

/**
 * Ouvre le plateau du Jeu des Six Couronnes.
 * L'import est volontairement différé afin de ne charger ApplicationV2
 * qu'une fois Foundry complètement initialisé.
 */
export async function openBoard() {
  const { SixCrownsBoard } = await import("./applications/game-board.js");

  board ??= new SixCrownsBoard();
  await board.render({ force: true });
  return board;
}
