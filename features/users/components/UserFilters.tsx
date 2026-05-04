"use client"

import { useRouter, useSearchParams } from "next/navigation"
import { useCallback, useEffect, useState } from "react"

const COUNTRIES = [
  "Afghanistan", "Australia", "Brazil", "Cambodia", "China", "Colombia",
  "India", "Indonesia", "Japan", "Madagascar", "Malawi", "Malaysia",
  "Mozambique", "Myanmar", "Pakistan", "Philippines", "Russia",
  "Singapore", "South Korea", "Sri Lanka", "Tanzania", "Thailand",
  "UK", "USA", "Vietnam", "Zambia", "Zimbabwe",
].sort()

type FilterKey = "country" | "state" | "city"
type Props = { country?: string; state?: string; city?: string }

const DEBOUNCE_MS = 400

const fieldClass =
  "h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-800 placeholder:text-slate-400 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:border-primary/50"

export function UserFilters({ country = "", state: stateProp = "", city: cityProp = "" }: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [stateInput, setStateInput] = useState(stateProp)
  const [cityInput, setCityInput] = useState(cityProp)

  useEffect(() => { setStateInput(stateProp) }, [stateProp])
  useEffect(() => { setCityInput(cityProp) }, [cityProp])

  const updateFilter = useCallback(
    (key: FilterKey, value: string) => {
      const params = new URLSearchParams(searchParams.toString())
      const trimmed = value?.trim() ?? ""
      if (trimmed) params.set(key, trimmed)
      else params.delete(key)
      params.delete("page")
      router.push(`/admin/users?${params.toString()}`)
    },
    [router, searchParams]
  )

  useEffect(() => {
    const t = setTimeout(() => {
      if (stateInput !== stateProp) updateFilter("state", stateInput)
    }, DEBOUNCE_MS)
    return () => clearTimeout(t)
  }, [stateInput, stateProp, updateFilter])

  useEffect(() => {
    const t = setTimeout(() => {
      if (cityInput !== cityProp) updateFilter("city", cityInput)
    }, DEBOUNCE_MS)
    return () => clearTimeout(t)
  }, [cityInput, cityProp, updateFilter])

  return (
    <div className="flex flex-wrap items-center gap-2">
      <label htmlFor="filter-country" className="text-xs font-medium text-slate-500">
        Country
      </label>
      <select
        id="filter-country"
        value={country}
        onChange={(e) => updateFilter("country", e.target.value)}
        className={`${fieldClass} min-w-[140px]`}
      >
        <option value="">All countries</option>
        {COUNTRIES.map((c) => <option key={c} value={c}>{c}</option>)}
      </select>

      <label htmlFor="filter-state" className="text-xs font-medium text-slate-500 sm:ml-2">
        State
      </label>
      <input
        id="filter-state"
        type="text"
        value={stateInput}
        onChange={(e) => setStateInput(e.target.value)}
        placeholder="Filter by state"
        className={`${fieldClass} min-w-[120px]`}
      />

      <label htmlFor="filter-city" className="text-xs font-medium text-slate-500 sm:ml-2">
        City
      </label>
      <input
        id="filter-city"
        type="text"
        value={cityInput}
        onChange={(e) => setCityInput(e.target.value)}
        placeholder="Filter by city"
        className={`${fieldClass} min-w-[120px]`}
      />
    </div>
  )
}
