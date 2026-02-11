import React, { useState, useMemo } from "react"
import { AdminPageContainer } from "../components/AdminBasePage"
import { PostStatus } from "@fider/models"

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

const defaultWeights: Record<string, number> = {
  votesCount: 1,
  commentsCount: 1,
}

const FeatureRankingPage = (props: FeatureRankingPageProps) => {
  const [sortField, setSortField] = useState<SortField>("score")
  const [sortDir, setSortDir] = useState<SortDir>("desc")
  const [weights, setWeights] = useState<Record<string, number>>(defaultWeights)

  // Collect all unique custom field keys from posts
  const customFieldKeys = useMemo(() => {
    const keys = new Set<string>()
    for (const post of props.posts) {
      if (post.customFieldSums) {
        for (const key of Object.keys(post.customFieldSums)) {
          keys.add(key)
        }
      }
    }
    return Array.from(keys).sort()
  }, [props.posts])

  // Initialize weights for custom fields if not already set
  useMemo(() => {
    const newWeights = { ...weights }
    let changed = false
    for (const key of customFieldKeys) {
      if (!(key in newWeights)) {
        newWeights[key] = 0
        changed = true
      }
    }
    if (changed) {
      setWeights(newWeights)
    }
  }, [customFieldKeys])

  const computeScore = (post: RankedPost): number => {
    let score = (weights.votesCount || 0) * post.votesCount + (weights.commentsCount || 0) * post.commentsCount
    for (const key of customFieldKeys) {
      score += (weights[key] || 0) * (post.customFieldSums[key] || 0)
    }
    return Math.round(score * 100) / 100
  }

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(sortDir === "asc" ? "desc" : "asc")
    } else {
      setSortField(field)
      setSortDir("desc")
    }
  }

  const sortedPosts = useMemo(() => {
    const withScores = props.posts.map((post) => ({
      ...post,
      score: computeScore(post),
    }))

    return withScores.sort((a, b) => {
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
        // Custom field
        valA = a.customFieldSums[sortField] || 0
        valB = b.customFieldSums[sortField] || 0
      }

      if (valA < valB) return sortDir === "asc" ? -1 : 1
      if (valA > valB) return sortDir === "asc" ? 1 : -1
      return 0
    })
  }, [props.posts, sortField, sortDir, weights])

  const handleWeightChange = (field: string, value: string) => {
    const num = parseFloat(value)
    setWeights({ ...weights, [field]: isNaN(num) ? 0 : num })
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

  return (
    <AdminPageContainer id="p-admin-ranking" name="ranking" title="Feature Ranking" subtitle="Prioritize features based on votes, comments, and custom fields">
      <div className="mb-4">
        <h2 className="text-display">Score Formula Weights</h2>
        <p className="text-muted mb-2">
          Configure how each factor contributes to the overall score. Score = Σ (weight × value) for each factor.
        </p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "1rem" }}>
          <label style={{ display: "flex", flexDirection: "column", fontSize: "0.875rem" }}>
            Votes
            <input
              type="number"
              step="0.1"
              value={weights.votesCount ?? 0}
              onChange={(e) => handleWeightChange("votesCount", e.target.value)}
              style={{ width: "80px", padding: "4px 8px", border: "1px solid var(--colors-gray-300)", borderRadius: "4px" }}
            />
          </label>
          <label style={{ display: "flex", flexDirection: "column", fontSize: "0.875rem" }}>
            Comments
            <input
              type="number"
              step="0.1"
              value={weights.commentsCount ?? 0}
              onChange={(e) => handleWeightChange("commentsCount", e.target.value)}
              style={{ width: "80px", padding: "4px 8px", border: "1px solid var(--colors-gray-300)", borderRadius: "4px" }}
            />
          </label>
          {customFieldKeys.map((key) => (
            <label key={key} style={{ display: "flex", flexDirection: "column", fontSize: "0.875rem" }}>
              {key}
              <input
                type="number"
                step="0.1"
                value={weights[key] ?? 0}
                onChange={(e) => handleWeightChange(key, e.target.value)}
                style={{ width: "80px", padding: "4px 8px", border: "1px solid var(--colors-gray-300)", borderRadius: "4px" }}
              />
            </label>
          ))}
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
                Votes{sortIndicator("votesCount")}
              </th>
              <th style={{ padding: "8px", cursor: "pointer", textAlign: "right", whiteSpace: "nowrap" }} onClick={() => handleSort("commentsCount")}>
                Comments{sortIndicator("commentsCount")}
              </th>
              {customFieldKeys.map((key) => (
                <th key={key} style={{ padding: "8px", cursor: "pointer", textAlign: "right", whiteSpace: "nowrap" }} onClick={() => handleSort(key)}>
                  Σ {key}{sortIndicator(key)}
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
                    {post.customFieldSums[key] != null ? post.customFieldSums[key] : 0}
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
