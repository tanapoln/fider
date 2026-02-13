import React, { useState, useEffect, useCallback } from "react"
import { Input, Avatar, Icon, Dropdown, Pagination, Modal, Button, Form } from "@fider/components"
import { User, UserRole, UserStatus } from "@fider/models"
import IconSearch from "@fider/assets/images/heroicons-search.svg"
import IconX from "@fider/assets/images/heroicons-x.svg"
import IconDotsHorizontal from "@fider/assets/images/heroicons-dots-horizontal.svg"
import HeroIconFilter from "@fider/assets/images/heroicons-filter.svg"
import { actions, Fider, Failure } from "@fider/services"
import { AdminPageContainer } from "../components/AdminBasePage"
import { HStack, VStack } from "@fider/components/layout"

interface ManageMembersPageProps {
  users: User[]
  totalPages: number
}

interface UserListItemProps {
  user: User
  onAction: (actionName: string, user: User) => Promise<void>
}

interface UserListItemExtendedProps extends UserListItemProps {
  isLast?: boolean
}

interface CustomFieldEntry {
  key: string
  value: string
}

interface CustomFieldsModalProps {
  user: User
  isOpen: boolean
  onClose: () => void
  onSave: (user: User, fields: Record<string, string | number | boolean | null>) => Promise<boolean>
}

const parseFieldValue = (value: string): string | number | boolean | null => {
  if (value === "") return null
  if (value === "true") return true
  if (value === "false") return false
  const num = Number(value)
  if (!isNaN(num) && value.trim() !== "") return num
  return value
}

const fieldValueToString = (value: string | number | boolean | null | undefined): string => {
  if (value === null || value === undefined) return ""
  return String(value)
}

const CustomFieldsModal = (props: CustomFieldsModalProps) => {
  const [fields, setFields] = useState<CustomFieldEntry[]>([])
  const [error, setError] = useState("")

  useEffect(() => {
    if (props.isOpen) {
      const cf = props.user.customFields || {}
      const entries = Object.entries(cf).map(([key, value]) => ({
        key,
        value: fieldValueToString(value),
      }))
      if (entries.length === 0) {
        entries.push({ key: "", value: "" })
      }
      setFields(entries)
      setError("")
    }
  }, [props.isOpen, props.user])

  const addField = () => {
    setFields([...fields, { key: "", value: "" }])
  }

  const removeField = (index: number) => {
    const updated = fields.filter((_, i) => i !== index)
    if (updated.length === 0) {
      updated.push({ key: "", value: "" })
    }
    setFields(updated)
  }

  const updateField = (index: number, key: string, value: string) => {
    const updated = [...fields]
    updated[index] = { key, value }
    setFields(updated)
  }

  const handleSave = async () => {
    setError("")
    const result: Record<string, string | number | boolean | null> = {}
    for (const field of fields) {
      if (field.key.trim() === "" && field.value.trim() === "") continue
      if (field.key.trim() === "") {
        setError("Field key cannot be empty.")
        return
      }
      if (field.key.length > 100) {
        setError("Field key must have 100 characters or fewer.")
        return
      }
      if (result[field.key.trim()] !== undefined) {
        setError(`Duplicate key: "${field.key.trim()}"`)
        return
      }
      result[field.key.trim()] = parseFieldValue(field.value)
    }
    const saved = await props.onSave(props.user, result)
    if (!saved) {
      setError("Unable to save custom fields. Please check your input and try again.")
    }
  }

  return (
    <Modal.Window isOpen={props.isOpen} onClose={props.onClose} size="large">
      <Modal.Header>
        <h3>Custom Fields for {props.user.name}</h3>
      </Modal.Header>
      <Modal.Content>
        {error && <div className="text-red-700 mb-2 text-xs">{error}</div>}
        <div className="mb-2 text-muted text-xs">Values are auto-detected as number, boolean (true/false), or string. Leave value empty for null.</div>
        {fields.map((field, index) => (
          <div key={index} className="flex gap-2 mb-2 flex-items-center">
            <input
              className="c-input flex-grow"
              placeholder="Key (e.g. mrr, tier)"
              value={field.key}
              onChange={(e) => updateField(index, e.target.value, field.value)}
            />
            <input
              className="c-input flex-grow"
              placeholder="Value (e.g. 100, vip, true)"
              value={field.value}
              onChange={(e) => updateField(index, field.key, e.target.value)}
            />
            <Button variant="danger" size="small" onClick={() => removeField(index)}>
              <Icon sprite={IconX} width="14" height="14" />
            </Button>
          </div>
        ))}
        <Button variant="tertiary" size="small" onClick={addField}>
          + Add Field
        </Button>
      </Modal.Content>
      <Modal.Footer>
        <Button variant="tertiary" onClick={props.onClose}>
          Cancel
        </Button>
        <Button variant="primary" onClick={handleSave}>
          Save Custom Fields
        </Button>
      </Modal.Footer>
    </Modal.Window>
  )
}

