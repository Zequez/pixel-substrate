export function createGridPen(
  pen: CanvasRenderingContext2D,
  downscaling: number,
  axis: "x" | "y",
) {
  function draw(x: number, y: number, w: number, h: number) {
    pen.clearRect(0, 0, pen.canvas.width, pen.canvas.height);
    pen.fillRect(0, 0, pen.canvas.width, pen.canvas.height);
    pen.strokeStyle = "white";
    pen.lineWidth = 0.5;
  }

  return { draw };
}

export function createStarsPen(
  pen: CanvasRenderingContext2D,
  density2: number,
) {
  // const pen = canvas.get
  pen.fillStyle = "black";

  const density = density2;

  function draw(x: number, y: number, w: number, h: number) {
    pen.fillRect(x, y, w, h);

    const count = Math.floor((w * h) / density); // density-based
    for (let i = 0; i < count; ++i) {
      const star = {
        x: Math.random() * w,
        y: Math.random() * h,
        r: Math.random() * 1.2 + 0.2,
        hue:
          Math.random() > 0.05
            ? Math.random() * 60 + 200
            : Math.random() * 40 + 0, // bluish to whitish
        twinkle: Math.random() * Math.PI * 2,
      };

      const intensity =
        0.5 + 0.5 * Math.sin((star.twinkle += 0.02 + Math.random() * 0.01));

      pen.beginPath();
      pen.fillStyle = `hsl(${star.hue}, 100%, ${70 * intensity}%)`;
      pen.arc(star.x, star.y, star.r, 0, Math.PI * 2);
      pen.fill();
    }
  }

  return { draw };
}

export function createSquarePen(pen: CanvasRenderingContext2D) {
  // console.log("Creating pen");
  function draw(x: number, y: number, scale: number, color: string) {
    // console.log("Drawing", x, y, scale, color);
    pen.fillStyle = color;
    pen.fillRect(Math.floor(x), Math.floor(y), scale, scale);
  }

  function clear() {
    pen.clearRect(0, 0, pen.canvas.width, pen.canvas.height);
  }

  return { draw, clear };
}
