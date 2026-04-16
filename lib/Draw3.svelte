<script lang="ts">
  import { onMount } from "svelte";
  import { render } from "svelte/server";
  import { createStarsPen, createSquarePen, createGridPen } from "./brushes";

  const props: { class?: any } = $props();

  let stage: HTMLDivElement;
  let canvasStars: HTMLCanvasElement;
  let canvasGrid: HTMLCanvasElement;
  let canvasSquares: HTMLCanvasElement;

  let starsPen: ReturnType<typeof createStarsPen> = null!;
  let squarePen: ReturnType<typeof createSquarePen> = null!;
  let gridPen: ReturnType<typeof createGridPen> = null!;

  const STARS_DOWNSCALING = 1;
  const MAX_DOWNSCALING = 6;

  let downscaling = $state(3);
  let direction: "r" | "b" | "t" | "l" = $state("r");
  let flexDirection = $derived(direction === "r" ? "column" : "row");

  let stageLoc = $state({ x: 0, y: 0, w: 1, h: 1 });
  let aspectRatio = $derived(stageLoc.w / stageLoc.h);
  let cross = $derived(2 ** (downscaling - 1));
  let axis = $derived(Math.floor(cross * aspectRatio));
  let shift = $state(0);
  // let axisMaxLength = $derived.by(() => {
  //   const finestBand = bands[bands.length - 1]!;
  //   return Math.max(...finestBand.map((color) => color.length));
  // });
  // let shiftLimit = $derived(bands);

  type SquareCoord = { cross: number; axis: number };

  let pointerState = $state<null | {
    type: "penDown";
    lastPos: SquareCoord;
  }>(null);

  let bands: string[][] = Array(MAX_DOWNSCALING).fill([] as string[]);
  for (let level = 0; level <= MAX_DOWNSCALING; level++) {
    const crossForLevel = 2 ** level;
    bands[level] = Array(crossForLevel).fill(["yellow", "orange", "blue"]);
  }

  onMount(() => {
    gridPen = createGridPen(canvasGrid.getContext("2d")!, downscaling, "x");
    starsPen = createStarsPen(canvasStars.getContext("2d")!, 100);
    squarePen = createSquarePen(canvasSquares.getContext("2d")!);

    readDimensionFromStage();
    drawStars();
    drawSquares();
  });

  function readDimensionFromStage() {
    let {
      width: w,
      height: h,
      left: x,
      top: y,
    } = stage.getBoundingClientRect();
    stageLoc = { w, h, x, y };

    canvasStars.width = w / STARS_DOWNSCALING;
    canvasStars.height = h / STARS_DOWNSCALING;
    resizeSquaresCanvas();
  }

  function resizeSquaresCanvas() {
    canvasSquares.width = axis;
    canvasSquares.height = cross;
  }

  function drawSquares() {
    squarePen.clear();
    const band = bands[downscaling]!;
    console.log(cross, axis);
    for (let x = 0; x < cross; x++) {
      for (let y = 0; y < axis; y++) {
        let x2 = x + shift;
        console.log(x2);
        const color = band[y]![x2];
        console.log(color);

        if (color) {
          squarePen.draw(x, y, 1, color);
        }
      }
    }
  }

  function drawStars() {
    const { w, h, x, y } = stageLoc;
    starsPen.draw(x, y, w, h);
  }

  function handleStageResize() {
    readDimensionFromStage();
    drawStars();
    drawSquares();
  }

  function handleKeyPress(ev: KeyboardEvent) {
    switch (ev.code) {
      case "KeyS":
      case "ArrowDown": {
        downscaling = Math.max(1, downscaling - 1);
        resizeSquaresCanvas();
        break;
      }
      case "KeyW":
      case "ArrowUp": {
        downscaling = Math.min(MAX_DOWNSCALING, downscaling + 1);
        resizeSquaresCanvas();
        break;
      }
      case "KeyA":
      case "ArrowLeft": {
        shift -= 1;
        break;
      }
      case "KeyD":
      case "ArrowRight": {
        shift += 1;
        break;
      }
    }

    drawSquares();
  }

  function viewportCoordToStageCoord(
    viewportX: number,
    viewportY: number,
  ): { x: number; y: number } {
    return {
      x: viewportX - stageLoc.x,
      y: viewportY - stageLoc.y,
    };
  }

  // function stageCoordToSquareCoord(x: number, y: number): SquareCoord {}

  function handlePointerDown(ev: PointerEvent) {
    if (ev.button === 1) return;
  }

  function handlePointerMove(ev: PointerEvent) {
    if (pointerState === null) return;

    switch (pointerState.type) {
      case "penDown": {
        // TODO
        break;
      }
    }
  }

  function handlePointerLeave() {
    if (pointerState !== null) {
      pointerState = null;
    }
  }
</script>

<svelte:window onresize={handleStageResize} onkeypress={handleKeyPress} />

<div style={`flex-direction: ${flexDirection};`} class="flex h-[100dvh]">
  <div class="basis-20 bg-red"></div>
  <div class="basis-60 relative flex-grow bg-gray-900" bind:this={stage}>
    <canvas
      class={[
        "absolute top-0 left-0 w-full h-full z-4 pointer-events-none",
        props.class,
      ]}
      bind:this={canvasGrid}
    ></canvas>
    <canvas
      onpointerdown={handlePointerDown}
      onpointermove={handlePointerMove}
      onpointerleave={handlePointerLeave}
      style="image-rendering: pixelated;"
      class={["absolute top-0 left-0 w-full h-full z-3", props.class]}
      bind:this={canvasSquares}
    ></canvas>
    <canvas
      style="image-rendering: pixelated;"
      class={[
        "absolute top-0 left-0 w-full h-full z-2 pointer-events-none",
        props.class,
      ]}
      bind:this={canvasStars}
    ></canvas>
  </div>
  <div class="basis-20 bg-blue"></div>
</div>
