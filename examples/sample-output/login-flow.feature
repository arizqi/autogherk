@login @authentication
Feature: User Login
  As a registered user, I want to log in to the application so that I can access my dashboard.

  Background:
    Given the user is on the login page

  @smoke
  Scenario: Successfully log in with valid credentials
    Given the user has a valid account
    When the user enters their email "user@example.com"
    And the user enters their password
    And the user clicks the login button
    Then the user should be redirected to the dashboard
    And the user should see a welcome message

  @regression
  Scenario Outline: Login with invalid credentials
    When the user enters email <email> and password <password>
    And the user clicks the login button
    Then the user should see the error message <error>
    And the user should remain on the login page

    Examples:
      | email              | password | error                          |
      | invalid@test.com   | wrong    | Invalid email or password      |
      |                    | pass123  | Email is required              |
      | user@example.com   |          | Password is required           |

  @regression @accessibility
  Scenario: Submit login form with Enter key
    Given the user has a valid account
    When the user enters their email "user@example.com"
    And the user enters their password
    And the user presses Enter
    Then the user should be redirected to the dashboard
