import { tick } from "svelte";
import Slider from "./Slider.svelte";
import {
  canvasCoordToGroupOfCells,
  clampNumber,
  drawCells,
  drawGridLines,
  floodFill,
  type GridCoordinate,
  interpolateGridLine,
  parseCellKey,
  toCellKey,
} from "./utils";
import { lsState } from "/@shared/ls-state.svelte";

export function createVpState() {
  let shell = $state<HTMLDivElement>(null!);
  let canvas = $state<HTMLCanvasElement>(null!);
  let gridCanvas = $state<HTMLCanvasElement>(null!);
  let stage = $state<HTMLDivElement>(null!);
}
