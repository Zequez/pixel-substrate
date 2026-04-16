<script lang="ts">
  // ██╗███╗   ███╗██████╗  ██████╗ ██████╗ ████████╗███████╗
  // ██║████╗ ████║██╔══██╗██╔═══██╗██╔══██╗╚══██╔══╝██╔════╝
  // ██║██╔████╔██║██████╔╝██║   ██║██████╔╝   ██║   ███████╗
  // ██║██║╚██╔╝██║██╔═══╝ ██║   ██║██╔══██╗   ██║   ╚════██║
  // ██║██║ ╚═╝ ██║██║     ╚██████╔╝██║  ██║   ██║   ███████║
  // ╚═╝╚═╝     ╚═╝╚═╝      ╚═════╝ ╚═╝  ╚═╝   ╚═╝   ╚══════╝
  // #region imports

  import { tick } from "svelte";
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
  import Background from "./StarryBg.svelte";

  // #endregion imports

  // ##############################################################
  // ##############################################################
  // ##############################################################
  // ##############################################################
  // ##############################################################
  // ##############################################################
  // ##############################################################
  // ##############################################################
  // ##############################################################
  // ##############################################################
  // ##############################################################
  // ##############################################################
  // ##############################################################
  // ##############################################################
  // ##############################################################
  // ##############################################################
  // ##############################################################
  // ##############################################################
  // ##############################################################
  // ##############################################################
  // ##############################################################
  // ##############################################################
  // ##############################################################
  // ##############################################################
  // ##############################################################
  // ##############################################################
  // ##############################################################
  // ##############################################################
  // ##############################################################
  // ##############################################################
  // ##############################################################
  // ##############################################################
  // ##############################################################
  // ##############################################################
  // ##############################################################
  // ##############################################################
  // ##############################################################
  // ##############################################################
  // ##############################################################
  // ##############################################################
  // ##############################################################
  // ##############################################################
  // ##############################################################
  // ##############################################################
  // ##############################################################
  // ##############################################################
  // ##############################################################
  // ##############################################################
  // ##############################################################
  // ##############################################################

  //  ██████╗ ██████╗ ███╗   ██╗███████╗████████╗ █████╗ ███╗   ██╗████████╗███████╗
  // ██╔════╝██╔═══██╗████╗  ██║██╔════╝╚══██╔══╝██╔══██╗████╗  ██║╚══██╔══╝██╔════╝
  // ██║     ██║   ██║██╔██╗ ██║███████╗   ██║   ███████║██╔██╗ ██║   ██║   ███████╗
  // ██║     ██║   ██║██║╚██╗██║╚════██║   ██║   ██╔══██║██║╚██╗██║   ██║   ╚════██║
  // ╚██████╗╚██████╔╝██║ ╚████║███████║   ██║   ██║  ██║██║ ╚████║   ██║   ███████║
  //  ╚═════╝ ╚═════╝ ╚═╝  ╚═══╝╚══════╝   ╚═╝   ╚═╝  ╚═╝╚═╝  ╚═══╝   ╚═╝   ╚══════╝
  // #region Constants

  const STORAGE_KEY = "state12";
  const BASE_BLOCK_SIZE = 6;
  const PALETTE = [
    "transparent",
    "#ffffff",
    "#000000",
    "#ef4444",
    "#f59e0b",
    "#eab308",
    "#22c55e",
    "#06b6d4",
    "#3b82f6",
    "#a855f7",
  ];
  const DEFAULT_STATE: {
    aspectRatioName: "square" | "goldenV" | "goldenH" | "stage";
    aspectRatio: number;
    blockSize: number;
    mainColor: string;
    cells: { [key: string]: string };
    tool: "pen" | "bucket" | "eyedropper";
    showGrid: boolean;
    penSize: number;
    xShift: number;
  } = {
    aspectRatioName: "stage",
    aspectRatio: 1,
    blockSize: BASE_BLOCK_SIZE * 2 * 2,
    mainColor: PALETTE[3]!,
    cells: {},
    tool: "pen",
    showGrid: true,
    penSize: 1,
    xShift: 0,
  };

  // ███████╗████████╗ █████╗ ████████╗███████╗
  // ██╔════╝╚══██╔══╝██╔══██╗╚══██╔══╝██╔════╝
  // ███████╗   ██║   ███████║   ██║   █████╗
  // ╚════██║   ██║   ██╔══██║   ██║   ██╔══╝
  // ███████║   ██║   ██║  ██║   ██║   ███████╗
  // ╚══════╝   ╚═╝   ╚═╝  ╚═╝   ╚═╝   ╚══════╝
  // #region State

  // Elements
  let shell = $state<HTMLDivElement>(null!);
  let canvas = $state<HTMLCanvasElement>(null!);
  let gridCanvas = $state<HTMLCanvasElement | null>(null);
  let starsBgCanvas = $state<HTMLCanvasElement | null>(null);
  let stage = $state<HTMLDivElement>(null!);

  // Persited State
  let P = lsState(STORAGE_KEY, DEFAULT_STATE);

  let canvasLeft = $state(0);
  let canvasTop = $state(0);
  let canvasWidth = $state(-1);
  let canvasHeight = $state(-1);
  let logicalWidth = $state(-1);
  let logicalHeight = $state(-1);

  let isTouchDevice = $state(false);
  let isResetting = $state(false);

  let cellsHistory = $state<{ [key: string]: string }[]>([]);
  let cellsFuture = $state<{ [key: string]: string }[]>([]);

  // Eyedropper
  let prevTool: typeof P.tool | null = null;

  let mouseXY = $state<GridCoordinate | null>(null);
  let canvasXY = $derived(mouseXY ? clientCoordToCanvas(mouseXY) : null);
  let gridPenBrushTargetXY = $derived.by(() => {
    if (canvasXY) {
      return canvasCoordToGroupOfCells(canvasXY, P.penSize);
    } else {
      return null;
    }
  });

  let pointerState = $state<null | {
    type: "penDown";
    lastP: GridCoordinate;
  }>(null);

  let toolbarSide = $state<"left" | "right">("left");
  let splitToolbar = $state(false);

  let ctx: CanvasRenderingContext2D = null!;
  let imageData: ImageData = null!;

  // ##############################################################
  // ##############################################################
  // ##############################################################
  // ##############################################################
  // ##############################################################
  // ##############################################################
  // ##############################################################
  // ##############################################################
  // ##############################################################
  // ##############################################################
  // ##############################################################
  // ##############################################################
  // ##############################################################
  // ##############################################################
  // ##############################################################
  // ##############################################################
  // ##############################################################
  // ##############################################################
  // ##############################################################
  // ##############################################################
  // ##############################################################
  // ##############################################################
  // ##############################################################
  // ##############################################################
  // ##############################################################
  // ##############################################################
  // ##############################################################
  // ##############################################################
  // ##############################################################
  // ##############################################################
  // ##############################################################
  // ##############################################################
  // ##############################################################
  // ##############################################################
  // ##############################################################
  // ##############################################################
  // ##############################################################
  // ##############################################################
  // ##############################################################
  // ##############################################################
  // ##############################################################
  // ##############################################################
  // ##############################################################
  // ##############################################################
  // ##############################################################
  // ##############################################################
  // ##############################################################
  // ##############################################################
  // ##############################################################
  // ##############################################################

  // ███████╗███████╗███╗   ██╗███████╗ ██████╗ ██████╗
  // ██╔════╝██╔════╝████╗  ██║██╔════╝██╔═══██╗██╔══██╗
  // ███████╗█████╗  ██╔██╗ ██║███████╗██║   ██║██████╔╝
  // ╚════██║██╔══╝  ██║╚██╗██║╚════██║██║   ██║██╔══██╗
  // ███████║███████╗██║ ╚████║███████║╚██████╔╝██║  ██║
  // ╚══════╝╚══════╝╚═╝  ╚═══╝╚══════╝ ╚═════╝ ╚═╝  ╚═╝

  // #region Sensor

  // FEATURE
  // When the stage size changes, the number of blocks on the screen
  // changes.
  // And if the do, then the canvas has to be re-rendered.

  let isFullscreen = $state(false);
  $effect(() => {
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.target === stage) {
          resize();
        }
      }
    });

    const handleFullscreenChange = () => {
      isFullscreen = document.fullscreenElement === shell;
    };

    resizeObserver.observe(stage);
    document.addEventListener("fullscreenchange", handleFullscreenChange);

    return () => {
      resizeObserver.disconnect();
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
    };
  });

  // ##############################################################
  // ##############################################################
  // ##############################################################
  // ##############################################################
  // ##############################################################
  // ##############################################################
  // ##############################################################
  // ##############################################################
  // ##############################################################
  // ##############################################################
  // ##############################################################
  // ##############################################################
  // ##############################################################
  // ##############################################################
  // ##############################################################
  // ##############################################################
  // ##############################################################
  // ##############################################################
  // ##############################################################
  // ##############################################################
  // ##############################################################
  // ##############################################################
  // ##############################################################
  // ##############################################################
  // ##############################################################
  // ##############################################################
  // ##############################################################
  // ##############################################################
  // ##############################################################
  // ##############################################################
  // ##############################################################
  // ##############################################################
  // ##############################################################
  // ##############################################################
  // ##############################################################
  // ##############################################################
  // ##############################################################
  // ##############################################################
  // ##############################################################
  // ##############################################################
  // ##############################################################
  // ##############################################################
  // ##############################################################
  // ##############################################################
  // ##############################################################
  // ##############################################################
  // ##############################################################
  // ##############################################################
  // ##############################################################
  // ##############################################################

  // ███████╗██╗   ██╗███╗   ██╗
  // ██╔════╝██║   ██║████╗  ██║
  // █████╗  ██║   ██║██╔██╗ ██║
  // ██╔══╝  ██║   ██║██║╚██╗██║
  // ██║     ╚██████╔╝██║ ╚████║
  // ╚═╝      ╚═════╝ ╚═╝  ╚═══╝
  // #region Functions

  function reDrawCells(force: boolean = false) {
    imageData = drawCells(
      canvas,
      force ? null : imageData,
      P.cells,
      undefined,
      P.xShift,
    );
  }

  function paintCellsColor(
    coordinatesToPaint: GridCoordinate[],
    color: string,
  ) {
    imageData = drawCells(
      canvas,
      imageData,
      {},
      { cells: coordinatesToPaint, color },
      P.xShift,
    );
  }

  function captureCellsToHistory() {
    cellsHistory.push({ ...P.cells });
    cellsFuture = [];
  }

  function setAspectRatio(target: (typeof P)["aspectRatioName"]) {
    P.aspectRatioName = target;

    if (target === "square") {
      P.aspectRatio = 1;
    } else if (target === "goldenV") {
      P.aspectRatio = 16 / 9;
    } else if (target === "goldenH") {
      P.aspectRatio = 9 / 16;
    } else if (target === "stage") {
      const { width, height } = stage.getBoundingClientRect();
      P.aspectRatio = width / height;
    }
    resize();
  }

  function setPenSize(size: number) {
    const size2 = isTouchDevice ? (size > 8 ? 1 : size) : size;
    P.penSize = clampNumber(size2, 1, isTouchDevice ? 8 : 64);
  }

  function biggerBlockSize() {
    if (logicalWidth === 1 && logicalHeight === 1) {
      return;
    }
    captureCellsToHistory();

    const nextCells: Record<string, string> = {};
    const groupedColors = new Map<
      string,
      { red: number; green: number; blue: number; count: number }
    >();

    for (const [key, color] of Object.entries(P.cells)) {
      if (color === "transparent") {
        continue;
      }

      const { x, y } = parseCellKey(key);
      const nextKey = toCellKey(Math.floor(x / 2), Math.floor(y / 2));
      const group = groupedColors.get(nextKey) || {
        red: 0,
        green: 0,
        blue: 0,
        count: 0,
      };
      const { red, green, blue } = colorToRgb(color);

      group.red += red;
      group.green += green;
      group.blue += blue;
      group.count += 1;
      groupedColors.set(nextKey, group);
    }

    for (const [key, group] of groupedColors) {
      nextCells[key] = rgbToColor({
        red: Math.round(group.red / group.count),
        green: Math.round(group.green / group.count),
        blue: Math.round(group.blue / group.count),
      });
    }

    P.cells = nextCells;
    P.blockSize = P.blockSize * 2;
    P.xShift = Math.round(P.xShift / 2);

    resize();
  }

  function smallerBlockSize() {
    if (P.blockSize <= BASE_BLOCK_SIZE) {
      return;
    }

    const nextCells: Record<string, string> = {};

    for (const [key, color] of Object.entries(P.cells)) {
      if (color === "transparent") {
        continue;
      }

      const { x, y } = parseCellKey(key);
      const baseX = x * 2;
      const baseY = y * 2;

      nextCells[toCellKey(baseX, baseY)] = color;
      nextCells[toCellKey(baseX + 1, baseY)] = color;
      nextCells[toCellKey(baseX, baseY + 1)] = color;
      nextCells[toCellKey(baseX + 1, baseY + 1)] = color;
    }

    P.cells = nextCells;
    P.blockSize = P.blockSize / 2;
    P.xShift = P.xShift * 2;

    resize();
  }

  function colorToRgb(color: string) {
    return {
      red: Number.parseInt(color.slice(1, 3), 16),
      green: Number.parseInt(color.slice(3, 5), 16),
      blue: Number.parseInt(color.slice(5, 7), 16),
    };
  }

  function rgbToColor(rgb: { red: number; green: number; blue: number }) {
    return `#${toHexChannel(rgb.red)}${toHexChannel(rgb.green)}${toHexChannel(rgb.blue)}`;
  }

  function toHexChannel(value: number) {
    return clampNumber(Math.round(value), 0, 255).toString(16).padStart(2, "0");
  }

  function resize() {
    const { width, height } = stage.getBoundingClientRect();

    splitToolbar = width < 768;

    const stageAspectRatio = width / height;

    if (P.aspectRatioName === "stage") {
      P.aspectRatio = stageAspectRatio;
    }

    if (stageAspectRatio > P.aspectRatio) {
      canvasWidth = height * P.aspectRatio;
      canvasHeight = height;
    } else {
      canvasWidth = width;
      canvasHeight = width / P.aspectRatio;
    }

    const pxW = Math.floor(canvasWidth / P.blockSize);
    const pxH = Math.floor(canvasHeight / P.blockSize);

    canvas.width = pxW || 1;
    canvas.height = pxH || 1;
    logicalWidth = canvas.width;
    logicalHeight = canvas.height;
    if (gridCanvas) {
      setGridCanvas();
    }
    ctx = canvas.getContext("2d")!;
    reDrawCells(true);
    tick().then(() => {
      const { left, top } = canvas.getBoundingClientRect();
      canvasLeft = left;
      canvasTop = top;
    });
  }

  function setGridCanvas() {
    gridCanvas!.width = canvasWidth - (canvasWidth % P.blockSize);
    gridCanvas!.height = canvasHeight - (canvasHeight % P.blockSize);

    drawGridLines(gridCanvas!.getContext("2d")!, P.blockSize);
  }

  function realBlockSize() {
    const w = logicalWidth;
    const h = logicalHeight;

    return { xx: canvasWidth / w, yy: canvasHeight / h };
  }

  function clientCoordToCanvas(p: { x: number; y: number }): {
    x: number;
    y: number;
  } {
    if (canvasWidth === 0 || canvasHeight === 0) {
      return { x: 0, y: 0 };
    }

    return {
      x: ((p.x - canvasLeft) / canvasWidth) * logicalWidth,
      y: ((p.y - canvasTop) / canvasHeight) * logicalHeight,
    };
  }

  function canvasCoordToCell(p: { x: number; y: number }): {
    x: number;
    y: number;
  } {
    return {
      x: Math.max(0, Math.min(logicalWidth - 1, Math.floor(p.x))),
      y: Math.max(0, Math.min(logicalHeight - 1, Math.floor(p.y))),
    };
  }

  // FROM and TO are logical coordinates with decimals
  function paintStroke(from3: GridCoordinate | null, to3: GridCoordinate) {
    if (pointerState === null) return;

    const from = from3 ? { x: from3.x + P.xShift, y: from3.y } : null;
    const to = { x: to3.x + P.xShift, y: to3.y };

    let coordinatesToPaint: GridCoordinate[] = [];
    if (P.penSize !== 1) {
      if (from) {
        const p1 = canvasCoordToGroupOfCells(from, P.penSize);
        const p2 = canvasCoordToGroupOfCells(to, P.penSize);
        for (let i = 0; i < P.penSize; i++) {
          for (let j = 0; j < P.penSize; j++) {
            const cells = interpolateGridLine(
              { x: p1.x + i, y: p1.y + j },
              { x: p2.x + i, y: p2.y + j },
            );
            coordinatesToPaint.push(...cells);
          }
        }
      } else {
        const p = canvasCoordToGroupOfCells(to, P.penSize);
        for (let i = 0; i < P.penSize; i++) {
          for (let j = 0; j < P.penSize; j++) {
            coordinatesToPaint.push({ x: p.x + i, y: p.y + j });
          }
        }
      }
    } else {
      coordinatesToPaint = from
        ? interpolateGridLine(canvasCoordToCell(from), canvasCoordToCell(to))
        : [canvasCoordToCell(to)];
    }

    const shouldDelete = P.mainColor === "transparent";

    for (const coordinate of coordinatesToPaint) {
      if (shouldDelete) {
        deleteCell(coordinate);
      } else {
        storeCell(coordinate, P.mainColor);
      }
    }

    reDrawCells();
    paintCellsColor(coordinatesToPaint, P.mainColor);
  }

  function paintFloodFill(to: GridCoordinate) {
    const coords = floodFill(P.cells, canvasCoordToCell(to), {
      columns: logicalWidth,
      rows: logicalHeight,
    });
    for (const coord of coords) {
      if (P.mainColor === "transparent") {
        deleteCell(coord);
      } else {
        storeCell(coord, P.mainColor);
      }
    }
    reDrawCells(true);
  }

  let resetTimout: number | null = null;
  function reset() {
    if (!isResetting) {
      isResetting = true;
      resetTimout = setTimeout(() => {
        isResetting = false;
      }, 2000);
    } else {
      clearTimeout(resetTimout!);
      captureCellsToHistory();
      P.cells = {};
      reDrawCells(true);
      isResetting = false;
    }
  }

  function undo() {
    if (cellsHistory.length > 0) {
      cellsFuture.push(P.cells);
      P.cells = cellsHistory.pop()!;
      reDrawCells(true);
    }
  }

  function redo() {
    if (cellsFuture.length > 0) {
      cellsHistory.push(P.cells);
      P.cells = cellsFuture.pop()!;
      reDrawCells(true);
    }
  }

  function switchTool(tool: typeof P.tool) {
    prevTool = P.tool;
    P.tool = tool;
  }

  function download() {
    const link = document.createElement("a");
    link.href = canvas.toDataURL("image/png");
    const randomFileName = Math.random().toString(36).slice(2);
    link.download = `pixel-${randomFileName}.png`;
    link.click();
  }

  async function toggleFullscreen() {
    if (document.fullscreenElement === shell) {
      await document.exitFullscreen();
      return;
    }

    await shell.requestFullscreen();
  }

  function storeCell(p: GridCoordinate, color: string) {
    const key = toCellKey(p.x, p.y);
    P.cells[key] = color;
  }

  function deleteCell(p: GridCoordinate) {
    const key = toCellKey(p.x, p.y);
    delete P.cells[key];
  }

  function shiftCells(
    cells: Record<string, string>,
    shift: GridCoordinate,
  ): Record<string, string> {
    const nextCells: Record<string, string> = {};

    for (const [key, color] of Object.entries(cells)) {
      const coordinate = parseCellKey(key);
      const nextCoordinate = {
        x: coordinate.x + shift.x,
        y: coordinate.y + shift.y,
      };

      nextCells[toCellKey(nextCoordinate.x, nextCoordinate.y)] = color;
    }

    return nextCells;
  }

  function toggleGrid() {
    P.showGrid = !P.showGrid;
    if (P.showGrid) {
      tick().then(() => {
        setGridCanvas();
      });
    }
  }

  // ███████╗██╗   ██╗███████╗███╗   ██╗████████╗███████╗
  // ██╔════╝██║   ██║██╔════╝████╗  ██║╚══██╔══╝██╔════╝
  // █████╗  ██║   ██║█████╗  ██╔██╗ ██║   ██║   ███████╗
  // ██╔══╝  ╚██╗ ██╔╝██╔══╝  ██║╚██╗██║   ██║   ╚════██║
  // ███████╗ ╚████╔╝ ███████╗██║ ╚████║   ██║   ███████║
  // ╚══════╝  ╚═══╝  ╚══════╝╚═╝  ╚═══╝   ╚═╝   ╚══════╝

  function handlePointerDown(ev: PointerEvent) {
    if (ev.button === 1) return;
    const lastP = clientCoordToCanvas(ev);
    const mode = ev.button === 2 ? "alt" : "main";

    if (mode === "alt" || P.tool === "eyedropper") {
      const p = canvasCoordToCell(lastP);
      P.mainColor = P.cells[toCellKey(p.x + P.xShift, p.y)] || "transparent";
      if (P.tool === "eyedropper" && prevTool) {
        P.tool = prevTool;
      }
    } else {
      captureCellsToHistory();
      if (P.tool === "pen") {
        pointerState = { type: "penDown", lastP };
        paintStroke(null, lastP);
      } else if (P.tool === "bucket") {
        paintFloodFill(lastP);
      }
    }
  }

  function handlePointerMove(ev: PointerEvent) {
    mouseXY = { x: ev.clientX, y: ev.clientY };
    if (pointerState === null) return;

    switch (pointerState.type) {
      case "penDown": {
        const nextP = clientCoordToCanvas(ev);
        paintStroke(pointerState.lastP, nextP);
        pointerState.lastP = nextP;
        break;
      }
    }
  }

  function handlePointerLeave() {
    if (pointerState !== null) {
      pointerState = null;
    }
  }

  function handlePointerWheel(ev: WheelEvent) {
    // if (P.tool !== "pen") return;
    ev.preventDefault();
    if (ev.deltaY < 0) {
      P.xShift += 1;
      // P.cells = shiftCells(P.cells, { x: 1, y: 0 });
    } else {
      // P.cells = shiftCells(P.cells, { x: -1, y: 0 });
      P.xShift -= 1;
    }
    // setPenSize(P.penSize + (ev.deltaY < 0 ? 1 : -1));
    reDrawCells(true);
  }

  function handleKeyPress(ev: KeyboardEvent) {
    switch (ev.code) {
      case "KeyS":
      case "ArrowDown": {
        smallerBlockSize();
        break;
      }
      case "KeyW":
      case "ArrowUp": {
        biggerBlockSize();
        break;
      }
      case "KeyA":
      case "ArrowLeft": {
        P.xShift -= 1;
        reDrawCells(true);
        break;
      }
      case "KeyD":
      case "ArrowRight": {
        P.xShift += 1;
        reDrawCells(true);
        break;
      }
    }

    reDrawCells();
  }

  function handleTouchStart(ev: TouchEvent) {
    isTouchDevice = true;
  }

  // ##############################################################
  // ##############################################################
  // ##############################################################
  // ##############################################################
  // ##############################################################
  // ##############################################################
  // ##############################################################
  // ##############################################################
  // ##############################################################
  // ##############################################################
  // ##############################################################
  // ##############################################################
  // ##############################################################
  // ##############################################################
  // ##############################################################
  // ##############################################################
  // ##############################################################
  // ##############################################################
  // ##############################################################
  // ##############################################################
  // ##############################################################
  // ##############################################################
  // ##############################################################
  // ##############################################################
  // ##############################################################
  // ##############################################################
  // ##############################################################
  // ##############################################################
  // ##############################################################
  // ##############################################################
  // ##############################################################
  // ##############################################################
  // ##############################################################
  // ##############################################################
  // ##############################################################
  // ##############################################################
  // ##############################################################
  // ##############################################################
  // ##############################################################
  // ##############################################################
  // ##############################################################
  // ##############################################################
  // ##############################################################
  // ##############################################################
  // ##############################################################
  // ##############################################################
  // ##############################################################
  // ##############################################################
  // ##############################################################
  // ##############################################################
  // ████████╗██████╗ ███████╗██╗     ██╗     ██╗███████╗
  // ╚══██╔══╝██╔══██╗██╔════╝██║     ██║     ██║██╔════╝
  //    ██║   ██████╔╝█████╗  ██║     ██║     ██║███████╗
  //    ██║   ██╔══██╗██╔══╝  ██║     ██║     ██║╚════██║
  //    ██║   ██║  ██║███████╗███████╗███████╗██║███████║
  //    ╚═╝   ╚═╝  ╚═╝╚══════╝╚══════╝╚══════╝╚═╝╚══════╝
  // #region Trellis
