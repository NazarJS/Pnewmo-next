import { useCallback, useState } from "react";

export const useOpenInput = () => {
  const [activePanel, setActivePanel] = useState<"search" | "catalog" | "mobileCatalog" | null>(
    null,
  );

  const togglePanel = (panel: "search" | "catalog" | "mobileCatalog") => {
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
    isMobileCatalogOpen: activePanel === "mobileCatalog",
    isCatalogOpen: activePanel === "catalog"
  };
};
