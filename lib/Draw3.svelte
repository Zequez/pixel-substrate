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

  let STARS_DOWNSCALING = 1;

  let MAX_DOWNSCALING = 6;
  let downscaling = $state(3);
  let DIRECTION = 1;

  let stageLoc = $state({ x: 0, y: 0, w: 1, h: 1 });
  let aspectRatio = $derived(stageLoc.w / stageLoc.h);
  let cross = $derived(2 ** (downscaling - 1));

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
    canvasSquares.width = Math.floor(cross * aspectRatio);
    canvasSquares.height = cross;
  }

  function drawSquares() {
    const { w, h, x, y } = stageLoc;
    squarePen.draw(0, 0, 1, "yellow");
    squarePen.draw(1, 0, 1, "pink");
    squarePen.draw(0, 2, 1, "red");
    squarePen.draw(1, 2, 1, "blue");
    squarePen.draw(1, 3, 1, "green");
    squarePen.draw(0, 4, 1, "red");
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
        break;
      }
      case "KeyW":
      case "ArrowUp": {
        downscaling = Math.min(MAX_DOWNSCALING, downscaling + 1);
        break;
      }
      case "KeyA":
      case "ArrowLeft": {
        // P.xShift -= 1;
        // reDrawCells(true);
        break;
      }
      case "KeyD":
      case "ArrowRight": {
        // P.xShift += 1;
        // reDrawCells(true);
        break;
      }
    }

    resizeSquaresCanvas();
    drawSquares();
  }
</script>

<svelte:window onresize={handleStageResize} onkeypress={handleKeyPress} />

<div class="flex flex-col h-[100dvh]">
  <div class="basis-20 bg-red"></div>
  <div class="basis-60 relative flex-grow bg-gray-900" bind:this={stage}>
    <canvas
      class={["absolute top-0 left-0 w-full h-full z-4", props.class]}
      bind:this={canvasGrid}
    ></canvas>
    <canvas
      style="image-rendering: pixelated;"
      class={["absolute top-0 left-0 w-full h-full z-3", props.class]}
      bind:this={canvasSquares}
    ></canvas>
    <canvas
      style="image-rendering: pixelated;"
      bind:this={canvasGrid}
      class={["absolute top-0 left-0 w-full h-full z-2 ", props.class]}
      bind:this={canvasStars}
    ></canvas>
  </div>
  <div class="basis-20 bg-blue"></div>
</div>
