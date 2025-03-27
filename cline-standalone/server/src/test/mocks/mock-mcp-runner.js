// Mock MCP Server Runner
const path = require('path');

// We need to correctly resolve the TypeScript mock server implementation
// For the tests to work correctly, we'll load the compiled version
const { MockMcpServer } = require('./mock-mcp-server');

// Create and start the mock server
const server = new MockMcpServer();

// Configure the server behavior based on command line args
// This can be useful for testing different error scenarios
const args = process.argv.slice(2);
if (args.includes('--delay')) {
  const delayIndex = args.indexOf('--delay');
  if (delayIndex < args.length - 1) {
    server.setDelay(parseInt(args[delayIndex + 1]));
  }
}

if (args.includes('--fail')) {
  server.setFailRequests(true);
}

if (args.includes('--timeout')) {
  server.setTimeout(true);
}

if (args.includes('--crash')) {
  server.setCrash(true);
}

// Log server starting
console.error('Mock MCP server starting');

// Start the server
server.start();

// Handle process termination
process.on('SIGINT', () => {
  console.error('Mock MCP server shutting down');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.error('Mock MCP server shutting down');
  process.exit(0);
});
