"use client";

import { useEffect, useState } from "react";

export const useIsDesktop = () => {
  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    const resize = () => {
      setIsDesktop(window.innerWidth > 1024);
    };

    resize();

    window.addEventListener("resize", resize);

    return () => {
      window.removeEventListener("resize", resize);
    };
  }, []);

  return isDesktop;
};