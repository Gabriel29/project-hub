import "./TeamPage.css";

import {
  Check,
  ChevronDown,
  KeyRound,
  LoaderCircle,
  Mail,
  MoreHorizontal,
  Phone,
  Plus,
  Search,
  ShieldCheck,
  ShieldOff,
  UserCheck,
  Users,
  X,
} from "lucide-react";
import { type MouseEvent, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "../components/Button";
import { PageHead } from "../components/PageHead";
import { t } from "../i18n";
import { roleLabel, searchText } from "../logic/navigation";
import type { Portal } from "../logic/usePortal";
import type { User } from "../types/portal";

type TeamPageProps = Pick<Portal["people"], "generateLink" | "disableUser" | "revokeUser"> & {
  user: User;
  people: User[];
  peopleLoading: boolean;
  busy: boolean;
  setModal: (modal: string) => void;
};
type StatusFilter = "all" | "active" | "pending" | "disabled";
type RoleFilter = "all" | "Owner" | "Admin" | "Client";

function accountStatus(person: User): Exclude<StatusFilter, "all"> {
  if (person.disabled) {
    return "disabled";
  }

  if (!person.hasPassword) {
    return "pending";
  }

  return "active";
}

function PersonActions({ person, portal }: { person: User; portal: TeamPageProps }) {
  const { user, busy, generateLink, disableUser, revokeUser } = portal;
  const client = person.roles.includes("Client");
  const canManage = !person.roles.includes("Owner") && (user.roles.includes("Owner") || client);
  const canGenerateLink = canManage && !person.disabled;
  const [expiredLink, setExpiredLink] = useState<string | null>(null);
  const linkExpiry = person.activeLinkExpiresAt;
  useEffect(() => {
    if (!linkExpiry) {
      return;
    }

    const delay = Date.parse(linkExpiry) - Date.now();
    if (delay <= 0) {
      return;
    }

    const timer = window.setTimeout(
      () => setExpiredLink(linkExpiry),
      Math.min(delay + 1, 2_147_483_647),
    );

    return () => window.clearTimeout(timer);
  }, [linkExpiry]);

  function closeMenu(event: MouseEvent<HTMLButtonElement>) {
    event.currentTarget.closest("details")?.removeAttribute("open");
  }

  if (!canManage && !canGenerateLink) {
    return (
      <span className="people-account-note">
        <ShieldCheck size={14} aria-hidden="true" />
        {person.id === user.id ? t("users.yourAccount") : t("users.ownerManaged")}
      </span>
    );
  }

  return (
    <div className="people-actions">
      {canGenerateLink && (
        <Button secondary disabled={busy} onClick={() => void generateLink(person)}>
          <KeyRound size={14} aria-hidden="true" />
          {person.hasPassword ? t("auth.resetPassword") : t("links.generateActivation")}
        </Button>
      )}
      <details
        className="people-action-menu"
        onBlur={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget)) {
            event.currentTarget.removeAttribute("open");
          }
        }}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.currentTarget.removeAttribute("open");
            event.currentTarget.querySelector("summary")?.focus();
            event.stopPropagation();
          }
        }}
      >
        <summary aria-label={t("common.itemMenu", { name: person.displayName })}>
          <MoreHorizontal size={19} aria-hidden="true" />
        </summary>
        <div className="people-action-popover">
          {canGenerateLink &&
            person.activeLinkExpiresAt &&
            expiredLink !== person.activeLinkExpiresAt &&
            Date.parse(person.activeLinkExpiresAt) > Date.now() && (
              <button
                type="button"
                disabled={busy}
                onClick={(event) => {
                  closeMenu(event);
                  void revokeUser(person);
                }}
              >
                <KeyRound size={15} aria-hidden="true" /> {t("links.revoke")}
              </button>
            )}
          {canManage && (
            <button
              type="button"
              className={person.disabled ? "" : "people-deactivate"}
              disabled={busy}
              onClick={(event) => {
                closeMenu(event);
                void disableUser(person);
              }}
            >
              {person.disabled ? (
                <UserCheck size={15} aria-hidden="true" />
              ) : (
                <ShieldOff size={15} aria-hidden="true" />
              )}
              {person.disabled ? t("common.activate") : t("common.deactivate")}
            </button>
          )}
        </div>
      </details>
    </div>
  );
}

