<script lang="ts">
  // ██╗███╗   ███╗██████╗  ██████╗ ██████╗ ████████╗███████╗
  // ██║████╗ ████║██╔══██╗██╔═══██╗██╔══██╗╚══██╔══╝██╔════╝
  // ██║██╔████╔██║██████╔╝██║   ██║██████╔╝   ██║   ███████╗
  // ██║██║╚██╔╝██║██╔═══╝ ██║   ██║██╔══██╗   ██║   ╚════██║
  // ██║██║ ╚═╝ ██║██║     ╚██████╔╝██║  ██║   ██║   ███████║
  // ╚═╝╚═╝     ╚═╝╚═╝      ╚═════╝ ╚═╝  ╚═╝   ╚═╝   ╚══════╝
  // #region Imports

  import { onMount, tick } from "svelte";
  import { render } from "svelte/server";
  import { createStarsPen, createSquarePen, createGridPen } from "./brushes";
  import { createBandsState, type Band, type LCHA } from "./bands.state.svelte";
  import { lchaToRgba, hexRgbaToLcha, interpolatePoints } from "./utils3";
  import { lsState } from "/@shared/ls-state.svelte";

  const props: { class?: any } = $props();

  let shellEl: HTMLDivElement;
  let stage: HTMLDivElement;
  let canvasStars: HTMLCanvasElement;
  let canvasGrid: HTMLCanvasElement;
  let canvasSquares: HTMLCanvasElement;
  let canvasCursor: HTMLCanvasElement;
  let miniMapCanvasEl: HTMLCanvasElement;

  let starsPen: ReturnType<typeof createStarsPen> = null!;
  let squarePen: ReturnType<typeof createSquarePen> = null!;

  const STARS_DOWNSCALING = 1;

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

  let minimapLoc = $state({ x: 0, y: 0, w: 0, h: 0 });

  let UI = lsState("UI", {
    showDetails: false,
    showMiniMap: true,
  });

  // black   : lch(0%   0   0)
  // red     : lch(60%  80  30)
  // orange  : lch(70%  80  60)
  // yellow  : lch(90%  80 100)
  // green   : lch(65%  80 140)
  // cyan    : lch(70%  70 200)
  // blue    : lch(55%  80 260)
  // violet  : lch(60%  80 310)
  // white   : lch(100% 0   0)

  let color = $state<LCHA | null>([100, 0, 140, 1]);
  let colorString = $derived(color ? lchaToRgba(...color) : null);

  // Mouse position tracking
  // #######################

  type SquareCoord = { cross: number; axis: number };

  let mousePosClient = $state({ x: 0, y: 0 }); // check handleMouseMove
  let mousePosStage = $derived(clientPosToStagePos(mousePosClient));
  let mousePosBand: SquareCoord = $derived(stagePosToBandPos(mousePosStage));
  let axisBlockSize = $derived(stageLoc.w / stageLength);
  let crossBlockSize = $derived(stageLoc.h / B.bandSize);
  let mousePosColor = $derived(
    B.sampleColor(mousePosBand.axis, mousePosBand.cross),
  );
  let mouseIndicatorDark = $derived(
    mousePosColor ? hexRgbaToLcha(mousePosColor)[0] > 50 : null,
  );

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
    | { type: "inactive" }
    | { type: "moving" }
    | { type: "penDown"; lastPos: SquareCoord }
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
    drawMinimap();
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

    if (miniMapCanvasEl) {
      let minimapRect = miniMapCanvasEl.getBoundingClientRect();
      minimapLoc = {
        w: minimapRect.width,
        h: minimapRect.height,
        x: minimapRect.left,
        y: minimapRect.top,
      };
    }

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

  function drawMinimapPartial(coords: SquareCoord[], color: string | null) {
    if (miniMapCanvasEl) {
      const minimapPen = createSquarePen(miniMapCanvasEl.getContext("2d")!);
      const BN = 0;
      const band = B.band;
      coords.forEach((coord) => {
        const cursor = B.cursor % B.BANDS_MAX_SIZES[B.dimension]!;
        minimapPen.draw(cursor + coord.axis, coord.cross, 1, color);
      });
    }
  }

  function drawMinimap() {
    if (miniMapCanvasEl) {
      const minimapPen = createSquarePen(miniMapCanvasEl.getContext("2d")!);
      // const BN = 0;
      // const band = B.bands[BN]!;
      const band = B.band;
      // minimapPen.draw(0, 0)

      const size = B.BANDS_MAX_SIZES[B.dimension]!;
      miniMapCanvasEl.width = size;
      miniMapCanvasEl.height = band.length;
      minimapPen.clear();
      band.forEach((line, cross) => {
        line.forEach((color, axis) => {
          minimapPen.draw(axis, cross, 1, color);
        });
      });
      // B.BANDS_MAX_SIZES.forEach((size, i) => {
      //   const band = B.bands[i]!;

      //   minimapPen.draw()
      // });
    }
  }

  async function toggleFullscreen() {
    if (document.fullscreenElement === shellEl!) {
      await document.exitFullscreen();
      return;
    }

    await shellEl!.requestFullscreen();
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

  // ██╗  ██╗███████╗██╗   ██╗██████╗  ██████╗  █████╗ ██████╗ ██████╗
  // ██║ ██╔╝██╔════╝╚██╗ ██╔╝██╔══██╗██╔═══██╗██╔══██╗██╔══██╗██╔══██╗
  // █████╔╝ █████╗   ╚████╔╝ ██████╔╝██║   ██║███████║██████╔╝██║  ██║
  // ██╔═██╗ ██╔══╝    ╚██╔╝  ██╔══██╗██║   ██║██╔══██║██╔══██╗██║  ██║
  // ██║  ██╗███████╗   ██║   ██████╔╝╚██████╔╝██║  ██║██║  ██║██████╔╝
  // ╚═╝  ╚═╝╚══════╝   ╚═╝   ╚═════╝  ╚═════╝ ╚═╝  ╚═╝╚═╝  ╚═╝╚═════╝

  function handleKeyPress(ev: KeyboardEvent) {
    switch (ev.code) {
      case "KeyS":
      case "ArrowDown": {
        B.nextDimension();
        resizeSquaresCanvas();
        drawMinimap();
        break;
      }
      case "KeyW":
      case "ArrowUp": {
        B.previousDimension();
        resizeSquaresCanvas();
        drawMinimap();
        break;
      }
      case "KeyA":
      case "ArrowLeft": {
        if (ev.shiftKey) {
          B.shift(-4);
        } else {
          B.shift(-1);
        }

        break;
      }
      case "KeyD":
      case "ArrowRight": {
        if (ev.shiftKey) {
          B.shift(4);
        } else {
          B.shift(1);
        }
        break;
      }
      case "KeyR": {
        B.fillWithGiberish(Math.floor(mousePosBand.axis));
        drawSquares();
        drawMinimap();
        break;
      }
      case "KeyT": {
        B.fillWithSpectrum(Math.floor(mousePosBand.axis));
        drawSquares();
        drawMinimap();
        break;
      }
      case "KeyF": {
        B.emptySpace(Math.floor(mousePosBand.axis));
        drawMinimap();
        break;
      }
      case "KeyE": {
        B.addSpace(Math.floor(mousePosBand.axis + 1));
        drawMinimap();
        break;
      }
      case "KeyQ": {
        B.removeSpace(Math.floor(mousePosBand.axis));
        drawMinimap();
        break;
      }
      case "Comma": {
        UI.showDetails = !UI.showDetails;
        tick().then(() => {
          readDimensionFromStage();
          drawStars();
          drawSquares();
          drawMinimap();
        });

        break;
      }
      case "KeyM": {
        UI.showMiniMap = !UI.showMiniMap;
        tick().then(() => {
          readDimensionFromStage();
          drawStars();
          drawSquares();
          drawMinimap();
        });
        break;
      }
      case "Enter": {
        toggleFullscreen();
      }
    }

    // console.log("Pressed", ev.code);

    drawSquares();
  }

  // ██████╗  ██████╗ ██╗███╗   ██╗████████╗███████╗██████╗
  // ██╔══██╗██╔═══██╗██║████╗  ██║╚══██╔══╝██╔════╝██╔══██╗
  // ██████╔╝██║   ██║██║██╔██╗ ██║   ██║   █████╗  ██████╔╝
  // ██╔═══╝ ██║   ██║██║██║╚██╗██║   ██║   ██╔══╝  ██╔══██╗
  // ██║     ╚██████╔╝██║██║ ╚████║   ██║   ███████╗██║  ██║
  // ╚═╝      ╚═════╝ ╚═╝╚═╝  ╚═══╝   ╚═╝   ╚══════╝╚═╝  ╚═╝
  // #region POINTER

  function handlePointerDown(ev: PointerEvent) {
    const { cross, axis } = mousePosBand;
    if (ev.button === 1) {
      B.fillSpace(axis, cross, stageLength, colorString);
      drawSquares();
    } else if (ev.button === 0) {
      const sampled = B.sampleColor(axis, cross);
      pointerState = { type: "penDown", lastPos: { cross, axis } };
      B.paint(axis, cross, 1, colorString);
      // drawSquares(); // Maybe optimize later
      squarePen.draw(axis, cross, 1, colorString);
      drawMinimapPartial([{ axis, cross }], colorString);
    } else if (ev.button === 2) {
      const sampled = B.sampleColor(axis, cross);
      color = sampled ? hexRgbaToLcha(sampled) : null;
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
        const prevPos = pointerState.lastPos;
        const { cross, axis } = mousePosBand;
        const points = interpolatePoints(prevPos, { cross, axis });

        const sampled = B.sampleColor(axis, cross);
        // const colorStringNow =
        // sampled === null && colorString === null ? "#ffffffff" : colorString;

        points.forEach(({ axis, cross }) => {
          B.paint(axis, cross, 1, colorString);
          squarePen.draw(axis, cross, 1, colorString);
        });
        drawMinimapPartial(points, colorString);
        pointerState.lastPos = { cross, axis };
        // drawSquares(); // Maybe optimize later
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

<div
  style={`flex-direction: ${flexDirection};`}
  class="flex h-[100dvh]"
  bind:this={shellEl}
>
  <!-- #region Data
    ################################### -->
  {#if UI.showDetails}
    <div class="basis-24 p3 shrink-0 flex bg-stone-600 text-white">
      <div class="flex">
        <div>
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
        <div class="grow"></div>
        <!-- <div class="flex w-60% flex-wrap space-x-1">
          <div class="bg-black text-white rounded-1 px-1">A-D = Move band</div>
          <div class="bg-black text-white rounded-1 px-1">
            W-S = UP / DOWN density dimensions
          </div>
          <div class="bg-black text-white rounded-1 px-1">
            F = Erase cross line
          </div>
          <div class="bg-black text-white rounded-1 px-1">
            R = Fill cross line with colors
          </div>
          <div class="bg-black text-white rounded-1 px-1">
            Shift+R = Fill cross line with a spectrum color pallette
          </div>
          <div class="bg-black text-white rounded-1 px-1">
            E = Insert space in between
          </div>
          <div class="bg-black text-white rounded-1 px-1">Q = Remove space</div>
          <div class="bg-black text-white rounded-1 px-1">
            Left Click: Paint
          </div>
          <div class="bg-black text-white rounded-1 px-1">
            Middle Click: Fill
          </div>
          <div class="bg-black text-white rounded-1 px-1">
            Right Click: Sample color
          </div>
        </div> -->
      </div>
    </div>
  {/if}
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
        background-color: ${colorString ? colorString.slice(0, 7) + "aa" : "transparent"};
        border-color: ${mouseIndicatorDark ? "#00000033" : "#ffffff33"};
        transform: translate(${Math.floor(mousePosBand.axis) * axisBlockSize}px, ${Math.floor(mousePosBand.cross) * crossBlockSize}px);
      `}
      class="pointer-events-none b-1.5 absolute left-0 top-0 z-10 rounded-1"
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
      class="absolute bottom-0 pointer-events-none left-1/2 -translate-x-1/2 inline-flex z-5 overflow-hidden w-20 h-10"
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
  {#if UI.showMiniMap}
    <div class="relative h40 p1.5 grow-0 shrink-0 bg-slate-600">
      <div class="relative size-full overflow-hidden">
        {#if minimapLoc.w > 0}
          {@const minimapBlockSize =
            (1 / B.BANDS_MAX_SIZES[B.dimension]!) * minimapLoc.w}
          {@const minimapVisorSize = minimapBlockSize * stageLength}
          {@const posX = (B.cursor * minimapBlockSize) % minimapLoc.w}
          <div
            style={`transform: translateX(${posX}px); width: ${minimapVisorSize}px;`}
            class="absolute top-0 left-0 h-full bg-white/50 b b-white"
          ></div>
        {/if}
        <canvas
          style="image-rendering: pixelated;"
          bind:this={miniMapCanvasEl}
          class="bg-black rounded-1 size-full"
        ></canvas>
      </div>
    </div>
    <!-- <div class="basis-24 p3 grow-0 shrink-0 bg-slate-600">
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
    </div> -->
  {/if}
</div>