</script>

<svelte:window on:keydown={handleKeyPress} on:touchstart={handleTouchStart} />

<div class="w-screen h-[100dvh] bg-gray-900 flex flex-col" bind:this={shell}>
  <div class="grow h-200px relative flex-cc overflow-hidden" bind:this={stage}>
    <div
      class="relative transparent-lines shadow-[0_20px_60px_rgba(0,0,0,0.34)]"
      style="width: {canvasWidth}px; height: {canvasHeight}px;"
    >
      {#if canvasWidth !== -1}
        <Background />
      {/if}
      <canvas
        style="image-rendering: pixelated;"
        class="absolute size-full left-0 top-0 z-1 touch-none"
        bind:this={starsBgCanvas}
      >
      </canvas>
      <canvas
        style="image-rendering: pixelated;"
        class="absolute size-full left-0 top-0 z-1 cursor-crosshair touch-none"
        onpointerdown={handlePointerDown}
        onpointermove={handlePointerMove}
        onpointerleave={handlePointerLeave}
        onpointerup={handlePointerLeave}
        onwheel={handlePointerWheel}
        oncontextmenu={(ev) => ev.preventDefault()}
        bind:this={canvas}
      ></canvas>
      {#if P.showGrid}
        <canvas
          class="absolute size-full left-0 top-0 z-2 pointer-events-none"
          bind:this={gridCanvas}
        ></canvas>
      {/if}
      {#if P.tool === "pen" && gridPenBrushTargetXY}
        {@const { xx, yy } = realBlockSize()}
        {@const s = P.penSize}
        {@const { x, y } = gridPenBrushTargetXY}
        <div
          style={`transform: translate(${x * xx}px, ${y * yy}px);
              width: ${xx * P.penSize}px; height: ${yy * P.penSize}px;
              `}
          class="absolute z-3 top-0 left-0 b-2 b-white bg-white/20 pointer-events-none"
        ></div>
      {/if}
    </div>
  </div>

  <!--
   ████████╗ ██████╗  ██████╗ ██╗     ██████╗  █████╗ ██████╗
   ╚══██╔══╝██╔═══██╗██╔═══██╗██║     ██╔══██╗██╔══██╗██╔══██╗
      ██║   ██║   ██║██║   ██║██║     ██████╔╝███████║██████╔╝
      ██║   ██║   ██║██║   ██║██║     ██╔══██╗██╔══██║██╔══██╗
      ██║   ╚██████╔╝╚██████╔╝███████╗██████╔╝██║  ██║██║  ██║
      ╚═╝    ╚═════╝  ╚═════╝ ╚══════╝╚═════╝ ╚═╝  ╚═╝╚═╝  ╚═╝
  -->

  <div class="h12 bg-gray-700 shrink-0 overflow-hidden font-mono touch-none">
    <div
      class={[
        "flex h-full",
        {
          "w-[200vw]": splitToolbar,
          "w-[100vw]": !splitToolbar,
        },
      ]}
    >
      <!-- First tools -->
      {#if toolbarSide === "left" || !splitToolbar}
        <div class="w-1/2 shrink-0 flex-cs space-x-2 pl-2">
          <!-- <select
            class="bg-white text-black w16 h8 rounded-1 px1.5 text-xs"
            value={P.aspectRatioName}
            oninput={(ev) => setAspectRatio(ev.currentTarget.value as any)}
          >
            <option value="square">Square</option>
            <option value="goldenV">GoldenV</option>
            <option value="goldenH">GoldenH</option>
            <option value="stage">Stage</option>
          </select> -->

          <button
            class={[
              "h8 w8 flex-cc hover:bg-white/10 cursor-pointer rounded-1",
              {
                "text-red": isResetting,
                "text-white": !isResetting,
              },
            ]}
            onclick={reset}
            title="Reset"
          >
            <span class="i-fa-file-half-dashed text-9"></span>
          </button>

          <button
            class="h8 w8 flex-cc hover:bg-white/10 cursor-pointer text-white rounded-1"
            onclick={download}
            title="Download"
          >
            <span class="i-fa-file-arrow-down text-9"></span>
          </button>

          <button
            class={[
              "h8 w8 flex-cc cursor-pointer rounded-1",
              {
                "text-white bg-transparent hover:bg-white/10": !isFullscreen,
                "text-black bg-gray-100 hover:bg-gray-200": isFullscreen,
              },
            ]}
            onclick={toggleFullscreen}
            aria-label="Toggle fullscreen"
          >
            {#if isFullscreen}
              <span class="i-fa-compress text-8"></span>
            {:else}
              <span class="i-fa-expand text-8"></span>
            {/if}
          </button>

          <button
            class={[
              "h8 w8 flex-cc cursor-pointer text-black rounded-1",
              {
                "text-white bg-transparent hover:bg-white/10": !P.showGrid,
                "text-black bg-gray-100 hover:bg-gray-200": P.showGrid,
              },
            ]}
            onclick={toggleGrid}
            aria-label="Toggle grid"
          >
            <span class="i-fa-table-cells text-8"></span>
          </button>
          <div class="flex text-white">
            <div class="flex flex-col h-12">
              <button
                onclick={biggerBlockSize}
                aria-label="Larger block size"
                class="h-1/2 w8 hover:bg-white/20 flex-cc cursor-pointer text-white rounded-1"
              >
                <span class="i-fa-caret-up text-8"></span>
              </button>
              <button
                onclick={smallerBlockSize}
                aria-label="Smaller block size"
                class="h-1/2 w8 hover:bg-white/20 flex-cc cursor-pointer text-white rounded-1"
                ><span class="i-fa-caret-down text-8"></span></button
              >
            </div>
            <div class="flex-cc w-8 h-12 font-mono text-xs">
              {P.blockSize}
            </div>
          </div>

          {#if splitToolbar}
            <button
              class="h12 w8 text-white flex-cc bg-white/10 hover:bg-white/20"
              aria-label="Draw controls"
              onclick={() => (toolbarSide = "right")}
            >
              <span class="i-fa-angles-right text-7"></span>
            </button>
          {/if}
          <!-- </div> -->
        </div>
      {/if}
      {#if toolbarSide === "right" || !splitToolbar}
        <!-- Second tools -->
        <div class="w-1/2 flex-ce space-x-2 pr-2">
          {#if splitToolbar}
            <button
              class="h12 w8 text-white flex-cc bg-white/10 hover:bg-white/20"
              aria-label="View controls"
              onclick={() => (toolbarSide = "left")}
            >
              <span class="i-fa-angles-left text-7"></span>
            </button>
          {/if}
          <div class="flex-ce grow ml-2">
            <div
              class="flex-cc text-white mr-2 rounded-1 overflow-hidden b b-white/10"
            >
              <button
                class={[
                  "h8 w8 flex-cc",
                  {
                    "bg-white/10 hover:bg-white/30 cursor-pointer":
                      cellsHistory.length >= 1,
                    "opacity-50": cellsHistory.length < 1,
                  },
                ]}
                onclick={undo}
                aria-label="Undo"
              >
                <div class="i-fa-arrow-turn-up -rotate-90 block text-6"></div>
              </button>
              <button
                class={[
                  "h8 w8 flex-cc",
                  {
                    "bg-white/10 hover:bg-white/30 cursor-pointer":
                      cellsFuture.length >= 1,
                    "opacity-50": cellsFuture.length < 1,
                  },
                ]}
                aria-label="Redo"
                onclick={redo}
              >
                <div class="i-fa-arrow-turn-down -rotate-90 block text-6"></div>
              </button>
            </div>
            <div class="flex overflow-hidden rounded-1 grow max-w-100">
              {#each PALETTE as color}
                <button
                  class={[
                    "h-8 w-full relative group",
                    {
                      "transparent-lines": color === "transparent",
                    },
                  ]}
                  style="background-color: {color};"
                  aria-label="Set color to {color}"
                  oncontextmenu={(ev) => ev.preventDefault()}
                  onmousedown={(ev) => {
                    if (ev.button === 0) {
                      P.mainColor = color;
                    }
                  }}
                >
                  <div
                    class={[
                      "group-hover:block hidden absolute inset-0 b-1.5  group-last:rounded-r-1 group-first:rounded-l-1",
                      {
                        "b-gray-800 bg-white/20": color !== "#000000",
                        "b-gray-200 bg-black/20": color === "#000000",
                      },
                    ]}
                  ></div>
                  {#if color === P.mainColor}
                    <span
                      class="absolute top-.5 left-.5 h3 w3 bg-white rounded-full b b-black"
                    ></span>
                  {/if}
                </button>
              {/each}
            </div>
          </div>
          <button
            class="relative text-white b b-white/30 b-r-0 h-6 -mr0 w-8 flex-cc rounded-l-1 cursor-pointer"
            onclick={(ev) => {
              if (isTouchDevice) {
                setPenSize(P.penSize + 1);
              } else {
                const { height, top } =
                  ev.currentTarget.getBoundingClientRect();
                const y = ev.clientY - top;
                const add = y < height / 2;
                setPenSize(P.penSize + (add ? 1 : -1));
              }
            }}
          >
            {P.penSize}
            <div class="absolute w-full h-1/2 top-0 hover:bg-white/50"></div>
            <div class="absolute w-full h-1/2 top-1/2 hover:bg-white/50"></div>
          </button>
          <div class="flex bg-white/20 rounded-1">
            {#snippet toolBtn(tool: typeof P.tool, label: string, icon: string)}
              <button
                class={[
                  "w8 h8 first:rounded-l-1 last:rounded-r-1 flex-cc",
                  {
                    "bg-white text-black": P.tool === tool,
                    "text-white": P.tool !== tool,
                  },
                ]}
                onclick={() => switchTool(tool)}
                aria-label={label}
              >
                <span class="{icon} text-6 block"></span>
              </button>
            {/snippet}
            {@render toolBtn("pen", "Pen tool", "i-fa-pen")}
            {@render toolBtn("bucket", "Bucket tool", "i-fa-fill")}
            {@render toolBtn(
              "eyedropper",
              "Eyedropper tool",
              "i-fa-eye-dropper",
            )}
          </div>
        </div>
      {/if}
    </div>
  </div>
</div>

<style>
  .transparent-lines {
    background-image: linear-gradient(
      -45deg,
      rgba(255, 255, 255, 0.96) 25%,
      rgba(229, 231, 235, 0.96) 25%,
      rgba(229, 231, 235, 0.96) 50%,
      rgba(255, 255, 255, 0.96) 50%,
      rgba(255, 255, 255, 0.96) 75%,
      rgba(229, 231, 235, 0.96) 75%,
      rgba(229, 231, 235, 0.96) 100%
    );
    background-size: 20px 20px;
  }
</style>
