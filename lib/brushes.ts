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

export function createStarsPen(pen: CanvasRenderingContext2D, density: number) {
  // const pen = canvas.get
  pen.fillStyle = "black";

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

export function createStarsBgPenAI(
  pen: CanvasRenderingContext2D,
  density: number,
) {
  const stars: any[] = [];

  const STAR_VOLUME = 2;
  const STAR_COUNT = density;

  // Generate stars in 3D
  for (let i = 0; i < STAR_COUNT; i++) {
    stars.push({
      x: (Math.random() - 0.5) * STAR_VOLUME,
      y: (Math.random() - 0.5) * STAR_VOLUME,
      z: (Math.random() - 0.5) * STAR_VOLUME,
      r: Math.random() * 1.2 + 0.2,
      hue: Math.random() > 0.05 ? Math.random() * 60 + 200 : Math.random() * 40,
      twinkle: Math.random() * Math.PI * 2,
    });
  }

  function draw(angle: number) {
    const w = pen.canvas.width;
    const h = pen.canvas.height;

    pen.fillStyle = "black";
    pen.fillRect(0, 0, w, h);

    const cos = Math.cos(angle);
    const sin = Math.sin(angle);

    const projected = [];

    for (const star of stars) {
      // rotate around Y axis
      const rx = star.x * cos - star.z * sin;
      const rz = star.x * sin + star.z * cos;

      const ry = star.y;

      const perspective = 1 / (rz + 2); // shift camera

      const sx = rx * perspective * w + w / 2;
      const sy = ry * perspective * h + h / 2;

      projected.push({
        x: sx,
        y: sy,
        depth: rz,
        size: star.r * perspective * 3,
        hue: star.hue,
        twinkle: (star.twinkle += 0.02),
      });
    }

    // draw far stars first
    projected.sort((a, b) => a.depth - b.depth);

    for (const star of projected) {
      const intensity = 0.5 + 0.5 * Math.sin(star.twinkle);

      pen.beginPath();
      pen.fillStyle = `hsl(${star.hue},100%,${70 * intensity}%)`;
      pen.arc(star.x, star.y, star.size, 0, Math.PI * 2);
      pen.fill();
    }
  }

  return { draw };
}

// export function createStarsBgPen(
//   pen: CanvasRenderingContext2D,
//   density: number,
// ) {
//   pen.fillStyle = "black";

//   let stars = [];

//   // Generate the stars in a 3D matrix

//   function draw(angle: number) {
//     const w = pen.canvas.width;
//     const h = pen.canvas.height;
//     pen.fillRect(0, 0, w, h);

//     // Render the stars from the angle point of view
//   }

//   return { draw };
// }

export function createSquarePen(pen: CanvasRenderingContext2D) {
  // console.log("Creating pen");
  function draw(x: number, y: number, scale: number, color: string | null) {
    // console.log("Drawing", x, y, scale, color);
    if (!color) {
      pen.clearRect(Math.floor(x), Math.floor(y), scale, scale);
    } else {
      pen.fillStyle = color;
      pen.fillRect(Math.floor(x), Math.floor(y), scale, scale);
    }
  }

  function clear() {
    pen.clearRect(0, 0, pen.canvas.width, pen.canvas.height);
  }

  return { draw, clear };
}
