// context/FilterContext.jsx
import { createContext, useContext, useState } from "react";

const FilterContext = createContext();

export function FilterProvider({ children }) {
  const [showFilters, setShowFilters] = useState(false);
  return (
    <FilterContext.Provider value={{ showFilters, setShowFilters }}>
      {children}
    </FilterContext.Provider>
  );
}

export const useFilter = () => useContext(FilterContext);