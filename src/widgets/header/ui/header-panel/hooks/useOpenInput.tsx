import { useCallback, useState } from "react";

export const useOpenInput = () => {
  const [activePanel, setActivePanel] = useState<"search" | "catalog" | null>(
    null,
  );

  const togglePanel = (panel: "search" | "catalog") => {
    setActivePanel((prev) => (prev === panel ? null : panel));
  };

  const closeAll = useCallback(() => {
    setActivePanel(null);
  },[]);

  return {
    activePanel,
    togglePanel,
    closeAll,
    isSearchOpen: activePanel === "search",
    isCatalogOpen: activePanel === "catalog",
  };
};
