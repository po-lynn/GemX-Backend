"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

const COUNTRIES = [
  "Afghanistan", "Australia", "Brazil", "Cambodia", "China", "Colombia",
  "India", "Indonesia", "Japan", "Madagascar", "Malawi", "Malaysia",
  "Mozambique", "Myanmar", "Pakistan", "Philippines", "Russia",
  "Singapore", "South Korea", "Sri Lanka", "Tanzania", "Thailand",
  "UK", "USA", "Vietnam", "Zambia", "Zimbabwe",
].sort();

type FilterKey = "country" | "state" | "city";

type Props = {
  country?: string;
  state?: string;
  city?: string;
};

const DEBOUNCE_MS = 400;

const selectClass =
  "h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring";
const inputClass =
  "h-9 w-full min-w-[120px] rounded-md border border-input bg-transparent px-3 py-1 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring";

export function UserFilters({
  country = "",
  state: stateProp = "",
  city: cityProp = "",
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [stateInput, setStateInput] = useState(stateProp);
  const [cityInput, setCityInput] = useState(cityProp);

  useEffect(() => {
    setStateInput(stateProp);
  }, [stateProp]);
  useEffect(() => {
    setCityInput(cityProp);
  }, [cityProp]);

  const updateFilter = useCallback(
    (key: FilterKey, value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      const trimmed = value?.trim() ?? "";
      if (trimmed) params.set(key, trimmed);
      else params.delete(key);
      params.delete("page");
      router.push(`/admin/users?${params.toString()}`);
    },
    [router, searchParams]
  );

  useEffect(() => {
    const t = setTimeout(() => {
      if (stateInput !== stateProp) updateFilter("state", stateInput);
    }, DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [stateInput, stateProp, updateFilter]);

  useEffect(() => {
    const t = setTimeout(() => {
      if (cityInput !== cityProp) updateFilter("city", cityInput);
    }, DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [cityInput, cityProp, updateFilter]);

  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="flex items-center gap-2">
        <label htmlFor="filter-country" className="text-sm font-medium text-muted-foreground">
          Country
        </label>
        <select
          id="filter-country"
          value={country}
          onChange={(e) => updateFilter("country", e.target.value)}
          className={`${selectClass} min-w-[140px]`}
        >
          <option value="">All</option>
          {COUNTRIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>
      <div className="flex items-center gap-2">
        <label htmlFor="filter-state" className="text-sm font-medium text-muted-foreground">
          State
        </label>
        <input
          id="filter-state"
          type="text"
          value={stateInput}
          onChange={(e) => setStateInput(e.target.value)}
          placeholder="Filter by state"
          className={inputClass}
        />
      </div>
      <div className="flex items-center gap-2">
        <label htmlFor="filter-city" className="text-sm font-medium text-muted-foreground">
          City
        </label>
        <input
          id="filter-city"
          type="text"
          value={cityInput}
          onChange={(e) => setCityInput(e.target.value)}
          placeholder="Filter by city"
          className={inputClass}
        />
      </div>
    </div>
  );
}
