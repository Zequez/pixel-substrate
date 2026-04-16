<script lang="ts">
  import { onMount } from "svelte";
  import { render } from "svelte/server";
  import { createStarsPen, createSquarePen, createGridPen } from "./brushes";
  import { createBandsState } from "./bands.state.svelte";

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

  let direction: "r" | "b" | "t" | "l" = $state("r");
  let flexDirection = $derived(direction === "r" ? "column" : "row");

  let stageLoc = $state({ x: 0, y: 0, w: 1, h: 1 });
  let aspectRatio = $derived(stageLoc.w / stageLoc.h);
  let shift = $state(0);

  let B = createBandsState({ maxBands: 6, initialBand: 3, minLength: 6 });
  let stageLength = $derived(Math.floor(B.bandSize * aspectRatio));
  let stageSlice = $derived(B.readBand(shift, stageLength));

  // VIEWPORT STATE
  // let dimension = $state(3);
  // let bands: string[][] = Array(MAX_DOWNSCALING).fill([] as string[]);
  // let band = $derived(bands[dimension]!);
  // let cross = $derived(2 ** (dimension - 1));
  // let axis = $derived(Math.floor(cross * aspectRatio));

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

  // for (let level = 0; level <= MAX_DOWNSCALING; level++) {
  //   const crossForLevel = 2 ** level;
  //   bands[level] = Array(crossForLevel).fill(["yellow", "orange", "blue"]);
  // }

  onMount(() => {
    // gridPen = createGridPen(canvasGrid.getContext("2d")!, dimension, "x");
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

    // canvasGrid.width = w;
    // canvasGrid.height = h;
    canvasStars.width = w / STARS_DOWNSCALING;
    canvasStars.height = h / STARS_DOWNSCALING;
    resizeSquaresCanvas();
    // drawGrid();
  }

  // $effect(() => {
  //   canvasSquares.height = B.bandSize;
  //   canvasSquares.width = stageLength;
  // })

  function resizeSquaresCanvas() {
    canvasSquares.height = B.bandSize;
    canvasSquares.width = stageLength;
  }

  function drawSquares() {
    squarePen.clear();
    stageSlice.forEach((line, lineN) => {
      line.forEach((color, x) => {
        if (color) {
          squarePen.draw(x, lineN, 1, color);
        }
      });
    });
  }

  function drawStars() {
    const { w, h } = stageLoc;
    starsPen.draw(0, 0, w, h);
  }

  function drawGrid() {
    const { w, h } = stageLoc;
    gridPen.draw(0, 0, w, h);
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
        B.nextDimension();
        resizeSquaresCanvas();
        break;
      }
      case "KeyW":
      case "ArrowUp": {
        B.previousDimension();
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
      case "Space": {
        B.fillCurrentWithGiberish();
        drawSquares();
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
  <div class="basis-24 p3 shrink-0 bg-stone-600 text-white">
    <div class="h6 align-middle">
      Stage (PX):
      <span class="inline-block i-fa-arrow-right relative top-0.5"></span>
      {stageLoc.x}
      <span class="inline-block i-fa-arrow-down relative top-0.5"></span>
      {stageLoc.y}
      |
      {stageLoc.w}x{stageLoc.h}
    </div>
    <div class="h6">
      Aspect Ratio: {JSON.stringify(Math.round(aspectRatio * 100) / 100)}
    </div>
    <div class="h6">
      [{B.dimension}] | Canvas: {B.bandSize}x{stageLength} | {shift} ({B.loopPos(
        shift,
      )})
    </div>
  </div>
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
  <div class="basis-24 p3 grow-0 shrink-0 bg-slate-600">
    <div class="bg-white/20">
      {#each B.bands as band, i (i)}
        {@const scale = i + 1}
        <div
          class={[
            "flex flex-col",
            { "shadow-[inset_0_0_1px_#fff]": i === B.dimension },
          ]}
        >
          {#each band as line, i (i)}
            <div class="flex relative">
              {#each line as block, j}
                <div
                  style={`background-color: ${block}; width: ${8 / scale}px; height: ${8 / scale}px`}
                ></div>
              {/each}
            </div>
          {/each}
        </div>
      {/each}
    </div>
  </div>
</div>
