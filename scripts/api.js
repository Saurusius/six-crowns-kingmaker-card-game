import { SixCrownsBoard } from "./applications/game-board.js";

let board;

export function openBoard() {
  board ??= new SixCrownsBoard();
  board.render({ force: true });
  return board;
}
