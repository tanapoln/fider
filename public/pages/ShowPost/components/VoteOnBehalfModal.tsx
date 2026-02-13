import React, { useEffect, useRef, useState } from "react"
import { Post, User, Vote } from "@fider/models"
import { Modal, Button, Input, Avatar, UserName, Loader } from "@fider/components"
import { actions, http } from "@fider/services"
import IconSearch from "@fider/assets/images/heroicons-search.svg"
import IconX from "@fider/assets/images/heroicons-x.svg"
import { HStack, VStack } from "@fider/components/layout"
import { i18n } from "@lingui/core"
import { Trans } from "@lingui/react/macro"
import { createUser } from "@fider/services/actions"

interface VoteOnBehalfModalProps {
  isOpen: boolean
  post: Post
  onClose: () => void
  onVoted: () => void
}

interface UserSearchResult {
  users: User[]
  totalCount: number
}

export const VoteOnBehalfModal: React.FC<VoteOnBehalfModalProps> = (props) => {
  const [query, setQuery] = useState("")
  const [users, setUsers] = useState<User[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [votingUserID, setVotingUserID] = useState<number | null>(null)
  const [votedUserIDs, setVotedUserIDs] = useState<Set<number>>(new Set())
  const [hasVoted, setHasVoted] = useState<boolean>(false)
  const searchRequestRef = useRef(0)

  useEffect(() => {
    if (props.isOpen) {
      actions.listVotes(props.post.number).then((response) => {
        if (response.ok) {
          setVotedUserIDs(new Set(response.data.map((v: Vote) => v.user.id)))
        }
      })
      searchUsers("")
    }
  }, [props.isOpen])

  const searchUsers = async (q: string) => {
    setQuery(q)

    const requestId = ++searchRequestRef.current
    setIsSearching(true)
    const result = await http.get<UserSearchResult>(`/api/v1/users?query=${encodeURIComponent(q)}&limit=50`)
    if (requestId !== searchRequestRef.current) {
      return
    }
    if (result.ok) {
      setUsers(result.data.users)
    }
    setIsSearching(false)
  }

  const handleVote = async (user: User) => {
    setVotingUserID(user.id)
    const result = await actions.addVoteOnBehalf(props.post.number, user.id)
    if (result.ok) {
      setVotedUserIDs((prev) => new Set(prev).add(user.id))
      setHasVoted(true)
    }
    setVotingUserID(null)
  }

  const closeModal = () => {
    setQuery("")
    setUsers([])
    if (hasVoted) {
      props.onVoted()
    } else {
      props.onClose()
    }
  }

  const clearSearch = () => {
    searchUsers("")
  }

  const createUserAction = async () => {
    setIsSearching(true)
    await createUser(query)
    setIsSearching(false)
    searchUsers(query)
  }

  return (
    <Modal.Window isOpen={props.isOpen} center={false} onClose={closeModal}>
      <Modal.Content>
        <Input
          field="query"
          icon={query ? IconX : IconSearch}
          onIconClick={query ? clearSearch : undefined}
          placeholder={i18n._({ id: "modal.voteonbehalf.query.placeholder", message: "Search for users by name..." })}
          value={query}
          onChange={searchUsers}
        />
        <VStack spacing={0} className="h-max-5xl overflow-auto c-votes-modal__list">
          {isSearching && <Loader />}
          {!isSearching &&
            users.map((user, index) => (
              <HStack
                key={user.id}
                justify="between"
                align="center"
                className={index % 2 === 1 ? "c-votes-modal__item c-votes-modal__item--alternate" : "c-votes-modal__item"}
              >
                <HStack spacing={4}>
                  <Avatar user={user} />
                  <VStack spacing={1}>
                    <UserName user={user} />
                  </VStack>
                </HStack>
                {votedUserIDs.has(user.id) ? (
                  <span className="text-muted text-sm">
                    <Trans id="label.voted">Voted</Trans>
                  </span>
                ) : (
                  <Button variant="secondary" size="small" onClick={() => handleVote(user)} disabled={votingUserID === user.id}>
                    <Trans id="action.vote">Vote for this idea</Trans>
                  </Button>
                )}
              </HStack>
            ))}
          {!isSearching && query.length >= 2 && users.length === 0 && (
            <p className="text-muted">
              <Trans id="modal.voteonbehalf.message.zeromatches">
                No users found matching <strong>{query}</strong>.
              </Trans>
            </p>
          )}
          {!isSearching && query.length >= 2 && users.length === 0 && (
            <Button onClick={createUserAction}>
              Click to create a user:&nbsp;<strong>{query}</strong>
            </Button>
          )}
        </VStack>
      </Modal.Content>

      <Modal.Footer>
        <Button variant="tertiary" onClick={closeModal}>
          <Trans id="action.close">Close</Trans>
        </Button>
      </Modal.Footer>
    </Modal.Window>
  )
}
