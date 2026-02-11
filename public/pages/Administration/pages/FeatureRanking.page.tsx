import { PostStatus } from "@fider/models"
import { compile, EvalFunction } from "mathjs"
import React, { useMemo, useState } from "react"
import { AdminPageContainer } from "../components/AdminBasePage"

interface RankedPost {
  id: number
  number: number
  title: string
  slug: string
  status: string
  votesCount: number
  commentsCount: number
  customFieldSums: Record<string, number>
}

interface FeatureRankingPageProps {
  posts: RankedPost[]
}

type SortField = "title" | "votesCount" | "commentsCount" | "score" | string
type SortDir = "asc" | "desc"

// Normalize a custom field key to a safe mathjs identifier (letters, digits, underscores)
const normalizeKey = (key: string): string => {
  const normalized = key
    .replace(/[^a-zA-Z0-9_]/g, "_")
    .replace(/_{2,}/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/^([0-9])/, "_$1")
  return normalized || "field"
}

const getInitialFormula = (): string => {
  if (typeof window !== "undefined") {
    return localStorage.getItem("featureRankingFormula") || "votes + comments"
  }
  return "votes + comments"
}

const FeatureRankingPage = (props: FeatureRankingPageProps) => {
  const [sortField, setSortField] = useState<SortField>("score")
  const [sortDir, setSortDir] = useState<SortDir>("desc")
  const [formula, setFormula] = useState<string>(getInitialFormula)

  // Collect all unique custom field keys and build a mapping from original key to normalized identifier
  const { customFieldKeys, keyToIdentifier } = useMemo(() => {
    const keys = new Set<string>()
    for (const post of props.posts) {
      if (post.customFieldSums) {
        for (const key of Object.keys(post.customFieldSums)) {
          keys.add(key)
        }
      }
    }
    const sorted = Array.from(keys).sort()
    const mapping: Record<string, string> = {}
    for (const key of sorted) {
      mapping[key] = normalizeKey(key)
    }
    return { customFieldKeys: sorted, keyToIdentifier: mapping }
  }, [props.posts])

  // Compute sorted posts and any formula error as pure derived data (no setState in useMemo)
  const { sortedPosts, formulaError } = useMemo(() => {
    let error = ""
    let compiledExpr: EvalFunction | undefined
    try {
      compiledExpr = compile(formula)
    } catch (e) {
      error = `Invalid formula: ${e}`
    }

    const withScores = props.posts.map((post) => {
      let score = 0
      if (compiledExpr && !error) {
        const scope: Record<string, number> = {
          votes: post.votesCount,
          comments: post.commentsCount,
        }
        // Use normalized keys in scope
        for (const [origKey, normKey] of Object.entries(keyToIdentifier)) {
          scope[normKey] = post.customFieldSums[origKey] ?? 0
        }
        try {
          score = compiledExpr.evaluate(scope)
        } catch (e) {
          error = `Error evaluating formula: ${e}`
          score = 0
        }
      }
      return { ...post, score }
    })

    const sorted = withScores.sort((a, b) => {
      let valA: string | number
      let valB: string | number

      if (sortField === "title") {
        valA = a.title.toLowerCase()
        valB = b.title.toLowerCase()
      } else if (sortField === "score") {
        valA = a.score
        valB = b.score
      } else if (sortField === "votesCount") {
        valA = a.votesCount
        valB = b.votesCount
      } else if (sortField === "commentsCount") {
        valA = a.commentsCount
        valB = b.commentsCount
      } else {
        valA = a.customFieldSums[sortField] ?? 0
        valB = b.customFieldSums[sortField] ?? 0
      }

      if (valA < valB) return sortDir === "asc" ? -1 : 1
      if (valA > valB) return sortDir === "asc" ? 1 : -1
      return 0
    })

    return { sortedPosts: sorted, formulaError: error }
  }, [props.posts, sortField, sortDir, keyToIdentifier, formula])

  const handleFormulaChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (typeof window !== "undefined") {
      localStorage.setItem("featureRankingFormula", e.target.value)
    }
    setFormula(e.target.value)
  }

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(sortDir === "asc" ? "desc" : "asc")
    } else {
      setSortField(field)
      setSortDir("desc")
    }
  }

  const sortIndicator = (field: string) => {
    if (sortField !== field) return ""
    return sortDir === "asc" ? " ▲" : " ▼"
  }

  const getStatusName = (status: string): string => {
    try {
      return PostStatus.Get(status).title
    } catch {
      return status
    }
  }

  // Build list of available identifiers for the formula
  const availableIdentifiers = ["votes", "comments", ...Object.values(keyToIdentifier)]

  return (
    <AdminPageContainer id="p-admin-ranking" name="ranking" title="Feature Ranking" subtitle="Prioritize features based on votes, comments, and custom fields">
      <div className="mb-4">
        <h2 className="text-display">Score Formula</h2>
        <p className="text-muted mb-2">Enter a math expression to compute the score for each post.</p>
        <div>
          <label style={{ display: "flex", flexDirection: "column", fontSize: "0.875rem" }}>
            <span>
              <strong>Formula</strong>
            </span>
            <input
              onChange={handleFormulaChange}
              value={formula}
              style={{
                width: "500px",
                padding: "4px 8px",
                border: formulaError ? "1px solid var(--colors-red-500)" : "1px solid var(--colors-gray-300)",
                borderRadius: "4px",
                fontSize: "0.875rem",
              }}
            />
          </label>
          {formulaError && <p style={{ color: "var(--colors-red-500)", marginTop: "4px", fontSize: "0.875rem" }}>{formulaError}</p>}
          <p style={{ color: "var(--colors-gray-500)", marginTop: "4px", marginBottom: "0", fontSize: "0.8rem" }}>
            Available identifiers: <code>{availableIdentifiers.join(", ")}</code>
          </p>
          {customFieldKeys.some((key) => key !== keyToIdentifier[key]) && (
            <p style={{ color: "var(--colors-gray-500)", marginTop: "2px", fontSize: "0.8rem" }}>
              Custom field mapping:{" "}
              {customFieldKeys
                .filter((key) => key !== keyToIdentifier[key])
                .map((key) => `"${key}" → ${keyToIdentifier[key]}`)
                .join(", ")}
            </p>
          )}
        </div>
      </div>

      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.875rem" }}>
          <thead>
            <tr style={{ borderBottom: "2px solid var(--colors-gray-300)", textAlign: "left" }}>
              <th style={{ padding: "8px", cursor: "pointer", whiteSpace: "nowrap" }} onClick={() => handleSort("title")}>
                Title{sortIndicator("title")}
              </th>
              <th style={{ padding: "8px", textAlign: "center" }}>Status</th>
              <th style={{ padding: "8px", cursor: "pointer", textAlign: "right", whiteSpace: "nowrap" }} onClick={() => handleSort("votesCount")}>
                votes{sortIndicator("votesCount")}
              </th>
              <th style={{ padding: "8px", cursor: "pointer", textAlign: "right", whiteSpace: "nowrap" }} onClick={() => handleSort("commentsCount")}>
                comments{sortIndicator("commentsCount")}
              </th>
              {customFieldKeys.map((key) => (
                <th key={key} style={{ padding: "8px", cursor: "pointer", textAlign: "right", whiteSpace: "nowrap" }} onClick={() => handleSort(key)}>
                  Σ {key}
                  {sortIndicator(key)}
                </th>
              ))}
              <th style={{ padding: "8px", cursor: "pointer", textAlign: "right", whiteSpace: "nowrap" }} onClick={() => handleSort("score")}>
                Score{sortIndicator("score")}
              </th>
            </tr>
          </thead>
          <tbody>
            {sortedPosts.map((post) => (
              <tr key={post.id} style={{ borderBottom: "1px solid var(--colors-gray-200)" }}>
                <td style={{ padding: "8px" }}>
                  <a href={`/posts/${post.number}/${post.slug}`} style={{ color: "var(--colors-primary-base)" }}>
                    {post.title}
                  </a>
                </td>
                <td style={{ padding: "8px", textAlign: "center" }}>{getStatusName(post.status)}</td>
                <td style={{ padding: "8px", textAlign: "right" }}>{post.votesCount}</td>
                <td style={{ padding: "8px", textAlign: "right" }}>{post.commentsCount}</td>
                {customFieldKeys.map((key) => (
                  <td key={key} style={{ padding: "8px", textAlign: "right" }}>
                    {post.customFieldSums[key] ?? 0}
                  </td>
                ))}
                <td style={{ padding: "8px", textAlign: "right", fontWeight: 600 }}>{post.score}</td>
              </tr>
            ))}
            {sortedPosts.length === 0 && (
              <tr>
                <td colSpan={4 + customFieldKeys.length + 1} style={{ padding: "16px", textAlign: "center", color: "var(--colors-gray-500)" }}>
                  No posts found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </AdminPageContainer>
  )
}

export default FeatureRankingPage
