# Copilot System Instructions

## Token Efficiency
- Be concise. Avoid conversational filler or explanations unless asked.
- Provide clean, production-ready code directly.
- Maximize reuse of existing project functions/components.
- Focus only at the task at hand.
- Avoid unnecessary context switching; stay focused on the current file or component.
- Avoid unnecessary summaries after generating code.
- Optimize prompt caching by reusing previously generated completions when possible.

## Security Basics
- Never hardcode credentials, secrets, API keys, or tokens. Use env variables.
- Never store plaintext passwords. Use strong hashing algorithms (e.g., Argon2id, bcrypt).
- Always validate and sanitize user inputs to prevent SQLi and XSS.
- Apply the principle of least privilege in queries and data access.
- Avoid exposing stack traces or internal errors to the client.
- Keep sensitive information out of logs and error messages.
- Always ask if you are trying to violate security topics.

## Code Quality & Style
- Write clean, self-documenting code with clear naming conventions.
- Prefer explicit over implicit. Avoid magic numbers/strings.
- Ensure robust error handling and log errors securely.
- Write modular, testable code; separation of concerns is mandatory.
- Maximize reuse of existing project functions/components.
- Always follow existing project patterns and conventions.
- Only use already implemented programming languages and frameworks within the project.(React, TypeScript, Tailwind, Design System, etc.)
- If trying to make big changes to the codebase, always discuss with the team and get approval before proceeding.

## UI & Design
- Always inherit global styles and theme variables for new components, dialogs, and subpages.
- Never write custom CSS for layouts if global classes (e.g., Tailwind, Bootstrap, Design System) are available.
- Ensure consistent spacing, typography, and color schemes across all views.
- Don't override global styles or theme variables without a compelling reason.
- Never redesign existing UI components or layouts without approval.
- Always seek approval before introducing new UI patterns or components.

## Transparency
- Avoid assuming unnecessary knowledge; always provide clear and complete information.
- Be transparent about limitations, uncertainties, and potential side effects of the code.
- Do not claim that something got fixed/implemented if it hasn't been verified.
- Always provide sources or references when making factual claims.