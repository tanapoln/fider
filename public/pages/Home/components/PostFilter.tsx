import React, { useCallback, useEffect, useRef, useState } from "react"
import { PostStatus, Tag, User } from "@fider/models"
import { Checkbox, Dropdown, Icon, Avatar, UserName } from "@fider/components"
import { HStack } from "@fider/components/layout"
import HeroIconFilter from "@fider/assets/images/heroicons-filter.svg"
import IconX from "@fider/assets/images/heroicons-x.svg"
import { useFider } from "@fider/hooks"
import { http } from "@fider/services"
import { i18n } from "@lingui/core"
import { FilterState } from "./PostsContainer"

import "./PostFilter.scss"

type FilterType = "tag" | "status" | "myVotes" | "noTags" | "myPosts"

interface OptionItem {
  value: string | boolean
  label: string
  count?: number
  type: FilterType
}

interface PostFilterProps {
  activeFilter: FilterState
  countPerStatus: { [key: string]: number }
  filtersChanged: (filter: FilterState) => void
  tags: Tag[]
}

export interface FilterItem {
  type: FilterType
  value: string | boolean
}

const FilterStateToFilterItems = (filterState: FilterState): FilterItem[] => {
  const filterItems: FilterItem[] = []
  filterState.statuses.forEach((s) => {
    filterItems.push({ type: "status", value: s })
  })
  filterState.tags.forEach((t) => {
    filterItems.push({ type: "tag", value: t })
  })
  if (filterState.myVotes) {
    filterItems.push({ type: "myVotes", value: true })
  }
  if (filterState.noTags) {
    filterItems.push({ type: "noTags", value: true })
  }
  if (filterState.myPosts) {
    filterItems.push({ type: "myPosts", value: true })
  }
  return filterItems
}

const FilterItemsToFilterState = (filterItems: FilterItem[]): FilterState => {
  const filterState: FilterState = { tags: [], statuses: [], myVotes: false, noTags: false, myPosts: false }
  filterItems.forEach((i) => {
    if (i.type === "tag") {
      filterState.tags.push(i.value as string)
    } else if (i.type === "status") {
      filterState.statuses.push(i.value as string)
    } else if (i.type === "myVotes") {
      filterState.myVotes = true
    } else if (i.type === "noTags") {
      filterState.noTags = true
    } else if (i.type === "myPosts") {
      filterState.myPosts = true
    }
  })
  return filterState
}

