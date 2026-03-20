# Backend Documentation Index

This folder now includes AI integration material for the backend team.

## Read First
- `AI_Backend_Integration_Guide.md`: practical integration steps and flow.
- `AI_API_Contract.md`: request/response contract to keep implementation stable.

## Ready-To-Use Examples
- `examples/ai_client_python.py`: Python client for `/ai/parse`.
- `examples/ai_client_node.mjs`: Node.js client for `/ai/parse`.

## Suggested Team Workflow
1. Read integration guide.
2. Implement client in backend service layer.
3. Add confirmation state machine for sensitive intents.
4. Validate against API contract examples.
