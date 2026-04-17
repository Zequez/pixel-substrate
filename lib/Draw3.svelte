<script lang="ts">
  // ██╗███╗   ███╗██████╗  ██████╗ ██████╗ ████████╗███████╗
  // ██║████╗ ████║██╔══██╗██╔═══██╗██╔══██╗╚══██╔══╝██╔════╝
  // ██║██╔████╔██║██████╔╝██║   ██║██████╔╝   ██║   ███████╗
  // ██║██║╚██╔╝██║██╔═══╝ ██║   ██║██╔══██╗   ██║   ╚════██║
  // ██║██║ ╚═╝ ██║██║     ╚██████╔╝██║  ██║   ██║   ███████║
  // ╚═╝╚═╝     ╚═╝╚═╝      ╚═════╝ ╚═╝  ╚═╝   ╚═╝   ╚══════╝
  // #region Imports

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

  // ███████╗████████╗ █████╗ ████████╗███████╗
  // ██╔════╝╚══██╔══╝██╔══██╗╚══██╔══╝██╔════╝
  // ███████╗   ██║   ███████║   ██║   █████╗
  // ╚════██║   ██║   ██╔══██║   ██║   ██╔══╝
  // ███████║   ██║   ██║  ██║   ██║   ███████╗
  // ╚══════╝   ╚═╝   ╚═╝  ╚═╝   ╚═╝   ╚══════╝
  // #region State

  let direction: "r" | "b" | "t" | "l" = $state("r");
  let flexDirection = $derived(direction === "r" ? "column" : "row");

  let stageLoc = $state({ x: 0, y: 0, w: 1, h: 1 });
  let aspectRatio = $derived(stageLoc.w / stageLoc.h);
  let shift = $state(0);

  let B = createBandsState({ maxBands: 6, initialBand: 3, minLength: 6 });
  let stageLength = $derived(Math.floor(B.bandSize * aspectRatio));
  let stageSlice = $derived(B.readBand(shift, stageLength));

  type SquareCoord = { cross: number; axis: number };

  // Mouse position tracking
  // #######################

  let mouseMoved = $state(false);
  let mousePosClient = $state({ x: 0, y: 0 }); // check handleMouseMove
  let mousePosStage = $derived(clientPosToStagePos(mousePosClient));
  let mousePosBand = $state<SquareCoord>({ cross: 0, axis: 0 });

  function clientPosToStagePos(clientPos: { x: number; y: number }) {
    return {
      x: Math.max(0, clientPos.x - stageLoc.x),
      y: Math.max(0, clientPos.y - stageLoc.y),
    };
  }

  let stagePosToAngle = $derived.by(() => {
    const { x, y } = mousePosStage;
    const { w, h } = stageLoc;

    const originX = w / 2;
    const originY = h;

    const dx = x - originX;
    const dy = originY - y;

    const angleRad = Math.atan2(dx, dy);
    const angleDeg = angleRad * (180 / Math.PI);

    return angleDeg;
  });

  let pointerState = $state<null | {
    type: "penDown";
    lastPos: SquareCoord;
  }>(null);

  // for (let level = 0; level <= MAX_DOWNSCALING; level++) {
  //   const crossForLevel = 2 ** level;
  //   bands[level] = Array(crossForLevel).fill(["yellow", "orange", "blue"]);
  // }

  //  ██████╗ ███╗   ██╗███╗   ███╗ ██████╗ ██╗   ██╗███╗   ██╗████████╗
  // ██╔═══██╗████╗  ██║████╗ ████║██╔═══██╗██║   ██║████╗  ██║╚══██╔══╝
  // ██║   ██║██╔██╗ ██║██╔████╔██║██║   ██║██║   ██║██╔██╗ ██║   ██║
  // ██║   ██║██║╚██╗██║██║╚██╔╝██║██║   ██║██║   ██║██║╚██╗██║   ██║
  // ╚██████╔╝██║ ╚████║██║ ╚═╝ ██║╚██████╔╝╚██████╔╝██║ ╚████║   ██║
  //  ╚═════╝ ╚═╝  ╚═══╝╚═╝     ╚═╝ ╚═════╝  ╚═════╝ ╚═╝  ╚═══╝   ╚═╝
  // #region On Mount

  onMount(() => {
    // gridPen = createGridPen(canvasGrid.getContext("2d")!, dimension, "x");
    starsPen = createStarsPen(canvasStars.getContext("2d")!, 100);
    squarePen = createSquarePen(canvasSquares.getContext("2d")!);

    readDimensionFromStage();
    drawStars();
    drawSquares();
  });

  //  ██████╗ ██████╗ ███╗   ███╗███╗   ███╗ █████╗ ███╗   ██╗██████╗ ███████╗
  // ██╔════╝██╔═══██╗████╗ ████║████╗ ████║██╔══██╗████╗  ██║██╔══██╗██╔════╝
  // ██║     ██║   ██║██╔████╔██║██╔████╔██║███████║██╔██╗ ██║██║  ██║███████╗
  // ██║     ██║   ██║██║╚██╔╝██║██║╚██╔╝██║██╔══██║██║╚██╗██║██║  ██║╚════██║
  // ╚██████╗╚██████╔╝██║ ╚═╝ ██║██║ ╚═╝ ██║██║  ██║██║ ╚████║██████╔╝███████║
  //  ╚═════╝ ╚═════╝ ╚═╝     ╚═╝╚═╝     ╚═╝╚═╝  ╚═╝╚═╝  ╚═══╝╚═════╝ ╚══════╝

  // #region Cmd

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

  // ███████╗██╗   ██╗███████╗███╗   ██╗████████╗███████╗
  // ██╔════╝██║   ██║██╔════╝████╗  ██║╚══██╔══╝██╔════╝
  // █████╗  ██║   ██║█████╗  ██╔██╗ ██║   ██║   ███████╗
  // ██╔══╝  ╚██╗ ██╔╝██╔══╝  ██║╚██╗██║   ██║   ╚════██║
  // ███████╗ ╚████╔╝ ███████╗██║ ╚████║   ██║   ███████║
  // ╚══════╝  ╚═══╝  ╚══════╝╚═╝  ╚═══╝   ╚═╝   ╚══════╝
  // #region Events

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
    if (!mouseMoved) mouseMoved = true;
    mousePosClient = { x: ev.clientX, y: ev.clientY };
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

  // ████████╗██████╗ ███████╗██╗     ██╗     ██╗███████╗
  // ╚══██╔══╝██╔══██╗██╔════╝██║     ██║     ██║██╔════╝
  //    ██║   ██████╔╝█████╗  ██║     ██║     ██║███████╗
  //    ██║   ██╔══██╗██╔══╝  ██║     ██║     ██║╚════██║
  //    ██║   ██║  ██║███████╗███████╗███████╗██║███████║
  //    ╚═╝   ╚═╝  ╚═╝╚══════╝╚══════╝╚══════╝╚═╝╚══════╝
  // #region Trellis
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
      |
      {Math.round(mousePosStage.x)}x{Math.round(mousePosStage.y)}
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
    <div
      class="absolute bottom-0 left-1/2 -translate-x-1/2 inline-flex z-5 overflow-hidden w-20 h-10 bg-white/15 rounded-t-1"
    >
      <div
        class={`
        absolute bottom-0 left-1/2
        -translate-x-1/2
        bg-green-500/50
        rounded-t-full h-4 w-6 b-2 b-b-0 b-green-500`}
      ></div>

      {#if mouseMoved}
        <div
          style={`transform: rotate(${stagePosToAngle - 90}deg)`}
          class={`
        absolute bottom-0 left-1/2 origin-center-left translate-y-1px
        bg-green-200
        h-2px w-20px `}
        ></div>
      {/if}
      <div
        class={`
        absolute bottom-0 left-1/2
        -translate-x-1/2
        bg-green-400
        rounded-t-full h-2 w-5 b-2 b-b-0 b-green-500`}
      ></div>
    </div>
  </div>
  <div class="basis-24 p3 grow-0 shrink-0 bg-slate-600">
    <div class="bg-black flex-ss flex-col">
      {#each B.bands as band, i (i)}
        {@const scale = i + 1}
        {@const pxSize = 8 / scale}
        <div
          class={[
            "flex-ss flex-col relative ",
            { "bg-white/0": i === B.dimension },
          ]}
        >
          {#each band as line, j (j)}
            <div
              style={`width: ${pxSize * (line.length + 0)}px;`}
              class="flex relative"
            >
              {#each line as block, k (k)}
                <div
                  style={`background-color: ${block}; width: ${pxSize}px; height: ${pxSize}px`}
                ></div>
              {/each}
            </div>
          {/each}
          {#if i === B.dimension}
            <div
              style={`width: ${pxSize * stageLength}px; left: ${pxSize * shift}px`}
              class="absolute top-0 left-0 h-full b b-white/50 bg-white/20"
            ></div>
          {/if}
        </div>
      {/each}
    </div>
  </div>
</div>
