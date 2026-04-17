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
  import { createBandsState, type LCHA } from "./bands.state.svelte";
  import { lchaToRgba, hexRgbaToLcha } from "./utils3";

  const props: { class?: any } = $props();

  let stage: HTMLDivElement;
  let canvasStars: HTMLCanvasElement;
  let canvasGrid: HTMLCanvasElement;
  let canvasSquares: HTMLCanvasElement;
  let canvasCursor: HTMLCanvasElement;

  let starsPen: ReturnType<typeof createStarsPen> = null!;
  let squarePen: ReturnType<typeof createSquarePen> = null!;
  let gridPen: ReturnType<typeof createGridPen> = null!;
  let cursorPen: ReturnType<typeof createSquarePen> = null!;

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

  let B = createBandsState({ maxBands: 6, initialBand: 3, minLength: 6 });
  let stageLength = $derived(Math.floor(B.bandSize * aspectRatio));
  let stageSlice = $derived(B.readBand(B.cursor, stageLength));

  // black   : lch(0%   0   0)
  // red     : lch(60%  80  30)
  // orange  : lch(70%  80  60)
  // yellow  : lch(90%  80 100)
  // green   : lch(65%  80 140)
  // cyan    : lch(70%  70 200)
  // blue    : lch(55%  80 260)
  // violet  : lch(60%  80 310)
  // white   : lch(100% 0   0)

  let color = $state<LCHA>([65, 80, 140, 1]);
  // let colorString = $derived(
  //   `lch(${color[0]}% ${color[1]} ${color[2]} ${color[3]})`,
  // );
  let colorString = $derived(lchaToRgba(...color));

  // Mouse position tracking
  // #######################

  type SquareCoord = { cross: number; axis: number };

  let mousePosClient = $state({ x: 0, y: 0 }); // check handleMouseMove
  let mousePosStage = $derived(clientPosToStagePos(mousePosClient));
  let mousePosBand: SquareCoord = $derived(stagePosToBandPos(mousePosStage));
  let axisBlockSize = $derived(stageLoc.w / stageLength);
  let crossBlockSize = $derived(stageLoc.h / B.bandSize);

  function clientPosToStagePos(clientPos: { x: number; y: number }) {
    return {
      x: Math.max(0, clientPos.x - stageLoc.x),
      y: Math.max(0, clientPos.y - stageLoc.y),
    };
  }

  function stagePosToBandPos(pos: { x: number; y: number }): SquareCoord {
    const { x, y } = pos;
    const { w, h } = stageLoc;
    const maxAxis = stageLength;
    const maxCross = B.bandSize;
    const squareW = w / maxAxis;
    const squareH = h / maxCross;
    const axis = Math.round((x / squareW) * 100) / 100;
    const cross = Math.round((y / squareH) * 100) / 100;
    return { cross, axis };
  }

  // Angle for beautiful thing little hand

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

  // ##############################

  let pointerState = $state<
    { type: "inactive" } | { type: "moving" } | { type: "penDown" }
  >({ type: "inactive" });

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
    canvasCursor.width = w;
    canvasCursor.height = h;
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

  // SCREEN
  // #########################

  function handleStageResize() {
    readDimensionFromStage();
    drawStars();
    drawSquares();
  }

  // KEYBOARD
  // #########################

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
        B.shift(-1);
        break;
      }
      case "KeyD":
      case "ArrowRight": {
        B.shift(1);
        break;
      }
      case "Space": {
        B.fillWithGiberish(Math.floor(stageLength / 2));
        drawSquares();
      }
    }

    drawSquares();
  }

  // #region POINTER
  // #########################

  function handlePointerDown(ev: PointerEvent) {
    if (ev.button === 1) {
      return;
    } else if (ev.button === 0) {
      const { cross, axis } = mousePosBand;
      pointerState = { type: "penDown" };
      B.paint(axis, cross, 1, colorString);
      drawSquares(); // Maybe optimize later
      // squarePen.draw(axis, cross, 1, "#ffffff");
    } else if (ev.button === 2) {
      const { cross, axis } = mousePosBand;
      color = hexRgbaToLcha(B.sampleColor(axis, cross));
    }
  }

  function handlePointerMove(ev: PointerEvent) {
    mousePosClient = { x: ev.clientX, y: ev.clientY };

    switch (pointerState.type) {
      case "inactive": {
        pointerState = { type: "moving" };
        break;
      }
      case "moving": {
        break;
      }
      case "penDown": {
        const { cross, axis } = mousePosBand;
        B.paint(axis, cross, 1, colorString);
        drawSquares(); // Maybe optimize later
        // squarePen.draw(axis, cross, 1, "#ffffff");
        break;
      }
    }
  }

  function handlePointerLeave() {
    if (pointerState.type === "penDown") {
      pointerState = { type: "inactive" };
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
  <!-- #region Data
    ################################### -->
  <div class="basis-24 p3 shrink-0 bg-stone-600 text-white">
    <div class="h6 align-middle">
      Stage (PX):
      <span class="inline-block i-fa-arrow-right relative top-0.5"></span>
      {stageLoc.x}
      <span class="inline-block i-fa-arrow-down relative top-0.5"></span>
      {stageLoc.y}
      |
      {Math.round(stageLoc.w)}x{Math.round(stageLoc.h)} [{Math.round(
        mousePosStage.x,
      )}x{Math.round(mousePosStage.y)}]
    </div>
    <div class="h6">
      Aspect Ratio: {JSON.stringify(Math.round(aspectRatio * 100) / 100)}
    </div>
    <div class="h6">
      <div
        style={`background: ${colorString}`}
        class="inline-block h4 w4"
      ></div>
      [{B.dimension}] | SquarePos: {B.bandSize}x{stageLength} [{mousePosBand.cross},
      {mousePosBand.axis}] | {B.cursor} ({B.loopPos(B.cursor)})
    </div>
  </div>
  <div
    class="basis-60 relative flex-grow bg-gray-900 overflow-hidden"
    bind:this={stage}
  >
    <!-- <div
      class="w-2px pointer-events-none h-full bg-green-500/30 shadow-[0_0_14px] shadow-green-500 absolute top-0 left-0 z-5"
    ></div>
    <div
      class="w-2px pointer-events-none h-full bg-green-500/30 shadow-[0_0_14px] shadow-green-500 absolute top-0 right-0 z-5"
    ></div> -->
    <div
      style={`
        width: ${axisBlockSize}px;
        height: ${crossBlockSize}px;
        transform: translate(${Math.floor(mousePosBand.axis) * axisBlockSize}px, ${Math.floor(mousePosBand.cross) * crossBlockSize}px);
      `}
      class="bg-white/20 pointer-events-none b-1.5 b-white/50 absolute left-0 top-0 z-10 rounded-1"
    ></div>
    <!-- #region Canvas
    ################################### -->
    <canvas
      class={[
        "absolute top-0 left-0 w-full h-full z-4 pointer-events-none",
        props.class,
      ]}
      bind:this={canvasGrid}
    ></canvas>
    <canvas
      style="image-rendering: pixelated;"
      class={[
        "absolute top-0 left-0 w-full h-full z-4 pointer-events-none",
        props.class,
      ]}
      bind:this={canvasCursor}
    ></canvas>
    <canvas
      onpointerdown={handlePointerDown}
      onpointermove={handlePointerMove}
      onpointerleave={handlePointerLeave}
      onpointerup={handlePointerLeave}
      oncontextmenu={(ev) => ev.preventDefault()}
      style="image-rendering: pixelated;"
      class={[
        "absolute top-0 left-0 w-full h-full z-3 cursor-crosshair",
        props.class,
      ]}
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
    <!-- #region Thingy
    ################################### -->
    <div
      class="absolute bottom-0 pointer-events-none left-1/2 -translate-x-1/2 inline-flex z-5 overflow-hidden w-20 h-10 bg-white/15 rounded-t-1"
    >
      <div
        class={`
        absolute bottom-0 left-1/2
        -translate-x-1/2
        bg-green-500/50
        rounded-t-full h-4 w-6 b-2 b-b-0 b-green-500`}
      ></div>

      {#if pointerState.type !== "inactive"}
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
  <!-- #region Bands
    ################################### -->
  <div class="basis-24 p3 grow-0 shrink-0 bg-slate-600">
    <div class="bg-black rounded-1 flex-ss flex-col">
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
              style={`width: ${pxSize * stageLength}px; left: ${pxSize * B.cursor}px`}
              class="absolute top-0 left-0 h-full b b-white/50 bg-white/20"
            ></div>
          {/if}
        </div>
      {/each}
    </div>
  </div>
</div>
