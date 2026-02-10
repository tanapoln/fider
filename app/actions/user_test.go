package actions_test

import (
	"context"
	"testing"

	"github.com/getfider/fider/app"
	"github.com/getfider/fider/app/actions"
	"github.com/getfider/fider/app/models/entity"
	"github.com/getfider/fider/app/models/enum"
	"github.com/getfider/fider/app/models/query"
	. "github.com/getfider/fider/app/pkg/assert"
	"github.com/getfider/fider/app/pkg/bus"
	"github.com/getfider/fider/app/pkg/rand"
)

func TestCreateUser_InvalidInput(t *testing.T) {
	RegisterT(t)

	testCases := []struct {
		expected []string
		action   *actions.CreateUser
	}{
		{
			expected: []string{"name"},
			action:   &actions.CreateUser{},
		},
		{
			expected: []string{"email"},
			action: &actions.CreateUser{
				Name:  "Jon Snow",
				Email: "helloworld",
			},
		},
		{
			expected: []string{"name", "email", "reference"},
			action: &actions.CreateUser{
				Name:      rand.String(101),
				Email:     rand.String(201),
				Reference: rand.String(101),
			},
		},
	}

	for _, testCase := range testCases {
		result := testCase.action.Validate(context.Background(), nil)
		ExpectFailed(result, testCase.expected...)
	}
}

func TestCreateUser_ValidInput(t *testing.T) {
	RegisterT(t)

	testCases := []struct {
		action *actions.CreateUser
	}{
		{
			action: &actions.CreateUser{
				Name:      "John Snow",
				Email:     "jon.snow@got.com",
				Reference: "812747824",
			},
		},
		{
			action: &actions.CreateUser{
				Name:  "John Snow",
				Email: "jon.snow@got.com",
			},
		},
		{
			action: &actions.CreateUser{
				Name:      "John Snow",
				Reference: "812747824",
			},
		},
		{
			action: &actions.CreateUser{
				Name: "John Snow",
			},
		},
	}

	for _, testCase := range testCases {
		result := testCase.action.Validate(context.Background(), nil)
		ExpectSuccess(result)
	}
}

func TestCreateUser_CollaboratorAuthorized(t *testing.T) {
	RegisterT(t)

	collaborator := &entity.User{ID: 1, Role: enum.RoleCollaborator}
	action := &actions.CreateUser{Name: "New User"}
	Expect(action.IsAuthorized(context.Background(), collaborator)).IsTrue()
}

func TestCreateUser_AdminAuthorized(t *testing.T) {
	RegisterT(t)

	admin := &entity.User{ID: 1, Role: enum.RoleAdministrator}
	action := &actions.CreateUser{Name: "New User"}
	Expect(action.IsAuthorized(context.Background(), admin)).IsTrue()
}

func TestCreateUser_VisitorNotAuthorized(t *testing.T) {
	RegisterT(t)

	visitor := &entity.User{ID: 1, Role: enum.RoleVisitor}
	action := &actions.CreateUser{Name: "New User"}
	Expect(action.IsAuthorized(context.Background(), visitor)).IsFalse()
}

func TestChangeUserRole_Unauthorized(t *testing.T) {
	RegisterT(t)

	for _, user := range []*entity.User{
		{ID: 1, Role: enum.RoleVisitor},
		{ID: 1, Role: enum.RoleCollaborator},
		{ID: 2, Role: enum.RoleAdministrator},
	} {
		action := actions.ChangeUserRole{UserID: 2}
		Expect(action.IsAuthorized(context.Background(), user)).IsFalse()
	}
}

func TestChangeUserRole_Authorized(t *testing.T) {
	RegisterT(t)

	user := &entity.User{ID: 2, Role: enum.RoleAdministrator}
	action := actions.ChangeUserRole{UserID: 1}
	Expect(action.IsAuthorized(context.Background(), user)).IsTrue()
}

func TestChangeUserRole_InvalidRole(t *testing.T) {
	RegisterT(t)

	targetUser := &entity.User{Role: enum.RoleVisitor}
	currentUser := &entity.User{Role: enum.RoleAdministrator}

	action := actions.ChangeUserRole{UserID: targetUser.ID, Role: 4}
	action.IsAuthorized(context.Background(), currentUser)
	result := action.Validate(context.Background(), currentUser)
	Expect(result.Err).Equals(app.ErrNotFound)
}

func TestChangeUserRole_InvalidUser(t *testing.T) {
	RegisterT(t)

	bus.AddHandler(func(ctx context.Context, q *query.GetUserByID) error {
		return app.ErrNotFound
	})

	currentUser := &entity.User{
		Tenant: &entity.Tenant{ID: 1},
		Role:   enum.RoleAdministrator,
	}

	ctx := context.Background()
	action := actions.ChangeUserRole{UserID: 999, Role: enum.RoleAdministrator}
	action.IsAuthorized(ctx, currentUser)
	result := action.Validate(ctx, currentUser)
	ExpectFailed(result, "userID")
}