export function TeamPage(portal: TeamPageProps) {
  useTranslation();
  const { people, peopleLoading, setModal, user } = portal;
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [role, setRole] = useState<RoleFilter>("all");
  const normalizedQuery = searchText(query);
  const totals = { all: people.length, active: 0, pending: 0, disabled: 0 };
  for (const person of people) {
    totals[accountStatus(person)]++;
  }

  const filteredPeople = people.filter((person) => {
    if (status !== "all" && accountStatus(person) !== status) {
      return false;
    }

    if (role !== "all" && !person.roles.includes(role)) {
      return false;
    }

    return (
      !normalizedQuery ||
      searchText(
        [person.displayName, person.clientName, person.email, person.phoneNumber]
          .filter(Boolean)
          .join(" "),
      ).includes(normalizedQuery)
    );
  });
  const metrics = [
    { key: "all", label: "users.total", Icon: Users },
    { key: "active", label: "users.activeAccounts", Icon: UserCheck },
    { key: "pending", label: "users.pending", Icon: KeyRound },
    { key: "disabled", label: "users.disabled", Icon: ShieldOff },
  ] as const;
  const filters = [
    ["all", "users.allPeople"],
    ["active", "users.active"],
    ["pending", "users.pending"],
    ["disabled", "users.disabled"],
  ] as const;

  function clearFilters() {
    setQuery("");
    setRole("all");
    setStatus("all");
  }

  return (
    <section className="people-page" aria-label={t("users.directory")}>
      <p className="people-eyebrow">
        <Users size={14} aria-hidden="true" /> {t("users.accessDirectory")}
      </p>
      <PageHead
        className="people-header"
        title={t("users.title")}
        description={t("users.description")}
        action={
          <Button onClick={() => setModal("new-user")}>
            <Plus size={17} aria-hidden="true" /> {t("users.add")}
          </Button>
        }
      />
      <div className="people-summary" aria-label={t("users.summary")}>
        {metrics.map(({ key, label, Icon }) => (
          <div className={`people-metric people-metric-${key}`} key={key}>
            <span className="people-metric-icon">
              <Icon size={19} aria-hidden="true" />
            </span>
            <div>
              <strong>{peopleLoading ? "—" : totals[key]}</strong>
              <span>{t(label)}</span>
            </div>
          </div>
        ))}
      </div>
      <div className="people-toolbar">
        <label className="people-search">
          <Search size={18} aria-hidden="true" />
          <span className="visually-hidden">{t("users.search")}</span>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t("users.searchPlaceholder")}
            type="search"
          />
          {query && (
            <button type="button" aria-label={t("users.clearSearch")} onClick={() => setQuery("")}>
              <X size={16} />
            </button>
          )}
        </label>
        <label className="people-role-filter">
          <span>{t("users.filterRole")}</span>
          <select value={role} onChange={(event) => setRole(event.target.value as RoleFilter)}>
            <option value="all">{t("users.allRoles")}</option>
            {(["Owner", "Admin", "Client"] as const).map((value) => (
              <option key={value} value={value}>
                {roleLabel(value)}
              </option>
            ))}
          </select>
          <ChevronDown size={15} aria-hidden="true" />
        </label>
      </div>
      <div className="people-status-filters" role="group" aria-label={t("users.filterStatus")}>
        {filters.map(([value, label]) => (
          <button
            type="button"
            key={value}
            aria-pressed={status === value}
            aria-label={t(label)}
            onClick={() => setStatus(value)}
          >
            {t(label)} <span aria-hidden="true">{totals[value]}</span>
          </button>
        ))}
      </div>
      <div className="people-directory">
        <div className="people-directory-heading">
          <h2>{t("users.directory")}</h2>
          {!peopleLoading && (
            <span role="status" aria-live="polite">
              {t("users.results", { count: filteredPeople.length, total: people.length })}
            </span>
          )}
        </div>
        {peopleLoading ? (
          <div className="people-loading" role="status">
            <LoaderCircle className="spin" size={20} /> {t("users.loading")}
          </div>
        ) : filteredPeople.length === 0 ? (
          <div className="people-empty">
            <span className="people-empty-icon">
              <Users size={28} aria-hidden="true" />
            </span>
            <h3>{people.length ? t("users.noMatches") : t("users.empty")}</h3>
            <p>{people.length ? t("users.noMatchesHint") : t("users.emptyHint")}</p>
            {people.length > 0 && (
              <Button secondary onClick={clearFilters}>
                {t("users.clearFilters")}
              </Button>
            )}
          </div>
        ) : (
          <>
            <div className="people-directory-columns" aria-hidden="true">
              <span>{t("users.person")}</span>
              <span>{t("users.contact")}</span>
              <span>{t("common.access")}</span>
              <span>{t("common.actions")}</span>
            </div>
            <ul className="people-list" aria-label={t("users.directory")}>
              {filteredPeople.map((person) => {
                const state = accountStatus(person);
                const name =
                  person.displayName.trim() ||
                  person.clientName ||
                  person.email ||
                  t("users.person");
                const initials = name
                  .split(/\s+/)
                  .map((word) => word[0])
                  .slice(0, 2)
                  .join("")
                  .toLocaleUpperCase();
                const client = person.roles.includes("Client");

                return (
                  <li className={`people-row people-row-${state}`} key={person.id}>
                    <div className="people-identity">
                      <span
                        className={`people-avatar ${client ? "people-avatar-client" : "people-avatar-team"}`}
                        aria-hidden="true"
                      >
                        {initials}
                      </span>
                      <div>
                        <strong>{name}</strong>
                        {person.clientName && person.clientName !== name && (
                          <span>{person.clientName}</span>
                        )}
                        {person.id === user.id && <small>{t("users.you")}</small>}
                      </div>
                    </div>
                    <div className="people-contact">
                      {person.email && (
                        <a href={`mailto:${person.email}`} title={person.email}>
                          <Mail size={14} aria-hidden="true" />
                          <span>{person.email}</span>
                        </a>
                      )}
                      {person.phoneNumber && (
                        <a href={`tel:${person.phoneNumber.replace(/[^\d+]/g, "")}`}>
                          <Phone size={14} aria-hidden="true" />
                          <span>{person.phoneNumber}</span>
                        </a>
                      )}
                      {!person.email && !person.phoneNumber && (
                        <span className="people-no-contact">{t("users.noContact")}</span>
                      )}
                    </div>
                    <div className="people-access">
                      <span
                        className={`people-role ${client ? "people-role-client" : "people-role-team"}`}
                      >
                        {person.roles.map(roleLabel).join(", ")}
                      </span>
                      <span className={`people-status people-status-${state}`}>
                        {state === "active" && <Check size={12} aria-hidden="true" />}
                        {t(
                          state === "pending"
                            ? "users.pending"
                            : state === "disabled"
                              ? "users.disabled"
                              : "users.active",
                        )}
                      </span>
                    </div>
                    <PersonActions person={person} portal={portal} />
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </div>
    </section>
  );
}