const UserListItem = (props: UserListItemExtendedProps) => {
  const admin = props.user.role === UserRole.Administrator && <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">administrator</span>
  const collaborator = props.user.role === UserRole.Collaborator && <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">collaborator</span>
  const blocked = props.user.status === UserStatus.Blocked && <span className="text-xs bg-red-100 text-red-800 px-2 py-1 rounded">blocked</span>
  const trusted = props.user.status === UserStatus.Active && props.user.role === UserRole.Visitor && props.user.isTrusted && (
    <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">trusted member</span>
  )
  const isMember = props.user.role === UserRole.Visitor

  const customFields = props.user.customFields || {}
  const customFieldKeys = Object.keys(customFields)

  const actionSelected = (actionName: string) => () => {
    props.onAction(actionName, props.user)
  }

  return (
    <div className={`border-b border-gray-200 py-4 px-4 bg-white hover ${props.isLast ? "rounded-md-b" : ""}`}>
      <div className="grid gap-4 flex-items-center" style={{ gridTemplateColumns: "minmax(200px, 1fr) minmax(280px, 2fr) minmax(120px, 150px) 100px" }}>
        <HStack>
          <Avatar user={props.user} />
          <div className="text-subtitle">{props.user.name}</div>
        </HStack>

        <div className="text-muted nowrap" title={props.user.email}>
          {props.user.email || "No email"}
        </div>

        <div>
          {admin} {collaborator} {blocked} {trusted}
          {isMember && !blocked && !trusted && <span className="text-xs text-gray-600">member</span>}
        </div>

        <div className="flex justify-end relative">
          {Fider.session.user.id !== props.user.id && (Fider.session.user.isAdministrator || Fider.session.user.isCollaborator) && (
            <div className="relative z-10">
              <Dropdown renderHandle={<Icon sprite={IconDotsHorizontal} width="16" height="16" />}>
                {Fider.session.user.isAdministrator && !blocked && (!!collaborator || isMember) && (
                  <Dropdown.ListItem onClick={actionSelected("to-administrator")}>Promote to Administrator</Dropdown.ListItem>
                )}
                {Fider.session.user.isAdministrator && !blocked && (!!admin || isMember) && (
                  <Dropdown.ListItem onClick={actionSelected("to-collaborator")}>Promote to Collaborator</Dropdown.ListItem>
                )}
                {Fider.session.user.isAdministrator && !blocked && (!!collaborator || !!admin) && (
                  <Dropdown.ListItem onClick={actionSelected("to-visitor")}>Demote to Member</Dropdown.ListItem>
                )}
                {Fider.session.user.isAdministrator && isMember && !blocked && !props.user.isTrusted && (
                  <Dropdown.ListItem onClick={actionSelected("approve")}>Trust User</Dropdown.ListItem>
                )}
                {Fider.session.user.isAdministrator && isMember && !blocked && props.user.isTrusted && (
                  <Dropdown.ListItem onClick={actionSelected("unapprove")}>Untrust User</Dropdown.ListItem>
                )}
                {Fider.session.user.isAdministrator && isMember && !blocked && (
                  <Dropdown.ListItem onClick={actionSelected("block")}>Block User</Dropdown.ListItem>
                )}
                {Fider.session.user.isAdministrator && isMember && !!blocked && (
                  <Dropdown.ListItem onClick={actionSelected("unblock")}>Unblock User</Dropdown.ListItem>
                )}
                <Dropdown.ListItem onClick={actionSelected("custom-fields")}>Manage Custom Fields</Dropdown.ListItem>
              </Dropdown>
            </div>
          )}
        </div>
      </div>
      {customFieldKeys.length > 0 && (
        <div className="flex gap-2 mt-2 ml-10 flex-wrap">
          {customFieldKeys.map((key) => (
            <span key={key} className="text-2xs bg-gray-100 text-gray-700 px-2 py-1 rounded">
              {key}: {fieldValueToString(customFields[key])}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

export default function ManageMembersPage(props: ManageMembersPageProps) {
  const [query, setQuery] = useState("")
  const [roleFilter, setRoleFilter] = useState<UserRole | "all">("all")
  const [users, setUsers] = useState<User[]>(props.users)
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(props.totalPages)
  const [searchTimeoutId, setSearchTimeoutId] = useState<number | undefined>(undefined)
  const [customFieldsUser, setCustomFieldsUser] = useState<User | null>(null)
  const [showAddMemberModal, setShowAddMemberModal] = useState(false)
  const [newMemberName, setNewMemberName] = useState("")
  const [addMemberError, setAddMemberError] = useState<Failure>()
  const pageSize = 10

  // Initialize state from URL parameters and load first page
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search)
    const initialQuery = urlParams.get("query") || ""
    const initialRoleFilter = (urlParams.get("roles") as UserRole) || "all"
    const initialPage = parseInt(urlParams.get("page") || "1")

    setQuery(initialQuery)
    setRoleFilter(initialRoleFilter)
    setCurrentPage(initialPage)
  }, [])

  const reloadUsers = useCallback(
    async (searchQuery: string, roleFilterValue: UserRole | "all", page = 1) => {
      const params = new URLSearchParams()
      if (searchQuery) {
        params.append("query", searchQuery)
      }
      if (roleFilterValue !== "all") {
        params.append("roles", roleFilterValue.toString())
      }
      params.append("page", page.toString())
      params.append("limit", pageSize.toString())

      const response = await fetch(`/api/v1/users?${params.toString()}`)
      if (response.ok) {
        const data = await response.json()
        setUsers(data.users)
        setTotalPages(data.totalPages)
        setCurrentPage(page)
      }
    },
    [pageSize]
  )

  const handleSearchFilterChanged = useCallback(
    (newQuery: string) => {
      setQuery(newQuery)

      // Debounce the API call for search
      if (searchTimeoutId) {
        clearTimeout(searchTimeoutId)
      }

      const timeoutId = window.setTimeout(() => {
        reloadUsers(newQuery, roleFilter, 1) // Reset to page 1 when searching
      }, 300)

      setSearchTimeoutId(timeoutId)
    },
    [roleFilter, reloadUsers, searchTimeoutId]
  )

  const handleRoleFilterChanged = useCallback(
    (newRoleFilter: UserRole | "all") => {
      setRoleFilter(newRoleFilter)
      reloadUsers(query, newRoleFilter, 1) // Reset to page 1 when changing filter
    },
    [query, reloadUsers]
  )

  const clearSearch = useCallback(() => {
    if (searchTimeoutId) {
      clearTimeout(searchTimeoutId)
    }
    setQuery("")
    reloadUsers("", roleFilter, 1)
  }, [roleFilter, reloadUsers, searchTimeoutId])

  const handlePageChange = useCallback(
    (page: number) => {
      reloadUsers(query, roleFilter, page)
    },
    [query, roleFilter, reloadUsers]
  )

  const handleAction = useCallback(
    async (actionName: string, user: User) => {
      const changeRole = async (role: UserRole) => {
        const result = await actions.changeUserRole(user.id, role)
        if (result.ok) {
          user.role = role
          // Update the user in current state without full reload
          const updatedUsers = users.map((u) => (u.id === user.id ? user : u))
          setUsers(updatedUsers)
        }
      }

      const changeStatus = async (status: UserStatus) => {
        const action = status === UserStatus.Blocked ? actions.blockUser : actions.unblockUser
        const result = await action(user.id)
        if (result.ok) {
          user.status = status
          // Update the user in current state without full reload
          const updatedUsers = users.map((u) => (u.id === user.id ? user : u))
          setUsers(updatedUsers)
        }
      }

      const changeTrust = async (isTrusted: boolean) => {
        const action = isTrusted ? actions.trustUser : actions.untrustUser
        const result = await action(user.id)
        if (result.ok) {
          user.isTrusted = isTrusted
          // Update the user in current state without full reload
          const updatedUsers = users.map((u) => (u.id === user.id ? user : u))
          setUsers(updatedUsers)
        }
      }

      if (actionName === "to-collaborator") {
        await changeRole(UserRole.Collaborator)
      } else if (actionName === "to-visitor") {
        await changeRole(UserRole.Visitor)
      } else if (actionName === "to-administrator") {
        await changeRole(UserRole.Administrator)
      } else if (actionName === "block") {
        await changeStatus(UserStatus.Blocked)
      } else if (actionName === "unblock") {
        await changeStatus(UserStatus.Active)
      } else if (actionName === "approve") {
        await changeTrust(true)
      } else if (actionName === "unapprove") {
        await changeTrust(false)
      } else if (actionName === "custom-fields") {
        setCustomFieldsUser(user)
      }
    },
    [users]
  )

  const handleSaveCustomFields = useCallback(
    async (user: User, customFields: Record<string, string | number | boolean | null>): Promise<boolean> => {
      const result = await actions.setUserCustomFields(user.id, customFields)
      if (result.ok) {
        const updatedUsers = users.map((u) => (u.id === user.id ? { ...u, customFields } : u))
        setUsers(updatedUsers)
        setCustomFieldsUser(null)
        return true
      }
      return false
    },
    [users]
  )

  const handleAddMember = useCallback(async () => {
    setAddMemberError(undefined)
    const result = await actions.createUser(newMemberName)
    if (result.ok) {
      setShowAddMemberModal(false)
      setNewMemberName("")
      reloadUsers(query, roleFilter, currentPage)
    } else if (result.error) {
      setAddMemberError(result.error)
    }
  }, [newMemberName, query, roleFilter, currentPage, reloadUsers])

  const handleCloseAddMemberModal = useCallback(() => {
    setShowAddMemberModal(false)
    setNewMemberName("")
    setAddMemberError(undefined)
  }, [])

  return (
    <AdminPageContainer id="p-admin-members" name="members" title="Members" subtitle="Manage your site administrators and collaborators">
      <div className="flex gap-4 flex-items-center mb-4">
        <div className="flex-grow">
          <Input
            field="query"
            icon={query ? IconX : IconSearch}
            onIconClick={query ? clearSearch : undefined}
            placeholder="Search by name / email ..."
            value={query}
            onChange={handleSearchFilterChanged}
          />
        </div>
        <Dropdown
          renderHandle={
            <div className="flex flex-items-center h-10 text-medium text-xs rounded-md uppercase border border-gray-400 text-gray-800 p-2 px-3 hover">
              <Icon sprite={HeroIconFilter} className="h-5 pr-1" />
              Role
              {roleFilter !== "all" && <div className="bg-gray-200 inline-block rounded-full px-2 py-1 w-min-4 text-2xs text-center ml-2">1</div>}
            </div>
          }
        >
          <Dropdown.ListItem onClick={() => handleRoleFilterChanged("all")}>
            <span className={roleFilter === "all" ? "text-semibold" : ""}>All Roles</span>
          </Dropdown.ListItem>
          <Dropdown.ListItem onClick={() => handleRoleFilterChanged(UserRole.Administrator)}>
            <span className={roleFilter === UserRole.Administrator ? "text-semibold" : ""}>Administrators</span>
          </Dropdown.ListItem>
          <Dropdown.ListItem onClick={() => handleRoleFilterChanged(UserRole.Collaborator)}>
            <span className={roleFilter === UserRole.Collaborator ? "text-semibold" : ""}>Collaborators</span>
          </Dropdown.ListItem>
          <Dropdown.ListItem onClick={() => handleRoleFilterChanged(UserRole.Visitor)}>
            <span className={roleFilter === UserRole.Visitor ? "text-semibold" : ""}>Members</span>
          </Dropdown.ListItem>
        </Dropdown>
        <Button variant="primary" onClick={() => setShowAddMemberModal(true)}>
          Add Member
        </Button>
      </div>

      <Modal.Window isOpen={showAddMemberModal} onClose={handleCloseAddMemberModal} center={false} size="small">
        <Modal.Header>Add New Member</Modal.Header>
        <Modal.Content>
          <Form error={addMemberError} onSubmit={handleAddMember}>
            <Input field="name" label="Name" placeholder="Enter member name" value={newMemberName} onChange={setNewMemberName} maxLength={100} />
            <p className="text-muted">A random email will be generated for this member automatically.</p>
          </Form>
        </Modal.Content>
        <Modal.Footer>
          <Button variant="primary" onClick={handleAddMember} disabled={!newMemberName.trim()}>
            Add
          </Button>
          <Button variant="tertiary" onClick={handleCloseAddMemberModal}>
            Cancel
          </Button>
        </Modal.Footer>
      </Modal.Window>

      <VStack className="rounded-md border border-gray-200 relative">
        <div
          className="grid rounded-md-t gap-4 py-3 px-4 bg-gray-100 text-category"
          style={{ gridTemplateColumns: "minmax(200px, 1fr) minmax(280px, 2fr) minmax(120px, 150px) 100px" }}
        >
          <div>Name</div>
          <div>Email</div>
          <div>Role</div>
        </div>
        <div>
          {users.map((user, index) => (
            <UserListItem key={user.id} user={user} onAction={handleAction} isLast={index === users.length - 1} />
          ))}
        </div>
      </VStack>

      <div className="pt-4">
        <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={handlePageChange} />
      </div>

      <ul className="text-muted">
        <li>
          <strong>Administrators</strong> have full access to edit and manage content, permissions and all site settings.
        </li>
        <li>
          <strong>Collaborators</strong> can edit and manage content, but not permissions and settings.
        </li>
        <li>
          <strong>Blocked</strong> users are unable to sign into this site.
        </li>
      </ul>

      {customFieldsUser && (
        <CustomFieldsModal user={customFieldsUser} isOpen={!!customFieldsUser} onClose={() => setCustomFieldsUser(null)} onSave={handleSaveCustomFields} />
      )}
    </AdminPageContainer>
  )
}
