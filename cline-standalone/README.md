# Cline Standalone

A standalone web application version of the Cline VSCode extension, allowing access to the autonomous coding agent from any browser.

## Overview

This project transforms the VSCode-specific Cline extension into a web application that can be accessed from any browser, without requiring VSCode installation. The application preserves the core functionality of Cline while providing a similar user experience through a web interface.

## Architecture

The application consists of two main parts:

```
cline-standalone/
├── client/              # React frontend application
│   ├── package.json
│   ├── vite.config.ts
│   ├── index.html
│   └── src/
│       ├── App.tsx
│       ├── components/  # UI components
│       │   ├── chat/
│       │   ├── settings/
│       │   └── welcome/
│       ├── context/     # State management
│       └── types.ts
│
└── server/              # Node.js/Express backend
    ├── package.json
    ├── tsconfig.json
    └── src/
        ├── index.ts     # Main server file
        └── services/
            └── agent.ts # Core agent logic
```

### Client

- React-based frontend application
- Communicates with the server using WebSockets via Socket.IO
- Provides UI for interacting with the Cline agent
- Handles state management using React Context API

### Server

- Node.js/Express backend
- Contains the core Cline agent functionality
- Provides tool implementations for file operations, command execution, etc.
- Communicates with AI models (Claude, etc.) for generating responses

## Features

- **Autonomous coding agent** - Create and edit files, run commands, and execute complex tasks
- **File operations** - Read, write, and search files in the user's filesystem
- **Command execution** - Run CLI commands and get real-time output
- **API configuration** - Configure different AI providers (Anthropic, etc.)
- **Task history** - Track past tasks and their results

## Getting Started

### Prerequisites

- Node.js (version 18 or later)
- npm or yarn

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd cline-standalone
```

2. Install dependencies for both client and server:
```bash
# Install server dependencies
cd server
npm install

# Install client dependencies
cd ../client
npm install
```

### Running the Application

1. Start the server:
```bash
cd server
npm run dev
```

2. In a separate terminal, start the client:
```bash
cd client
npm run dev
```

3. Open your browser and go to http://localhost:3000

## Usage

1. **Configure API Settings**:
   - Click on "Configure Settings" on the welcome screen
   - Enter your AI provider (Anthropic, OpenAI, etc.) and API key

2. **Start a New Task**:
   - Click on "Start a New Task" on the welcome screen
   - Type your task or request in the chat input field
   - The agent will process your request and execute the necessary actions

3. **View Results**:
   - The agent's responses, tool usage, and results will be displayed in the chat interface

## Differences from VSCode Extension

While this standalone version preserves most of the core functionality of the Cline VSCode extension, there are some differences:

- No direct integration with VSCode editor (highlighting, document manipulation, etc.)
- More streamlined browser-based interface for file operations
- Changes to the file system are made via the server rather than VSCode's file system API
- Some VSCode-specific functionality has been removed or simplified

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License
