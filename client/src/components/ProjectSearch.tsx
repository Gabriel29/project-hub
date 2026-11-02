import "./ProjectSearch.css";

import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { t } from "../i18n";
import type { SearchSuggestion } from "../services/api/projects";
import { projectsApi } from "../services/api/projects";

export function ProjectSearch({ select }: { select: (result: SearchSuggestion) => void }) {
  useTranslation();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState<SearchSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    setResults([]);
    setError("");
    setLoading(query.trim().length >= 2);
    if (query.trim().length < 2) {
      return;
    }

    const timer = setTimeout(() => {
      void projectsApi
        .search(query.trim())
        .then((r) => {
          if (active) {
            setResults(r);
          }
        })
        .catch(() => {
          if (active) {
            setError(t("search.unavailable"));
          }
        })
        .finally(() => {
          if (active) {
            setLoading(false);
          }
        });
    }, 250);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [query]);

  return (
    <div
      className="project-search"
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) {
          setOpen(false);
        }
      }}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          setOpen(false);
          e.stopPropagation();
        }
      }}
    >
      <label className="field">
        <span>{t("search.projectOrClient")}</span>
        <input
          aria-label={t("search.clientOrCode")}
          aria-expanded={open}
          aria-controls="project-search-results"
          placeholder={t("search.projectPlaceholder")}
          maxLength={120}
          value={query}
          onFocus={() => setOpen(true)}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
        />
      </label>
      {open && (
        <div
          className="search-popover"
          id="project-search-results"
          aria-label={t("search.suggestions")}
        >
          <div role="status">
            {query.trim().length < 2
              ? t("search.minimumLength")
              : loading
                ? t("search.searching")
                : error ||
                  (!results.length
                    ? t("search.noResults")
                    : t("search.results", { count: results.length }))}
          </div>
          {results.map((r) => (
            <button
              type="button"
              key={`${r.kind}-${r.id}`}
              onPointerDown={(e) => e.preventDefault()}
              onClick={() => {
                select(r);
                setQuery("");
                setOpen(false);
              }}
            >
              <small>
                {r.kind === "project" ? t("projects.project") : t("roles.client")}
                {r.code && ` · ${r.code}`}
              </small>
              <strong>{r.name}</strong>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
