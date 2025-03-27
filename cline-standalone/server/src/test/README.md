# Cline Standalone Server Tests

This directory contains tests for the Cline Standalone server. The tests are organized into:

- `unit/`: Unit tests for individual components
- `integration/`: Integration tests that test multiple components together
- `mocks/`: Mock implementations used in tests

## MCP Tests

The Model Context Protocol (MCP) functionality is tested at multiple levels:

### Unit Tests

- `unit/mcp/config.test.ts`: Tests for the MCP configuration manager
- `unit/mcp/protocol.test.ts`: Tests for the MCP JSON-RPC protocol implementation
- `unit/mcp/hub.test.ts`: Tests for the MCP hub that coordinates multiple servers

### Integration Tests

- `integration/agent-mcp.test.ts`: Integration tests for the AgentService with MCP functionality

### Mock MCP Server

The tests use a mock MCP server implementation in `mocks/mock-mcp-server.ts` which simulates an MCP server for testing purposes. This server:

- Responds to JSON-RPC protocol messages
- Implements core MCP methods (listTools, callTool, listResources, etc.)
- Can be configured to simulate various error conditions

## Running Tests

Run all tests:
```
npm test
```

Run only unit tests:
```
npm run test:unit
```

Run only integration tests:
```
npm run test:integration
```

Run only MCP-related tests:
```
npm run test:mcp
```

## Adding New Tests

When adding new MCP tests:

1. For unit tests, add them to the appropriate file in `unit/mcp/`
2. For integration tests, add them to `integration/agent-mcp.test.ts` or create a new file
3. If you need to extend the mock server capabilities, modify `mocks/mock-mcp-server.ts`

## Mock Server Configuration

The mock MCP server can be configured with the following options:

- `setDelay(ms)`: Add a delay to responses to test timeout handling
- `setFailRequests(true)`: Make all requests fail with errors
- `setTimeout(true)`: Make requests never respond to test timeout handling
- `setCrash(true)`: Make the server process exit unexpectedly

These options can be set during test setup or via command line arguments when running the mock server directly.
