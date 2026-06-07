import React, { useRef, useEffect, useState } from "react";

export const CanvasRevealEffect = ({
  animationSpeed = 0.4,
  containerClassName = "",
  colors = [[59, 130, 246], [139, 92, 246]],
  opacities = [0.2, 0.2, 0.2, 0.2, 0.2, 0.4, 0.4, 0.4, 0.4, 1],
  dotSize = 2,
  showGradient = true
}) => {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const [mouse, setMouse] = useState({ x: 0, y: 0, active: false });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    let animationFrameId;
    let time = 0;

    const handleResize = () => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      canvas.width = rect.width;
      canvas.height = rect.height;
    };

    handleResize();
    window.addEventListener("resize", handleResize);

    const draw = () => {
      if (!canvas || !ctx) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      time += animationSpeed * 0.05;

      const spacing = 16;
      const cols = Math.floor(canvas.width / spacing) + 1;
      const rows = Math.floor(canvas.height / spacing) + 1;

      // Reveal circle radius around mouse cursor
      const revealRadius = 180;

      for (let i = 0; i < cols; i++) {
        for (let j = 0; j < rows; j++) {
          const dotX = i * spacing + 8;
          const dotY = j * spacing + 8;

          // Default styling (base idle state)
          let opacity = opacities[0];
          let r = colors[0][0];
          let g = colors[0][1];
          let b = colors[0][2];

          if (mouse.active) {
            const dx = dotX - mouse.x;
            const dy = dotY - mouse.y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (dist < revealRadius) {
              // Normalized factor from 0 (at cursor) to 1 (at border radius limit)
              const factor = dist / revealRadius;
              
              // Map to correct opacity stages from props
              const opacityIndex = Math.min(
                Math.floor((1 - factor) * opacities.length),
                opacities.length - 1
              );
              opacity = opacities[opacityIndex];

              // Blends colors dynamically using a smooth math sine transition
              const colorRatio = (Math.sin(factor * Math.PI - time) + 1) / 2;
              const activeColor = colors[1] && colors[0] ? colors[0].map((c, idx) => 
                Math.round(c * (1 - colorRatio) + colors[1][idx] * colorRatio)
              ) : colors[0];
              
              r = activeColor[0];
              g = activeColor[1];
              b = activeColor[2];
            }
          }

          // Render circle particles
          ctx.beginPath();
          ctx.arc(dotX, dotY, dotSize, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${opacity})`;
          ctx.fill();
        }
      }

      animationFrameId = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      window.removeEventListener("resize", handleResize);
      cancelAnimationFrame(animationFrameId);
    };
  }, [mouse, colors, opacities, dotSize, animationSpeed]);

  const handleMouseMove = (e) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    setMouse({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
      active: true
    });
  };

  const handleMouseLeave = () => {
    setMouse((prev) => ({ ...prev, active: false }));
  };

  const handleMouseEnter = () => {
    setMouse((prev) => ({ ...prev, active: true }));
  };

  return (
    <div
      ref={containerRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onMouseEnter={handleMouseEnter}
      className={`absolute inset-0 w-full h-full ${containerClassName}`}
    >
      <canvas ref={canvasRef} className="block w-full h-full" />
    </div>
  );
};