func TestChangeUserRole_InvalidUser_Tenant(t *testing.T) {
	RegisterT(t)

	targetUser := &entity.User{
		Tenant: &entity.Tenant{ID: 1},
	}

	currentUser := &entity.User{
		Tenant: &entity.Tenant{ID: 2},
		Role:   enum.RoleAdministrator,
	}

	bus.AddHandler(func(ctx context.Context, q *query.GetUserByID) error {
		if q.UserID == targetUser.ID {
			q.Result = targetUser
			return nil
		}
		return app.ErrNotFound
	})

	action := actions.ChangeUserRole{UserID: targetUser.ID, Role: enum.RoleAdministrator}
	action.IsAuthorized(context.Background(), currentUser)
	result := action.Validate(context.Background(), currentUser)
	ExpectFailed(result, "userID")
}

func TestChangeUserRole_CurrentUser(t *testing.T) {
	RegisterT(t)

	currentUser := &entity.User{
		Tenant: &entity.Tenant{ID: 2},
		Role:   enum.RoleAdministrator,
	}

	bus.AddHandler(func(ctx context.Context, q *query.GetUserByID) error {
		if q.UserID == currentUser.ID {
			q.Result = currentUser
			return nil
		}
		return app.ErrNotFound
	})

	action := actions.ChangeUserRole{UserID: currentUser.ID, Role: enum.RoleVisitor}
	action.IsAuthorized(context.Background(), currentUser)
	result := action.Validate(context.Background(), currentUser)
	ExpectFailed(result, "userID")
}

func TestSetUserCustomFields_Unauthorized(t *testing.T) {
	RegisterT(t)

	for _, user := range []*entity.User{
		nil,
		{ID: 1, Role: enum.RoleVisitor},
	} {
		action := actions.SetUserCustomFields{UserID: 2}
		Expect(action.IsAuthorized(context.Background(), user)).IsFalse()
	}
}

func TestSetUserCustomFields_Authorized(t *testing.T) {
	RegisterT(t)

	for _, user := range []*entity.User{
		{ID: 1, Role: enum.RoleCollaborator},
		{ID: 1, Role: enum.RoleAdministrator},
	} {
		action := actions.SetUserCustomFields{UserID: 2}
		Expect(action.IsAuthorized(context.Background(), user)).IsTrue()
	}
}

func TestSetUserCustomFields_InvalidUserID(t *testing.T) {
	RegisterT(t)

	currentUser := &entity.User{
		Tenant: &entity.Tenant{ID: 1},
		Role:   enum.RoleAdministrator,
	}

	action := actions.SetUserCustomFields{UserID: 0}
	result := action.Validate(context.Background(), currentUser)
	ExpectFailed(result, "userID")
}

func TestSetUserCustomFields_UserNotFound(t *testing.T) {
	RegisterT(t)

	bus.AddHandler(func(ctx context.Context, q *query.GetUserByID) error {
		return app.ErrNotFound
	})

	currentUser := &entity.User{
		Tenant: &entity.Tenant{ID: 1},
		Role:   enum.RoleAdministrator,
	}

	action := actions.SetUserCustomFields{
		UserID:       999,
		CustomFields: map[string]interface{}{"mrr": float64(100)},
	}
	result := action.Validate(context.Background(), currentUser)
	ExpectFailed(result, "userID")
}

func TestSetUserCustomFields_ValidInput(t *testing.T) {
	RegisterT(t)

	targetUser := &entity.User{
		ID:     2,
		Tenant: &entity.Tenant{ID: 1},
	}

	bus.AddHandler(func(ctx context.Context, q *query.GetUserByID) error {
		if q.UserID == targetUser.ID {
			q.Result = targetUser
			return nil
		}
		return app.ErrNotFound
	})

	currentUser := &entity.User{
		Tenant: &entity.Tenant{ID: 1},
		Role:   enum.RoleAdministrator,
	}

	action := actions.SetUserCustomFields{
		UserID: targetUser.ID,
		CustomFields: map[string]interface{}{
			"mrr":  float64(100),
			"tier": "vip",
			"beta": true,
		},
	}
	result := action.Validate(context.Background(), currentUser)
	ExpectSuccess(result)
}

func TestSetUserCustomFields_InvalidValueType(t *testing.T) {
	RegisterT(t)

	targetUser := &entity.User{
		ID:     2,
		Tenant: &entity.Tenant{ID: 1},
	}

	bus.AddHandler(func(ctx context.Context, q *query.GetUserByID) error {
		if q.UserID == targetUser.ID {
			q.Result = targetUser
			return nil
		}
		return app.ErrNotFound
	})

	currentUser := &entity.User{
		Tenant: &entity.Tenant{ID: 1},
		Role:   enum.RoleAdministrator,
	}

	action := actions.SetUserCustomFields{
		UserID: targetUser.ID,
		CustomFields: map[string]interface{}{
			"data": []string{"a", "b"},
		},
	}
	result := action.Validate(context.Background(), currentUser)
	ExpectFailed(result, "customFields")
}

func TestSetUserCustomFields_NilCustomFields(t *testing.T) {
	RegisterT(t)

	targetUser := &entity.User{
		ID:     2,
		Tenant: &entity.Tenant{ID: 1},
	}

	bus.AddHandler(func(ctx context.Context, q *query.GetUserByID) error {
		if q.UserID == targetUser.ID {
			q.Result = targetUser
			return nil
		}
		return app.ErrNotFound
	})

	currentUser := &entity.User{
		Tenant: &entity.Tenant{ID: 1},
		Role:   enum.RoleAdministrator,
	}

	action := actions.SetUserCustomFields{
		UserID:       targetUser.ID,
		CustomFields: nil,
	}
	result := action.Validate(context.Background(), currentUser)
	ExpectSuccess(result)
}