export const PostFilter = (props: PostFilterProps) => {
  const fider = useFider()

  const filterItems: FilterItem[] = FilterStateToFilterItems(props.activeFilter)
  const [query, setQuery] = useState("")
  const [userQuery, setUserQuery] = useState("")
  const [userResults, setUserResults] = useState<User[]>([])
  const [isSearchingUsers, setIsSearchingUsers] = useState(false)
  const userSearchTimerRef = useRef<number>()
  const userSearchRequestRef = useRef(0)

  const isCollaborator = fider.session.isAuthenticated && fider.session.user.isCollaborator

  const searchUsers = useCallback((q: string) => {
    setUserQuery(q)
    window.clearTimeout(userSearchTimerRef.current)
    if (q.length < 2) {
      setUserResults([])
      setIsSearchingUsers(false)
      return
    }
    setIsSearchingUsers(true)
    const requestId = ++userSearchRequestRef.current
    userSearchTimerRef.current = window.setTimeout(async () => {
      const result = await http.get<{ users: User[] }>(`/api/v1/users?query=${encodeURIComponent(q)}&limit=5`)
      if (requestId !== userSearchRequestRef.current) return
      if (result.ok) {
        setUserResults(result.data.users)
      }
      setIsSearchingUsers(false)
    }, 300)
  }, [])

  useEffect(() => {
    return () => window.clearTimeout(userSearchTimerRef.current)
  }, [])

  const handleChangeFilter = (item: OptionItem) => () => {
    const exists = filterItems.find((i) => i.type === item.type && i.value === item.value)
    const newFilter = exists
      ? filterItems.filter((i) => !(i.type === item.type && i.value === item.value))
      : [...filterItems, { type: item.type, value: item.value }]

    props.filtersChanged(FilterItemsToFilterState(newFilter))
    setQuery("")
  }

  const handleSelectVotedByUser = (user: User) => () => {
    const currentState = FilterItemsToFilterState(filterItems)
    currentState.votedByUser = { id: user.id, name: user.name }
    props.filtersChanged(currentState)
    setUserQuery("")
    setUserResults([])
  }

  const handleClearVotedByUser = () => {
    const currentState = FilterItemsToFilterState(filterItems)
    currentState.votedByUser = undefined
    props.filtersChanged(currentState)
  }

  const options: OptionItem[] = []

  if (fider.session.isAuthenticated) {
    options.push({ value: true, label: i18n._({ id: "home.postfilter.option.myvotes", message: "My Votes" }), type: "myVotes" })
    options.push({ value: true, label: i18n._({ id: "home.postfilter.option.myposts", message: "My Posts" }), type: "myPosts" })
  }

  PostStatus.All.filter((s) => s.filterable && props.countPerStatus[s.value]).forEach((s) => {
    const id = `enum.poststatus.${s.value.toString()}`
    options.push({
      label: i18n._(id, { message: s.title }),
      value: s.value,
      count: props.countPerStatus[s.value],
      type: "status",
    })
  })

  // Add Pending status for collaborators and admins
  if (fider.session.isAuthenticated && fider.session.user.isCollaborator) {
    options.push({
      label: "Pending",
      value: "pending",
      type: "status",
    })
  }

  if (props.tags.length > 0) {
    options.push({
      value: true,
      label: i18n._({ id: "home.postfilter.option.notags", message: "Untagged" }),
      type: "noTags",
    })

    props.tags.forEach((t) => {
      options.push({
        label: t.name,
        value: t.slug,
        type: "tag",
      })
    })
  }

  const filterCount = filterItems.length + (props.activeFilter.votedByUser ? 1 : 0)
  const filteredOptions = options.filter((option) => option.label.toLowerCase().includes(query.toLowerCase()))

  const FilterGroupSection = ({ title, type }: { title: string; type: string[] }) => {
    const options = filteredOptions.filter((o) => type.includes(o.type))

    if (options.length === 0) return null

    return (
      <>
        <div className="p-2 text-medium uppercase">{title}</div>

        {options.map((o) => {
          const isChecked = filterItems.some((f) => f.type === o.type && f.value === o.value)
          const fieldKey = `${o.type}:${o.value.toString()}`

          return (
            <Dropdown.ListItem onClick={handleChangeFilter(o)} key={fieldKey}>
              <Checkbox field={fieldKey} checked={isChecked}>
                <HStack spacing={2}>
                  <span className={isChecked ? "text-semibold" : ""}>{o.label}</span>
                  {o.count && o.count > 0 && <span className="bg-gray-200 inline-block rounded-full px-1 w-min-4 text-2xs text-center">{o.count}</span>}
                </HStack>
              </Checkbox>
            </Dropdown.ListItem>
          )
        })}
      </>
    )
  }

  const UserVotesSection = () => {
    if (!isCollaborator) return null

    return (
      <>
        <div className="p-2 text-medium uppercase">{i18n._({ id: "home.postfilter.label.uservotes", message: "User's Votes" })}</div>
        {props.activeFilter.votedByUser && (
          <Dropdown.ListItem onClick={handleClearVotedByUser}>
            <HStack spacing={2}>
              <span className="text-semibold">{props.activeFilter.votedByUser.name}</span>
              <Icon sprite={IconX} className="h-4" />
            </HStack>
          </Dropdown.ListItem>
        )}
        {!props.activeFilter.votedByUser && (
          <>
            <div className="px-2 pb-1">
              <input
                type="text"
                value={userQuery}
                onChange={(e) => searchUsers(e.target.value)}
                className="c-input filter-input"
                placeholder={i18n._({ id: "home.postfilter.uservotes.placeholder", message: "Search users..." })}
                onClick={(e) => e.stopPropagation()}
              />
            </div>
            {isSearchingUsers && <div className="px-2 py-1 text-muted text-xs">...</div>}
            {!isSearchingUsers &&
              userResults.map((user) => (
                <Dropdown.ListItem key={user.id} onClick={handleSelectVotedByUser(user)}>
                  <HStack spacing={2}>
                    <Avatar user={user} />
                    <UserName user={user} />
                  </HStack>
                </Dropdown.ListItem>
              ))}
            {!isSearchingUsers && userQuery.length >= 2 && userResults.length === 0 && (
              <div className="px-2 py-1 text-muted text-xs">{i18n._({ id: "home.postfilter.uservotes.noresults", message: "No users found" })}</div>
            )}
          </>
        )}
      </>
    )
  }

  return (
    <HStack className="mr-4">
      <Dropdown
        onToggled={() => {
          setQuery("")
          setUserQuery("")
          setUserResults([])
        }}
        renderHandle={
          <HStack className="c-post-filter-btn">
            <Icon sprite={HeroIconFilter} className="h-5 pr-1" />
            {i18n._({ id: "home.filter.label", message: "Filter" })}
            {filterCount > 0 && <div className="bg-gray-200 inline-block rounded-full px-2 py-1 w-min-4 text-2xs text-center">{filterCount}</div>}
          </HStack>
        }
      >
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="c-input filter-input"
          placeholder={i18n._({ id: "home.filter.search.label", message: "Search in filters..." })}
        />

        <FilterGroupSection title={i18n._({ id: "home.postfilter.label.myactivity", message: "My activity" })} type={["myVotes", "myPosts"]} />

        <UserVotesSection />

        <FilterGroupSection title={i18n._({ id: "home.postfilter.label.status", message: "Status" })} type={["status"]} />

        <FilterGroupSection title={i18n._({ id: "label.tags", message: "Tags" })} type={["noTags", "tag"]} />
      </Dropdown>
    </HStack>
  )
}
